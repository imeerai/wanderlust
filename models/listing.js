const mongoose = require("mongoose");
const Review = require("./reviews");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
  title: {
    type: String,   // ✔ Correct
    required: true,
  },
  description: String,
  image: {
    url: String,
    filename: String,
  }
  ,
  prize: {
    type: Number,
  },
  location: {
    type: String,
  },
  country: {
    type: String,
  },
  Reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  Owner:{
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  // geometry: {
  //   type: {
  //     type: String, // Don't do `{ location: { type: String } }`
  //     enum: ['Point'], // 'location.type' must be 'Point'
  //     required: true
  //   },
  //   coordinates: {
  //     type: [Number],
  //     required: true
  //   }
  // }
});

listingSchema.post("findOneAndDelete", async function (listing) {
  if (!listing) return;
  await Review.deleteMany({
    _id: { $in: listing.Reviews }
  });
});


const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
