const Camp = require('./camp.model');
const CampMember = require('./campMember.model');
const Doctor = require('../doctors/doctor.model');
const Volunteer = require('../volunteers/volunteer.model');
const { generateCampCode, getCampStats } = require('./camp.service');
const { logAuditEvent } = require('../../services/audit.service');

// Get all camps (with filtering by status or role)
async function getCamps(req, res) {
  try {
    const query = {};
    if (req.query.status) {
      query.status = req.query.status.toUpperCase();
    }

    // If doctor or volunteer, only return camps they are assigned to (unless Super Admin)
    if (req.user.role === 'DOCTOR') {
      const assigned = await CampMember.find({
        $or: [{ userId: req.user._id }, ...(req.doctor ? [{ doctorId: req.doctor._id }] : [])]
      }).select('campId');
      query._id = { $in: assigned.map(a => a.campId) };
    } else if (req.user.role === 'REGISTRATION_VOLUNTEER' || req.user.role === 'CAMP_COORDINATOR') {
      const assigned = await CampMember.find({ userId: req.user._id }).select('campId');
      query._id = { $in: assigned.map(a => a.campId) };
    }

    const camps = await Camp.find(query).sort({ date: -1, createdAt: -1 });

    // Attach basic stats for each camp
    const campsWithStats = await Promise.all(
      camps.map(async camp => {
        const stats = await getCampStats(camp._id);
        return {
          ...camp.toObject(),
          stats
        };
      })
    );

    return res.json({
      success: true,
      data: campsWithStats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'ক্যাম্প তালিকা লোড করতে সমস্যা হয়েছে (Failed to fetch camps)',
      error: error.message
    });
  }
}

// Create new health camp (Super Admin only)
async function createCamp(req, res) {
  try {
    let { name, date, district, upazila, venue, isPourashava, pourashavaName, description, organizerName } = req.body;
    const campCode = req.body.campCode || (await generateCampCode());

    if (!upazila || !upazila.trim()) {
      upazila = (isPourashava && pourashavaName) ? pourashavaName : `${district} সদর`;
    }

    const camp = await Camp.create({
      campCode,
      name: name.trim(),
      date: new Date(date),
      district: district.trim(),
      upazila: upazila.trim(),
      venue: venue.trim(),
      isPourashava: Boolean(isPourashava),
      pourashavaName: isPourashava ? (pourashavaName || '').trim() : '',
      description: (description || '').trim(),
      organizerName: organizerName || 'We Can Change (WCC)',
      status: 'DRAFT',
      createdBy: req.user._id
    });

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'CAMP_CREATE',
      resourceType: 'Camp',
      resourceId: camp._id,
      result: 'SUCCESS',
      req,
      metadata: { campCode: camp.campCode, name: camp.name }
    });

    return res.status(201).json({
      success: true,
      message: 'নতুন স্বাস্থ্য ক্যাম্প সফলভাবে তৈরি হয়েছে (Camp created successfully)',
      data: camp
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'ক্যাম্প তৈরি করতে সমস্যা হয়েছে (Failed to create camp)',
      error: error.message
    });
  }
}

// Get single camp details with complete statistics
async function getCampById(req, res) {
  try {
    const { campId } = req.params;
    const camp = await Camp.findById(campId).populate('createdBy', 'name email');
    if (!camp) {
      return res.status(404).json({
        success: false,
        message: 'ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)'
      });
    }

    const stats = await getCampStats(camp._id);

    return res.json({
      success: true,
      data: {
        ...camp.toObject(),
        stats
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'ক্যাম্পের তথ্য লোড করতে সমস্যা হয়েছে (Failed to fetch camp details)',
      error: error.message
    });
  }
}

// Update camp details
async function updateCamp(req, res) {
  try {
    const { campId } = req.params;
    const { name, date, district, upazila, venue, description, organizerName } = req.body;

    const camp = await Camp.findById(campId);
    if (!camp) {
      return res.status(404).json({
        success: false,
        message: 'ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)'
      });
    }

    if (name) camp.name = name;
    if (date) camp.date = new Date(date);
    if (district) camp.district = district;
    if (upazila) camp.upazila = upazila;
    if (venue) camp.venue = venue;
    if (description !== undefined) camp.description = description;
    if (organizerName) camp.organizerName = organizerName;

    await camp.save();

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'CAMP_UPDATE',
      resourceType: 'Camp',
      resourceId: camp._id,
      result: 'SUCCESS',
      req
    });

    return res.json({
      success: true,
      message: 'ক্যাম্পের তথ্য আপডেট করা হয়েছে (Camp updated successfully)',
      data: camp
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'ক্যাম্প আপডেট ব্যর্থ হয়েছে (Failed to update camp)',
      error: error.message
    });
  }
}

