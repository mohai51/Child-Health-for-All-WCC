const mongoose = require('mongoose');

const campSchema = new mongoose.Schema(
  {
    campCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    district: {
      type: String,
      required: true,
      trim: true
    },
    upazila: {
      type: String,
      required: true,
      trim: true
    },
    venue: {
      type: String,
      required: true,
      trim: true
    },
    isPourashava: {
      type: Boolean,
      default: false
    },
    pourashavaName: {
      type: String,
      default: '',
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    organizerName: {
      type: String,
      default: 'We Can Change (WCC)',
      trim: true
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'CLOSED'],
      default: 'DRAFT',
      index: true
    },
    activatedAt: {
      type: Date,
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Camp', campSchema);
