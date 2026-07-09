// vendorAgreementsValidator.js  (Kishore - Vendor Management, Sprint 2)
const Joi = require("joi");

// endDate must be strictly after startDate -> gives a 400 (AC2).
const base = {
  stallId: Joi.number().integer().positive().required(),
  vendorId: Joi.string().allow("", null).max(100),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required()
    .messages({ "date.greater": "endDate must be after startDate" }),
  monthlyRent: Joi.number().positive().precision(2).required(),
  deposit: Joi.number().min(0).precision(2).default(0),
  status: Joi.string().valid("active", "expired", "terminated").default("active"),
};

const createAgreement = Joi.object(base);
const updateAgreement = Joi.object(base);

module.exports = { createAgreement, updateAgreement };