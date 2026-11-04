// Lightweight CSRF protection: one random token per session.
// Send it as a hidden "_csrf" field, a "?_csrf=" query param (multipart forms),
// or an "x-csrf-token" header (Postman / fetch). Needs no new env vars.
const crypto = require("crypto");
const ExpressError = require("./utils/ExpressError");

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

const same = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

module.exports = (req, res, next) => {
  if (!req.session) return next(new ExpressError(500, "Session unavailable"));
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.locals.csrfToken = req.session.csrfToken;
  if (SAFE.has(req.method)) return next();
  const sent = (req.body && req.body._csrf) || req.query._csrf || req.get("x-csrf-token");
  if (!same(sent, req.session.csrfToken)) {
    return next(new ExpressError(403, "Your session expired or the form was invalid. Please go back, refresh and try again."));
  }
  next();
};
