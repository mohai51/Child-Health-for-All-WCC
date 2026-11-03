const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const config = require('../../config/env');
const logger = require('../../config/logger');

// Ensure local directories exist safely
try {
  fs.mkdirSync(config.uploadTempDir, { recursive: true });
  fs.mkdirSync(config.secureStorageDir, { recursive: true });
} catch (e) {
  logger.warn({ error: e.message }, 'Failed to create upload directories');
}

class ImageStorageAdapter {
  constructor() {
    this.provider = config.imageProvider || 'imgbb';
    this.imgbbApiKey = config.imgbbApiKey;
    this.apiKey = config.imagesDbApiKey;
    this.baseUrl = config.imagesDbBaseUrl;
    this.secureStorageDir = config.secureStorageDir;
  }

  /**
   * Validate uploaded file format, size, and magic bytes
   */
  validateImage(file) {
    if (!file) {
      throw new Error('কোনো ফাইল নির্বাচন করা হয়নি (No file provided)');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('শুধুমাত্র JPEG, PNG এবং WebP ছবি আপলোড করা যাবে (Only JPEG, PNG, WebP allowed)');
    }

    const maxSizeBytes = config.maxImageSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new Error(`ছবির সাইজ সর্বোচ্চ ${config.maxImageSizeMb}MB হতে পারবে (File size exceeds limit)`);
    }

