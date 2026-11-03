/**
 * Patient Registration and Slip Generator
 * We Can Change (WCC) Child Health Registry
 */

let selectedCampId = null;
let campsCacheMap = {};

async function initPatientDesk() {
  const user = await checkAuth(['REGISTRATION_VOLUNTEER', 'SUPER_ADMIN', 'CAMP_COORDINATOR']);
  if (!user) return;

  await loadActiveCampsForRegistration();

  const regForm = document.getElementById('patient-reg-form');
  if (regForm) {
    regForm.addEventListener('submit', handlePatientRegistration);
  }

  // Setup search input for returning patients
  const searchInput = document.getElementById('patient-search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => searchPatients(searchInput.value), 350);
    });
  }

  // Check if patientId passed via query param to display slip
  const urlParams = new URLSearchParams(window.location.search);
  const patientIdParam = urlParams.get('patientId');
  if (patientIdParam) {
    loadAndShowPatientSlip(patientIdParam);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPatientDesk);
} else {
  initPatientDesk();
}

// Load active camps dropdown and automatically pre-fill location
async function loadActiveCampsForRegistration() {
  const select = document.getElementById('camp-select');
  if (!select) return;

  try {
    let camps = [];
    const res = await apiFetch('/api/camps?status=ACTIVE', { bypassCache: true });
    if (res && res.success) {
      camps = Array.isArray(res.data) ? res.data : (res.data?.camps || []);
    }

    // Fallback: if no active camps returned, fetch all camps so field registration is never blocked
    if (!camps || camps.length === 0) {
      const allRes = await apiFetch('/api/camps', { bypassCache: true });
      if (allRes && allRes.success) {
        camps = Array.isArray(allRes.data) ? allRes.data : (allRes.data?.camps || []);
      }
    }

    if (!camps || camps.length === 0) {
      select.innerHTML = '<option value="">-- কোনো স্বাস্থ্য ক্যাম্প পাওয়া যায়নি (অ্যাডমিনের সাথে যোগাযোগ করুন) --</option>';
      selectedCampId = null;
      showToast('কোনো স্বাস্থ্য ক্যাম্প পাওয়া যায়নি।', 'error');
      return;
    }

    campsCacheMap = {};
    camps.forEach(c => {
      campsCacheMap[c._id] = c;
    });

    // Determine best default camp: previously stored camp in localStorage, user assigned camp, first active camp, or first camp
    const savedCampId = localStorage.getItem('wcc_active_registration_camp');
    const userAssignedCamp = window.currentUser?.assignedCampId || window.currentUser?.assignedCamp;
    const userCampId = userAssignedCamp?._id || userAssignedCamp || null;

    let preferredCampId = null;
    if (userCampId && campsCacheMap[userCampId]) {
      preferredCampId = String(userCampId);
    } else if (savedCampId && campsCacheMap[savedCampId]) {
      preferredCampId = String(savedCampId);
    } else {
      const firstActive = camps.find(c => c.status === 'ACTIVE');
      preferredCampId = String(firstActive ? firstActive._id : camps[0]._id);
    }

    select.innerHTML = camps.map(c => {
      const isSelected = String(c._id) === String(preferredCampId);
      const pourashavaStr = c.isPourashava && c.pourashavaName ? ` [${c.pourashavaName}]` : '';
      const statusIcon = c.status === 'ACTIVE' ? '🟢' : '⚪';
      return `<option value="${c._id}" ${isSelected ? 'selected' : ''}>${statusIcon} ${c.name} (${c.campCode} - ${c.venue}${pourashavaStr})</option>`;
    }).join('');

    selectedCampId = select.value || preferredCampId;
    if (selectedCampId && campsCacheMap[selectedCampId]) {
      localStorage.setItem('wcc_active_registration_camp', selectedCampId);
      applyCampLocation(campsCacheMap[selectedCampId]);
    }

    select.onchange = () => {
      selectedCampId = select.value;
      if (selectedCampId && campsCacheMap[selectedCampId]) {
        localStorage.setItem('wcc_active_registration_camp', selectedCampId);
        applyCampLocation(campsCacheMap[selectedCampId]);
      }
    };
  } catch (err) {
    showToast(err.message || 'স্বাস্থ্য ক্যাম্প লোড ব্যর্থ', 'error');
  }
}

