/**
 * Health Camp Management & Camp Operations Controller
 * We Can Change (WCC) Child Health Registry
 * Focused strictly on: Camp List (Active/Completed) and Camp Analytics View
 */

let allCampsData = [];
let currentFilter = 'ALL';
let currentSearchQuery = '';

// Modal helpers - globally exposed
window.openModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
};

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
};

// Open Create Camp Modal with initialized dropdowns & date
window.openCreateCampModal = function() {
  const form = document.getElementById('create-camp-form');
  if (form) {
    form.reset();
  }
  const dateInput = document.getElementById('camp-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  const pourashavaBox = document.getElementById('camp-pourashava-box');
  if (pourashavaBox) {
    pourashavaBox.style.display = 'none';
  }

  populateDistrictDropdown();
  window.openModal('create-camp-modal');
};

function populateDistrictDropdown() {
  const distSelect = document.getElementById('camp-district-select');
  const upaSelect = document.getElementById('camp-upazila-select');
  if (!distSelect || !upaSelect) return;

  const districts = (typeof BANGLADESH_GEO_DATA !== 'undefined') ? Object.keys(BANGLADESH_GEO_DATA).sort((a, b) => a.localeCompare(b, 'bn')) : [];

  distSelect.innerHTML = '<option value="">-- জেলা নির্বাচন করুন --</option>' +
    districts.map(d => `<option value="${d}">${d}</option>`).join('');

  upaSelect.innerHTML = '<option value="">-- প্রথমে জেলা নির্বাচন করুন --</option>';
  upaSelect.disabled = true;

  distSelect.onchange = function() {
    const selectedDist = distSelect.value;
    if (selectedDist && typeof BANGLADESH_GEO_DATA !== 'undefined' && BANGLADESH_GEO_DATA[selectedDist]) {
      const upazilas = BANGLADESH_GEO_DATA[selectedDist];
      upaSelect.innerHTML = '<option value="">-- উপজেলা নির্বাচন করুন --</option>' +
        upazilas.map(u => `<option value="${u}">${u}</option>`).join('');
      upaSelect.disabled = false;
      if (upazilas.length > 0) {
        upaSelect.selectedIndex = 1;
      }
    } else {
      upaSelect.innerHTML = '<option value="">-- প্রথমে জেলা নির্বাচন করুন --</option>';
      upaSelect.disabled = true;
    }
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  // Wire up modal close on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        window.closeModal(overlay.id);
      }
    });
  });

  // Setup button listener for create camp button
  const openCampBtn = document.getElementById('btn-open-create-camp');
  if (openCampBtn) {
    openCampBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.openCreateCampModal();
    });
  }

  // Setup Pourashava checkbox toggle
  const pourashavaCheck = document.getElementById('camp-is-pourashava-check');
  const pourashavaBox = document.getElementById('camp-pourashava-box');
  if (pourashavaCheck && pourashavaBox) {
    pourashavaCheck.addEventListener('change', () => {
      pourashavaBox.style.display = pourashavaCheck.checked ? 'block' : 'none';
    });
  }

  // Setup Create Camp Form listener if present
  const createCampForm = document.getElementById('create-camp-form');
  if (createCampForm) {
    createCampForm.addEventListener('submit', handleCreateCamp);
  }

  // Setup event delegation for on/off buttons
  const campsListContainer = document.getElementById('camps-list-container');
  if (campsListContainer) {
    campsListContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-camp-toggle');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const campId = btn.getAttribute('data-camp-id');
      const action = btn.getAttribute('data-action');
      if (campId && action) {
        window.toggleCampStatus(campId, action, btn);
      }
    });
  }

  // Load camps
  await loadAllCamps();
});

/**
 * Load all camps from backend API
 */
