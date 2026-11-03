const path = require('path');
const dotenv = require('dotenv');

// Load .env from backend folder or workspace root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  mongodbUri: process.env.MONGODB_URI || '',
  sessionSecret: process.env.SESSION_SECRET || 'wcc_super_secret_session_key_bangladesh_child_health_registry_2026',
  sessionExpiresIn: process.env.SESSION_EXPIRES_IN || '8h',
  frontendOrigins: (process.env.FRONTEND_ORIGIN || 'http://localhost:5000,http://127.0.0.1:5000,http://localhost:3000')
    .split(',')
    .map(s => s.trim()),
  imageProvider: process.env.IMAGE_PROVIDER || 'local_secure',
  imgbbApiKey: process.env.IMGBB_API_KEY || '',
  imagesDbApiKey: process.env.IMAGESDB_API_KEY || '',
  imagesDbBaseUrl: process.env.IMAGESDB_API_BASE_URL || 'https://api.imagesdb.io/v1',
  maxImageSizeMb: parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10),
  uploadTempDir: path.resolve(__dirname, '../../../uploads/temp'),
  secureStorageDir: path.resolve(__dirname, '../../../uploads/secure'),
};

module.exports = config;
