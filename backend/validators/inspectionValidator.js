// inspectionValidator.js  (Kaden - NEA inspections & hygiene grades)
// Joi schemas for the inspection and hygiene-grade endpoints. Format checks
// live here so the controllers only deal with business rules (does the stall
// exist, is this inspection already completed) - the same split Aswin uses in
// userValidator.js. Used with Kishore's shared validate() middleware.
//
// NOTE ON officerId
//   There is deliberately no officerId field in any of these schemas. The
//   officer comes from the JWT via officerAuth.js, never from the request
//   body. If it were accepted here, one officer could file an inspection
//   under another officer's name.
//
// NOTE ON .raw()
//   Joi would normally replace a validated date string with a JavaScript
//   Date object. .raw() keeps the original "YYYY-MM-DD" string, which is what
//   the models and controllers were written to receive.
const Joi = require("joi");

// ------------------------------------------------------------
// shared field rules
// ------------------------------------------------------------
const stallId = Joi.number().integer().positive().required().messages({
  "number.base": "Please choose a stall.",
  "number.positive": "Please choose a stall.",
  "any.required": "Please choose a stall.",
});

const scheduledDate = Joi.date().iso().raw().required().messages({
  "date.base": "Please pick a valid inspection date (YYYY-MM-DD).",
  "date.format": "Please pick a valid inspection date (YYYY-MM-DD).",
  "any.required": "Please pick a valid inspection date (YYYY-MM-DD).",
});

// ------------------------------------------------------------
// POST /api/inspections  - schedule a visit
// ------------------------------------------------------------
// status is never accepted from the client: a brand new inspection is always
// inserted as 'Scheduled' by the model.
const scheduleInspectionSchema = Joi.object({
  stallId,
  scheduledDate,
});

// ------------------------------------------------------------
// PUT /api/inspections/:id  - move or cancel a booked visit
// ------------------------------------------------------------
// 'Completed' is not a valid choice here. Completing an inspection needs a
// score, so it has its own endpoint (PUT /:id/complete) and its own schema.
const updateInspectionSchema = Joi.object({
  stallId,
  scheduledDate,
  status: Joi.string().valid("Scheduled", "Cancelled").default("Scheduled").messages({
    "any.only": "Status must be either Scheduled or Cancelled.",
  }),
});

// ------------------------------------------------------------
// PUT /api/inspections/:id/complete  - record the result
// ------------------------------------------------------------
// completedDate is optional; the controller falls back to today.
const completeInspectionSchema = Joi.object({
  score: Joi.number().integer().min(0).max(100).required().messages({
    "number.base": "Score is required and must be a whole number from 0 to 100.",
    "number.integer": "Score must be a whole number.",
    "number.min": "Score cannot be below 0.",
    "number.max": "Score cannot be above 100.",
    "any.required": "Score is required and must be a whole number from 0 to 100.",
  }),
  remarks: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Remarks cannot be longer than 500 characters.",
  }),
  completedDate: Joi.date().iso().raw().messages({
    "date.format": "Completed date must be a valid date (YYYY-MM-DD).",
  }),
});

// ------------------------------------------------------------
// POST + PUT /api/hygiene-grades  - manual / corrective grade entry
// ------------------------------------------------------------
// Most grades are issued automatically when an inspection is completed.
// This path exists for corrections, which is why a reason is required.
const hygieneGradeSchema = Joi.object({
  stallId,
  inspectionId: Joi.number().integer().positive().allow(null),
  grade: Joi.string().trim().uppercase().valid("A", "B", "C", "D").required().messages({
    "any.only": "Grade must be A, B, C or D.",
    "string.empty": "Grade must be A, B, C or D.",
    "any.required": "Grade must be A, B, C or D.",
  }),
  validFrom: Joi.date().iso().raw().required().messages({
    "date.base": "Valid-from must be a valid date (YYYY-MM-DD).",
    "any.required": "Valid-from must be a valid date (YYYY-MM-DD).",
  }),
  validTo: Joi.date().iso().greater(Joi.ref("validFrom")).raw().required().messages({
    "date.base": "Valid-to must be a valid date (YYYY-MM-DD).",
    "date.greater": "The valid-to date must be after the valid-from date.",
    "any.required": "Valid-to must be a valid date (YYYY-MM-DD).",
  }),
});

module.exports = {
  scheduleInspectionSchema,
  updateInspectionSchema,
  completeInspectionSchema,
  hygieneGradeSchema,
};
