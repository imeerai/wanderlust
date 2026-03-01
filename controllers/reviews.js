const Review = require("../models/reviews");
const Listing = require("../models/listing");
const flash = require("connect-flash");

module.exports.createReview = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing your requested does not exist.");
    return res.redirect("/listings");
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
