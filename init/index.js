if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");
const Review = require("../models/reviews.js");
const { generateListingsForUsers, generateReviewsForListings } = require("./data.js");

const mongoURL = (process.env.ATLAS_URI || "").trim();

const seedUsers = [
  {
    username: "ali_raza",
    email: "ali.raza@wanderhost.pk",
    password: "Host@123",
  },
  {
    username: "fatima_khan",
    email: "fatima.khan@wanderhost.pk",
    password: "Host@123",
  },
  {
    username: "ahmed_shah",
    email: "ahmed.shah@wanderhost.pk",
    password: "Host@123",
  },
  {
    username: "zainab_noor",
    email: "zainab.noor@wanderhost.pk",
    password: "Host@123",
  },
  {
    username: "hassan_haider",
    email: "hassan.haider@wanderhost.pk",
    password: "Host@123",
  },
];

const initDB = async () => {
  if (!mongoURL) {
    throw new Error("ATLAS_URI not found in environment.");
  }

  try {
    await mongoose.connect(mongoURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await Review.deleteMany({});
    await Listing.deleteMany({});
    await User.deleteMany({});

    const createdUsers = [];
    for (const userData of seedUsers) {
      const userDoc = new User({
        username: userData.username,
        email: userData.email,
      });
      const registeredUser = await User.register(userDoc, userData.password);
      createdUsers.push(registeredUser);
    }

    const listings = await Listing.insertMany(generateListingsForUsers(createdUsers));
    const reviewsByListing = generateReviewsForListings(listings, createdUsers);

    for (const entry of reviewsByListing) {
      const insertedReviews = await Review.insertMany(entry.reviews);
      await Listing.findByIdAndUpdate(entry.listingId, {
        $set: { Reviews: insertedReviews.map((review) => review._id) },
      });
    }

    console.log(`Seed completed: ${createdUsers.length} users, ${listings.length} listings, reviews added.`);
  } catch (err) {
    console.error("Error initializing DB:", err);
  } finally {
    await mongoose.connection.close();
  }
};

initDB();