// Activate health camp (ক্যাম্প চালু করুন)
async function activateCamp(req, res) {
  try {
    const { campId } = req.params;
    const camp = await Camp.findById(campId);
    if (!camp) {
      return res.status(404).json({
        success: false,
        message: 'ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)'
      });
    }

    if (camp.status === 'ACTIVE') {
      return res.json({
        success: true,
        message: 'স্বাস্থ্য ক্যাম্পটি ইতিমধ্যে চালু আছে',
        data: camp
      });
    }

    camp.status = 'ACTIVE';
    camp.activatedAt = new Date();
    await camp.save();

    await logAuditEvent({
      actorId: req.user?._id || null,
      actorRole: req.user?.role || 'SUPER_ADMIN',
      action: 'CAMP_ACTIVATE',
      resourceType: 'Camp',
      resourceId: camp._id,
      result: 'SUCCESS',
      req,
      metadata: { campCode: camp.campCode, activatedAt: camp.activatedAt }
    });

    return res.json({
      success: true,
      message: 'স্বাস্থ্য ক্যাম্পটি সফলভাবে চালু করা হয়েছে (Camp activated successfully)',
      data: camp
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'ক্যাম্প চালু করতে সমস্যা হয়েছে (Failed to activate camp)',
      error: error.message
    });
  }
}

// Close health camp (ক্যাম্প বন্ধ করুন)
async function closeCamp(req, res) {
  try {
    const { campId } = req.params;
    const camp = await Camp.findById(campId);
    if (!camp) {
      return res.status(404).json({
        success: false,
        message: 'ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)'
      });
    }

    if (camp.status === 'CLOSED') {
      return res.json({
        success: true,
        message: 'স্বাস্থ্য ক্যাম্পটি ইতিমধ্যে অফ করা আছে',
        data: camp
      });
    }

    camp.status = 'CLOSED';
    camp.closedAt = new Date();
    await camp.save();

    await logAuditEvent({
      actorId: req.user?._id || null,
      actorRole: req.user?.role || 'SUPER_ADMIN',
      action: 'CAMP_CLOSE',
      resourceType: 'Camp',
      resourceId: camp._id,
      result: 'SUCCESS',
      req,
      metadata: { campCode: camp.campCode, closedAt: camp.closedAt }
    });

    return res.json({
      success: true,
      message: 'স্বাস্থ্য ক্যাম্পটি বন্ধ করা হয়েছে (Camp closed successfully)',
      data: camp
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'ক্যাম্প বন্ধ করতে সমস্যা হয়েছে (Failed to close camp)',
      error: error.message
    });
  }
}

// Toggle health camp status (চালু থাকলে অফ, বন্ধ/ড্রাফট থাকলে চালু)
async function toggleCamp(req, res) {
  try {
    const { campId } = req.params;
    const camp = await Camp.findById(campId);
    if (!camp) {
      return res.status(404).json({
        success: false,
        message: 'ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)'
      });
    }

    const isCurrentlyActive = camp.status === 'ACTIVE';
    if (isCurrentlyActive) {
      camp.status = 'CLOSED';
      camp.closedAt = new Date();
    } else {
      camp.status = 'ACTIVE';
      camp.activatedAt = new Date();
    }
    await camp.save();

    await logAuditEvent({
      actorId: req.user?._id || null,
      actorRole: req.user?.role || 'SUPER_ADMIN',
      action: camp.status === 'ACTIVE' ? 'CAMP_ACTIVATE' : 'CAMP_CLOSE',
      resourceType: 'Camp',
      resourceId: camp._id,
      result: 'SUCCESS',
      req,
      metadata: { campCode: camp.campCode, status: camp.status }
    });

    return res.json({
      success: true,
      message: camp.status === 'ACTIVE' 
        ? 'স্বাস্থ্য ক্যাম্পটি সফলভাবে চালু করা হয়েছে' 
        : 'স্বাস্থ্য ক্যাম্পটি অফ করা হয়েছে',
      data: camp
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'ক্যাম্প স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে',
      error: error.message
    });
  }
}

