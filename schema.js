const Joi = require("joi");

const text = (label, min, max) => Joi.string().trim().min(min).max(max).required().label(label);

const listingSchema = Joi.object({
  listing: Joi.object({
    title: text("Title", 3, 80),
    description: text("Description", 10, 2000),
    location: text("Location", 2, 60),
    country: text("Country", 2, 60),
    prize: Joi.number().min(10).max(10000000).required().label("Price"),
    // The photo only ever arrives as an uploaded file, never as a text field.
    image: Joi.any().strip(),
    maxGuests: Joi.number().integer().min(1).max(30).default(6).label("Max guests"),
    amenities: Joi.array().items(Joi.string().valid(...require("./utils/amenities"))).single().default([]).label("Amenities"),
  }).required()
});

const reviewSchema = Joi.object({
  review: Joi.object({
    comment: Joi.string().required(),
    rating: Joi.number().min(1).max(5).required()
  }).required()
});

// const userSchema = Joi.object({
//   user: Joi.object({
//     email: Joi.string().required().email(),
//     username: Joi.string().required(),
//     password: Joi.string().required()
//   }).required()
// });

module.exports = { listingSchema, reviewSchema};
