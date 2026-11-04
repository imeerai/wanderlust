const Listing = require("../models/listing");
const { imgOf } = require("../utils/images");
const { snippet, jsonLd } = require("../utils/seo");
const Review = require("../models/reviews");
const mongoose = require("mongoose");
const ExpressError = require("../utils/ExpressError");
const { bookedRanges } = require("./bookings");
const AMENITIES = require("../utils/amenities");
const { formatPrice } = require("../utils/ratings");
// const mbxGeoCoding = require("@mapbox/mapbox-sdk/services/geocoding");
// const mapBoxToken = process.env.MAPBOX_TOKEN;
// const geocodingClient = mbxGeoCoding({ accessToken: mapBoxToken });

module.exports.index = async (req, res) => {
  const PER_PAGE = 12;
  const q = req.query;
  const clean = (v) => (typeof v === "string" ? v.trim() : "");
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const location = clean(q.location).slice(0, 80);
  const country = clean(q.country).slice(0, 60);
  const maxPrice = Math.min(Number(q.maxPrice) || 0, 10000000);
  const minRating = [3.5, 4, 4.5].includes(Number(q.minRating)) ? Number(q.minRating) : 0;
  const picked = [].concat(q.amenities || []).filter((a) => AMENITIES.includes(a));
  const sort = ["recent", "rated", "priceAsc", "priceDesc"].includes(q.sort) ? q.sort : "recent";
  const page = Math.max(parseInt(q.page, 10) || 1, 1);

  const match = {};
  if (location) match.$or = [{ location: { $regex: escapeRe(location), $options: "i" } }, { title: { $regex: escapeRe(location), $options: "i" } }];
  if (country) match.country = country;
  if (maxPrice > 0) match.prize = { $lte: maxPrice };
  if (picked.length) match.amenities = { $all: picked };

  const sortStage = {
    recent: { _id: -1 },
    rated: { avg: -1, reviewCount: -1, _id: -1 },
    priceAsc: { prize: 1, _id: -1 },
    priceDesc: { prize: -1, _id: -1 },
  }[sort];

  const [result] = await Listing.aggregate([
    { $match: match },
    { $lookup: { from: Review.collection.name, localField: "Reviews", foreignField: "_id", as: "revs" } },
    { $addFields: { avg: { $ifNull: [{ $avg: "$revs.rating" }, 0] }, reviewCount: { $size: "$revs" } } },
    ...(minRating ? [{ $match: { avg: { $gte: minRating } } }] : []),
    { $project: { revs: 0, description: 0 } },
    { $sort: sortStage },
    { $facet: { total: [{ $count: "n" }], rows: [{ $skip: (page - 1) * PER_PAGE }, { $limit: PER_PAGE }] } },
  ]);

  const total = result.total[0] ? result.total[0].n : 0;
  const totalPages = Math.max(Math.ceil(total / PER_PAGE), 1);
  const currentPage = Math.min(page, totalPages);
  let rows = result.rows;
  if (currentPage !== page) {
    return res.redirect(`/listings?${new URLSearchParams({ ...req.query, page: String(currentPage) }).toString()}`);
  }

  const wl = new Set(res.locals.wishlistIds || []);
  const stays = rows.map((l) => ({
    id: String(l._id),
    title: l.title,
    location: l.location || "",
    image: imgOf(l),
    price: l.prize || 0,
    priceText: formatPrice(l.prize),
    rating: { average: l.avg || 0, count: l.reviewCount || 0 },
    saved: wl.has(String(l._id)),
  }));

  // Query string for sort chips and pagination links (everything except "page").
  const keep = new URLSearchParams();
  if (location) keep.set("location", location);
  if (country) keep.set("country", country);
  if (maxPrice > 0) keep.set("maxPrice", String(maxPrice));
  if (minRating) keep.set("minRating", String(minRating));
  picked.forEach((a) => keep.append("amenities", a));
  const withSort = (s) => { const p = new URLSearchParams(keep); if (s !== "recent") p.set("sort", s); return p.toString(); };
  const base = new URLSearchParams(keep); if (sort !== "recent") base.set("sort", sort);

  res.locals.wide = true;
  res.render("listings/index", {
    pageTitle: "All stays in Pakistan",
    metaDesc: "Browse every Wanderlust stay: villas, apartments and farm stays across Pakistan, with prices per night and real guest reviews.",
    stays,
    total,
    currentPage,
    totalPages,
    pageSize: PER_PAGE,
    sort,
    sortLinks: ["recent", "rated", "priceAsc", "priceDesc"].map((s) => ({ key: s, qs: withSort(s) })),
    pageQs: base.toString(),
    amenityList: AMENITIES,
    selectedFilters: { location, country, maxPrice: maxPrice > 0 ? maxPrice : "", minRating, amenities: picked, sort },
    filterCount: (maxPrice > 0 ? 1 : 0) + (minRating ? 1 : 0) + picked.length,
  });
};

const { discardUpload, destroyImage } = require("../utils/cloud");
const { rejectListing } = require("../middleware");

// Only these fields can ever be written from a form.
const pick = (l) => ({
  title: l.title,
  description: l.description,
  location: l.location,
  country: l.country,
  prize: l.prize,
  maxGuests: l.maxGuests,
  amenities: l.amenities,
});

module.exports.renderNewForm = (req, res) => {
  res.locals.wide = true;
  res.render("listings/new", {
    L: { title: "", location: "", country: "Pakistan", prize: "", maxGuests: 6, description: "", amenities: [], imageUrl: "" },
    errors: [],
    pageTitle: "New listing",
  });
};

