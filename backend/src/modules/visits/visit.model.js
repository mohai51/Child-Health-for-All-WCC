const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema(
  {
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
    visitToken: {
      type: Number,
      required: true
    },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    registeredAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    status: {
      type: String,
      enum: ['REGISTERED', 'IN_CONSULTATION', 'COMPLETED'],
      default: 'REGISTERED',
      index: true
    },
    mainComplaint: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent accidental duplicate registration of the same patient within the same camp
visitSchema.index({ campId: 1, patientId: 1 }, { unique: true });
visitSchema.index({ campId: 1, visitToken: 1 });

module.exports = mongoose.model('Visit', visitSchema);
