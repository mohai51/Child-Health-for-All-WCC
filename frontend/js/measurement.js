/**
 * Measurement Corner Frontend Controller
 * Captures: Height, Weight, Blood Group, Hemoglobin %
 * Auto calculates pediatric BMI based on WHO / CDC standards
 */

let currentPatient = null;
let currentVisit = null;
let currentCampId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth(['MEASUREMENT_OFFICER', 'SUPER_ADMIN', 'DOCTOR', 'CAMP_COORDINATOR']);
  if (!user) return;

  const logoutButtons = document.querySelectorAll('#logout-btn, #header-logout-btn, .logout-action-btn, .logout-btn');
  logoutButtons.forEach(btn => {
    btn.onclick = (e) => {
      if (e) e.preventDefault();
      logout();
    };
  });

  // Load Camps list into dropdown
  await loadCamps();

  // Search input listeners
  const searchBtn = document.getElementById('measure-search-btn');
  const searchInput = document.getElementById('measure-patient-id-input');

  if (searchBtn) {
    searchBtn.addEventListener('click', searchPatient);
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchPatient();
      }
    });
  }

  // Live BMI calculation listeners
  const heightInput = document.getElementById('input-height');
  const weightInput = document.getElementById('input-weight');

  if (heightInput) heightInput.addEventListener('input', updateLiveBmiPreview);
  if (weightInput) weightInput.addEventListener('input', updateLiveBmiPreview);

  // Form submission
  const form = document.getElementById('measurement-form');
  if (form) {
    form.addEventListener('submit', handleSaveMeasurement);
  }

  // Reset button
  const resetBtn = document.getElementById('reset-measurement-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetMeasurementScreen);
  }
});

// Load camps
async function loadCamps() {
  const select = document.getElementById('measure-camp-select');
  if (!select) return;

  try {
    const res = await apiFetch('/api/camps');
    if (res && res.success) {
      const camps = Array.isArray(res.data) ? res.data : (res.data?.camps || []);
      if (!camps || camps.length === 0) {
        select.innerHTML = '<option value="">-- কোনো স্বাস্থ্য ক্যাম্প পাওয়া যায়নি --</option>';
        return;
      }

      select.innerHTML = camps.map(c => `
        <option value="${c._id}" ${c.status === 'ACTIVE' ? 'selected' : ''}>
          ${c.status === 'ACTIVE' ? '● [চালু]' : '○'} ${escapeHtml(c.name)} (${c.campCode})
        </option>
      `).join('');

      currentCampId = select.value;
      select.addEventListener('change', () => {
        currentCampId = select.value;
      });
    }
  } catch (err) {
    console.error('Error loading camps:', err);
  }
}

