const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const Listing = require("./listing");
const Review = require("./reviews");

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    }
});

UserSchema.pre("findOneAndDelete", async function (next) {
  try {
    const user = await this.model.findOne(this.getFilter());
    if (!user) return next();
    // 1️⃣ Delete ALL reviews written by user
    await Review.deleteMany({ author: user._id });

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

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);
