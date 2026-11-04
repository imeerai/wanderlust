const express = require("express");
const catchAsync = require("../utils/wrapAync");
const { isLoggedIn } = require("../middleware");
const { writeLimiter } = require("../security");
const controller = require("../controllers/bookings");

// Mounted at /listings/:id/bookings
const forListing = express.Router({ mergeParams: true });
forListing.post("/", writeLimiter, isLoggedIn, catchAsync(controller.create));

// Mounted at /bookings
const own = express.Router();
own.post("/:bookingId/cancel", writeLimiter, isLoggedIn, catchAsync(controller.cancel));

module.exports = { forListing, own };