// Search patient
async function searchPatient() {
  const input = document.getElementById('measure-patient-id-input');
  if (!input) return;

  const rawQuery = input.value.trim();
  if (!rawQuery) {
    showToast('অনুগ্রহ করে রোগীর আইডি লিখুন (যেমন: WCC-000001)', 'error');
    input.focus();
    return;
  }

  const campSelect = document.getElementById('measure-camp-select');
  const campId = campSelect ? campSelect.value : (currentCampId || '');

  const searchBtn = document.getElementById('measure-search-btn');
  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span>খোঁজা হচ্ছে...</span>';
  }

  try {
    const res = await apiFetch(`/api/measurements/search-patient?patientId=${encodeURIComponent(rawQuery)}&campId=${encodeURIComponent(campId)}`, { bypassCache: true });
    if (res && res.success && res.data) {
      currentPatient = res.data.patient;
      currentVisit = res.data.visit;

      renderPatient(res.data);
    }
  } catch (err) {
    showToast(err.message || 'রোগী খুঁজে পাওয়া যায়নি', 'error');
    resetMeasurementScreen();
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

// Render patient details and prefill measurements
function renderPatient(data) {
  const p = data.patient;
  const v = data.visit;

  const placeholder = document.getElementById('measure-initial-placeholder');
  const section = document.getElementById('patient-measurement-section');
  if (placeholder) placeholder.style.display = 'none';
  if (section) section.style.display = 'block';

  // Identity cards
  document.getElementById('mv-id').innerText = p.patientId || '-';
  document.getElementById('mv-token').innerText = toBanglaNumber(v?.visitToken || 1);
  document.getElementById('mv-name').innerText = p.fullName || '-';
  document.getElementById('mv-age-sex').innerText = `${toBanglaNumber(p.ageYears || 0)} বছর ${p.ageMonths ? `${toBanglaNumber(p.ageMonths)} মাস, ` : ''}${p.sex === 'MALE' ? 'ছেলে' : p.sex === 'FEMALE' ? 'মেয়ে' : 'অন্যান্য'}`;
  document.getElementById('mv-guardian').innerText = `${p.guardianName || '-'} (${p.guardianPhone || 'ফোন নেই'})`;
  document.getElementById('mv-complaint').innerText = v?.mainComplaint || p.mainComplaint || 'সাধারণ স্বাস্থ্য পরীক্ষা';

  // Already measured notice
  const notice = document.getElementById('already-measured-notice');
  if (notice) {
    notice.style.display = data.isAlreadyMeasured ? 'block' : 'none';
  }

  // Prefill input fields
  const heightInput = document.getElementById('input-height');
  const weightInput = document.getElementById('input-weight');
  const bloodGroupInput = document.getElementById('input-blood-group');
  const hemoglobinInput = document.getElementById('input-hemoglobin');

  if (heightInput) heightInput.value = p.height || '';
  if (weightInput) weightInput.value = p.weight || '';
  if (bloodGroupInput) bloodGroupInput.value = p.bloodGroup || '';
  if (hemoglobinInput) hemoglobinInput.value = p.hemoglobin || '';

  // Trigger live BMI calculation
  updateLiveBmiPreview();

  // Focus on height input for smooth data entry
  setTimeout(() => {
    if (heightInput) heightInput.focus();
  }, 100);
}

// Pediatric BMI calculation logic
function calculatePediatricBMI(weightKg, heightCm, ageYears) {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  const age = parseInt(ageYears || 5, 10);

  if (!w || !h || w <= 0 || h <= 0) {
    return {
      bmi: null,
      status: 'উচ্চতা ও ওজন লিখুন',
      badgeClass: 'status-normal'
    };
  }

  const heightM = h / 100;
  const bmi = parseFloat((w / (heightM * heightM)).toFixed(1));

  let status = 'স্বাভাবিক ওজন (Healthy Weight)';
  let badgeClass = 'status-normal';

  if (age <= 5) {
    if (bmi < 13.5) {
      status = 'কম ওজন / অপুষ্টি (Underweight)';
      badgeClass = 'status-underweight';
    } else if (bmi <= 17.5) {
      status = 'স্বাভাবিক ওজন (Healthy Weight)';
      badgeClass = 'status-normal';
    } else if (bmi <= 19.0) {
      status = 'অতিরিক্ত ওজন (Overweight)';
      badgeClass = 'status-overweight';
    } else {
      status = 'স্থূলতা (Obese)';
      badgeClass = 'status-obese';
    }
  } else if (age <= 10) {
    if (bmi < 14.0) {
      status = 'কম ওজন (Underweight)';
      badgeClass = 'status-underweight';
    } else if (bmi <= 19.5) {
      status = 'স্বাভাবিক ওজন (Healthy Weight)';
      badgeClass = 'status-normal';
    } else if (bmi <= 22.0) {
      status = 'অতিরিক্ত ওজন (Overweight)';
      badgeClass = 'status-overweight';
    } else {
      status = 'স্থূলতা (Obese)';
      badgeClass = 'status-obese';
    }
  } else if (age <= 14) {
    if (bmi < 15.5) {
      status = 'কম ওজন (Underweight)';
      badgeClass = 'status-underweight';
    } else if (bmi <= 22.5) {
      status = 'স্বাভাবিক ওজন (Healthy Weight)';
      badgeClass = 'status-normal';
    } else if (bmi <= 26.0) {
      status = 'অতিরিক্ত ওজন (Overweight)';
      badgeClass = 'status-overweight';
    } else {
      status = 'স্থূলতা (Obese)';
      badgeClass = 'status-obese';
    }
  } else {
    // 15 to 18 years
    if (bmi < 18.5) {
      status = 'কম ওজন (Underweight)';
      badgeClass = 'status-underweight';
    } else if (bmi <= 24.9) {
      status = 'স্বাভাবিক ওজন (Healthy Weight)';
      badgeClass = 'status-normal';
    } else if (bmi <= 29.9) {
      status = 'অতিরিক্ত ওজন (Overweight)';
      badgeClass = 'status-overweight';
    } else {
      status = 'স্থূলতা (Obese)';
      badgeClass = 'status-obese';
    }
  }

  return { bmi, status, badgeClass };
}

// Update live BMI on UI
function updateLiveBmiPreview() {
  const heightVal = document.getElementById('input-height')?.value;
  const weightVal = document.getElementById('input-weight')?.value;
  const age = currentPatient?.ageYears || 5;

  const res = calculatePediatricBMI(weightVal, heightVal, age);

  const valEl = document.getElementById('bmi-numeric-val');
  const badgeEl = document.getElementById('bmi-status-badge');

  if (valEl) {
    valEl.innerText = res.bmi ? toBanglaNumber(res.bmi) : '-';
  }

  if (badgeEl) {
    badgeEl.className = `bmi-badge-pill ${res.badgeClass}`;
    badgeEl.innerHTML = `<span>${res.status}</span>`;
  }
}

// Save measurements
async function handleSaveMeasurement(e) {
  e.preventDefault();

  if (!currentPatient) {
    showToast('অনুগ্রহ করে প্রথমে রোগী খুঁজুন', 'error');
    return;
  }

  const height = document.getElementById('input-height')?.value.trim();
  const weight = document.getElementById('input-weight')?.value.trim();
  const bloodGroup = document.getElementById('input-blood-group')?.value.trim();
  let hemoglobin = document.getElementById('input-hemoglobin')?.value.trim();

  if (!height || !weight) {
    showToast('উচ্চতা ও ওজন উভয় ফিল্ড পূরণ করা আবশ্যক', 'error');
    return;
  }

  const campSelect = document.getElementById('measure-camp-select');
  const campId = campSelect ? campSelect.value : (currentCampId || '');

  const saveBtn = document.getElementById('save-measurement-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span>সংরক্ষণ হচ্ছে...</span>';

  try {
    const payload = {
      patientId: currentPatient._id,
      campId,
      height: parseFloat(height),
      weight: parseFloat(weight),
      bloodGroup,
      hemoglobin
    };

    const res = await apiFetch('/api/measurements/save', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.success) {
      const patientName = currentPatient.fullName || 'রোগী';
      const patientId = currentPatient.patientId || '';

      // Success Popup / Alert as requested
      alert(`পরিমাপ সফলভাবে সংরক্ষিত হয়েছে!\nরোগী: ${patientName} (${patientId})\n\nএবার রোগীকে ডাক্তারের কাছে যেতে বলুন।`);

      showToast(`রোগী ${patientName} (${patientId}) এর পরিমাপ সংরক্ষিত হয়েছে!`, 'success');

      // Reset and prepare for next patient
      resetMeasurementScreen();
    }
  } catch (err) {
    showToast(err.message || 'পরিমাপ সংরক্ষণ ব্যর্থ হয়েছে', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>পরিমাপ সংরক্ষণ করুন (Save & Forward)</span>
    `;
  }
}

// Reset measurement screen
function resetMeasurementScreen() {
  currentPatient = null;
  currentVisit = null;

  const placeholder = document.getElementById('measure-initial-placeholder');
  const section = document.getElementById('patient-measurement-section');
  if (placeholder) placeholder.style.display = 'block';
  if (section) section.style.display = 'none';

  const form = document.getElementById('measurement-form');
  if (form) form.reset();

  const valEl = document.getElementById('bmi-numeric-val');
  const badgeEl = document.getElementById('bmi-status-badge');
  if (valEl) valEl.innerText = '-';
  if (badgeEl) {
    badgeEl.className = 'bmi-badge-pill status-normal';
    badgeEl.innerHTML = '<span>উচ্চতা ও ওজন লিখুন</span>';
  }

  const input = document.getElementById('measure-patient-id-input');
  if (input) {
    input.value = '';
    input.focus();
  }
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toBanglaNumber(num) {
  if (num === null || num === undefined) return '';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, d => banglaDigits[parseInt(d, 10)]);
}