module.exports.createListing = async (req, res) => {
  if (!req.file) return rejectListing(req, res, ["Please add a photo of your place (JPG, PNG or WebP, up to 5 MB)."]);
  try {
    const newListing = new Listing(pick(req.body.listing));
    newListing.Owner = req.user._id;
    newListing.image = { url: req.file.url || req.file.path, filename: req.file.public_id || req.file.filename };
    await newListing.save();
    req.flash("success", "Your listing is live!");
    res.redirect(`/listings/${newListing._id}`);
  } catch (e) {
    await discardUpload(req.file);
    throw e;
  }
};

module.exports.renderEditForm = async (req, res) => {
  res.locals.wide = true;
  const listing = req.listing || (await Listing.findById(req.params.id));
  if (!listing) throw new ExpressError(404, "That listing does not exist.");
  res.render("listings/edit", {
    L: {
      id: String(listing._id),
      title: listing.title || "",
      location: listing.location || "",
      country: listing.country || "Pakistan",
      prize: listing.prize || "",
      maxGuests: listing.maxGuests || 6,
      description: listing.description || "",
      amenities: listing.amenities || [],
      imageUrl: listing.image && listing.image.url ? listing.image.url : "",
    },
    errors: [],
    pageTitle: "Edit listing",
  });
};

module.exports.updateListing = async (req, res) => {
  const listing = req.listing || (await Listing.findById(req.params.id));
  if (!listing) {
    await discardUpload(req.file);
    throw new ExpressError(404, "That listing does not exist.");
  }
  const oldFilename = listing.image && listing.image.filename;
  try {
    const moved = req.body.listing && (req.body.listing.location !== listing.location || req.body.listing.country !== listing.country);
    listing.set(pick(req.body.listing));
    if (moved) listing.geo = undefined;
    if (req.file) listing.image = { url: req.file.url || req.file.path, filename: req.file.public_id || req.file.filename };
    await listing.save();
  } catch (e) {
    await discardUpload(req.file);
    throw e;
  }
  if (req.file && oldFilename && oldFilename !== listing.image.filename) await destroyImage(oldFilename);
  req.flash("success", "Your changes were saved.");
  res.redirect(`/listings/${listing._id}`);
};

module.exports.deleteListing = async (req, res) => {
  const { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Successfully Deleted!");
  res.redirect("/listings");
};

// Where to put the map pin: saved result -> well-known place -> one quick outside lookup -> middle of Pakistan.
const { lookupPlace, PAKISTAN } = require("../utils/places");
const lookupOnline = async (listing) => {
  try {
    const q = `${listing.location || ""}, ${listing.country || "Pakistan"}`;
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Wanderlust/1.0" }, signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data) && data.length ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
  } catch (e) {
    return null;
  }
};
const placeFor = async (listing) => {
  const saved = listing.geo && Number.isFinite(listing.geo.lat) && Number.isFinite(listing.geo.lng) ? listing.geo : null;
  if (saved) return { ...saved, exact: true };
  const found = lookupPlace(`${listing.location} ${listing.title}`) || (listing.location ? await lookupOnline(listing) : null);
  if (found && Number.isFinite(found.lat) && Number.isFinite(found.lng)) {
    Listing.updateOne({ _id: listing._id }, { $set: { geo: found } }).catch(() => {});
    return { ...found, exact: true };
  }
  return { ...PAKISTAN, exact: false };
};

module.exports.showListing = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ExpressError(404, "That listing does not exist.");

  const listing = await Listing.findById(id).populate("Owner", "username").lean();
  if (!listing) throw new ExpressError(404, "That listing does not exist.");

  const [reviews, booked, geo, hostCount] = await Promise.all([
    Review.find({ _id: { $in: listing.Reviews } }).populate("author", "username").sort({ created_At: -1 }).lean(),
    bookedRanges(listing._id),
    placeFor(listing),
    Listing.countDocuments({ Owner: listing.Owner && listing.Owner._id }),
  ]);

  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
  const user = req.user;
  const isOwner = !!(user && listing.Owner && String(listing.Owner._id) === String(user._id));
  const hasReviewed = !!(user && reviews.some((r) => r.author && String(r.author._id) === String(user._id)));

  res.locals.wide = true;
  res.render("listings/show", {
    pageTitle: `${listing.title}${listing.location ? " in " + listing.location : ""}`,
    metaDesc: snippet(listing.description || `${listing.title} in ${listing.location || "Pakistan"}. Book on Wanderlust.`),
    metaImage: imgOf(listing).startsWith("http") ? imgOf(listing) : undefined,
    jsonLd: jsonLd({
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      name: listing.title,
      description: snippet(listing.description, 300),
      image: imgOf(listing),
      url: `${res.locals.siteUrl}/listings/${listing._id}`,
      address: { "@type": "PostalAddress", addressLocality: listing.location || undefined, addressCountry: listing.country || "Pakistan" },
      priceRange: `Rs ${Number(listing.prize || 0).toLocaleString("en-US")} per night`,
      ...(count ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(average.toFixed(1)), reviewCount: count } } : {}),
    }),
    listing,
    reviews,
    rating: { count, average },
    booked,
    mapData: { lat: geo.lat, lng: geo.lng, exact: geo.exact, label: listing.title },
    isOwner,
    canReview: !!user && !isOwner && !hasReviewed,
    hasReviewed,
    hostCount,
    saved: (res.locals.wishlistIds || []).includes(String(listing._id)),
    today: new Date().toISOString().slice(0, 10),
  });
};
