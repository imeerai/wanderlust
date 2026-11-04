const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const ExpressError = require("../utils/ExpressError");

const DAY = 24 * 60 * 60 * 1000;
const MAX_NIGHTS = 30;
const GST_RATE = 0.18;

const parseDay = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
};
const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

// Booked nights for the calendar: [["2026-11-05","2026-11-08"], ...]
module.exports.bookedRanges = async (listingId) => {
  const rows = await Booking.find(
    { listing: listingId, status: "confirmed", checkOut: { $gt: todayUTC() } },
    { checkIn: 1, checkOut: 1 }
  ).lean();
  return rows.map((b) => [b.checkIn.toISOString().slice(0, 10), b.checkOut.toISOString().slice(0, 10)]);
};

const overlapQuery = (listing, checkIn, checkOut, extra = {}) => ({
  listing, status: "confirmed", checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn }, ...extra,
});

module.exports.create = async (req, res) => {
  const { id } = req.params;
  const back = `/listings/${id}`;
  if (!mongoose.isValidObjectId(id)) throw new ExpressError(404, "That listing does not exist.");
  const listing = await Listing.findById(id);
  if (!listing) throw new ExpressError(404, "That listing does not exist.");

  const fail = (msg) => { req.flash("error", msg); return res.redirect(back); };

  if (listing.Owner && listing.Owner.equals(req.user._id)) return fail("You cannot book your own listing.");

  const checkIn = parseDay(req.body.checkIn);
  const checkOut = parseDay(req.body.checkOut);
  if (!checkIn || !checkOut) return fail("Please choose your check-in and checkout dates.");
  if (checkIn < todayUTC()) return fail("Check-in cannot be in the past.");
  const nights = Math.round((checkOut - checkIn) / DAY);
  if (nights < 1) return fail("Checkout must be at least one night after check-in.");
  if (nights > MAX_NIGHTS) return fail(`You can book up to ${MAX_NIGHTS} nights at a time.`);

  const guests = Number.parseInt(req.body.guests, 10);
  const cap = listing.maxGuests || 6;
  if (!Number.isInteger(guests) || guests < 1) return fail("Please choose how many guests are coming.");
  if (guests > cap) return fail(`This place hosts up to ${cap} guests.`);

  if (await Booking.exists(overlapQuery(listing._id, checkIn, checkOut))) {
    return fail("Those dates were just booked. Please pick different dates.");
  }

  // Price is always calculated here, never taken from the browser.
  const pricePerNight = listing.prize || 0;
  const subtotal = pricePerNight * nights;
  const gst = Math.round(subtotal * GST_RATE);
  const booking = await Booking.create({
    listing: listing._id, guest: req.user._id, checkIn, checkOut, guests, nights,
    pricePerNight, subtotal, gst, total: subtotal + gst,
  });

  // Two people can submit at the same moment. The earlier booking wins.
  const clash = await Booking.exists(overlapQuery(listing._id, checkIn, checkOut, { _id: { $lt: booking._id } }));
  if (clash) {
    await Booking.deleteOne({ _id: booking._id });
    return fail("Those dates were just booked. Please pick different dates.");
  }

  req.flash("success", `Reserved! ${nights} ${nights === 1 ? "night" : "nights"}, total Rs ${(subtotal + gst).toLocaleString("en-US")} including GST.`);
  res.redirect(back);
};

module.exports.cancel = async (req, res) => {
  const { bookingId } = req.params;
  if (!mongoose.isValidObjectId(bookingId)) throw new ExpressError(404, "That booking does not exist.");
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ExpressError(404, "That booking does not exist.");
  if (!booking.guest.equals(req.user._id)) throw new ExpressError(403, "You can only cancel your own bookings.");
  if (booking.status === "confirmed" && booking.checkIn <= todayUTC()) {
    req.flash("error", "This stay has already started, so it can no longer be cancelled online.");
    return res.redirect("/profile");
  }
  if (booking.status !== "cancelled") {
    booking.status = "cancelled";
    await booking.save();
  }
  req.flash("success", "Your booking was cancelled.");
  res.redirect("/profile");
};
