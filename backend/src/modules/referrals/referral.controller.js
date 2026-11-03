const Referral = require('./referral.model');
const { logAuditEvent } = require('../../services/audit.service');

// Get referrals (optionally filtered by campId or status)
async function getReferrals(req, res) {
  try {
    const { campId, status } = req.query;
    const filter = {};
    if (campId) filter.campId = campId;
    if (status) filter.status = status;

    const referrals = await Referral.find(filter)
      .populate('patientId', 'patientId fullName ageYears sex guardianName guardianPhone')
      .populate('campId', 'name campCode date')
      .populate('referringDoctorId', 'fullName specialty designation')
      .populate('consultationId', 'diagnosis notes')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: referrals
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'রেফারেল তালিকা আনতে ব্যর্থ হয়েছে (Failed to get referrals)',
      error: error.message
    });
  }
}

// Update referral follow-up
async function updateReferral(req, res) {
  try {
    const { referralId } = req.params;
    const { status, followUpDate, followUpNotes, referredHospital } = req.body;

    const referral = await Referral.findById(referralId);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'রেফারেল রেকর্ড পাওয়া যায়নি (Referral not found)'
      });
    }

    if (status) referral.status = status;
    if (followUpDate) referral.followUpDate = new Date(followUpDate);
    if (followUpNotes !== undefined) referral.followUpNotes = followUpNotes;
    if (referredHospital) referral.referredHospital = referredHospital;

    await referral.save();

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'REFERRAL_UPDATE',
      resourceType: 'Referral',
      resourceId: referral._id,
      result: 'SUCCESS',
      req,
      metadata: { status: referral.status }
    });

    return res.json({
      success: true,
      message: 'রেফারেল ফলোআপ আপডেট হয়েছে (Referral updated successfully)',
      data: referral
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'রেফারেল আপডেট ব্যর্থ হয়েছে (Failed to update referral)',
      error: error.message
    });
  }
}

module.exports = {
  getReferrals,
  updateReferral
};
