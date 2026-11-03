const Volunteer = require('./volunteer.model');
const User = require('../users/user.model');
const CampMember = require('../camps/campMember.model');
const Visit = require('../visits/visit.model');
const { hashPassword } = require('../../utils/security');
const { logAuditEvent } = require('../../services/audit.service');

// Get all volunteers
async function getVolunteers(req, res) {
  try {
    const volunteers = await Volunteer.find()
      .populate('userId', 'email role accountStatus')
      .populate('profileImageAssetId')
      .populate('assignedCampId', 'name campCode district upazila status date venue')
      .sort({ fullName: 1 });

    const volunteerIds = volunteers.map(v => v._id);
    const userIds = volunteers.map(v => v.userId?._id || v.userId).filter(Boolean);

    const campMembers = await CampMember.find({
      $or: [
        { volunteerId: { $in: volunteerIds } },
        { userId: { $in: userIds } }
      ]
    }).populate('campId', 'name campCode district upazila status date venue');

    const campMemberMap = {};
    const userCampMemberMap = {};
    campMembers.forEach(cm => {
      if (cm.campId) {
        if (cm.volunteerId) {
          campMemberMap[cm.volunteerId.toString()] = cm.campId;
        }
        if (cm.userId) {
          const uId = (cm.userId._id || cm.userId).toString();
          userCampMemberMap[uId] = cm.campId;
        }
      }
    });

    const volunteersWithStats = await Promise.all(
      volunteers.map(async vol => {
        let registrationCount = 0;
        const uId = vol.userId?._id || vol.userId;
        if (uId) {
          registrationCount = await Visit.countDocuments({ registeredBy: uId });
        }
        const assignedCampsCount = await CampMember.countDocuments({
          $or: [
            { volunteerId: vol._id },
            ...(uId ? [{ userId: uId }] : [])
          ]
        });
        const assignedCamp = vol.assignedCampId || campMemberMap[vol._id.toString()] || (uId ? userCampMemberMap[uId.toString()] : null) || null;

        return {
          ...vol.toObject(),
          assignedCamp,
          stats: {
            registrationCount,
            assignedCampsCount
          }
        };
      })
    );

    return res.json({
      success: true,
      data: volunteersWithStats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'স্বেচ্ছাসেবকদের তালিকা লোড ব্যর্থ হয়েছে (Failed to fetch volunteers)',
      error: error.message
    });
  }
}

