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

/**
 * Atomically get the next sequential visit token for a specific camp
 * Ensures 100% collision-free tokens even when multiple volunteers register simultaneously
 */
counterSchema.statics.getNextVisitToken = async function (campId) {
  const counterId = `camp_${campId}_token`;

  // Synchronize with existing records if counter doesn't exist yet
  const existingCounter = await this.findById(counterId);
  if (!existingCounter) {
    const Visit = mongoose.model('Visit');
    const existingCount = await Visit.countDocuments({ campId });
    await this.findByIdAndUpdate(
      counterId,
      { $setOnInsert: { seq: existingCount } },
      { upsert: true }
    );
  }

  const counter = await this.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
