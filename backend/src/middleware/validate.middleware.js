const { ZodError } = require('zod');

/**
 * Middleware factory to validate req using Zod schema
 * @param {import('zod').ZodSchema} schema
 */
function validate(schema) {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      req.body = parsed.body ?? req.body;
      req.query = parsed.query ?? req.query;
      req.params = parsed.params ?? req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({
          success: false,
          message: `তথ্য যাচাই ব্যর্থ হয়েছে: ${errorMessages}`,
          errors: error.errors
        });
      }
      next(error);
    }
  };
}

module.exports = validate;
