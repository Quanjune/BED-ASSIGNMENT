// userValidator.js  (Aswin - User accounts / authentication)
// Joi schemas for the auth endpoints. Format checks live here so the
// controllers only deal with business rules (duplicate email, wrong password).
// Used with the shared validate() middleware: validate(signupSchema).
const Joi = require("joi");

// shared field rules
const email = Joi.string().trim().email().max(255).required().messages({
  "string.email": "Please enter a valid email address.",
  "string.empty": "Email is required.",
  "any.required": "Email is required."
});

const name = Joi.string().trim().min(2).max(100).required().messages({
  "string.min": "Name must be at least 2 characters.",
  "string.empty": "Name is required.",
  "any.required": "Name is required."
});

// new passwords must be 8+ chars with at least one letter and one number
const newPassword = Joi.string()
  .min(8)
  .max(100)
  .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
  .required()
  .messages({
    "string.min": "Password must be at least 8 characters.",
    "string.pattern.base": "Password must contain at least one letter and one number.",
    "string.empty": "Password is required.",
    "any.required": "Password is required."
  });

// signup: role is optional and can only ever be customer or vendor.
// admin accounts are never self-registered - they are seeded in the database.
const signupSchema = Joi.object({
  name,
  email,
  password: newPassword,
  role: Joi.string().valid("customer", "vendor").default("customer").messages({
    "any.only": "Role must be either customer or vendor."
  })
});

// login only checks the fields are present - an existing password must not
// be re-tested against the current strength rules.
const loginSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "string.email": "Please enter a valid email address.",
    "any.required": "Email is required."
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required."
  })
});

// profile update: name and email only. role and password are not editable here.
const updateProfileSchema = Joi.object({
  name,
  email
});

module.exports = { signupSchema, loginSchema, updateProfileSchema };
