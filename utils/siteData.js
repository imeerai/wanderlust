// Small in-memory cache for data every page needs (header destination suggestions).
const Listing = require("../models/listing");

let cache = { at: 0, value: [] };
const TTL = 60 * 1000;

module.exports.suggestions = async () => {
  if (Date.now() - cache.at < TTL) return cache.value;
  try {
    const rows = await Listing.aggregate([
      { $match: { location: { $type: "string", $ne: "" } } },
      { $group: { _id: "$location", count: { $sum: 1 }, image: { $first: "$image.url" } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5 },
    ]);
    cache = { at: Date.now(), value: rows.map((r) => ({ name: r._id, count: r.count, image: r.image || "" })) };
  } catch (e) {
    /* keep the old value; the header still works without suggestions */
  }
  return cache.value;
};