// Automatically apply camp location and municipality info to registration form
function applyCampLocation(camp) {
  if (!camp) return;

  // 1. Update location summary banner
  const badgeEl = document.getElementById('camp-auto-location-badge');
  const summaryEl = document.getElementById('camp-location-summary');
  if (badgeEl && summaryEl) {
    const pourashavaText = camp.isPourashava && camp.pourashavaName ? ` • পৌরসভা: ${camp.pourashavaName}` : '';
    summaryEl.innerText = `${camp.venue}, ${camp.upazila}, ${camp.district}${pourashavaText}`;
    badgeEl.style.display = 'block';
  }

  // 2. Set District and Upazila
  if (typeof window.setSelectorDistrictAndUpazila === 'function') {
    window.setSelectorDistrictAndUpazila('district-input', 'upazila-select', camp.district, camp.upazila);
  } else {
    const dInput = document.getElementById('district-input');
    const uSelect = document.getElementById('upazila-select');
    if (dInput) dInput.value = camp.district || '';
    if (uSelect && camp.upazila) {
      uSelect.innerHTML = `<option value="${camp.upazila}" selected>${camp.upazila}</option>`;
      uSelect.disabled = false;
    }
  }

  // 3. Handle Municipality (Pourashava) & Ward
  const pourashavaCheck = document.getElementById('is-pourashava-check');
  const pourashavaBox = document.getElementById('pourashava-box');
  const pourashavaNameInput = document.getElementById('pourashava-name-input');
  const pourashavaHint = document.getElementById('camp-pourashava-hint');
  const wardSelect = document.getElementById('ward-select');

  if (camp.isPourashava) {
    if (pourashavaCheck) pourashavaCheck.checked = true;
    if (pourashavaBox) pourashavaBox.style.display = 'block';
    if (pourashavaNameInput) {
      pourashavaNameInput.value = camp.pourashavaName || '';
      pourashavaNameInput.readOnly = true;
      pourashavaNameInput.style.backgroundColor = '#F3F4F6';
    }
    if (pourashavaHint) {
      pourashavaHint.innerText = `পৌরসভা স্বয়ংক্রিয়ভাবে নির্ধারিত: ${camp.pourashavaName} (অনুগ্রহ করে শুধু ওয়ার্ড নম্বর নির্বাচন করুন)`;
    }
    if (wardSelect) {
      wardSelect.focus();
    }
  } else {
    if (pourashavaCheck) pourashavaCheck.checked = false;
    if (pourashavaBox) pourashavaBox.style.display = 'none';
    if (pourashavaNameInput) {
      pourashavaNameInput.value = '';
      pourashavaNameInput.readOnly = false;
      pourashavaNameInput.style.backgroundColor = 'white';
    }
    if (pourashavaHint) pourashavaHint.innerText = '';
  }
}