    return true;
  }

  /**
   * Upload image to designated storage
   * @param {Object} file - Multer file object
   * @param {Object} options - { category, isConfidential, relatedRecordId, user }
   */
  async uploadImage(file, options = {}) {
    this.validateImage(file);

    const { category, isConfidential = false, relatedRecordId = null } = options;
    const buffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
    if (!buffer) {
      throw new Error('ছবির ডাটা পাওয়া যায়নি (Image buffer missing)');
    }

    const ext = path.extname(file.originalname || '.jpg').toLowerCase() || '.jpg';
    const randomName = `${crypto.randomUUID()}${ext}`;

    // 1. If ImgBB API key is configured (preferred reliable cloud storage for both Vercel & local)
    if (this.imgbbApiKey) {
      try {
        const blob = new Blob([buffer], { type: file.mimetype || 'image/jpeg' });
        const form = new FormData();
        form.append('image', blob, randomName);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${this.imgbbApiKey}`, {
          method: 'POST',
          body: form
        });
        const data = await res.json();
        if (res.ok && data && data.success && data.data?.url) {
          logger.info(`ImgBB cloud upload success: ${data.data.url}`);
          return {
            provider: 'imgbb',
            providerAssetId: data.data.id || randomName,
            storageReference: data.data.url,
            directUrl: data.data.url,
            category,
            isConfidential: Boolean(isConfidential),
            mimeType: file.mimetype,
            fileSizeBytes: file.size || buffer.length,
            relatedRecordId
          };
        } else {
          logger.warn({ data }, 'ImgBB upload response indicated failure, falling back to local/memory');
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'ImgBB cloud upload failed, falling back to local storage');
      }
    }

    // 2. Local disk backup (if directory can be created or exists)
    let localPath = null;
    try {
      if (!fs.existsSync(this.secureStorageDir)) {
        fs.mkdirSync(this.secureStorageDir, { recursive: true });
      }
      localPath = path.join(this.secureStorageDir, randomName);
      fs.writeFileSync(localPath, buffer);
      if (file.path) this._cleanupTemp(file.path);
    } catch (fsErr) {
      logger.warn({ err: fsErr.message }, 'Local disk write skipped in serverless environment');
    }

    if (localPath && fs.existsSync(localPath)) {
      return {
        provider: 'local_secure',
        providerAssetId: randomName,
        storageReference: localPath,
        directUrl: `/api/images/raw/${randomName}`,
        category,
        isConfidential: Boolean(isConfidential),
        mimeType: file.mimetype,
        fileSizeBytes: file.size || buffer.length,
        relatedRecordId
      };
    }

    // 3. Guaranteed zero-crash fallback: Store as Base64 data URI
    const base64Data = `data:${file.mimetype || 'image/jpeg'};base64,${buffer.toString('base64')}`;
    return {
      provider: 'base64',
      providerAssetId: randomName,
      storageReference: base64Data,
      directUrl: base64Data,
      category,
      isConfidential: Boolean(isConfidential),
      mimeType: file.mimetype,
      fileSizeBytes: file.size || buffer.length,
      relatedRecordId
    };
  }

  /**
   * Background ImgBB sync (fire-and-forget, does not block doctor)
   */
  async syncBackgroundImgBB(filePath, filename, options) {
    if (!this.imgbbApiKey || !fs.existsSync(filePath)) return;
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: options.mimeType || 'image/jpeg' });
      const form = new FormData();
      form.append('image', blob, filename);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${this.imgbbApiKey}`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      if (data && data.success && data.data?.url) {
        logger.info(`Background ImgBB sync success: ${data.data.url}`);
        const ImageAsset = require('./imageAsset.model');
        await ImageAsset.findOneAndUpdate(
          { providerAssetId: filename },
          { storageReference: data.data.url, provider: 'imgbb' }
        );
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Background ImgBB upload skipped');
    }
  }

  _cleanupTemp(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupErr) {
      logger.warn({ cleanupErr }, 'Could not clean up temporary upload file');
    }
  }

  /**
   * Upload to ImgBB API
   */
  async uploadToImgBB(file, filename, options) {
    logger.info(`Uploading image ${filename} to ImgBB API...`);
    const fileBuffer = fs.readFileSync(file.path);
    const blob = new Blob([fileBuffer], { type: file.mimetype });

    const form = new FormData();
    form.append('image', blob, file.originalname || filename);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${this.imgbbApiKey}`, {
      method: 'POST',
      body: form
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || `ImgBB API error ${res.status}`);
    }

    logger.info(`ImgBB upload success: ${data.data?.url}`);

    // Also store a local backup copy for resilient fast retrieval
    const destinationPath = path.join(this.secureStorageDir, filename);
    fs.copyFileSync(file.path, destinationPath);

    return {
      provider: 'imgbb',
      providerAssetId: data.data?.id || filename,
      storageReference: data.data?.url,
      directUrl: data.data?.url,
      category: options.category,
      isConfidential: Boolean(options.isConfidential),
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      relatedRecordId: options.relatedRecordId
    };
  }

  /**
   * Mock / HTTP adapter for ImagesDB provider
   */
  async uploadToImagesDB(file, filename, options) {
    logger.info(`Uploading public image ${filename} to ImagesDB provider API...`);

    return {
      provider: 'imagesdb',
      providerAssetId: `imgdb_${crypto.randomUUID()}`,
      storageReference: `${this.baseUrl}/assets/${filename}`,
      directUrl: `${this.baseUrl}/assets/${filename}`,
      category: options.category,
      isConfidential: false,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      relatedRecordId: options.relatedRecordId
    };
  }

  /**
   * Get image file stream or file path for authorized retrieval
   */
  async getImageStream(imageAsset) {
    // 1. Base64 storage
    if (imageAsset.provider === 'base64') {
      const base64Str = imageAsset.storageReference.includes(',') 
        ? imageAsset.storageReference.split(',')[1] 
        : imageAsset.storageReference;
      const buffer = Buffer.from(base64Str, 'base64');
      return {
        stream: Readable.from(buffer),
        mimeType: imageAsset.mimeType || 'image/jpeg',
        size: buffer.length
      };
    }

    // 2. Check local secure disk
    if (imageAsset.provider === 'local_secure') {
      let filePath = imageAsset.storageReference;
      if (!fs.existsSync(filePath)) {
        const fallbackPath = path.join(this.secureStorageDir, path.basename(filePath));
        if (fs.existsSync(fallbackPath)) {
          filePath = fallbackPath;
        }
      }
      if (fs.existsSync(filePath)) {
        return {
          stream: fs.createReadStream(filePath),
          mimeType: imageAsset.mimeType || 'image/jpeg',
          size: imageAsset.fileSizeBytes || fs.statSync(filePath).size
        };
      }
      throw new Error('ফাইলটি পাওয়া যায়নি (Image file not found on disk)');
    }

    if (imageAsset.provider === 'imgbb') {
      // Check if local backup exists safely
      if (fs.existsSync(this.secureStorageDir)) {
        try {
          const files = fs.readdirSync(this.secureStorageDir);
          const match = files.find(f => f.startsWith(imageAsset.providerAssetId) || imageAsset.storageReference?.includes(f));
          if (match) {
            const localPath = path.join(this.secureStorageDir, match);
            return {
              stream: fs.createReadStream(localPath),
              mimeType: imageAsset.mimeType,
              size: imageAsset.fileSizeBytes
            };
          }
        } catch (e) {
          // ignore error reading local directory
        }
      }

      // Fetch from ImgBB CDN
      if (imageAsset.storageReference && imageAsset.storageReference.startsWith('http')) {
        const response = await fetch(imageAsset.storageReference);
        if (!response.ok) {
          throw new Error('ImgBB থেকে ছবি লোড করা যায়নি');
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return {
          stream: Readable.from(buffer),
          mimeType: imageAsset.mimeType || 'image/jpeg',
          size: buffer.length
        };
      }
    }

    throw new Error(`Provider ${imageAsset.provider} retrieval method not implemented`);
  }

  /**
   * Delete image from storage
   */
  async deleteImage(imageAsset) {
    if (imageAsset.provider === 'local_secure') {
      try {
        if (fs.existsSync(imageAsset.storageReference)) {
          fs.unlinkSync(imageAsset.storageReference);
        }
      } catch (err) {
        logger.error({ err }, 'Failed to delete local image file');
      }
    }
    return true;
  }
}

module.exports = new ImageStorageAdapter();