// Get members assigned to a camp
async function getCampMembers(req, res) {
  try {
    const { campId } = req.params;
    const members = await CampMember.find({ campId })
      .populate({
        path: 'doctorId',
        populate: { path: 'profileImageAssetId' }
      })
      .populate({
        path: 'volunteerId',
        populate: { path: 'profileImageAssetId' }
      })
      .populate('userId', 'name email role');

    return res.json({
      success: true,
      data: members
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'সদস্য তালিকা আনতে সমস্যা হয়েছে (Failed to get camp members)',
      error: error.message
    });
  }
}

// Assign member (doctor or volunteer) to camp
async function assignCampMember(req, res) {
  try {
    const { campId } = req.params;
    const { doctorId, volunteerId, userId, campRole } = req.body;

    const camp = await Camp.findById(campId);
    if (!camp) {
      return res.status(404).json({
        success: false,
        message: 'ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)'
      });
    }

    if (camp.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'শুধুমাত্র চালু থাকা স্বাস্থ্য ক্যাম্পেই ডাক্তার ও ভলান্টিয়ার যুক্ত করা যাবে। অনুগ্রহ করে প্রথমে ক্যাম্পটি চালু করুন।'
      });
    }

    // Verify entity existence
    let resolvedUserId = userId;
    if (doctorId) {
      const doc = await Doctor.findById(doctorId);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'চিকিৎসক পাওয়া যায়নি (Doctor not found)' });
      }
      resolvedUserId = doc.userId;
    } else if (volunteerId) {
      const vol = await Volunteer.findById(volunteerId);
      if (!vol) {
        return res.status(404).json({ success: false, message: 'স্বেচ্ছাসেবক পাওয়া যায়নি (Volunteer not found)' });
      }
      if (vol.userId) resolvedUserId = vol.userId;
    }

    const member = await CampMember.create({
      campId,
      doctorId: doctorId || null,
      volunteerId: volunteerId || null,
      userId: resolvedUserId || null,
      campRole
    });

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'CAMP_MEMBER_ASSIGN',
      resourceType: 'CampMember',
      resourceId: member._id,
      result: 'SUCCESS',
      req,
      metadata: { campId, campRole, doctorId, volunteerId }
    });

    return res.status(201).json({
      success: true,
      message: 'সদস্য ক্যাম্পে সফলভাবে নিযুক্ত করা হয়েছে (Member assigned to camp successfully)',
      data: member
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'এই সদস্য ইতিমধ্যে এই ক্যাম্পে নিযুক্ত আছেন (Member already assigned to this camp)'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'সদস্য নিয়োগে ব্যর্থ হয়েছে (Failed to assign member)',
      error: error.message
    });
  }
}

// Remove member from camp
async function removeCampMember(req, res) {
  try {
    const { campId, memberId } = req.params;
    const deleted = await CampMember.findOneAndDelete({ _id: memberId, campId });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'সদস্য অ্যাসাইনমেন্ট খুঁজে পাওয়া যায়নি (Camp member assignment not found)'
      });
    }

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'CAMP_MEMBER_REMOVE',
      resourceType: 'CampMember',
      resourceId: memberId,
      result: 'SUCCESS',
      req
    });

    return res.json({
      success: true,
      message: 'সদস্যকে ক্যাম্প থেকে অব্যাহতি দেওয়া হয়েছে (Member removed from camp successfully)'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'সদস্য বাতিল ব্যর্থ হয়েছে (Failed to remove member)',
      error: error.message
    });
  }
}

module.exports = {
  getCamps,
  createCamp,
  getCampById,
  updateCamp,
  activateCamp,
  closeCamp,
  toggleCamp,
  getCampMembers,
  assignCampMember,
  removeCampMember
};