// Handle Patient Registration Submission
async function handlePatientRegistration(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  const campSelectEl = document.getElementById('camp-select');
  const campId = (campSelectEl && campSelectEl.value) ? campSelectEl.value : selectedCampId;

  if (!campId) {
    showToast('অনুগ্রহ করে একটি সক্রিয় স্বাস্থ্য ক্যাম্প নির্বাচন করুন', 'error');
    return;
  }
  selectedCampId = campId;

  submitBtn.disabled = true;
  submitBtn.innerText = 'নিবন্ধন সম্পন্ন হচ্ছে...';

  try {
    const isPourashava = form.isPourashava?.checked || false;
    const pourashavaName = isPourashava ? (form.pourashavaName?.value?.trim() || '') : '';
    const wardNo = isPourashava ? (form.wardNo?.value || '') : '';

    const body = {
      campId: selectedCampId,
      fullName: form.fullName.value.trim(),
      ageYears: Number(form.ageYears.value),
      ageMonths: Number(form.ageMonths.value || 0),
      sex: form.sex.value,
      guardianName: form.guardianName.value.trim(),
      guardianPhone: form.guardianPhone?.value?.trim() || '',
      district: form.district.value.trim(),
      upazila: form.upazila.value.trim(),
      isPourashava,
      pourashavaName,
      wardNo,
      address: form.address?.value?.trim() || '',
      mainComplaint: form.mainComplaint?.value?.trim() || '',
      guardianConsent: true
    };

    const res = await apiFetch('/api/patients', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (res && res.success) {
      showToast('রোগী নিবন্ধন সফল হয়েছে!', 'success');
      
      // Reset patient-specific inputs but maintain active camp's auto-location
      form.fullName.value = '';
      form.ageYears.value = '';
      form.ageMonths.value = '';
      form.guardianName.value = '';
      form.guardianPhone.value = '';
      if (form.wardNo) form.wardNo.value = '';
      if (form.address) form.address.value = '';
      if (form.mainComplaint) form.mainComplaint.value = '';

      // Re-apply camp location to form
      applyCampLocation(campsCacheMap[selectedCampId]);

      // Render Patient ID Slip
      renderPatientSlip(res.data);
    }
  } catch (err) {
    showToast(err.message || 'রোগী নিবন্ধন ব্যর্থ হয়েছে', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      রোগী নিবন্ধন ও প্রিন্ট স্লিপ প্রস্তুত করুন
    `;
  }
}

// Search existing / returning patients
async function searchPatients(query) {
  const container = document.getElementById('search-results-container');
  if (!container) return;

  if (!query || query.trim().length < 2) {
    container.innerHTML = '';
    return;
  }

  try {
    const res = await apiFetch(`/api/patients/search?q=${encodeURIComponent(query.trim())}&campId=${selectedCampId || ''}`);
    if (res && res.success) {
      if (!res.data || res.data.length === 0) {
        container.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 0.9rem;">কোনো পূর্ববর্তী রোগী পাওয়া যায়নি। নতুন হিসেবে নিবন্ধন করুন।</div>`;
        return;
      }

      container.innerHTML = res.data.map(p => `
        <div style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div>
            <b>${p.fullName}</b> (${p.patientId}) — ${toBanglaNumber(p.ageYears)} বছর, ${p.sex === 'MALE' ? 'ছেলে' : 'মেয়ে'}
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">
              অভিভাবক: ${p.guardianName} (${p.guardianPhone || 'মোবাইল নেই'}) • ${p.upazila}, ${p.district}${p.isPourashava ? ` [${p.pourashavaName} - ${p.wardNo}]` : ''}
            </div>
          </div>
          <div>
            ${p.isRegisteredInSelectedCamp ? 
              `<span class="status-badge active">এই ক্যাম্পে নিবন্ধিত (টোকেন #${toBanglaNumber(p.currentCampVisit?.visitToken)})</span>` : 
              `<button onclick="registerExistingPatientForCamp('${p._id}', '${p.fullName}', '${p.patientId}')" class="btn btn-outline btn-sm">বর্তমান ক্যাম্পে যুক্ত করুন</button>`
            }
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Register returning patient for a new visit in this camp
async function registerExistingPatientForCamp(patientRecordId, fullName, patientId) {
  if (!selectedCampId) {
    showToast('অনুগ্রহ করে একটি সক্রিয় ক্যাম্প নির্বাচন করুন', 'error');
    return;
  }

  const complaint = prompt(`রোগী ${fullName} (${patientId})-এর প্রধান শারীরিক সমস্যা বা অভিযোগ লিখুন:`, 'সাধারণ শিশু স্বাস্থ্য পরীক্ষা');
  if (complaint === null) return;

  try {
    const res = await apiFetch(`/api/camps/${selectedCampId}/registrations`, {
      method: 'POST',
      body: JSON.stringify({
        patientRecordId,
        mainComplaint: complaint
      })
    });

    if (res && res.success) {
      showToast('রোগীর ক্যাম্প ভিজিট সফলভাবে নিশ্চিত হয়েছে!', 'success');
      renderPatientSlip(res.data);
      document.getElementById('patient-search-input').value = '';
      document.getElementById('search-results-container').innerHTML = '';
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Render Printable Patient ID Slip (Clean, professional, without raw emojis)
function renderPatientSlip(data) {
  const container = document.getElementById('patient-slip-container');
  if (!container) return;

  const patient = data.patient;
  const visit = data.visit;
  const camp = data.camp;

  const pourashavaDetail = patient.isPourashava && patient.pourashavaName ?
    ` • ${patient.pourashavaName} (${patient.wardNo || 'ওয়ার্ড তথ্য'})` : '';
  const addressText = `${patient.address ? `${patient.address}, ` : ''}${patient.upazila}, ${patient.district}${pourashavaDetail}`;

  container.innerHTML = `
    <div class="patient-slip">
      <div style="display:flex; justify-content:center; align-items:center; margin-bottom:12px;">
        <img src="/assets/logo.png" alt="WCC Logo" style="width: 64px; height: 64px; border-radius: 50%; display: block; border: 2px solid var(--wcc-gold); object-fit: contain; padding: 2px; background: white;" />
      </div>
      <div class="slip-header">উই ক্যান চেঞ্জ (WCC) শিশু স্বাস্থ্য রেজিস্ট্রি</div>
      <div style="font-size: 0.9rem; color: var(--text-muted); margin-top: 2px;">বিনামূল্যে শিশু স্বাস্থ্য ক্যাম্প ও ডিজিটাল চিকিৎসা রেকর্ড</div>
      
      <div class="slip-id-box">
        <div style="font-size: 0.82rem; font-weight: 600; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">স্থায়ী রোগী আইডি (Patient ID)</div>
        <div class="slip-id-number">${patient.patientId}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">ক্যাম্প টোকেন: <b>#${toBanglaNumber(visit.visitToken)}</b></div>
      </div>

      <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
        রোগীর নাম: ${patient.fullName}
      </div>

      <div class="slip-meta-grid">
        <div><b>বয়স:</b> ${toBanglaNumber(patient.ageYears)} বছর ${patient.ageMonths ? `${toBanglaNumber(patient.ageMonths)} মাস` : ''}</div>
        <div><b>লিঙ্গ:</b> ${patient.sex === 'MALE' ? 'ছেলে' : patient.sex === 'FEMALE' ? 'মেয়ে' : 'অন্যান্য'}</div>
        <div><b>অভিভাবক:</b> ${patient.guardianName}</div>
        <div><b>মোবাইল:</b> ${patient.guardianPhone || 'প্রযোজ্য নয়'}</div>
        <div style="grid-column: 1 / -1;"><b>ঠিকানা:</b> ${addressText}</div>
        <div><b>নিবন্ধনের সময়:</b> ${new Date(visit.registeredAt).toLocaleTimeString('bn-BD')}</div>
        <div><b>ক্যাম্প কোড:</b> ${camp.campCode || ''}</div>
        <div style="grid-column: 1 / -1;"><b>প্রধান স্বাস্থ্য অভিযোগ:</b> ${visit.mainComplaint || 'সাধারণ স্বাস্থ্য পরীক্ষা'}</div>
        <div style="grid-column: 1 / -1;"><b>ক্যাম্পের ভেন্যু:</b> ${camp.name} (${camp.venue})</div>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: #FEF3C7; border-left: 4px solid #D97706; border-radius: 4px; font-size: 0.85rem; color: #92400E;">
        <b>জরুরি নির্দেশনা:</b> এই রোগী আইডি (${patient.patientId}) অভিভাবকের হাতে প্রদান করুন। শিশু রোগী এই টোকেন আইডি দিয়ে ক্যাম্পে দায়িত্বরত যেকোনো চিকিৎসকের কাছে সরাসরি সেবা গ্রহণ করতে পারবেন।
      </div>

      <div class="no-print" style="margin-top: 20px; display: flex; justify-content: center; gap: 12px;">
        <button onclick="window.print()" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          স্লিপ প্রিন্ট করুন
        </button>
        <button onclick="document.getElementById('patient-slip-container').innerHTML=''" class="btn btn-outline">
          নতুন রোগী নিবন্ধন
        </button>
      </div>
    </div>
  `;

  container.scrollIntoView({ behavior: 'smooth' });
}

async function loadAndShowPatientSlip(patientIdOrDocId) {
  try {
    const res = await apiFetch(`/api/patients/${patientIdOrDocId}`);
    if (res && res.success) {
      const p = res.data.patient;
      const latestVisit = res.data.visits?.[0] || { visitToken: 1, registeredAt: p.createdAt };
      renderPatientSlip({
        patient: p,
        visit: latestVisit,
        camp: { name: latestVisit.campId?.name || 'WCC স্বাস্থ্য ক্যাম্প', venue: latestVisit.campId?.venue || '', campCode: latestVisit.campId?.campCode || '' }
      });
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
