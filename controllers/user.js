const User = require("../models/user");
const { imgOf } = require("../utils/images");
const Listing = require("../models/listing");
const Review = require("../models/reviews");
const passport = require("passport");
const ExpressError = require("../utils/ExpressError");
const { validateSignup, safeReturnTo } = require("../utils/authRules");
const { wantsJson } = require("../security");

// A real listing photo for the split-screen hero; falls back to a dark gradient.
const heroFor = async () => {
  try {
    const l = await Listing.findOne({ "image.url": { $type: "string" } }, "title location image")
      .sort({ _id: -1 })
      .lean();
    return l ? { url: l.image.url, caption: [l.title, l.location].filter(Boolean).join(", ") } : { url: require("../utils/images").fallbackFor("auth"), caption: "A Wanderlust stay" };
  } catch (e) {
    return null;
  }
};

// The stats page is public, so cache the numbers for a minute instead of hitting the DB on every request.
let statsCache = { at: 0, data: null };
const getPlatformStats = async () => {
  if (statsCache.data && Date.now() - statsCache.at < 60 * 1000) return statsCache.data;
  const data = await computePlatformStats();
  statsCache = { at: Date.now(), data };
  return data;
};

const computePlatformStats = async () => {
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
            reviewCount: { $size: { $ifNull: ["$Reviews", []] } },
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
      imageUrl: imgOf(listingData),
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

module.exports.showRegisterForm = async (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/listings");
  res.render("users/register", { hero: await heroFor(), errors: {}, values: {}, pageTitle: "Sign up" });
};

module.exports.registerUser = async (req, res) => {
  const { values, errors } = validateSignup(req.body && req.body.user);
  const fail = async (status, errs, message) => {
    if (wantsJson(req)) return res.status(status).json({ ok: false, status, error: message || "Please fix the highlighted fields.", fields: errs });
    res.status(status).render("users/register", {
      hero: await heroFor(),
      errors: errs,
      values: { username: values.username, email: values.email },
      pageTitle: "Sign up",
    });
  };
  if (Object.keys(errors).length) return fail(400, errors);

  try {
    await User.register(new User({ email: values.email, username: values.username }), values.password);
  } catch (e) {
    if (e.name === "UserExistsError" || (e.code === 11000 && e.keyPattern && e.keyPattern.username)) {
      return fail(409, { username: "That username is already taken" }, "That username is already taken.");
    }
    if (e.code === 11000 && e.keyPattern && e.keyPattern.email) {
      return fail(409, { email: "This email is already registered" }, "This email is already registered.");
    }
    throw e; // anything else becomes a clean 500 page; details stay in server logs
  }
  if (wantsJson(req)) return res.status(201).json({ ok: true, message: "Account created. You can log in now." });
  req.flash("success", "Welcome! Your account is created. Please log in.");
  res.redirect("/login");
};

// One place that draws the login page, so a failed attempt keeps the username and shows what went wrong.
module.exports.renderLogin = async (req, res, opts = {}) => {
  res.status(opts.status || 200).render("users/login", {
    hero: await heroFor(),
    formError: opts.message || "",
    fields: opts.fields || {},
    values: { username: typeof opts.username === "string" ? opts.username.slice(0, 100) : "" },
    pageTitle: "Log in",
  });
};

module.exports.showLoginForm = async (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/listings");
  await module.exports.renderLogin(req, res);
};

// Live "is this username free?" check for the sign-up form. Usernames are public (@name), so this reveals nothing private.
module.exports.usernameAvailable = async (req, res) => {
  res.set("Cache-Control", "no-store");
  const name = typeof req.query.username === "string" ? req.query.username.trim() : "";
  if (!USERNAME_RE.test(name)) return res.status(400).json({ ok: false, error: "Use 4 to 30 characters: lowercase letters, numbers, . or _" });
  const taken = await User.exists({ username: name });
  res.json({ ok: true, available: !taken });
};

// Runs after passport.authenticate succeeded (passport already rotated the session id).
module.exports.loginSuccess = (req, res) => {
  const dest = safeReturnTo(req.session.returnTo);
  delete req.session.returnTo;
  if (wantsJson(req)) return res.json({ ok: true, redirect: dest });
  req.flash("success", "Welcome back");
  res.redirect(dest);
};

const mongoose = require("mongoose");
const Booking = require("../models/booking");
const { passwordError, EMAIL_RE, USERNAME_RE, str } = require("../utils/authRules");

const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};
const shortDay = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Everything the profile page needs. Never hands password hash/salt to a view,
// and only the owner ever gets their email address.
const getProfileData = async (profileUserId, currentUser) => {
  if (!mongoose.isValidObjectId(profileUserId)) return null;
  const profileUser = await User.findById(profileUserId, { username: 1, email: 1 }).lean();
  if (!profileUser) return null;
  const isOwnProfile = !!currentUser && String(currentUser._id) === String(profileUser._id);

  const userListings = await Listing.find({ Owner: profileUser._id }, "title location country prize image Reviews").sort({ _id: -1 }).lean();
  const reviewIds = userListings.flatMap((l) => (Array.isArray(l.Reviews) ? l.Reviews : []));
  const ratings = reviewIds.length ? await Review.find({ _id: { $in: reviewIds } }, { rating: 1 }).lean() : [];
  const avg = ratings.length ? ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / ratings.length : 0;

  let top = null;
  for (const l of userListings) {
    const n = Array.isArray(l.Reviews) ? l.Reviews.length : 0;
    if (n > 0 && (!top || n > top.reviewCount)) {
      top = { id: String(l._id), title: l.title, location: l.location, imageUrl: imgOf(l), reviewCount: n };
    }
  }

  let trips = [];
  if (isOwnProfile) {
    const today = todayUTC();
    const rows = await Booking.find({ guest: profileUser._id }).sort({ checkIn: -1 }).limit(50)
      .populate("listing", "title location image").lean();
    trips = rows.filter((b) => b.listing).map((b) => ({
      id: String(b._id),
      listingId: String(b.listing._id),
      title: b.listing.title,
      location: b.listing.location || "",
      image: imgOf(b.listing),
      range: `${shortDay(b.checkIn)} - ${shortDay(b.checkOut)} ${b.checkOut.getUTCFullYear()}`,
      nights: b.nights, guests: b.guests, total: Number(b.total || 0).toLocaleString("en-US"),
      status: b.status,
      upcoming: b.status === "confirmed" && b.checkOut > today,
      canCancel: b.status === "confirmed" && b.checkIn > today,
    }));
  }

  return {
    profile: {
      id: String(profileUser._id),
      username: profileUser.username,
      email: isOwnProfile ? profileUser.email : "",
      since: profileUser._id.getTimestamp().toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }),
    },
    isOwnProfile,
    listings: userListings.map((l) => ({
      id: String(l._id), title: l.title, location: l.location || "",
      image: imgOf(l), price: Number(l.prize || 0).toLocaleString("en-US"),
    })),
    stats: { posts: userListings.length, reviews: reviewIds.length, average: avg, top },
    trips,
  };
};

