const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/wrapAync");
const ExpressError = require("../utils/ExpressError");
const { writeLimiter } = require("../security");
const { isLoggedIn } = require("../middleware");
const controller = require("../controllers/wishlist");

// Hearts call this with fetch(), so a logged-out user gets JSON, not a redirect.
const needLogin = (req, res, next) =>
  req.isAuthenticated() ? next() : next(new ExpressError(401, "Please log in to save stays."));

router.get("/", isLoggedIn, catchAsync(controller.list));
router.post("/:id/toggle", writeLimiter, needLogin, catchAsync(controller.toggle));

module.exports = router;
