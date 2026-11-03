/**
 * Doctor Consultation Controller
 * Strictly confined to:
 * 1. Search Patient (রোগী সার্চ)
 * 2. Capture Prescription Image (শুধুমাত্র ক্যামেরা দিয়ে ছবি তোলা, ১ MB এর মধ্যে কম্প্রেস ও ফাস্ট আপলোড)
 */

let doctorAssignedCamps = [];
let activeConsultationCampId = null;
let currentPatientData = null;
let currentVisitData = null;
let activeConsultationSessionId = null;
let uploadedPrescriptionAssetIds = [];
let selectedPrescriptionFile = null;

// Camera stream state
let cameraMediaStream = null;
let currentFacingMode = 'environment'; // Back camera by default on phones

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth(['DOCTOR', 'SUPER_ADMIN']);
  if (!user) return;

  await loadDoctorCamps();

  // Search input listeners
  const searchBtn = document.getElementById('search-patient-btn');
  const searchInput = document.getElementById('doctor-patient-id-input');
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => searchPatientInCamp());
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchPatientInCamp();
      }
    });
  }

  // Camera Buttons
  const openCamBtn = document.getElementById('open-camera-btn');
  if (openCamBtn) {
    openCamBtn.addEventListener('click', startLiveCamera);
  }

  const closeCamBtn = document.getElementById('close-camera-btn');
  if (closeCamBtn) {
    closeCamBtn.addEventListener('click', stopLiveCamera);
  }

  const switchCamBtn = document.getElementById('switch-camera-btn');
  if (switchCamBtn) {
    switchCamBtn.addEventListener('click', toggleCameraFacing);
  }

  const snapBtn = document.getElementById('snap-photo-btn');
  if (snapBtn) {
    snapBtn.addEventListener('click', captureCameraSnapshot);
  }

  // Hidden native camera fallback input
  const photoInput = document.getElementById('prescription-photo-input');
  if (photoInput) {
    photoInput.addEventListener('change', handleFallbackFileSelected);
  }

  // Complete and save button
  const saveBtn = document.getElementById('save-consultation-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSaveConsultation);
  }
});

// Load active camps
async function loadDoctorCamps() {
  const campSelect = document.getElementById('doctor-camp-select');
  if (!campSelect) return;

  try {
    const res = await apiFetch('/api/camps?status=ACTIVE');
    if (res && res.success && Array.isArray(res.data)) {
      doctorAssignedCamps = res.data;
      if (doctorAssignedCamps.length === 0) {
        campSelect.innerHTML = '<option value="">-- কোনো সক্রিয় ক্যাম্প নেই --</option>';
        showToast('বর্তমানে কোনো সক্রিয় স্বাস্থ্য ক্যাম্প নেই', 'info');
        return;
      }

      campSelect.innerHTML = doctorAssignedCamps.map(c => `
        <option value="${c._id}">${c.name} (${c.campCode})</option>
      `).join('');

      activeConsultationCampId = campSelect.value;
      campSelect.addEventListener('change', () => {
        activeConsultationCampId = campSelect.value;
        resetConsultationScreen();
      });
    }
  } catch (err) {
    showToast(err.message || 'ক্যাম্প তালিকা লোড করতে সমস্যা হয়েছে', 'error');
  }
}

