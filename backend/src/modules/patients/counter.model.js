const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },
    seq: {
      type: Number,
      default: 0
    }
  },
  {
    versionKey: false
  }
);

/**
 * Atomically get the next sequential number and format as WCC-000001
 */
counterSchema.statics.getNextPatientId = async function () {
  const counter = await this.findByIdAndUpdate(
    'patientId',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(6, '0');
  return `WCC-${paddedSeq}`;
};

module.exports = mongoose.model('Counter', counterSchema);