const renderProfile = async (req, res, id) => {
  res.locals.wide = true;
  const data = await getProfileData(id, req.user);
  if (!data) throw new ExpressError(404, "That profile does not exist.");
  res.render("users/profile", { ...data, pageTitle: data.isOwnProfile ? "My profile" : `@${data.profile.username}` });
};

module.exports.showUserProfile = (req, res) => renderProfile(req, res, req.user._id);
module.exports.showUserProfileById = (req, res) => renderProfile(req, res, req.params.id);

module.exports.showPublicStats = async (req, res) => {
  res.locals.wide = true;
  const platformStats = await getPlatformStats();
  res.render("users/stats", { platformStats, pageTitle: "Platform stats" });
};

// Changing the email or password needs the current password (stops a hijacked session from locking you out).
const checkCurrentPassword = async (user, current) => {
  if (!current || current.length > 128) return false;
  const { user: ok } = await user.authenticate(current);
  return !!ok;
};

const profileFail = (req, res, status, message) => {
  if (wantsJson(req)) return res.status(status).json({ ok: false, status, error: message });
  req.flash("error", message);
  return res.redirect("/profile");
};

module.exports.updateUserProfile = async (req, res) => {
  const body = (req.body && req.body.user) || {};
  const email = str(body.email).trim().toLowerCase();
  const newPassword = str(body.password);
  const current = str(body.current);

  if (email.length > 254 || !EMAIL_RE.test(email)) return profileFail(req, res, 400, "Enter a valid email address.");
  if (newPassword) {
    const msg = passwordError(newPassword);
    if (msg) return profileFail(req, res, 400, `New password: ${msg}.`);
  }
  const user = await User.findById(req.user._id);
  if (!user) throw new ExpressError(404, "That profile does not exist.");
  if (email === user.email && !newPassword) return profileFail(req, res, 400, "There is nothing to update.");
  if (!(await checkCurrentPassword(user, current))) return profileFail(req, res, 403, "Your current password is incorrect.");

  try {
    user.email = email;
    if (newPassword) await user.setPassword(newPassword);
    await user.save();
  } catch (e) {
    if (e.code === 11000) return profileFail(req, res, 409, "This email is already registered.");
    throw e;
  }
  if (wantsJson(req)) return res.json({ ok: true, message: "Profile updated." });
  req.flash("success", "Profile updated successfully!");
  return res.redirect("/profile");
};

module.exports.deleteUserProfile = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ExpressError(404, "That profile does not exist.");
  if (!(await checkCurrentPassword(user, str(req.body && req.body.password)))) {
    return profileFail(req, res, 403, "Your password is incorrect, so the account was not deleted.");
  }
  await User.findByIdAndDelete(user._id); // also removes their listings, reviews and bookings
  req.logout((err) => {
    if (err) return next(err);
    if (wantsJson(req)) return res.json({ ok: true, message: "Account deleted." });
    req.flash("success", "Your account was deleted.");
    res.redirect("/listings");
  });
};

module.exports.logoutUser = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Logged out  NOW!");
    res.redirect("/listings");
  });
};
