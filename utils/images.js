// A listing without a usable photo gets a stock house photo (same one every time for the same listing).
const FALLBACKS = [
  "photo-1568605114967-8130f3a36994", "photo-1564013799919-ab600027ffc6", "photo-1560185008-b033106af5c3",
  "photo-1572120360610-d971b9d7767c", "photo-1613490493576-7fde63acd811", "photo-1600585154340-be6161a56a0c",
  "photo-1505693416388-ac5ce068fe85", "photo-1522708323590-d24dbb6b0267",
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function fallbackFor(seed) {
  const id = FALLBACKS[hash(String(seed || "wanderlust")) % FALLBACKS.length];
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=75`;
}

// imgOf(listing) -> the listing's own photo, or a stock photo when it has none.
function imgOf(l) {
  const url = l && l.image && typeof l.image.url === "string" ? l.image.url.trim() : "";
  return url || fallbackFor(l && (l._id || l.id || l.title));
}

module.exports = { imgOf, fallbackFor, FALLBACKS };
