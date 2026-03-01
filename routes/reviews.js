const express = require("express");
const router = express.Router({ mergeParams: true });
const catchAsync = require("../utils/wrapAync");
const { validateReview, isLoggedIn, reviewOwner } = require("../middleware");
const reviewController = require("../controllers/reviews");

// Create a review
router.post(
  "/",
  isLoggedIn,
  validateReview,
  catchAsync(reviewController.createReview)
);

router.delete(
  "/:reviewId",
  isLoggedIn,
  reviewOwner,
  catchAsync(reviewController.deleteReview)
);

module.exports = router;
