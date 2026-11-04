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
const Listing = require("./models/listing");
const security = require("./security");
const csrf = require("./csrf");

// Routes
const listingRouter = require("./routes/listings");
const reviewsRouter = require("./routes/reviews");
const userRouter = require("./routes/users");
const wishlistRouter = require("./routes/wishlist");
const bookingRoutes = require("./routes/bookings");
const { suggestions } = require("./utils/siteData");

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
app.disable("x-powered-by");
if (security.isProd) app.set("trust proxy", 1);
app.use(security.compression);
app.use(security.nonce);
app.use(security.helmetMiddleware);
app.use(express.static(path.join(__dirname, "public"), { maxAge: security.isProd ? "7d" : 0 }));
app.use(security.globalLimiter);
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(express.json({ limit: "50kb" }));
app.use(security.sanitize);
app.use(methodOverride("_method"));

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
  saveUninitialized: false,
  name: "wl.sid",
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
};

if (process.env.NODE_ENV === "production") {
  if (!sessionSecret) {
    throw new Error("Missing SCREAT or SECRET in production environment variables");
  }
  sessionOption.cookie.secure = true;
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

// ==================== CSRF ====================
app.use(csrf);

// Pages shown to a logged-in user are never stored by shared caches or the back button.
app.use((req, res, next) => {
  if (req.user) res.set("Cache-Control", "private, no-store");
  next();
});

// ==================== GLOBAL LOCALS ====================
app.use(async (req, res, next) => {
  try {
    res.locals.suggest = req.method === "GET" ? await suggestions() : [];
  } catch (e) {
    res.locals.suggest = [];
  }
  res.locals.wishlistIds = req.user && Array.isArray(req.user.wishlist) ? req.user.wishlist.map(String) : [];
  res.locals.imgOf = require("./utils/images").imgOf;
  res.locals.amenityList = require("./utils/amenities");
  res.locals.currentUser = req.user;
  res.locals.navPath = req.path;
  // SEO: canonical base, and keep personal/form pages out of search engines.
  const seo = require("./utils/seo");
  res.locals.siteUrl = seo.siteUrl(req);
  res.locals.canonicalPath = req.path === "/listings" && Number(req.query.page) > 1 ? `/listings?page=${parseInt(req.query.page, 10)}` : req.path;
  res.locals.noindex = seo.PRIVATE.test(req.path) || (req.path === "/listings" && Object.keys(req.query).some((k) => k !== "page"));
  if (res.locals.noindex) res.set("X-Robots-Tag", "noindex, nofollow");
  // Hosts see "My listings" instead of "Become a host" in the header.
  res.locals.isHost = false;
  if (req.user && req.method === "GET") {
    try { res.locals.isHost = !!(await Listing.exists({ Owner: req.user._id })); } catch (e) { /* header falls back to Become a host */ }
  }
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// ==================== ROUTES ====================
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
    ["User-agent: *", "Allow: /", "Disallow: /profile", "Disallow: /wishlist", "Disallow: /login", "Disallow: /register",
      "Disallow: /listings/new", "Disallow: /csrf-token", "Disallow: /health", "", `Sitemap: ${res.locals.siteUrl}/sitemap.xml`, ""].join("\n")
  );
});

let sitemapCache = { at: 0, base: "", xml: "" };
app.get("/sitemap.xml", require("./utils/wrapAync")(async (req, res) => {
  const base = res.locals.siteUrl;
  if (sitemapCache.xml && sitemapCache.base === base && Date.now() - sitemapCache.at < 60 * 60 * 1000) return res.type("application/xml").send(sitemapCache.xml);
  const rows = await Listing.find({}, "_id").sort({ _id: -1 }).limit(5000).lean();
  const urls = [["/", "1.0"], ["/listings", "0.9"], ["/about", "0.4"], ["/stats", "0.3"]].map(([p, pr]) => `<url><loc>${base}${p}</loc><priority>${pr}</priority></url>`)
    .concat(rows.map((r) => `<url><loc>${base}/listings/${r._id}</loc><priority>0.8</priority></url>`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  sitemapCache = { at: Date.now(), base, xml };
  res.type("application/xml").send(xml);
}));

app.get("/", require("./utils/wrapAync")(require("./controllers/home").showHome));

// For Postman: returns the token tied to your session cookie.
app.get("/csrf-token", (req, res) => res.json({ csrfToken: res.locals.csrfToken }));

app.get("/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    ok: dbConnected,
    db: dbConnected ? "connected" : "disconnected",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/wishlist", wishlistRouter);
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/listings/:id/bookings", bookingRoutes.forListing);
app.use("/bookings", bookingRoutes.own);
app.use("/", userRouter);
app.get("/about", require("./utils/wrapAync")(require("./controllers/home").showAbout));

// ==================== ERROR HANDLING ====================
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "We could not find that page."));
});

const TITLES = {
  400: "Something is not right",
  401: "Please log in",
  403: "You can't do that",
  404: "Page not found",
  405: "Method not allowed",
  409: "That is already taken",
  413: "That is too large",
  429: "Slow down",
  503: "Back in a moment",
};

// Turn known library errors into clean HTTP errors. Never leak internals.
const normalize = (err) => {
  if (err.name === "CastError") return { status: 404, message: "That item does not exist." };
  if (err.name === "ValidationError") return { status: 400, message: "Some details are missing or invalid." };
  if (err.name === "MulterError") return { status: 400, message: "That upload was rejected. Use an image under 5 MB." };
  if (err.type === "entity.too.large") return { status: 413, message: "The request was too large." };
  if (err.type === "entity.parse.failed") return { status: 400, message: "The request body could not be read." };
  // Database unreachable: tell the visitor to retry instead of showing a crash.
  if (["MongoNotConnectedError", "MongoServerSelectionError", "MongoNetworkError", "MongoNetworkTimeoutError"].includes(err.name) ||
      /buffering timed out|before initial connection is complete/i.test(err.message || "")) {
    return { status: 503, message: "We can't reach our database right now. Please try again in a minute." };
  }
  if (err.code === 11000) return { status: 409, message: "That value is already taken." };
  const status = Number(err.status || err.statusCode) || 500;
  // 4xx messages are written by us; 5xx messages stay hidden.
  const message = status < 500 && err.message ? err.message : "Something went wrong on our side. Please try again.";
  return { status, message };
};

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const { status, message } = normalize(err);
  if (status >= 500) console.error("❌", req.method, req.originalUrl, err);
  res.set("Cache-Control", "no-store");
  if (status === 503) res.set("Retry-After", "60");
  if (security.wantsJson(req)) {
    return res.status(status).json({ ok: false, status, error: message });
  }
  res.status(status).render("error", { status, title: TITLES[status] || "Something went wrong", message });
});

// ==================== SERVER ====================
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
