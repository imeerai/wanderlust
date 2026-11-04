const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Listing = require("./listing");

const reviewSchema = new Schema({
    comment: String,
    rating: Number,
    created_At: {
        type: Date,
        default: Date.now,
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
});

reviewSchema.post("findOneAndDelete", async function (review) {
  if (!review) return;

  await Listing.updateMany(
    { Reviews: review._id },
    { $pull: { Reviews: review._id } }
  );
});


const Review = mongoose.model("Review", reviewSchema);
module.exports = Review;
