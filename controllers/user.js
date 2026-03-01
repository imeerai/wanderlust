const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/reviews");
const passport = require("passport");

const getPlatformStats = async () => {
  const [totalUsers, totalListings, totalReviews, topReviewedListingRaw] =
    await Promise.all([
      User.countDocuments({}),
      Listing.countDocuments({}),
      Review.countDocuments({}),
      Listing.aggregate([
        {
          $project: {
            title: 1,
            location: 1,
            image: 1,
            Owner: 1,
            reviewCount: { $size: "$Reviews" },
          },
        },
        { $sort: { reviewCount: -1, _id: -1 } },
        { $limit: 1 },
      ]),
    ]);

  let topReviewedListing = null;

  if (topReviewedListingRaw.length > 0 && topReviewedListingRaw[0].reviewCount > 0) {
    const listingData = topReviewedListingRaw[0];
    const owner = await User.findById(listingData.Owner, { username: 1 }).lean();

    topReviewedListing = {
      id: String(listingData._id),
      title: listingData.title,
      location: listingData.location,
      reviewCount: listingData.reviewCount,
      imageUrl: listingData.image && listingData.image.url ? listingData.image.url : "",
      owner: owner ? owner.username : "Unknown",
    };
  }

  return {
    totalUsers,
    totalListings,
    totalReviews,
    topReviewedListing,
  };
};

module.exports.showRegisterForm = (req, res) => {
  res.render("users/register");
};

module.exports.registerUser = async (req, res) => {
  try {
    const { email, username, password } = req.body.user;
    const newUser = new User({ email, username });
    const newuserk = await User.register(newUser, password);
    // req.login(newuserk, (err) => {
    //   if (err) return next(err);
    //   req.flash("success", `Welcome! Your account is created.`);
    //   res.redirect("/login");
    // });  automatic login after registration is disabled
    req.flash("success", `Welcome! Your account is created.`);
    res.redirect("/login");
  } catch (e) {
    if (e.code === 11000 && e.keyPattern && e.keyPattern.email) {
      req.flash("error", "This email is already registered.");
      return res.redirect("/register");
    }
    req.flash("error", e.message);
    res.redirect("/register");
  }
};

module.exports.showLoginForm = (req, res) => {
  res.render("users/login");
};

module.exports.showProfile = (req, res) => {
  req.flash("success", `Welcome back`);
  let redirectUrl = res.locals.returnTo || "/listings";
  res.redirect(redirectUrl);
};

const getProfileData = async (profileUserId, currentUser) => {
  const [profileUser, userListings, platformStats] = await Promise.all([
    User.findById(profileUserId).lean(),
    Listing.find({ Owner: profileUserId }).sort({ _id: -1 }).lean(),
    getPlatformStats(),
  ]);

  if (!profileUser) {
    return null;
  }

  const isOwnProfile =
    !!currentUser && String(currentUser._id) === String(profileUser._id);

  const postCount = userListings.length;
  const totalReviewsOnPosts = userListings.reduce(
    (sum, listing) => sum + (Array.isArray(listing.Reviews) ? listing.Reviews.length : 0),
    0
  );

  const reviewIds = userListings.flatMap((listing) =>
    Array.isArray(listing.Reviews) ? listing.Reviews : []
  );

  let averageRatingOnPosts = 0;
  if (reviewIds.length > 0) {
    const ratings = await Review.find(
      { _id: { $in: reviewIds } },
      { rating: 1 }
    ).lean();

    if (ratings.length > 0) {
      const totalRating = ratings.reduce((sum, review) => sum + Number(review.rating || 0), 0);
      averageRatingOnPosts = totalRating / ratings.length;
    }
  }

  let mostReviewedPost = null;
  if (userListings.length > 0) {
    const topListing = userListings.reduce((best, current) => {
      const bestCount = Array.isArray(best.Reviews) ? best.Reviews.length : 0;
      const currentCount = Array.isArray(current.Reviews) ? current.Reviews.length : 0;
      return currentCount > bestCount ? current : best;
    });

    const topCount = Array.isArray(topListing.Reviews) ? topListing.Reviews.length : 0;
    if (topCount > 0) {
      mostReviewedPost = {
        id: String(topListing._id),
        title: topListing.title,
        location: topListing.location,
        imageUrl: topListing.image && topListing.image.url ? topListing.image.url : "",
        reviewCount: topCount,
      };
    }
  }

  const userStats = {
    postCount,
    totalReviewsOnPosts,
    averageRatingOnPosts,
    mostReviewedPost,
  };

  return {
    profileUser,
    userListings,
    platformStats,
    userStats,
    isOwnProfile,
  };
};

module.exports.showUserProfile = async (req, res) => {
  const profileData = await getProfileData(req.user._id, req.user);

  if (!profileData) {
    req.flash("error", "User profile not found.");
    return res.redirect("/listings");
  }

  res.render("users/profile", {
    user: profileData.profileUser,
    userListings: profileData.userListings,
    platformStats: profileData.platformStats,
    userStats: profileData.userStats,
    isOwnProfile: profileData.isOwnProfile,
    success: req.flash("success"),
    error: req.flash("error"),
  });
};

module.exports.showUserProfileById = async (req, res) => {
  const profileData = await getProfileData(req.params.id, req.user);

  if (!profileData) {
    req.flash("error", "User profile not found.");
    return res.redirect("/listings");
  }

  res.render("users/profile", {
    user: profileData.profileUser,
    userListings: profileData.userListings,
    platformStats: profileData.platformStats,
    userStats: profileData.userStats,
    isOwnProfile: profileData.isOwnProfile,
    success: req.flash("success"),
    error: req.flash("error"),
  });
};

module.exports.showPublicStats = async (req, res) => {
  const platformStats = await getPlatformStats();
  res.render("users/stats", { platformStats });
};

module.exports.updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { username, email, password } = req.body.user;
    user.username = username;
    user.email = email;
    if (password && password.trim() !== "") {
      await user.setPassword(password);
    }
    await user.save();
    req.flash("success", "Profile updated successfully!");
    return res.redirect("/profile");
  } catch (err) {
    req.flash("error", "Something went wrong updating profile.");
    return res.redirect("/profile");
  }
};

module.exports.deleteUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) throw new Error("User not found in session");
    await User.findByIdAndDelete(userId);

    req.logout((err) => {
      if (err) {
        req.flash("error", "Error logging out after deletion.");
        return res.redirect("/profile");
      }
      req.flash("success", "Account deleted successfully!");
      return res.redirect("/listings");
    });
  } catch (err) {
    console.log(err);
    req.flash("error", "Error deleting account.");
    return res.redirect("/profile");
  }
};

module.exports.logoutUser = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Logged out  NOW!");
    res.redirect("/listings");
  });
};
