const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/wrapAync");
const passport = require("passport");
const { isLoggedIn } = require("../middleware");
const userController = require("../controllers/user");
const { authLimiter, writeLimiter, wantsJson } = require("../security");

// Log in with a custom callback so that bad input, wrong passwords and locked
// accounts all produce the same clean response (page redirect or JSON).
const login = (req, res, next) => {
  const { username, password } = req.body || {};
  const fail = (status, message, fields) => {
    if (wantsJson(req)) return res.status(status).json({ ok: false, status, error: message || "Please fix the highlighted fields.", fields });
    userController.renderLogin(req, res, { status, message, fields, username }).catch(next);
  };
  const u = typeof username === "string" ? username.trim() : "";
  const p = typeof password === "string" ? password : "";
  if (!u || !p || u.length > 100 || p.length > 128) {
    const fields = {};
    if (!u) fields.username = "Enter your username";
    if (!p) fields.password = "Enter your password";
    if (u.length > 100) fields.username = "That username is too long";
    if (p.length > 128) fields.password = "That password is too long";
    return fail(400, "", fields);
  }
  req.body.username = u;
  passport.authenticate("local", { keepSessionInfo: true }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      const locked = info && /locked/i.test(info.message || "");
      return fail(401, locked
        ? "Too many wrong attempts, so this account is paused for 15 minutes. Please try again later."
        : "That username or password isn't right. Check them and try again.");
    }
    req.logIn(user, { keepSessionInfo: true }, (e) => (e ? next(e) : userController.loginSuccess(req, res)));
  })(req, res, next);
};

// ----------------------
// REGISTER ROUTES
// ----------------------
router.get("/register/available", writeLimiter, catchAsync(userController.usernameAvailable));

router.route("/register")
  .get(catchAsync(userController.showRegisterForm))           // Show Register Page
  .post(authLimiter, catchAsync(userController.registerUser)); // Register User

// ----------------------
// LOGIN ROUTES
// ----------------------
router.route("/login")
  .get(catchAsync(userController.showLoginForm))   // Show Login Page
  .post(authLimiter, login);                       // Login User

// ----------------------
// PROFILE ROUTES
// ----------------------
router.get("/stats", catchAsync(userController.showPublicStats));

router.get("/profile", isLoggedIn, userController.showUserProfile); // Show profile

router.post("/profile/update", writeLimiter, isLoggedIn, catchAsync(userController.updateUserProfile)); // Update profile

router.post("/profile/delete", writeLimiter, isLoggedIn, catchAsync(userController.deleteUserProfile)); // Delete profile

router.get("/profile/:id", catchAsync(userController.showUserProfileById)); // Public profile by user id
// ----------------------
// LOGOUT ROUTE
// ----------------------
router.post("/logout", userController.logoutUser);

module.exports = router;
