const Doctor = require('./doctor.model');
const User = require('../users/user.model');
const Consultation = require('../consultations/consultation.model');
const Referral = require('../referrals/referral.model');
const CampMember = require('../camps/campMember.model');
const { hashPassword } = require('../../utils/security');
const { getDoctorStats } = require('./doctor.service');
const { logAuditEvent } = require('../../services/audit.service');

// Get all doctors with stats and assigned camps (High-performance batch aggregation)
async function getDoctors(req, res) {
  try {
    const doctors = await Doctor.find()
      .populate('userId', 'email role accountStatus')
      .populate('profileImageAssetId')
      .populate('assignedCampId', 'name campCode district upazila status date venue')
      .sort({ createdAt: -1 })
      .lean();

    if (doctors.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const doctorIds = doctors.map(d => d._id);

    // Run parallel batch lookups & aggregations instead of N*5 sequential roundtrips
    const [campMembers, consultAgg, referralAgg, memberRoleAgg] = await Promise.all([
      CampMember.find({ doctorId: { $in: doctorIds } })
        .populate('campId', 'name campCode district upazila status date venue')
        .lean(),
      Consultation.aggregate([
        { $match: { doctorId: { $in: doctorIds } } },
        {
          $group: {
            _id: '$doctorId',
            totalConsultations: { $sum: 1 },
            uniquePatients: { $addToSet: '$patientId' }
          }
        }
      ]),
      Referral.aggregate([
        { $match: { referringDoctorId: { $in: doctorIds } } },
        { $group: { _id: '$referringDoctorId', count: { $sum: 1 } } }
      ]),
      CampMember.aggregate([
        { $match: { doctorId: { $in: doctorIds }, campRole: 'DOCTOR' } },
        { $group: { _id: '$doctorId', count: { $sum: 1 } } }
      ])
    ]);

    const campMemberMap = {};
    campMembers.forEach(cm => {
      if (cm.campId && cm.doctorId) {
        campMemberMap[cm.doctorId.toString()] = cm.campId;
      }
    });

    const consultMap = {};
    consultAgg.forEach(c => {
      consultMap[c._id.toString()] = {
        totalConsultations: c.totalConsultations || 0,
        uniquePatientsSeen: c.uniquePatients ? c.uniquePatients.length : 0
      };
    });

    const referralMap = {};
    referralAgg.forEach(r => {
      referralMap[r._id.toString()] = r.count || 0;
    });

    const memberRoleMap = {};
    memberRoleAgg.forEach(m => {
      memberRoleMap[m._id.toString()] = m.count || 0;
    });

    const doctorsWithStats = doctors.map(doc => {
      const docIdStr = doc._id.toString();
      const cData = consultMap[docIdStr] || { totalConsultations: 0, uniquePatientsSeen: 0 };
      const assignedCamp = doc.assignedCampId || campMemberMap[docIdStr] || null;

      let displayPhoto = doc.photoUrl;
      if (!displayPhoto && doc.profileImageAssetId) {
        displayPhoto = doc.profileImageAssetId.directUrl || `/api/images/${doc.profileImageAssetId._id || doc.profileImageAssetId}`;
      }

      const obj = { ...doc };
      if (req.user && req.user.role !== 'SUPER_ADMIN' && req.user._id?.toString() !== doc.userId?._id?.toString()) {
        delete obj.phone;
      }

      return {
        ...obj,
        assignedCamp,
        displayPhoto,
        stats: {
          totalConsultations: cData.totalConsultations,
          uniquePatientsSeen: cData.uniquePatientsSeen,
          totalReferrals: referralMap[docIdStr] || 0,
          assignedCampsCount: memberRoleMap[docIdStr] || 0
        }
      };
    });

    return res.json({
      success: true,
      data: doctorsWithStats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'চিকিৎসকদের তালিকা আনতে ব্যর্থ হয়েছে (Failed to fetch doctors)',
      error: error.message
    });
  }
}

// Create new doctor profile and linked login user (Super Admin only)
async function createDoctor(req, res) {
  try {
    const {
      fullName,
      email,
      password,
      specialty,
      designation,
      hospital,
      bmdcNumber,
      phone,
      assignedCampId,
      profileImageAssetId,
      photoUrl
    } = req.body;

    // Auto-generate clean email if omitted
    if (assignedCampId) {
      const Camp = require('../camps/camp.model');
      const targetCamp = await Camp.findById(assignedCampId);
      if (!targetCamp) {
        return res.status(404).json({ success: false, message: 'ক্যাম্প খুঁজে পাওয়া যায়নি' });
      }
      if (targetCamp.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: 'শুধুমাত্র চালু থাকা স্বাস্থ্য ক্যাম্পেই ডাক্তার যুক্ত করা যাবে। অনুগ্রহ করে প্রথমে ক্যাম্পটি চালু করুন।'
        });
      }
    }

    let normalizedEmail = email ? email.toLowerCase().trim() : '';
    if (!normalizedEmail) {
      const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
      const uniqueSuffix = cleanPhone.length >= 6 ? cleanPhone.slice(-6) : Math.floor(1000 + Math.random() * 9000);
      normalizedEmail = `dr.${uniqueSuffix}@wcc.org.bd`;
    }

    // Check if email already registered, make unique if auto-generated
    let existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (email) {
        return res.status(409).json({
          success: false,
          message: 'এই ইমেইল দিয়ে ইতিমধ্যে একজন ব্যবহারকারী নিবন্ধিত আছে (Email already registered)'
        });
      } else {
        normalizedEmail = `dr.${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)}@wcc.org.bd`;
      }
    }

    const passwordHash = await hashPassword(password || 'Doctor@123');

    // Create user account
    const user = await User.create({
      name: fullName,
      email: normalizedEmail,
      passwordHash,
      role: 'DOCTOR',
      accountStatus: 'ACTIVE'
    });

    // Create doctor profile
    const doctor = await Doctor.create({
      userId: user._id,
      fullName,
      specialty: specialty || 'সাধারণ শিশু রোগ',
      designation: designation || 'শিশু বিশেষজ্ঞ',
      hospital: hospital || '',
      bmdcNumber: bmdcNumber || '',
      phone: phone || '',
      assignedCampId: assignedCampId || null,
      profileImageAssetId: profileImageAssetId || null,
      photoUrl: photoUrl || '',
      accountStatus: 'ACTIVE'
    });

    // Create CampMember link if camp was selected
    if (assignedCampId) {
      const CampMember = require('../camps/campMember.model');
      await CampMember.findOneAndUpdate(
        { campId: assignedCampId, doctorId: doctor._id },
        {
          campId: assignedCampId,
          doctorId: doctor._id,
          userId: user._id,
          campRole: 'DOCTOR',
          assignedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'DOCTOR_CREATE',
      resourceType: 'Doctor',
      resourceId: doctor._id,
      result: 'SUCCESS',
      req,
      metadata: { doctorId: doctor._id, fullName: doctor.fullName, email: user.email, assignedCampId }
    });

    return res.status(201).json({
      success: true,
      message: 'চিকিৎসকের প্রোফাইল সফলভাবে তৈরি হয়েছে (Doctor created successfully)',
      data: {
        doctor,
        user: { id: user._id, email: user.email, role: user.role }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'চিকিৎসক যুক্ত করতে সমস্যা হয়েছে (Failed to create doctor)',
      error: error.message
    });
  }
}