async function loadAllCamps() {
  const container = document.getElementById('camps-list-container');
  if (!container) return;

  try {
    const res = await apiFetch('/api/camps');
    if (res && res.success) {
      allCampsData = res.data || [];
      renderCampsTable();
    }
  } catch (err) {
    showToast(err.message || 'ক্যাম্প তালিকা লোড করতে সমস্যা হয়েছে', 'error');
    container.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 24px; color: var(--danger);">ক্যাম্প লোড ব্যর্থ হয়েছে: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/**
 * Real-time camp search input handler
 */
window.handleCampSearch = function(query) {
  currentSearchQuery = (query || '').trim().toLowerCase();
  renderCampsTable();
};

/**
 * Render camps list in the table (শুধুমাত্র নাম ও চালু/অফ বাটন)
 */
function renderCampsTable() {
  const container = document.getElementById('camps-list-container');
  if (!container) return;

  let filtered = allCampsData;

  // Filter by search query if any
  if (currentSearchQuery) {
    filtered = filtered.filter(c => {
      const name = (c.name || '').toLowerCase();
      return name.includes(currentSearchQuery);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="2" style="text-align:center; padding: 36px; color: var(--text-muted); font-size:1rem;">
          কোনো স্বাস্থ্য ক্যাম্পের তথ্য পাওয়া যায়নি।
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = filtered.map(camp => {
    const isActive = camp.status === 'ACTIVE';

    const statusBadge = isActive
      ? '<span class="status-badge active" style="font-size:0.8rem; font-weight:700; margin-left:12px;">🟢 চালু (ডাক্তার ও ভলান্টিয়ার যুক্ত করার জন্য উন্মুক্ত)</span>'
      : '<span class="status-badge closed" style="font-size:0.8rem; font-weight:700; margin-left:12px; background:#f1f5f9; color:#64748b;">⚪ অফ</span>';

    const actionButton = isActive
      ? `<button type="button" data-camp-id="${camp._id}" data-action="CLOSE" onclick="toggleCampStatus('${camp._id}', 'CLOSE', this)" class="btn btn-danger btn-camp-toggle" style="padding:8px 22px; font-weight:700; border-radius:6px; cursor:pointer;" title="ক্যাম্পটি অফ করুন">🔴 অফ করুন</button>`
      : `<button type="button" data-camp-id="${camp._id}" data-action="ACTIVATE" onclick="toggleCampStatus('${camp._id}', 'ACTIVATE', this)" class="btn btn-success btn-camp-toggle" style="padding:8px 22px; font-weight:700; border-radius:6px; cursor:pointer;" title="ক্যাম্পটি চালু করুন">🟢 চালু করুন</button>`;

    return `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 16px 20px; vertical-align: middle;">
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
            <span style="font-size:1.05rem; font-weight:700; color:var(--text-main);">${escapeHtml(camp.name)}</span>
            ${statusBadge}
          </div>
        </td>
        <td style="padding: 16px 20px; text-align: center; vertical-align: middle;">
          ${actionButton}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Toggle Camp Status (চালু করুন / অফ করুন)
 */
window.toggleCampStatus = async function(campId, action, btnElement) {
  if (!campId) return;

  const targetCamp = allCampsData.find(c => String(c._id) === String(campId));
  const prevStatus = targetCamp ? targetCamp.status : (action === 'ACTIVATE' ? 'CLOSED' : 'ACTIVE');
  const newStatus = action === 'ACTIVATE' ? 'ACTIVE' : 'CLOSED';

  // 1. Instant optimistic UI update for instant zero-latency feedback
  if (targetCamp) {
    targetCamp.status = newStatus;
    renderCampsTable();
  }

  try {
    const endpoint = action === 'ACTIVATE'
      ? `/api/camps/${campId}/activate`
      : `/api/camps/${campId}/close`;

    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ status: newStatus })
    });

    if (res && res.success) {
      if (action === 'ACTIVATE') {
        showToast('স্বাস্থ্য ক্যাম্পটি সফলভাবে চালু করা হয়েছে। এখন এই ক্যাম্পে ডাক্তার ও ভলান্টিয়ার যুক্ত করা যাবে।', 'success');
      } else {
        showToast('স্বাস্থ্য ক্যাম্পটি অফ করা হয়েছে।', 'info');
      }
      if (res.data && targetCamp) {
        Object.assign(targetCamp, res.data);
      }
    } else {
      throw new Error(res?.message || 'ক্যাম্প স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে');
    }
  } catch (err) {
    // Revert optimistic update on error
    if (targetCamp) {
      targetCamp.status = prevStatus;
      renderCampsTable();
    }
    showToast(err.message || 'ক্যাম্প স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে', 'error');
  }
};

window.activateCamp = (id, btn) => window.toggleCampStatus(id, 'ACTIVATE', btn);
window.closeCamp = (id, btn) => window.toggleCampStatus(id, 'CLOSE', btn);

/**
 * Handle new camp creation form
 */
async function handleCreateCamp(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerHTML : 'ক্যাম্প সংরক্ষণ করুন';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'সংরক্ষণ হচ্ছে...';
  }

  try {
    const name = (form.name?.value || document.getElementById('camp-name')?.value || '').trim();
    const date = form.date?.value || document.getElementById('camp-date')?.value;
    const district = (form.district?.value || document.getElementById('camp-district-select')?.value || '').trim();
    let upazila = (form.upazila?.value || document.getElementById('camp-upazila-select')?.value || '').trim();
    const venue = (form.venue?.value || document.getElementById('camp-venue')?.value || '').trim();
    const isPourashava = document.getElementById('camp-is-pourashava-check')?.checked || false;
    const pourashavaName = isPourashava ? (document.getElementById('camp-pourashava-name')?.value || '').trim() : '';
    const description = (form.description?.value || document.getElementById('camp-description')?.value || '').trim();

    if (!name) {
      showToast('অনুগ্রহ করে ক্যাম্পের নাম লিখুন', 'warning');
      return;
    }
    if (!date) {
      showToast('অনুগ্রহ করে ক্যাম্পের তারিখ নির্বাচন করুন', 'warning');
      return;
    }
    if (!district) {
      showToast('অনুগ্রহ করে জেলা নির্বাচন করুন', 'warning');
      return;
    }
    if (!upazila) {
      upazila = (isPourashava && pourashavaName) ? pourashavaName : `${district} সদর`;
    }
    if (!venue) {
      showToast('অনুগ্রহ করে স্থান বা ভেন্যু প্রদান করুন', 'warning');
      return;
    }

    const payload = {
      name,
      date,
      district,
      upazila,
      venue,
      isPourashava,
      pourashavaName,
      description
    };

    const res = await apiFetch('/api/camps', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.success) {
      showToast('নতুন স্বাস্থ্য ক্যাম্প সফলভাবে তৈরি হয়েছে', 'success');
      window.closeModal('create-camp-modal');
      form.reset();
      await loadAllCamps();
    } else {
      throw new Error(res?.message || 'ক্যাম্প তৈরি ব্যর্থ হয়েছে');
    }
  } catch (err) {
    showToast(err.message || 'ক্যাম্প তৈরি ব্যর্থ হয়েছে', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

/**
 * Helper to show action confirmation modal
 */
function openConfirmModal({ title, message, actionBtnText, actionBtnClass, onConfirm }) {
  const modal = document.getElementById('camp-confirm-modal');
  if (!modal) {
    if (confirm(message)) onConfirm();
    return;
  }

  document.getElementById('confirm-modal-title').innerText = title;
  document.getElementById('confirm-modal-message').innerText = message;

  const actionBtn = document.getElementById('confirm-modal-action-btn');
  actionBtn.innerText = actionBtnText || 'নিশ্চিত করুন';
  actionBtn.className = actionBtnClass || 'btn btn-danger';

  // Replace onclick handler cleanly
  actionBtn.onclick = async () => {
    window.closeModal('camp-confirm-modal');
    await onConfirm();
  };

  window.openModal('camp-confirm-modal');
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
