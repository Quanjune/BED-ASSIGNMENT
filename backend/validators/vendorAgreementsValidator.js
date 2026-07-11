// vendorAgreementsValidator.js  (Kishore - Vendor Management, Sprint 2 rework)
const Joi = require("joi");

const AGREEMENT_TYPES = ["Rental", "Store Licence", "Food Safety", "Fire Safety", "Other"];

// No stallId - it comes from the login token, same as the menu.
// Rule 1: expiryDate must be after startDate            -> 400
// Rule 2: monthlyRent is required ONLY for Rental rows  -> 400
const base = {
  name: Joi.string().trim().min(1).max(150).required(),
  agreementType: Joi.string().valid(...AGREEMENT_TYPES).required(),
  startDate: Joi.date().required(),
  expiryDate: Joi.date().greater(Joi.ref("startDate")).required()
    .messages({ "date.greater": "expiryDate must be after startDate" }),
  monthlyRent: Joi.when("agreementType", {
    is: "Rental",
    then: Joi.number().positive().precision(2).required()
      .messages({ "any.required": "monthlyRent is required for Rental agreements" }),
    otherwise: Joi.number().min(0).precision(2).allow(null)
  }),
  // Only user-set statuses live here. 'Expired' / 'Expiring Soon' are
  // computed by the backend from expiryDate, so nobody can fake them.
  status: Joi.string().valid("Active", "Terminated").default("Active")
};

const createAgreement = Joi.object(base);
const updateAgreement = Joi.object(base);

module.exports = { createAgreement, updateAgreement, AGREEMENT_TYPES };
