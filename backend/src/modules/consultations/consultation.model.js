const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },
    visitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Visit',
      required: true,
      index: true
    },
    campId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camp',
      required: true,
      index: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true
    },
    doctorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    doctorName: {
      type: String,
      required: true
    },
    diagnosis: {
      type: String,
      default: '',
      trim: true
    },
    quickCategories: {
      type: [String],
      default: []
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    prescriptionImageAssetIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ImageAsset'
      }
    ],
    referralRequired: {
      type: Boolean,
      default: false
    },
    referralNotes: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'REFERRED'],
      default: 'IN_PROGRESS',
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

consultationSchema.index({ campId: 1, doctorId: 1 });
consultationSchema.index({ campId: 1, patientId: 1 });
consultationSchema.index({ visitId: 1, status: 1 });

module.exports = mongoose.model('Consultation', consultationSchema);
