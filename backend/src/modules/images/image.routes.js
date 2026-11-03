const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../../config/env');
const { uploadImage, getImage } = require('./image.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

const router = express.Router();

// Multer temporary storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadTempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});

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
      cb(new Error('শুধুমাত্র JPEG, PNG এবং WebP ছবি আপলোড করা যাবে (Invalid file format)'));
    }
  }
});

// Upload requires authentication
router.post('/upload', authenticate, upload.single('image'), uploadImage);

// Get image (uses optionalAuth so public profile photos can be viewed, while prescriptions enforce strict auth)
router.get('/:assetId', optionalAuth, getImage);

module.exports = router;
