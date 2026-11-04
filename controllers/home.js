const Listing = require("../models/listing");
const { imgOf } = require("../utils/images");
const { jsonLd } = require("../utils/seo");
const Review = require("../models/reviews");
const { ratingsFor, formatPrice } = require("../utils/ratings");

// Category strip. Listings have no category field yet, so each category is matched by keywords
// in the title, description and location. A real category select can replace this later.
const CATEGORIES = [
  { key: "Mountains", re: /mountain|hill|valley|swat|hunza|murree|skardu|nathia|gali|naran|kaghan|chitral/i, path: "M3 20l6-10 4 6 3-4 5 8z", title: "Mountain stays" },
  { key: "Villas", re: /villa|mansion|estate|bungalow/i, path: "M3 11l9-7.5L21 11M5.5 9.5V20h13V9.5M10 20v-6h4v6", title: "Villas to book now" },
  { key: "Lakeside", re: /lake|river|riverside|water|dam|beach|sea/i, path: "M3 18c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 13c3 0 3-2 6-2s3 2 6 2 3-2 6-2M8 7l4-3 4 3", title: "Lakeside stays" },
  { key: "City", re: /city|apartment|studio|penthouse|flat|karachi|lahore|islamabad|rawalpindi|faisalabad|multan/i, path: "M4 21V3h8v18M12 9h8v12M7 7h2M7 11h2M7 15h2M15 13h2M15 17h2", title: "City stays" },
  { key: "Farm stays", re: /farm|cabin|cottage|garden|ranch|village/i, path: "M12 3c3 4 5 6 5 9a5 5 0 01-10 0c0-3 2-5 5-9zM12 21v-4", title: "Farm stays" },
  { key: "Family", re: /family|kids|spacious|guest house|home/i, path: "M8 11a3 3 0 100-6 3 3 0 000 6zM17 11a2.4 2.4 0 100-4.8M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14c3 0 5 2 5 5", title: "Family-friendly stays" },
  { key: "Top rated", re: null, path: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z", title: "Top rated stays" },
  { key: "Work-friendly", re: /work|wifi|wi-fi|studio|office|apartment/i, path: "M3 5h18v12H3zM8 21h8M12 17v4", title: "Work-friendly stays" },
];

const INSPIRATION = [
  { key: "Popular", re: null },
  { key: "Mountains", re: CATEGORIES[0].re },
  { key: "Cities", re: CATEGORIES[3].re },
  { key: "Farm stays", re: CATEGORIES[4].re },
];

module.exports.showHome = async (req, res) => {
  res.locals.wide = true;
  const activeCat = CATEGORIES.find((c) => c.key === req.query.cat) || CATEGORIES[0];

  const recent = await Listing.find({}, "title description location country prize image Reviews Owner")
    .sort({ _id: -1 })
    .limit(80)
    .populate("Owner", "username")
    .lean();

  const ratings = await ratingsFor(recent);
  const wl = new Set(res.locals.wishlistIds);
  const decorate = (l) => ({
    id: String(l._id),
    title: l.title,
    blob: `${l.title} ${l.description || ""} ${l.location || ""}`,
    location: l.location || "",
    image: imgOf(l),
    price: l.prize || 0,
    priceText: formatPrice(l.prize),
    host: l.Owner && l.Owner.username ? l.Owner.username : "a host",
    rating: ratings[String(l._id)] || { average: 0, count: 0 },
    saved: wl.has(String(l._id)),
    desc: l.description || "",
  });
  const cards = recent.map(decorate);
  const byRating = [...cards].sort((a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count);
  const byReviews = [...cards].sort((a, b) => b.rating.count - a.rating.count || b.rating.average - a.rating.average);

  // Row 1 follows the category strip.
  const rowA = (activeCat.key === "Top rated" ? byRating : cards.filter((c) => activeCat.re.test(c.blob))).slice(0, 12);
  const rowB1 = byRating.filter((c) => c.rating.count > 0).slice(0, 8);
  const rowB2 = cards.filter((c) => CATEGORIES[5].re.test(c.blob)).slice(0, 8);

  // Hero card + featured block: best rated listing with at least one review.
  const featured = byReviews.find((c) => c.rating.count > 0 && c.rating.average >= 4) || byRating[0] || null;
  let quote = null;
  if (featured) {
    const doc = recent.find((l) => String(l._id) === featured.id);
    const last = (doc.Reviews || []).slice(-6);
    const reviews = last.length
      ? await Review.find({ _id: { $in: last }, rating: { $gte: 4 } }).populate("author", "username").sort({ _id: -1 }).limit(1).lean()
      : [];
    if (reviews[0] && reviews[0].comment) {
      quote = { text: reviews[0].comment, by: reviews[0].author ? reviews[0].author.username : "a guest", rating: reviews[0].rating };
    }
  }

  // Destinations (from real locations)
  const groups = new Map();
  for (const c of cards) {
    if (!c.location) continue;
    const g = groups.get(c.location) || { name: c.location, count: 0, image: "" };
    g.count += 1;
    if (!g.image && c.image) g.image = c.image;
    groups.set(c.location, g);
  }
  const destinations = [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const inspiration = INSPIRATION.map((t) => ({
    key: t.key,
    items: (t.re ? destinations.filter((d) => t.re.test(d.name) || cards.some((c) => c.location === d.name && t.re.test(c.blob))) : destinations).slice(0, 8),
  }));

  res.render("listings/home", {
    pageTitle: null,
    jsonLd: jsonLd({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Wanderlust",
      url: res.locals.siteUrl,
      potentialAction: { "@type": "SearchAction", target: `${res.locals.siteUrl}/listings?location={search_term_string}`, "query-input": "required name=search_term_string" },
    }),
    categories: CATEGORIES.map((c) => ({ key: c.key, path: c.path })),
    activeCat: activeCat.key,
    rowATitle: activeCat.title,
    rowA,
    rowB1,
    rowB2,
    destinations: destinations.slice(0, 6),
    inspiration,
    featured,
    quote,
    heroImage: featured && featured.image ? featured.image : "",
  });
};

// GET /about  ->  static page; the photo collage uses real listing photos when there are any.
module.exports.showAbout = async (req, res) => {
  res.locals.wide = true;
  let photos = [];
  try {
    const rows = await Listing.find({ "image.url": { $type: "string" } }, "title image").sort({ _id: -1 }).limit(3).lean();
    photos = rows.map((l) => ({ url: l.image.url, alt: l.title }));
  } catch (e) {
    photos = [];
  }
  res.render("about", { photos, pageTitle: "About" });
};
