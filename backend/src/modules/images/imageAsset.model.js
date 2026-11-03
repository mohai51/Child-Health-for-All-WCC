const mongoose = require('mongoose');

const imageAssetSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['imagesdb', 'local_secure', 's3', 'imgbb'],
      default: 'imgbb',
      required: true
    },
    providerAssetId: {
      type: String,
      required: true,
      index: true
    },
    storageReference: {
      type: String,
      required: true
    },
    directUrl: {
      type: String,
      default: null
    },
    category: {
      type: String,
      enum: ['DOCTOR_PROFILE', 'VOLUNTEER_PROFILE', 'PRESCRIPTION'],
      required: true,
      index: true
    },
    isConfidential: {
      type: Boolean,
      default: false,
      index: true
    },
    mimeType: {
      type: String,
      required: true
    },
    fileSizeBytes: {
      type: Number,
      default: 0
    },
    relatedRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

module.exports = mongoose.model('ImageAsset', imageAssetSchema);
