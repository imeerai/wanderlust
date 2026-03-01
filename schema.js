const Joi = require("joi");

const listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
    prize: Joi.number().min(10).required(),
    image: Joi.string().allow("",null).optional(),
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
