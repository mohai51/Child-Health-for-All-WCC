const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  logger.error({
    err: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method
  }, 'Unhandled request error');

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `ফাইল আপলোড ত্রুটি: ${err.message}`
    });
  }

  // Handle MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'ফিল্ড';
    return res.status(409).json({
      success: false,
      message: `এই তথ্যটি ইতিমধ্যে সংরক্ষিত আছে (${field} already exists)`
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'সার্ভারে অভ্যন্তরীণ ত্রুটি ঘটেছে (Internal server error)';

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV !== 'production' ? err.message : undefined
  });
}

module.exports = errorHandler;
