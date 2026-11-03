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
      if (error instanceof ZodError || error.name === 'ZodError' || Array.isArray(error.errors) || Array.isArray(error.issues)) {
        const issues = error.errors || error.issues || [];
        const errorMessages = issues.length > 0 
          ? issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
          : (error.message || 'ভুল তথ্য প্রদান করা হয়েছে');
        return res.status(400).json({
          success: false,
          message: `তথ্য যাচাই ব্যর্থ হয়েছে: ${errorMessages}`,
          errors: issues
        });
      }
      next(error);
    }
  };
}

module.exports = validate;
