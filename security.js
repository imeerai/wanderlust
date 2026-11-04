// Central security setup. Nothing here reads new env vars, so .env stays as it is.
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");

const isProd = process.env.NODE_ENV === "production";

// Clients like Postman or curl ask for JSON; browsers get an HTML error page.
const wantsJson = (req) =>
  req.xhr ||
  (req.headers.accept || "").includes("application/json") ||
  (req.headers["content-type"] || "").includes("application/json");

// One nonce per request, used by inline <script nonce="..."> tags.
const nonce = (req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
};

const helmetMiddleware = (req, res, next) =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com", (rq, rs) => `'nonce-${rs.locals.nonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'", "data:", "blob:",
          "https://res.cloudinary.com", "https://images.unsplash.com", "https://i.pravatar.cc",
          "https://upload.wikimedia.org", "https://raw.githubusercontent.com",
          "https://unpkg.com", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com",
        ],
        connectSrc: ["'self'", "https://nominatim.openstreetmap.org", "https://router.project-osrm.org"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false, // Leaflet tiles and Cloudinary images are cross-origin
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  })(req, res, next);

const limitHandler = (message) => (req, res) => {
  const status = 429;
  if (wantsJson(req)) return res.status(status).json({ ok: false, status, error: message });
  res.status(status).render("error", { status, title: "Slow down", message });
};

const limiter = (opts) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: limitHandler(opts.message),
    ...opts,
  });

// Rate limits. Static files are served before these run.
const globalLimiter = limiter({
  windowMs: 15 * 60 * 1000, limit: 400,
  message: "Too many requests from your network. Please wait a few minutes and try again.",
});
const authLimiter = limiter({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  message: "Too many login or sign-up attempts. Please try again in 15 minutes.",
});
const writeLimiter = limiter({
  windowMs: 15 * 60 * 1000, limit: 60,
  message: "You are making changes too quickly. Please wait a few minutes.",
});

// Strip "$" and "." keys (NoSQL injection) and duplicate query params (HPP).
const sanitize = [
  mongoSanitize({ replaceWith: "_" }),
  hpp({ whitelist: ["amenities"] }),
];

module.exports = {
  isProd, wantsJson, nonce, helmetMiddleware, compression: compression(),
  globalLimiter, authLimiter, writeLimiter, sanitize,
};