// Get single doctor details and consultation history
async function getDoctorById(req, res) {
  try {
    const { doctorId } = req.params;
    const doctor = await Doctor.findById(doctorId)
      .populate('userId', 'email role accountStatus lastLoginAt')
      .populate('profileImageAssetId')
      .populate('assignedCampId', 'name campCode district upazila status date venue');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'চিকিৎসক পাওয়া যায়নি (Doctor not found)'
      });
    }

    const stats = await getDoctorStats(doctor._id);

    // Recent consultations by this doctor
    const recentConsultations = await Consultation.find({ doctorId: doctor._id })
      .populate('patientId', 'patientId fullName ageYears sex')
      .populate('campId', 'name campCode date')
      .sort({ startedAt: -1 })
      .limit(20);

    const doctorObj = doctor.toObject();
    if (req.user.role !== 'SUPER_ADMIN' && req.user._id.toString() !== doctor.userId?._id?.toString()) {
      delete doctorObj.phone;
    }

    let displayPhoto = doctor.photoUrl;
    if (!displayPhoto && doctor.profileImageAssetId) {
      displayPhoto = doctor.profileImageAssetId.directUrl || `/api/images/${doctor.profileImageAssetId._id || doctor.profileImageAssetId}`;
    }

    return res.json({
      success: true,
      data: {
        ...doctorObj,
        displayPhoto,
        stats,
        recentConsultations
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'চিকিৎসকের তথ্য লোড করতে সমস্যা হয়েছে (Failed to get doctor details)',
      error: error.message
    });
  }
}

