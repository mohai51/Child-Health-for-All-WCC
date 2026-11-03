const mongoose = require('mongoose');

const campMemberSchema = new mongoose.Schema(
  {
    campId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camp',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
      index: true
    },
    volunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Volunteer',
      default: null,
      index: true
    },
    campRole: {
      type: String,
      enum: ['DOCTOR', 'VOLUNTEER', 'COORDINATOR'],
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate assignment using partialFilterExpression so null values do not collide
campMemberSchema.index(
  { campId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true, $ne: null } } }
);
campMemberSchema.index(
  { campId: 1, doctorId: 1 },
  { unique: true, partialFilterExpression: { doctorId: { $exists: true, $ne: null } } }
);
campMemberSchema.index(
  { campId: 1, volunteerId: 1 },
  { unique: true, partialFilterExpression: { volunteerId: { $exists: true, $ne: null } } }
);

module.exports = mongoose.model('CampMember', campMemberSchema);
