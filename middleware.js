const { listingSchema, reviewSchema } = require("./schema");
const ExpressError = require("./utils/ExpressError");
const Listing = require("./models/listing");
const Review = require("./models/reviews");
const { discardUpload } = require("./utils/cloud");
const { wantsJson } = require("./security");

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
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) throw new ExpressError(404, "That listing does not exist.");
    req.listing = listing;
    if (!req.user || !listing.Owner.equals(req.user._id)) {
      req.flash("error", "You do not have permission to do that.");
      return res.redirect(`/listings/${id}`);
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Shows the form again with the problems listed and the user's input kept.
const rejectListing = async (req, res, messages) => {
  await discardUpload(req.file);
  if (wantsJson(req)) return res.status(400).json({ ok: false, status: 400, error: messages.join(" "), fields: messages });
  const body = (req.body && req.body.listing) || {};
  const L = {
    title: typeof body.title === "string" ? body.title : "",
    location: typeof body.location === "string" ? body.location : "",
    country: typeof body.country === "string" ? body.country : "Pakistan",
    prize: body.prize === undefined ? "" : String(body.prize).slice(0, 12),
    maxGuests: body.maxGuests === undefined ? 6 : String(body.maxGuests).slice(0, 3),
    description: typeof body.description === "string" ? body.description : "",
    amenities: [].concat(body.amenities || []).filter((a) => typeof a === "string"),
    imageUrl: req.listing && req.listing.image ? req.listing.image.url || "" : "",
  };
  const editing = !!req.listing;
  if (editing) L.id = String(req.listing._id);
  return res.status(400).render(editing ? "listings/edit" : "listings/new", {
    L, errors: messages, pageTitle: editing ? "Edit listing" : "New listing", wide: true,
  });
};
module.exports.rejectListing = rejectListing;

module.exports.validateListing = async (req, res, next) => {
  try {
    const { error, value } = listingSchema.validate(req.body || {}, { abortEarly: false, errors: { wrap: { label: false } } });
    if (error) {
      const msgs = [...new Set(error.details.map((d) => d.message.replace(/^listing\./, "")))];
      return await rejectListing(req, res, msgs);
    }
    req.body = value;
    next();
  } catch (err) {
    next(err);
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
  try {
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
  } catch (err) {
    next(err);
  }
};