// Create new volunteer (Super Admin only)
async function createVolunteer(req, res) {
  try {
    const {
      fullName,
      phone,
      email,
      password,
      responsibility,
      createLoginAccount,
      profileImageAssetId,
      assignedCampId
    } = req.body;

    if (assignedCampId) {
      const Camp = require('../camps/camp.model');
      const targetCamp = await Camp.findById(assignedCampId);
      if (!targetCamp) {
        return res.status(404).json({ success: false, message: 'ক্যাম্প খুঁজে পাওয়া যায়নি' });
      }
      if (targetCamp.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: 'শুধুমাত্র চালু থাকা স্বাস্থ্য ক্যাম্পেই স্বেচ্ছাসেবক যুক্ত করা যাবে। অনুগ্রহ করে প্রথমে ক্যাম্পটি চালু করুন।'
        });
      }
    }

    let createdUser = null;

    if (createLoginAccount && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'এই ইমেইল দিয়ে ইতিমধ্যে একজন ব্যবহারকারী রয়েছে (Email already exists)'
        });
      }

      const passwordHash = await hashPassword(password || 'wccVolunteer@123');
      createdUser = await User.create({
        name: fullName,
        email: normalizedEmail,
        passwordHash,
        role: responsibility === 'Coordination' ? 'CAMP_COORDINATOR' : 'REGISTRATION_VOLUNTEER',
        accountStatus: 'ACTIVE'
      });
    }

    const volunteer = await Volunteer.create({
      userId: createdUser ? createdUser._id : null,
      fullName,
      phone,
      email: email ? email.toLowerCase().trim() : '',
      responsibility: responsibility || 'Registration Desk',
      profileImageAssetId: profileImageAssetId || null,
      assignedCampId: assignedCampId || null,
      accountStatus: 'ACTIVE'
    });

    if (assignedCampId) {
      await CampMember.findOneAndUpdate(
        { campId: assignedCampId, volunteerId: volunteer._id },
        {
          campId: assignedCampId,
          volunteerId: volunteer._id,
          userId: createdUser ? createdUser._id : null,
          campRole: responsibility === 'Coordination' ? 'COORDINATOR' : 'VOLUNTEER',
          assignedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    await logAuditEvent({
      actorId: req.user?._id || null,
      actorRole: req.user?.role || 'SUPER_ADMIN',
      action: 'VOLUNTEER_CREATE',
      resourceType: 'Volunteer',
      resourceId: volunteer._id,
      result: 'SUCCESS',
      req,
      metadata: { fullName: volunteer.fullName, responsibility: volunteer.responsibility }
    });

    return res.status(201).json({
      success: true,
      message: 'স্বেচ্ছাসেবক সফলভাবে যুক্ত করা হয়েছে (Volunteer created successfully)',
      data: volunteer
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'স্বেচ্ছাসেবক যুক্ত করতে ব্যর্থ হয়েছে (Failed to create volunteer)',
      error: error.message
    });
  }
}

// Update volunteer
async function updateVolunteer(req, res) {
  try {
    const { volunteerId } = req.params;
    const { fullName, phone, responsibility, accountStatus, profileImageAssetId, assignedCampId } = req.body;

    const volunteer = await Volunteer.findById(volunteerId);
    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'স্বেচ্ছাসেবক পাওয়া যায়নি (Volunteer not found)'
      });
    }

    if (fullName) volunteer.fullName = fullName;
    if (phone) volunteer.phone = phone;
    if (responsibility) volunteer.responsibility = responsibility;
    if (profileImageAssetId !== undefined) volunteer.profileImageAssetId = profileImageAssetId || null;

    if (assignedCampId !== undefined) {
      if (assignedCampId) {
        const Camp = require('../camps/camp.model');
        const targetCamp = await Camp.findById(assignedCampId);
        if (!targetCamp) {
          return res.status(404).json({ success: false, message: 'ক্যাম্প খুঁজে পাওয়া যায়নি' });
        }
        volunteer.assignedCampId = assignedCampId;
        const volFilter = {
          $or: [
            { volunteerId: volunteer._id },
            ...(volunteer.userId ? [{ userId: volunteer.userId }] : [])
          ]
        };
        await CampMember.findOneAndUpdate(
          volFilter,
          {
            campId: assignedCampId,
            volunteerId: volunteer._id,
            userId: volunteer.userId || null,
            campRole: (responsibility || volunteer.responsibility) === 'Coordination' ? 'COORDINATOR' : 'VOLUNTEER',
            assignedAt: new Date()
          },
          { upsert: true, new: true }
        );
      } else {
        volunteer.assignedCampId = null;
        await CampMember.deleteMany({
          $or: [
            { volunteerId: volunteer._id },
            ...(volunteer.userId ? [{ userId: volunteer.userId }] : [])
          ]
        });
      }
    }

    if (accountStatus && req.user && req.user.role === 'SUPER_ADMIN') {
      volunteer.accountStatus = accountStatus;
      if (volunteer.userId) {
        await User.findByIdAndUpdate(volunteer.userId, { accountStatus });
      }
    }

    await volunteer.save();

    await logAuditEvent({
      actorId: req.user?._id || null,
      actorRole: req.user?.role || 'SUPER_ADMIN',
      action: 'VOLUNTEER_UPDATE',
      resourceType: 'Volunteer',
      resourceId: volunteer._id,
      result: 'SUCCESS',
      req
    });

    return res.json({
      success: true,
      message: 'স্বেচ্ছাসেবকের তথ্য আপডেট হয়েছে (Volunteer updated successfully)',
      data: volunteer
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'স্বেচ্ছাসেবক আপডেট ব্যর্থ হয়েছে (Failed to update volunteer)',
      error: error.message
    });
  }
}

module.exports = {
  getVolunteers,
  createVolunteer,
  updateVolunteer
};
