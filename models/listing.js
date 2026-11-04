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
  maxGuests: {
    type: Number,
    min: 1,
    max: 30,
    default: 6,
  },
  amenities: {
    type: [String],
    enum: require("../utils/amenities"),
    default: [],
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
  // Saved after the first successful lookup so the map loads instantly next time.
  geo: {
    lat: Number,
    lng: Number,
  },
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
  await mongoose.model("Booking").deleteMany({ listing: listing._id });
  await require("../utils/cloud").destroyImage(listing.image && listing.image.filename);
  await Review.deleteMany({
    _id: { $in: listing.Reviews }
  });
});


const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
