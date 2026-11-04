const mongoose = require("mongoose");
const { imgOf } = require("../utils/images");
const User = require("../models/user");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");
const { ratingsFor, formatPrice } = require("../utils/ratings");

// GET /wishlist  ->  the logged-in user's saved stays (newest save first)
module.exports.list = async (req, res) => {
  res.locals.wide = true;
  const user = await User.findById(req.user._id, { wishlist: 1 }).lean();
  const ids = (user && user.wishlist ? user.wishlist : []).map(String);
  const found = ids.length
    ? await Listing.find({ _id: { $in: ids } }, "title location prize image Reviews Owner").lean()
    : [];
  const byId = new Map(found.map((l) => [String(l._id), l]));
  const ordered = ids.slice().reverse().map((id) => byId.get(id)).filter(Boolean);

  // Quietly drop saved stays whose listing was deleted.
  if (ordered.length !== ids.length) {
    await User.updateOne({ _id: req.user._id }, { $set: { wishlist: ids.filter((id) => byId.has(id)) } });
  }

  const ratings = await ratingsFor(ordered);
  const items = ordered.map((l) => ({
    id: String(l._id),
    title: l.title,
    location: l.location || "",
    image: imgOf(l),
    price: l.prize || 0,
    priceText: formatPrice(l.prize),
    rating: ratings[String(l._id)] || { average: 0, count: 0 },
  }));
  res.render("users/wishlist", { items, pageTitle: "Wishlist" });
};

// POST /wishlist/:id/toggle  ->  { ok, saved, count }
module.exports.toggle = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ExpressError(404, "That listing does not exist.");
  const exists = await Listing.exists({ _id: id });
  if (!exists) throw new ExpressError(404, "That listing does not exist.");

  const user = await User.findById(req.user._id, { wishlist: 1 });
  const has = user.wishlist.some((x) => String(x) === String(id));
  await User.updateOne(
    { _id: req.user._id },
    has ? { $pull: { wishlist: id } } : { $addToSet: { wishlist: id } }
  );
  const count = has ? user.wishlist.length - 1 : user.wishlist.length + 1;
  res.json({ ok: true, saved: !has, count });
};
