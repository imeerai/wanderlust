const Review = require("../models/reviews");

// One query for all listings: { listingId: { average, count } }
module.exports.ratingsFor = async (listings) => {
  const ids = listings.flatMap((l) => l.Reviews || []);
  const rows = ids.length ? await Review.find({ _id: { $in: ids } }, { rating: 1 }).lean() : [];
  const byId = new Map(rows.map((r) => [String(r._id), r.rating]));
  const out = {};
  for (const l of listings) {
    const vals = (l.Reviews || []).map((rid) => byId.get(String(rid))).filter((v) => typeof v === "number");
    const count = vals.length;
    out[String(l._id)] = { count, average: count ? vals.reduce((a, b) => a + b, 0) / count : 0 };
  }
  return out;
};

module.exports.formatPrice = (n) => Number(n || 0).toLocaleString("en-US");
