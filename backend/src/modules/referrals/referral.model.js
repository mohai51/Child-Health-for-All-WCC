const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
  {
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },
    campId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camp',
      required: true,
      index: true
    },
    referringDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true
    },
    referredHospital: {
      type: String,
      required: true,
      trim: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'FOLLOWED_UP', 'ADMITTED', 'DISCHARGED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },
    followUpDate: {
      type: Date,
      default: null
    },
    followUpNotes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

referralSchema.index({ campId: 1, status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
