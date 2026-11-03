const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    dateOfBirth: {
      type: Date,
      default: null
    },
    ageYears: {
      type: Number,
      required: true,
      min: 0,
      max: 18 // Pediatric registry
    },
    ageMonths: {
      type: Number,
      default: 0,
      min: 0,
      max: 11
    },
    sex: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      required: true,
      index: true
    },
    guardianName: {
      type: String,
      required: true,
      trim: true
    },
    guardianPhone: {
      type: String,
      default: '',
      trim: true,
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
    isPourashava: {
      type: Boolean,
      default: false
    },
    pourashavaName: {
      type: String,
      default: '',
      trim: true
    },
    wardNo: {
      type: String,
      default: '',
      trim: true
    },
    weight: {
      type: Number,
      default: null
    },
    height: {
      type: Number,
      default: null
    },
    mainComplaint: {
      type: String,
      default: '',
      trim: true
    },
    relevantHealthNotes: {
      type: String,
      default: '',
      trim: true
    },
    consentRecord: {
      given: {
        type: Boolean,
        required: true,
        default: true
      },
      text: {
        type: String,
        default: 'আমি অভিভাবক হিসেবে উই ক্যান চেঞ্জ (WCC)-এর স্বাস্থ্য ক্যাম্পে আমার সন্তানের স্বাস্থ্যসেবা গ্রহণের জন্য প্রয়োজনীয় তথ্য সংরক্ষণ ও ব্যবহারের পূর্ণ সম্মতি প্রদান করছি।'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
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

patientSchema.index({ fullName: 'text', patientId: 'text', guardianPhone: 'text' });

module.exports = mongoose.model('Patient', patientSchema);
