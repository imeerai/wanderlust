const Listing = require("../models/listing");
const Review = require("../models/reviews");
// const mbxGeoCoding = require("@mapbox/mapbox-sdk/services/geocoding");
// const mapBoxToken = process.env.MAPBOX_TOKEN;
// const geocodingClient = mbxGeoCoding({ accessToken: mapBoxToken });

module.exports.index = async (req, res) => { 
  const requestedPerPage = parseInt(req.query.perPage, 10);
  const perPage = requestedPerPage === 5 ? 5 : 15;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const location = (req.query.location || "").trim();
  const country = (req.query.country || "").trim();
  const maxPrice = Number(req.query.maxPrice);
  const sort = req.query.sort || "recent";

  const filters = {};

  if (location) {
    filters.location = { $regex: location, $options: "i" };
  }

  if (country) {
    filters.country = country;
  }

  if (!Number.isNaN(maxPrice) && maxPrice > 0) {
    filters.prize = { $lte: maxPrice };
  }

  let sortOption = { _id: -1 };
  if (sort === "priceAsc") sortOption = { prize: 1 };
  if (sort === "priceDesc") sortOption = { prize: -1 };

  const totalListings = await Listing.countDocuments(filters);
  const totalPages = Math.max(Math.ceil(totalListings / perPage), 1);
  const currentPage = Math.min(page, totalPages);

  const allListings = await Listing.find(filters)
    .sort(sortOption)
    .skip((currentPage - 1) * perPage)
    .limit(perPage);

  const countries = await Listing.distinct("country");
  countries.sort((a, b) => a.localeCompare(b));

  const queryParams = new URLSearchParams();
  if (location) queryParams.set("location", location);
  if (country) queryParams.set("country", country);
  if (!Number.isNaN(maxPrice) && maxPrice > 0) queryParams.set("maxPrice", String(maxPrice));
  if (sort) queryParams.set("sort", sort);
  queryParams.set("perPage", String(perPage));

  const queryTail = queryParams.toString() ? `&${queryParams.toString()}` : "";

  const ratingSummary = {};
  const guestFavoriteSummary = {};

  for (const listing of allListings) {
    const reviewCount = listing.Reviews.length;
    if (reviewCount === 0) {
      ratingSummary[String(listing._id)] = { average: 0, count: 0 };
      continue;
    }

    const reviews = await Review.find(
      { _id: { $in: listing.Reviews } },
      { rating: 1 }
    ).lean();

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const average = reviews.length ? totalRating / reviews.length : 0;

    ratingSummary[String(listing._id)] = {
      average,
      count: reviews.length,
    };

    guestFavoriteSummary[String(listing._id)] =
      reviews.length >= 3 && average >= 4.5;
  }

  for (const listing of allListings) {
    const listingId = String(listing._id);
    if (typeof guestFavoriteSummary[listingId] === "undefined") {
      guestFavoriteSummary[listingId] = false;
    }
  }

  res.render("listings/index", {
    allListings,
    perPage,
    currentPage,
    totalPages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    ratingSummary,
    guestFavoriteSummary,
    countries,
    selectedFilters: {
      location,
      country,
      maxPrice: !Number.isNaN(maxPrice) && maxPrice > 0 ? maxPrice : "",
      sort,
    },
    queryTail,
  });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new");
};

module.exports.createListing = async (req, res) => {
  // let coordinate = await geocodingClient
  //   .forwardGeocode({
  //     query: req.body.listing.location,
  //     limit: 1,
  //   })
  //   .send();
   

  let url = req.file.url;
  let filename = req.file.public_id;
  const { listing } = req.body;
  const newListing = new Listing(listing);
  newListing.Owner = req.user._id;
  newListing.image = { url, filename };
  // newListing.geometry = coordinate.body.features[0].geometry;
  await newListing.save();
  req.flash("success", "Successfully created a new listing!");
  res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing your requested does not exist.");
    return res.redirect("/listings");
  }
  let ogirlimgaurl = listing.image.url;
  ogirlimgaurl = ogirlimgaurl.replace("/upload/", "/upload/h_200,w_300/");

  res.render("listings/edit", { listing, ogirlimgaurl });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findByIdAndUpdate(
    id,
    { ...req.body.listing },
    { new: true }
  );
  if (!listing) {
    req.flash("error", "The listing you requested does not exist.");
    return res.redirect("/listings");
  }
  if (typeof req.file !== "undefined") {
    let url = req.file.url;
    let filename = req.file.public_id;
    listing.image = { url, filename };
    await listing.save();
  }

  req.flash("success", "Successfully updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.deleteListing = async (req, res) => {
  const { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Successfully Deleted!");
  res.redirect("/listings");
};

module.exports.showListing = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id)
    .populate("Owner");

  if (!listing) {
    req.flash("error", "Listing your requested does not exist.");
    return res.redirect("/listings");
  }

  const reviews = await Review.find({ _id: { $in: listing.Reviews } })
    .populate("author")
    .sort({ created_At: -1 });

  const totalReviews = reviews.length;

  let mapData = null;
  try {
    const searchText = encodeURIComponent(`${listing.location}, ${listing.country}`);
    const geocodeResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${searchText}`,
      {
        headers: {
          "User-Agent": "Wanderlust/1.0",
        },
      }
    );

    if (geocodeResponse.ok) {
      const geocodeData = await geocodeResponse.json();
      if (Array.isArray(geocodeData) && geocodeData.length > 0) {
        mapData = {
          lat: Number(geocodeData[0].lat),
          lng: Number(geocodeData[0].lon),
          label: `${listing.title} — PKR ${Number(listing.prize || 0).toLocaleString("en-PK")}`,
        };
      }
    }
  } catch (error) {
    mapData = null;
  }

  res.render("listings/show", {
    listing,
    currentUser: req.user,
    reviews,
    totalReviews,
    mapData,
  });
};
