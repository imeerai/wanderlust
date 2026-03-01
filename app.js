// ==================== ENV SETUP ====================
process.noDeprecation = true;

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// ==================== IMPORTS ====================
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");

const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");

const passport = require("passport");
const LocalStrategy = require("passport-local");

const ExpressError = require("./utils/ExpressError");
const User = require("./models/user");

// Routes
const listingRouter = require("./routes/listings");
const reviewsRouter = require("./routes/reviews");
const userRouter = require("./routes/users");

const PORT = process.env.PORT || 8000;
const mongoURL = process.env.ATLAS_URI?.trim();
const sessionSecret = (process.env.SCREAT || process.env.SECRET || "").trim();

// ==================== DATABASE ====================
let dbConnectPromise = null;

const connectDB = async () => {
  if (!mongoURL) return;
  if (mongoose.connection.readyState === 1) return;
  if (!dbConnectPromise) {
    dbConnectPromise = mongoose
      .connect(mongoURL, { serverSelectionTimeoutMS: 10000 })
      .then(() => {
        console.log("Connected to DB");
      })
      .catch((err) => {
        console.log("❌ MongoDB Connection Error:", err);
        throw err;
      })
      .finally(() => {
        dbConnectPromise = null;
      });
  }
  await dbConnectPromise;
};

connectDB().catch((err) => {
  console.log("❌ Initial MongoDB connect failed:", err?.message || err);
});

// ==================== VIEW ENGINE ====================
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ==================== MIDDLEWARE ====================
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// ==================== SESSION STORE ===================
let store;
if (mongoURL && sessionSecret) {
  store = MongoStore.create({
    clientPromise: connectDB().then(() => mongoose.connection.getClient()),
    crypto: {
      secret: sessionSecret,
    },
    touchAfter: 24 * 60 * 60,
  });

  store.on("error", (e) => {
    console.log("❌ SESSION STORE ERROR", e);
  });
} else {
  console.log("⚠️ Mongo session store disabled (missing ATLAS_URI or SCREAT/SECRET)");
}

// ==================== SESSION CONFIG ====================
const sessionOption = {
  secret: sessionSecret || "fallback-session-secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
};

if (process.env.NODE_ENV === "production") {
  if (!sessionSecret) {
    throw new Error("Missing SCREAT or SECRET in production environment variables");
  }
  app.set("trust proxy", 1);
  sessionOption.cookie.secure = true;
  sessionOption.cookie.sameSite = "lax";
}

if (store) {
  sessionOption.store = store;
}
app.use(session(sessionOption));
app.use(flash());

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// ==================== PASSPORT ====================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ==================== GLOBAL LOCALS ====================
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// ==================== ROUTES ====================
app.get("/", async (req, res, next) => {
  try {
    res.render("listings/home");
  } catch (err) {
    next(err);
  }
});

app.get("/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    ok: dbConnected,
    db: dbConnected ? "connected" : "disconnected",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/", userRouter);
app.get("/about", (req, res) => { res.render("about"); });

// ==================== ERROR HANDLING ====================
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
  const { status = 500, message = "Something went wrong" } = err;
  res.status(status).render("error", { status, message });
});

// ==================== SERVER ====================
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