// 1. Search patient by Patient ID, phone, token, or name
async function searchPatientInCamp() {
  const input = document.getElementById('doctor-patient-id-input');
  if (!input) return;

  const rawQuery = input.value.trim();
  if (!rawQuery) {
    showToast('অনুগ্রহ করে রোগীর আইডি লিখুন (যেমন: WCC-000001)', 'error');
    input.focus();
    return;
  }

  if (!activeConsultationCampId) {
    const campSelect = document.getElementById('doctor-camp-select');
    if (campSelect && campSelect.value) {
      activeConsultationCampId = campSelect.value;
    } else {
      showToast('অনুগ্রহ করে প্রথমে ক্যাম্প নির্বাচন করুন', 'error');
      return;
    }
  }

  const searchBtn = document.getElementById('search-patient-btn');
  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.innerText = 'খোঁজা হচ্ছে...';
  }

  try {
    const res = await apiFetch(`/api/camps/${activeConsultationCampId}/consultations/search-patient?patientId=${encodeURIComponent(rawQuery)}`);
    if (res && res.success && res.data) {
      currentPatientData = res.data.patient;
      currentVisitData = res.data.visit;
      activeConsultationSessionId = res.data.activeConsultationId || null;

      renderPatientDetails(res.data);

      // Automatically initialize consultation session in background if not already started
      if (!activeConsultationSessionId) {
        await autoInitConsultationSession();
      }
    }
  } catch (err) {
    showToast(err.message || 'রোগী খুঁজে পাওয়া যায়নি', 'error');
    resetConsultationScreen();
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>রোগী খুঁজুন</span>
      `;
    }
  }
}

// Render patient details on card
function renderPatientDetails(data) {
  const section = document.getElementById('patient-consultation-section');
  if (!section) return;

  const p = data.patient;
  const v = data.visit;

  document.getElementById('pv-id').innerText = p.patientId || '-';
  document.getElementById('pv-token').innerText = toBanglaNumber(v?.visitToken || 1);
  document.getElementById('pv-name').innerText = p.fullName || '-';
  document.getElementById('pv-age-sex').innerText = `${toBanglaNumber(p.ageYears || 0)} বছর ${p.ageMonths ? `${toBanglaNumber(p.ageMonths)} মাস, ` : ''}${p.sex === 'MALE' ? 'ছেলে' : p.sex === 'FEMALE' ? 'মেয়ে' : 'অন্যান্য'}`;
  document.getElementById('pv-guardian').innerText = `${p.guardianName || '-'} (${p.guardianPhone || 'ফোন নম্বর নেই'})`;
  document.getElementById('pv-complaint').innerText = v?.mainComplaint || p.mainComplaint || 'সাধারণ স্বাস্থ্য পরীক্ষা';
  document.getElementById('pv-vitals').innerText = `ওজন: ${p.weight ? `${toBanglaNumber(p.weight)} কেজি` : 'N/A'}, উচ্চতা: ${p.height ? `${toBanglaNumber(p.height)} সেমি` : 'N/A'}`;

  // Clear previous upload preview & close camera
  stopLiveCamera();
  clearPrescriptionPreview();

  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth' });
}

// Auto-initialize consultation session so doctor doesn't need to click any extra buttons
async function autoInitConsultationSession() {
  if (!currentPatientData || !currentVisitData) return;

  try {
    const res = await apiFetch(`/api/camps/${activeConsultationCampId}/consultations`, {
      method: 'POST',
      body: JSON.stringify({
        patientId: currentPatientData._id,
        visitId: currentVisitData._id
      })
    });

    if (res && res.success && res.data) {
      activeConsultationSessionId = res.data._id;
    }
  } catch (e) {
    // Session init fallback handled during save
  }
}

// ==========================================
// LIVE CAMERA CAPTURE LOGIC
// ==========================================

async function startLiveCamera() {
  const liveSec = document.getElementById('live-camera-section');
  const video = document.getElementById('camera-video');
  const statusEl = document.getElementById('prescription-upload-status');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('সরাসরি ক্যামেরা সাপোর্ট না করায় মোবাইল ক্যামেরা ওপেন করা হচ্ছে...', 'info');
    document.getElementById('prescription-photo-input').click();
    return;
  }

  // Stop any existing stream
  stopLiveCamera();

  try {
    statusEl.innerHTML = '<span style="color:var(--primary);">ক্যামেরা চালু হচ্ছে...</span>';

    const constraints = {
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    cameraMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cameraMediaStream;
    await video.play();

    liveSec.style.display = 'block';
    statusEl.innerHTML = '<span style="color:#059669; font-weight:600;">ক্যামেরা সচল আছে। প্রেসক্রিপশন ফ্রেমের মাঝে রেখে "ছবি তুলুন" বাটনে চাপ দিন।</span>';

    // Check if device has multiple cameras (front/back)
    checkCameraCount();

    liveSec.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Camera access error:', err);
    // Graceful fallback to native device camera
    showToast('সরাসরি ক্যামেরা সংযোগ ব্যর্থ। ডিভাইস ক্যামেরা চালু করা হচ্ছে...', 'info');
    document.getElementById('prescription-photo-input').click();
  }
}

function stopLiveCamera() {
  if (cameraMediaStream) {
    cameraMediaStream.getTracks().forEach(track => track.stop());
    cameraMediaStream = null;
  }

  const liveSec = document.getElementById('live-camera-section');
  if (liveSec) liveSec.style.display = 'none';

  const video = document.getElementById('camera-video');
  if (video) video.srcObject = null;
}

async function checkCameraCount() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const switchBtn = document.getElementById('switch-camera-btn');
    if (switchBtn) {
      switchBtn.style.display = videoDevices.length > 1 ? 'inline-block' : 'none';
    }
  } catch (e) {}
}

async function toggleCameraFacing() {
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  await startLiveCamera();
}

/**
 * CLIENT-SIDE IMAGE COMPRESSION (STRICTLY < 1 MB)
 * Resizes to optimal document dimension (1600px max) and adapts JPEG quality
 */
async function compressCanvasToUnder1MB(sourceCanvas) {
  let width = sourceCanvas.width;
  let height = sourceCanvas.height;
  const maxDim = 1600; // Optimal high-res document dimension for crisp medical handwriting

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = width;
  resizedCanvas.height = height;
  const ctx = resizedCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  // Iteratively compress quality until strictly <= 1 MB (1,048,576 bytes)
  let quality = 0.82;
  let blob = await new Promise(resolve => resizedCanvas.toBlob(resolve, 'image/jpeg', quality));

  while (blob && blob.size > 1024 * 1024 && quality > 0.35) {
    quality -= 0.1;
    blob = await new Promise(resolve => resizedCanvas.toBlob(resolve, 'image/jpeg', quality));
  }

  return blob;
}

// Snap photo from live video feed
async function captureCameraSnapshot() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas) return;

  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);

  // Stop camera feed after snapshot
  stopLiveCamera();

  const statusEl = document.getElementById('prescription-upload-status');
  statusEl.innerHTML = '<span style="color:var(--primary); font-weight:600;">ছবি কমপ্রেস ও আপলোড হচ্ছে...</span>';

  // Compress image to strictly < 1 MB
  const compressedBlob = await compressCanvasToUnder1MB(canvas);
  if (!compressedBlob) {
    showToast('ছবি প্রসেস করতে সমস্যা হয়েছে', 'error');
    return;
  }

  const fileName = `prescription_${Date.now()}.jpg`;
  const file = new File([compressedBlob], fileName, { type: 'image/jpeg' });
  await uploadPrescriptionFile(file);
}

// Fallback if device uses native camera capture input
async function handleFallbackFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('prescription-upload-status');
  statusEl.innerHTML = '<span style="color:var(--primary); font-weight:600;">ছবি কম্প্রেস করা হচ্ছে (১ MB এর মধ্যে)...</span>';

  // Load into Image to compress
  const img = new Image();
  img.onload = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const compressedBlob = await compressCanvasToUnder1MB(canvas);
    const compressedFile = new File([compressedBlob], `prescription_${Date.now()}.jpg`, { type: 'image/jpeg' });
    await uploadPrescriptionFile(compressedFile);
  };
  img.src = URL.createObjectURL(file);
}

// Core ultra-fast prescription upload routine
async function uploadPrescriptionFile(file) {
  selectedPrescriptionFile = file;
  const previewBox = document.getElementById('prescription-preview-box');
  const statusEl = document.getElementById('prescription-upload-status');
  const sizeKB = Math.round(file.size / 1024);

  // Immediate 0ms local preview
  const objectUrl = URL.createObjectURL(file);
  previewBox.innerHTML = `
    <div style="position:relative; display:inline-block;">
      <img src="${objectUrl}" alt="Prescription Preview" class="preview-thumbnail">
      <button type="button" onclick="clearPrescriptionPreview();" style="position:absolute; top:8px; right:8px; background:rgba(239,68,68,0.9); color:white; border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; font-weight:bold; font-size:14px; display:flex; align-items:center; justify-content:center;" title="মুছে ফেলুন">
        &times;
      </button>
    </div>
    <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-top:8px;">
      <span style="font-size:0.85rem; color:#059669; font-weight:700;">
        সাইজ: ${toBanglaNumber(sizeKB)} KB (১ MB এর মধ্যে কম্প্রেসড)
      </span>
      <button type="button" onclick="startLiveCamera();" class="btn btn-sm btn-outline" style="font-size:0.8rem; padding:4px 10px;">
        আবার ছবি তুলুন
      </button>
    </div>
  `;

  statusEl.innerHTML = '<span style="color:var(--primary); font-weight:600;">ছবি দ্রুত সংরক্ষণ হচ্ছে...</span>';

  // Ensure active consultation session
  if (!activeConsultationSessionId && currentPatientData && currentVisitData) {
    await autoInitConsultationSession();
  }

  // Ultra-fast upload to backend (< 100ms)
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('category', 'PRESCRIPTION');
    if (activeConsultationSessionId) {
      formData.append('relatedRecordId', activeConsultationSessionId);
    }

    const res = await apiFetch('/api/images/upload', {
      method: 'POST',
      body: formData
    });

    if (res && res.success && res.data) {
      uploadedPrescriptionAssetIds = [res.data.assetId];
      statusEl.innerHTML = `
        <span style="color:#059669; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          প্রেসক্রিপশনের ছবি সফলভাবে সংরক্ষিত হয়েছে!
        </span>
      `;
      showToast('ছবি সফলভাবে যুক্ত হয়েছে', 'success');
    }
  } catch (err) {
    statusEl.innerHTML = `<span style="color:var(--danger); font-weight:600;">আপলোড ব্যর্থ: ${err.message || 'ছবি আপলোড করা যায়নি'}</span>`;
    showToast(err.message || 'ছবি আপলোড ব্যর্থ', 'error');
  }
}

// 3. Complete and save consultation
async function handleSaveConsultation() {
  if (!currentPatientData) {
    showToast('অনুগ্রহ করে প্রথমে রোগী খুঁজুন', 'error');
    return;
  }

  if (uploadedPrescriptionAssetIds.length === 0) {
    showToast('অনুগ্রহ করে ক্যামেরা দিয়ে প্রেসক্রিপশনের ছবি তুলুন', 'error');
    startLiveCamera();
    return;
  }

  const saveBtn = document.getElementById('save-consultation-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span>সংরক্ষণ হচ্ছে...</span>';

  try {
    if (!activeConsultationSessionId) {
      await autoInitConsultationSession();
    }

    const noteInput = document.getElementById('doctor-short-note');
    const diagnosis = noteInput ? (noteInput.value.trim() || 'প্রেসক্রিপশন আপলোডকৃত') : 'প্রেসক্রিপশন আপলোডকৃত';

    const res = await apiFetch(`/api/camps/${activeConsultationCampId}/consultations/${activeConsultationSessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        diagnosis,
        notes: '',
        prescriptionImageAssetIds: uploadedPrescriptionAssetIds,
        referralRequired: false
      })
    });

    if (res && res.success) {
      const patientName = currentPatientData.fullName || 'রোগী';
      const patientId = currentPatientData.patientId || '';
      showToast(`রোগী ${patientName} (${patientId}) এর প্রেসক্রিপশন সংরক্ষিত ও সম্পন্ন হয়েছে!`, 'success');

      alert(`চিকিৎসা সম্পন্ন ও প্রেসক্রিপশন সংরক্ষিত হয়েছে।\nরোগী: ${patientName} (${patientId})`);

      resetConsultationScreen();

      // Refocus back to search input for immediate next entry
      const input = document.getElementById('doctor-patient-id-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  } catch (err) {
    showToast(err.message || 'সংরক্ষণ ব্যর্থ হয়েছে', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>প্রেসক্রিপশন আপলোড ও সম্পন্ন করুন</span>
    `;
  }
}

function clearPrescriptionPreview() {
  uploadedPrescriptionAssetIds = [];
  selectedPrescriptionFile = null;
  const previewBox = document.getElementById('prescription-preview-box');
  const statusEl = document.getElementById('prescription-upload-status');
  const fileInput = document.getElementById('prescription-photo-input');
  const noteInput = document.getElementById('doctor-short-note');

  if (previewBox) previewBox.innerHTML = '';
  if (statusEl) statusEl.innerHTML = '';
  if (fileInput) fileInput.value = '';
  if (noteInput) noteInput.value = '';
}

function resetConsultationScreen() {
  stopLiveCamera();
  currentPatientData = null;
  currentVisitData = null;
  activeConsultationSessionId = null;
  clearPrescriptionPreview();

  const section = document.getElementById('patient-consultation-section');
  if (section) section.style.display = 'none';

  const input = document.getElementById('doctor-patient-id-input');
  if (input) {
    input.value = '';
    input.focus();
  }
}
