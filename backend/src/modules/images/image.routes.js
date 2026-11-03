const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../../config/env');
const { uploadImage, getImage } = require('./image.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

const router = express.Router();

// Multer in-memory storage (Resilient across both Vercel Serverless and local containers)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxImageSizeMb * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('শুধুমাত্র JPEG, PNG এবং WebP ছবি আপলোড করা যাবে (Invalid file format)');
      err.isOperational = true;
      err.statusCode = 400;
      cb(err);
    }
  }
});

// Upload requires authentication
router.post('/upload', authenticate, upload.single('image'), uploadImage);

// Get image (uses optionalAuth so public profile photos can be viewed, while prescriptions enforce strict auth)
router.get('/:assetId', optionalAuth, getImage);

module.exports = router;
