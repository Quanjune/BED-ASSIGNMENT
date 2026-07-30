// inspectionValidator.js  (Kaden - NEA inspections & hygiene grades)
// Joi schemas for the inspection + hygiene-grade endpoints. Format checks
// live here so the controllers only deal with business rules (stall exists,
// inspection already completed) - the same split as Aswin's userValidator.
// Used with Kishore's shared validate() middleware: validate(schema).
//
// .raw() on the dates keeps the original "YYYY-MM-DD" strings after
// validation (Joi would otherwise replace them with Date objects, and the
// models/controllers were written to receive strings).
const Joi = require("joi");

// shared field rules
const stallId = Joi.number().integer().positive().required().messages({
  "number.base": "stallId is required and must be a number.",
  "any.required": "stallId is required and must be a number.",
});

const officerName = Joi.string().trim().min(2).max(100).required().messages({
  "string.min": "officerName must be at least 2 characters.",
  "string.empty": "officerName is required.",
  "any.required": "officerName is required.",
});

const scheduledDate = Joi.date().iso().raw().required().messages({
  "date.base": "scheduledDate is required and must be a valid date (YYYY-MM-DD).",
  "date.format": "scheduledDate must be a valid date (YYYY-MM-DD).",
  "any.required": "scheduledDate is required and must be a valid date (YYYY-MM-DD).",
});

// POST /api/inspections - status is never accepted from the client here;
// the model always inserts new inspections as 'Scheduled'.
const scheduleInspectionSchema = Joi.object({
  stallId,
  officerName,
  scheduledDate,
});

// PUT /api/inspections/:id - editing the schedule may also move the status
// (e.g. cancelling). Defaults back to 'Scheduled' when omitted, which is
// what the controller used to do with `req.body.status || "Scheduled"`.
const updateInspectionSchema = Joi.object({
  stallId,
  officerName,
  scheduledDate,
  status: Joi.string().valid("Scheduled", "Completed", "Cancelled").default("Scheduled").messages({
    "any.only": "status must be one of: Scheduled, Completed, Cancelled",
  }),
});

// PUT /api/inspections/:id/complete - completedDate is optional; the
// controller falls back to today when it is missing.
const completeInspectionSchema = Joi.object({
  score: Joi.number().integer().min(0).max(100).required().messages({
    "number.base": "score is required and must be a number between 0 and 100.",
    "number.min": "score is required and must be a number between 0 and 100.",
    "number.max": "score is required and must be a number between 0 and 100.",
    "any.required": "score is required and must be a number between 0 and 100.",
  }),
  remarks: Joi.string().trim().max(500).allow("", null),
  completedDate: Joi.date().iso().raw().messages({
    "date.format": "completedDate must be a valid date (YYYY-MM-DD).",
  }),
});

// POST + PUT /api/hygiene-grades - manual/corrective grade entry.
// uppercase() converts "a" -> "A" before valid() runs, and because
// validate() writes the converted value back onto req.body the controller
// no longer needs its own .toUpperCase().
const hygieneGradeSchema = Joi.object({
  stallId,
  inspectionId: Joi.number().integer().positive().allow(null),
  grade: Joi.string().trim().uppercase().valid("A", "B", "C", "D").required().messages({
    "any.only": "grade is required and must be one of: A, B, C, D",
    "string.empty": "grade is required and must be one of: A, B, C, D",
    "any.required": "grade is required and must be one of: A, B, C, D",
  }),
  validFrom: Joi.date().iso().raw().required().messages({
    "date.base": "validFrom is required and must be a valid date (YYYY-MM-DD).",
    "any.required": "validFrom is required and must be a valid date (YYYY-MM-DD).",
  }),
  validTo: Joi.date().iso().greater(Joi.ref("validFrom")).raw().required().messages({
    "date.base": "validTo is required and must be a valid date (YYYY-MM-DD).",
    "date.greater": "validTo must be after validFrom.",
    "any.required": "validTo is required and must be a valid date (YYYY-MM-DD).",
  }),
});

module.exports = {
  scheduleInspectionSchema,
  updateInspectionSchema,
  completeInspectionSchema,
  hygieneGradeSchema,
};