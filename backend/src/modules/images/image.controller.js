const ImageAsset = require('./imageAsset.model');
const imageStorageAdapter = require('./imageStorage.adapter');
const { logAuditEvent } = require('../../services/audit.service');

// Upload image (Doctor photo, Volunteer photo, or Prescription)
async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'কোনো ফাইল নির্বাচন করা হয়নি (No image file uploaded)'
      });
    }

    const { category, relatedRecordId } = req.body;
    const isConfidential = category === 'PRESCRIPTION';

    // RBAC for prescription upload: only Doctors or Super Admins can upload prescriptions
    if (isConfidential && req.user.role !== 'DOCTOR' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'প্রেসক্রিপশন আপলোড করার অনুমতি শুধুমাত্র চিকিৎসকদের রয়েছে (Only doctors can upload prescriptions)'
      });
    }

    const uploadResult = await imageStorageAdapter.uploadImage(req.file, {
      category: category || 'DOCTOR_PROFILE',
      isConfidential,
      relatedRecordId: relatedRecordId || null,
      user: req.user
    });

    const imageAsset = await ImageAsset.create({
      provider: uploadResult.provider,
      providerAssetId: uploadResult.providerAssetId,
      storageReference: uploadResult.storageReference,
      category: uploadResult.category,
      isConfidential: uploadResult.isConfidential,
      mimeType: uploadResult.mimeType,
      fileSizeBytes: uploadResult.fileSizeBytes,
      relatedRecordId: uploadResult.relatedRecordId,
      uploadedBy: req.user._id
    });

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'IMAGE_UPLOAD',
      resourceType: 'ImageAsset',
      resourceId: imageAsset._id,
      result: 'SUCCESS',
      req,
      metadata: { category: imageAsset.category, isConfidential }
    });

    return res.status(201).json({
      success: true,
      message: 'ছবি সফলভাবে সংরক্ষিত হয়েছে (Image uploaded successfully)',
      data: {
        assetId: imageAsset._id,
        category: imageAsset.category,
        isConfidential: imageAsset.isConfidential,
        mimeType: imageAsset.mimeType,
        url: `/api/images/${imageAsset._id}`
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'ছবি আপলোড ব্যর্থ হয়েছে (Image upload failed)'
    });
  }
}

// Retrieve image stream (Guarded with medical privacy RBAC)
async function getImage(req, res) {
  try {
    const { assetId } = req.params;
    const imageAsset = await ImageAsset.findById(assetId);

    if (!imageAsset) {
      return res.status(404).json({
        success: false,
        message: 'ছবি খুঁজে পাওয়া যায়নি (Image not found)'
      });
    }

    // Confidentiality Check:
    // Prescriptions require authenticated field staff (Doctor, Super Admin, Coordinator, Volunteer)
    if (imageAsset.isConfidential) {
      const allowedRoles = ['DOCTOR', 'SUPER_ADMIN', 'CAMP_COORDINATOR', 'REGISTRATION_VOLUNTEER'];
      const isAllowed = req.user && allowedRoles.includes(req.user.role);

      if (!isAllowed) {
        await logAuditEvent({
          actorId: req.user?._id || null,
          actorRole: req.user?.role || 'anonymous',
          action: 'CONFIDENTIAL_IMAGE_ACCESS',
          resourceType: 'ImageAsset',
          resourceId: imageAsset._id,
          result: 'DENIED',
          req
        });
        return res.status(403).json({
          success: false,
          message: 'গোপনীয় প্রেসক্রিপশন দেখার অনুমতি আপনার নেই (Access to confidential medical record denied)'
        });
      }

      await logAuditEvent({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'CONFIDENTIAL_IMAGE_ACCESS',
        resourceType: 'ImageAsset',
        resourceId: imageAsset._id,
        result: 'SUCCESS',
        req
      });
    }

    const { stream, mimeType, size } = await imageStorageAdapter.getImageStream(imageAsset);

    res.setHeader('Content-Type', mimeType);
    if (size) res.setHeader('Content-Length', size);
    res.setHeader('Cache-Control', imageAsset.isConfidential ? 'private, no-cache, no-store' : 'public, max-age=86400');

    stream.pipe(res);
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message || 'ছবি লোড করা যায়নি (Failed to load image)'
    });
  }
}

module.exports = {
  uploadImage,
  getImage
};
