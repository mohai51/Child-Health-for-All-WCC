const app = require('../backend/src/app');
const { connectDB } = require('../backend/src/config/database');
const { seedInitialData } = require('../backend/src/scripts/seed');

let isInitialized = false;

module.exports = async (req, res) => {
  if (!isInitialized) {
    try {
      await connectDB();
      await seedInitialData();
      isInitialized = true;
    } catch (err) {
      console.error('Database connection error in Vercel serverless function:', err);
    }
  }
  return app(req, res);
};

