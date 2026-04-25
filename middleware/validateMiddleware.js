const { ZodError } = require('zod');

/**
 * Middleware to validate request body against a Zod schema
 * @param {import('zod').ZodSchema} schema 
 */
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      // Pass the ZodError to the global error handler
      return next(error);
    }
    next(error);
  }
};

module.exports = validate;