// Update doctor profile
async function updateDoctor(req, res) {
  try {
    const { doctorId } = req.params;
    const { fullName, specialty, designation, hospital, bmdcNumber, phone, assignedCampId, profileImageAssetId, photoUrl, accountStatus } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'চিকিৎসক পাওয়া যায়নি (Doctor not found)'
      });
    }

    // Authorization: only Super Admin or doctor updating their own non-status details
    if (req.user.role !== 'SUPER_ADMIN' && req.doctor?._id?.toString() !== doctorId) {
      return res.status(403).json({
        success: false,
        message: 'অনুমতি নেই (Unauthorized)'
      });
    }

    if (fullName) doctor.fullName = fullName;
    if (specialty) doctor.specialty = specialty;
    if (designation) doctor.designation = designation;
    if (hospital !== undefined) doctor.hospital = hospital;
    if (bmdcNumber !== undefined) doctor.bmdcNumber = bmdcNumber;
    if (phone !== undefined) doctor.phone = phone;
    if (profileImageAssetId !== undefined) doctor.profileImageAssetId = profileImageAssetId || null;
    if (photoUrl !== undefined) doctor.photoUrl = photoUrl;

    if (assignedCampId !== undefined) {
      if (assignedCampId) {
        const Camp = require('../camps/camp.model');
        const targetCamp = await Camp.findById(assignedCampId);
        if (!targetCamp) {
          return res.status(404).json({ success: false, message: 'ক্যাম্প খুঁজে পাওয়া যায়নি' });
        }
        if (targetCamp.status !== 'ACTIVE') {
          return res.status(400).json({
            success: false,
            message: 'শুধুমাত্র চালু থাকা স্বাস্থ্য ক্যাম্পেই ডাক্তার যুক্ত করা যাবে। অনুগ্রহ করে প্রথমে ক্যাম্পটি চালু করুন।'
          });
        }
      }
      doctor.assignedCampId = assignedCampId || null;
      if (assignedCampId) {
        const CampMember = require('../camps/campMember.model');
        await CampMember.findOneAndUpdate(
          { campId: assignedCampId, doctorId: doctor._id },
          {
            campId: assignedCampId,
            doctorId: doctor._id,
            userId: doctor.userId,
            campRole: 'DOCTOR',
            assignedAt: new Date()
          },
          { upsert: true, new: true }
        );
      }
    }

    if (accountStatus && req.user.role === 'SUPER_ADMIN') {
      doctor.accountStatus = accountStatus;
      await User.findByIdAndUpdate(doctor.userId, { accountStatus });
    }

    await doctor.save();

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'DOCTOR_UPDATE',
      resourceType: 'Doctor',
      resourceId: doctor._id,
      result: 'SUCCESS',
      req
    });

    return res.json({
      success: true,
      message: 'চিকিৎসকের প্রোফাইল আপডেট করা হয়েছে (Doctor updated successfully)',
      data: doctor
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'চিকিৎসক আপডেট ব্যর্থ হয়েছে (Failed to update doctor)',
      error: error.message
    });
  }
}

module.exports = {
  getDoctors,
  createDoctor,
  getDoctorById,
  updateDoctor
};
