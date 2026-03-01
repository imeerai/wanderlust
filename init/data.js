const propertyTypes = [
  "Apartment",
  "Villa",
  "Guest House",
  "Cabin",
  "Farm Stay",
  "Penthouse",
  "Studio",
  "Family Home",
  "Lake View House",
  "Mountain Retreat",
];

const pakistanPlaces = [
  { location: "Lahore", country: "Pakistan" },
  { location: "Karachi", country: "Pakistan" },
  { location: "Islamabad", country: "Pakistan" },
  { location: "Murree", country: "Pakistan" },
  { location: "Hunza", country: "Pakistan" },
  { location: "Skardu", country: "Pakistan" },
  { location: "Nathia Gali", country: "Pakistan" },
  { location: "Swat", country: "Pakistan" },
  { location: "Faisalabad", country: "Pakistan" },
  { location: "Multan", country: "Pakistan" },
  { location: "Peshawar", country: "Pakistan" },
  { location: "Quetta", country: "Pakistan" },
  { location: "Hyderabad", country: "Pakistan" },
  { location: "Bhurban", country: "Pakistan" },
  { location: "Gwadar", country: "Pakistan" },
  { location: "Sialkot", country: "Pakistan" },
  { location: "Bahawalpur", country: "Pakistan" },
  { location: "Abbottabad", country: "Pakistan" },
  { location: "Chitral", country: "Pakistan" },
  { location: "Kalam", country: "Pakistan" },
];

const vibeWords = [
  "Royal",
  "Cozy",
  "Heritage",
  "Premium",
  "Serene",
  "Modern",
  "Scenic",
  "Family",
  "Elegant",
  "Peaceful",
];

const imageUrls = [
  "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1582582621959-48d27397dc69?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1613977257592-4a9a32f8cf9b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1597047084897-51e81819a499?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1571055107559-3e67626fa8be?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505692952047-1a78307da8f2?auto=format&fit=crop&w=900&q=80",
];

const reviewLines = [
  "Host was very cooperative and check-in was smooth.",
  "Location was perfect and the place looked exactly like photos.",
  "Clean rooms, great service, and peaceful environment.",
  "Family had a wonderful stay, highly recommended.",
  "Beautiful view and comfortable beds. Would book again.",
  "Great value for money and nearby food options were amazing.",
  "Safe area and very responsive host throughout the trip.",
  "Everything was managed professionally and neatly.",
];

const buildDescription = (type, location, hostName) =>
  `${type} by ${hostName} in ${location}. Neat rooms, reliable Wi-Fi, secure environment, and easy access to local markets. Ideal for family trips, solo travel, and short work stays.`;

const generateListingsForUsers = (users) => {
  const listings = [];

  users.forEach((user, userIndex) => {
    for (let listingIndex = 0; listingIndex < 10; listingIndex += 1) {
      const globalIndex = userIndex * 10 + listingIndex;
      const type = propertyTypes[(globalIndex + userIndex) % propertyTypes.length];
      const vibe = vibeWords[(globalIndex + 3) % vibeWords.length];
      const place = pakistanPlaces[globalIndex % pakistanPlaces.length];
      const imageUrl = imageUrls[globalIndex % imageUrls.length];
      const price = 4500 + ((globalIndex % 10) * 900) + (userIndex * 250);

      listings.push({
        title: `${vibe} ${type} in ${place.location}`,
        description: buildDescription(type, place.location, user.username),
        image: {
          url: imageUrl,
          filename: `pk-seed-${globalIndex + 1}`,
        },
        prize: price,
        location: place.location,
        country: place.country,
        Owner: user._id,
      });
    }
  });

  return listings;
};

const generateReviewsForListings = (listings, users) => {
  const reviewsByListing = [];

  listings.forEach((listing, index) => {
    const reviewCount = index % 2 === 0 ? 1 : 2;
    const listingReviews = [];

    for (let i = 0; i < reviewCount; i += 1) {
      const author = users[(index + i + 1) % users.length];
      const rating = 3 + ((index + i) % 3);

      listingReviews.push({
        comment: reviewLines[(index + i) % reviewLines.length],
        rating,
        author: author._id,
      });
    }

    reviewsByListing.push({ listingId: listing._id, reviews: listingReviews });
  });

  return reviewsByListing;
};

module.exports = { generateListingsForUsers, generateReviewsForListings };
