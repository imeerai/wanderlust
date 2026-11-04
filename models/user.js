const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const Listing = require("./listing");
const Review = require("./reviews");
const Booking = require("./booking");

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 254
    },
    wishlist: [
        {
            type: Schema.Types.ObjectId,
            ref: "Listing",
        },
    ],
});

UserSchema.pre("findOneAndDelete", async function (next) {
  try {
    const user = await this.model.findOne(this.getFilter());
    if (!user) return next();
    // 1️⃣ Delete ALL reviews written by user
    const mine = await Review.find({ author: user._id }, { _id: 1 }).lean();
    await Listing.updateMany({}, { $pull: { Reviews: { $in: mine.map((r) => r._id) } } });
    await Review.deleteMany({ author: user._id });
    await Booking.deleteMany({ guest: user._id });

    // 2️⃣ Find listings owned by user
    const listings = await Listing.find({ Owner: user._id });

    // 3️⃣ Delete reviews inside each listing
    for (let listing of listings) {
      await Review.deleteMany({
        _id: { $in: listing.Reviews }
      });
    }

    // 4️⃣ Delete listings ONE BY ONE (important!)
    for (let listing of listings) {
      await Listing.findByIdAndDelete(listing._id);
    }

    next();
  } catch (err) {
    next(err);
  }
});

// limitAttempts: after 8 wrong passwords the account is locked for 15 minutes.
UserSchema.plugin(passportLocalMongoose, {
  limitAttempts: true,
  maxAttempts: 8,
  unlockInterval: 15 * 60 * 1000,
});

module.exports = mongoose.model("User", UserSchema);
