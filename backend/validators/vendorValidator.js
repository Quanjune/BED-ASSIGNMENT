// vendorValidator.js  (Kishore - Vendor Management)
const Joi = require("joi");

const createMenuItem = Joi.object({
  stallId: Joi.number().integer().positive().required(),
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().allow("", null).max(500),
  imagePath: Joi.string().allow("", null).max(300),
  basePrice: Joi.number().positive().precision(2).required()
});

const updateMenuItem = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().allow("", null).max(500),
  imagePath: Joi.string().allow("", null).max(300),
  basePrice: Joi.number().positive().precision(2).required()
});

module.exports = { createMenuItem, updateMenuItem };
