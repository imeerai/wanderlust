const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/wrapAync");
const { isLoggedIn, validateListing, isOwner } = require("../middleware");
const listingController = require("../controllers/listing");

const multer = require("multer");
const { storage } = require("../cloudConfig");
const upload = multer({ storage });

// List all listings & Create new listing
router
  .route("/")
  .get(catchAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    catchAsync(listingController.createListing)
  );

// Render new listing form
router.get("/new", isLoggedIn, listingController.renderNewForm);

// Routes for a specific listing (show, update, delete)
router
  .route("/:id")
  .get(catchAsync(listingController.showListing)) // Show listing
  .put(
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"),
    validateListing,
    catchAsync(listingController.updateListing)
  ) // Update listing
  .delete(isLoggedIn, isOwner, catchAsync(listingController.deleteListing));

// Edit form for a specific listing
router
  .route("/:id/edit")
  .get(isLoggedIn, isOwner, catchAsync(listingController.renderEditForm));

module.exports = router;
