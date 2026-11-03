const app = require('../backend/src/app');
const { connectDB } = require('../backend/src/config/database');
const { seedInitialData } = require('../backend/src/scripts/seed');

let isInitialized = false;

module.exports = async (req, res) => {
  if (!isInitialized) {
    try {
      await connectDB();
      try {
        await seedInitialData();
      } catch (seedErr) {
        console.warn('Seed data warning:', seedErr.message);
      }
      isInitialized = true;
    } catch (err) {
      console.error('Database connection error in Vercel serverless function:', err);
      if (req.url && req.url.startsWith('/api')) {
        return res.status(503).json({
          success: false,
          message: 'ডাটাবেস কানেকশন ত্রুটি (Database connection error): ' + err.message,
          error: err.message,
          tip: 'Verify MONGODB_URI in Vercel Environment Variables and ensure MongoDB Atlas Network Access has 0.0.0.0/0 allowed.'
        });
      }
    }
  }
  return app(req, res);
};

