const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/wrapAync");
const passport = require("passport");
const { isLoggedIn, redirectIfLoggedIn } = require("../middleware");
const userController = require("../controllers/user");

// ----------------------
// REGISTER ROUTES
// ----------------------
router.route("/register")
  .get(userController.showRegisterForm)           // Show Register Page
  .post(catchAsync(userController.registerUser)); // Register User

// ----------------------
// LOGIN ROUTES
// ----------------------
router.route("/login")
  .get(userController.showLoginForm)              // Show Login Page
  .post(
    redirectIfLoggedIn,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.showProfile                     // Login User
  );

// ----------------------
// PROFILE ROUTES
// ----------------------
router.get("/stats", catchAsync(userController.showPublicStats));

router.get("/profile", isLoggedIn, userController.showUserProfile); // Show profile

router.post("/profile/update", isLoggedIn, catchAsync(userController.updateUserProfile)); // Update profile

router.post("/profile/delete", isLoggedIn, catchAsync(userController.deleteUserProfile)); // Delete profile

router.get("/profile/:id", catchAsync(userController.showUserProfileById)); // Public profile by user id
// ----------------------
// LOGOUT ROUTE
// ----------------------
router.get("/logout", userController.logoutUser);

module.exports = router;
