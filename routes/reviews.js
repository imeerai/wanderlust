const express = require("express");
const router = express.Router({ mergeParams: true });
const catchAsync = require("../utils/wrapAync");
const { validateReview, isLoggedIn, reviewOwner } = require("../middleware");
const reviewController = require("../controllers/reviews");
const { writeLimiter } = require("../security");

// Create a review
router.post(
  "/",
  writeLimiter,
  isLoggedIn,
  validateReview,
  catchAsync(reviewController.createReview)
);

router.delete(
  "/:reviewId",
  writeLimiter,
  isLoggedIn,
  reviewOwner,
  catchAsync(reviewController.deleteReview)
);

module.exports = router;
