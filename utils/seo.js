// Small helpers for page metadata, robots.txt and the sitemap.
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

// Prefer SITE_URL from the environment; otherwise use the host the request came in on.
const siteUrl = (req) => {
  const env = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\/[^\s/]+$/i.test(env)) return env;
  return `${req.protocol}://${req.get("host")}`;
};

const snippet = (text, max = 155) => {
  const t = clean(text);
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
};

// JSON-LD goes inside a <script>, so "<" must never appear raw.
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

// Pages that belong to one person or are forms: kept out of search results.
const PRIVATE = /^\/(profile|wishlist|login|register|logout|csrf-token|health|listings\/new|listings\/[^/]+\/edit|bookings)(\/|$)/;

module.exports = { siteUrl, snippet, jsonLd, PRIVATE, clean };
