const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    specialty: {
      type: String,
      required: true,
      trim: true
    },
    designation: {
      type: String,
      default: 'Medical Officer',
      trim: true
    },
    hospital: {
      type: String,
      default: '',
      trim: true
    },
    bmdcNumber: {
      type: String,
      default: '',
      trim: true
    },
    phone: {
      type: String,
      default: '',
      trim: true
    },
    profileImageAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImageAsset',
      default: null
    },
    photoUrl: {
      type: String,
      default: ''
    },
    assignedCampId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camp',
      default: null,
      index: true
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Doctor', doctorSchema);
