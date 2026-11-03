const app = require('../backend/src/app');
const { connectDB } = require('../backend/src/config/database');
const { seedInitialData } = require('../backend/src/scripts/seed');

let isConnecting = false;

module.exports = async (req, res) => {
  const mongoose = require('mongoose');

  if (mongoose.connection.readyState !== 1 && !isConnecting) {
    isConnecting = true;
    try {
      await connectDB();
      try {
        await seedInitialData();
      } catch (seedErr) {
        console.warn('Seed data warning:', seedErr.message);
      }
    } catch (err) {
      console.error('Database connection error in Vercel serverless function:', err);
    } finally {
      isConnecting = false;
    }
  }

  return app(req, res);
};

