// vendorValidator.js  (Kishore - Vendor Management)
// NOTE: no stallId here any more - the server takes it from the login
// token (vendorAuth middleware), never from the client. If a client
// sends stallId anyway, Joi rejects the request as an unknown field.
const Joi = require("joi");

const fields = {
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().allow("", null).max(500),
  imagePath: Joi.string().allow("", null).max(300),   // URL or /media/... path
  basePrice: Joi.number().positive().precision(2).required()
};

const createMenuItem = Joi.object(fields);
const updateMenuItem = Joi.object(fields);

module.exports = { createMenuItem, updateMenuItem };
