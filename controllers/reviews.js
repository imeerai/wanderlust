const Review = require("../models/reviews");
const Listing = require("../models/listing");
const flash = require("connect-flash");

module.exports.createReview = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing your requested does not exist.");
    return res.redirect("/listings");
  }
  if (listing.Owner && listing.Owner.equals(req.user._id)) {
    req.flash("error", "You cannot review your own listing.");
    return res.redirect(`/listings/${listing._id}`);
  }
  const existing = await Review.exists({ _id: { $in: listing.Reviews }, author: req.user._id });
  if (existing) {
    req.flash("error", "You have already reviewed this stay.");
    return res.redirect(`/listings/${listing._id}`);
  }
  const newReview = new Review(req.body.review);
  newReview.author = req.user._id;
  listing.Reviews.push(newReview);
  await newReview.save();
  await listing.save();
  req.flash("success", "Thanks for your Review!");
  res.redirect(`/listings/${listing._id}`);
};

module.exports.deleteReview = async (req, res) => {
  const { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { Reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "Successfully deleted your review!");
  res.redirect(`/listings/${id}`);
};
