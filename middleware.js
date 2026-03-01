const { listingSchema, reviewSchema } = require("./schema");
const ExpressError = require("./utils/ExpressError");
const Listing = require("./models/listing");
const Review = require("./models/reviews");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    req.flash("error", "Please login first");
    return res.redirect("/login");
  }
  next();
};

module.exports.redirectIfLoggedIn = (req, res, next) => {
  if (req.session.returnTo) {
    res.locals.returnTo = req.session.returnTo;
  }
  next();
};

module.exports.isOwner = async (req, res, next) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if (!req.user || !listing.Owner.equals(req.user._id)) {
    req.flash("error", "You do not have permission to do that.");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, msg);
  } else {
    next();
  }
};

module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, msg);
  } else {
    next();
  }
};

module.exports.reviewOwner = async (req, res, next) => {
  let { reviewId, id } = req.params;
  let review = await Review.findById(reviewId);
  if (!review) {
    req.flash("error", "Review not found.");
    return res.redirect(`/listings/${id}`);
  }
  if (!req.user || !review.author.equals(req.user._id)) {
    req.flash("error", "You do not have permission to do that.");
    return res.redirect(`/listings/${id}`);
  }
  // If everything is fine, proceed to the next middleware/controller
  next();
};

