const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    responsibility: {
      type: String,
      enum: ['Registration Desk', 'Doctor Assistant', 'Pharmacy', 'Coordination', 'General Support'],
      default: 'Registration Desk',
      required: true
    },
    profileImageAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImageAsset',
      default: null
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

module.exports = mongoose.model('Volunteer', volunteerSchema);
