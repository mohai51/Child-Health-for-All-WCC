/**
 * Main Admin Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth(['SUPER_ADMIN', 'CAMP_COORDINATOR']);
  if (!user) return;

  loadDashboardStats();
});

async function loadDashboardStats() {
  const loadingEl = document.getElementById('loading-spinner');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const res = await apiFetch('/api/dashboard/stats');
    if (res && res.success) {
      renderStats(res.data.summary);
      renderCampCards(res.data.camps);
    }
  } catch (error) {
    showToast(error.message || 'ড্যাশবোর্ড তথ্য লোড ব্যর্থ হয়েছে', 'error');
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

function renderStats(summary) {
  document.getElementById('stat-total-camps').innerText = toBanglaNumber(summary.totalCamps);
  document.getElementById('stat-active-camps').innerText = toBanglaNumber(summary.activeCamps);
  document.getElementById('stat-closed-camps').innerText = toBanglaNumber(summary.closedCamps);
  document.getElementById('stat-unique-patients').innerText = toBanglaNumber(summary.totalUniquePatients);
  document.getElementById('stat-total-visits').innerText = toBanglaNumber(summary.totalVisits);
  document.getElementById('stat-total-consultations').innerText = toBanglaNumber(summary.totalConsultations);
  document.getElementById('stat-total-doctors').innerText = toBanglaNumber(summary.totalDoctors);
  document.getElementById('stat-total-volunteers').innerText = toBanglaNumber(summary.totalVolunteers);
  document.getElementById('stat-total-referrals').innerText = toBanglaNumber(summary.totalReferrals);
}

function renderCampCards(camps) {
  const container = document.getElementById('camps-container');
  if (!container) return;

  if (camps.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: white; border-radius: 8px; border: 1px dashed var(--border-color);">
        <p style="color: var(--text-muted); font-size: 1.1rem;">কোনো স্বাস্থ্য ক্যাম্প তৈরি করা হয়নি।</p>
        <a href="/pages/camps.html" class="btn btn-primary" style="margin-top: 12px;">+ নতুন ক্যাম্প তৈরি করুন</a>
      </div>
    `;
    return;
  }

  container.innerHTML = camps.map(camp => {
    let statusClass = 'draft';
    let statusText = 'খসড়া (Draft)';
    if (camp.status === 'ACTIVE') {
      statusClass = 'active';
      statusText = 'সক্রিয় (Active)';
    } else if (camp.status === 'CLOSED') {
      statusClass = 'closed';
      statusText = 'বন্ধ (Closed)';
    }

    return `
      <div class="camp-card">
        <div class="camp-card-header">
          <div>
            <div class="camp-code">${camp.campCode}</div>
            <div class="camp-card-title">${camp.name}</div>
          </div>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>

        <div class="camp-meta">
          <div class="camp-meta-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>${toBanglaDate(camp.date)}</span>
          </div>
          <div class="camp-meta-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>${camp.venue}, ${camp.upazila}, ${camp.district}</span>
          </div>
        </div>

        <div class="camp-stat-badges">
          <div class="badge-counter" title="নিবন্ধিত শিশু রোগী">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <b>${toBanglaNumber(camp.registeredPatients)}</b> রোগী
          </div>
          <div class="badge-counter" title="উপস্থিত চিকিৎসক">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v6"/><path d="M16 15v6"/><path d="M12 18h4"/></svg>
            <b>${toBanglaNumber(camp.doctorsCount)}</b> চিকিৎসক
          </div>
          <div class="badge-counter" title="উপস্থিত স্বেচ্ছাসেবক">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <b>${toBanglaNumber(camp.volunteersCount)}</b> ভলান্টিয়ার
          </div>
        </div>

        <a href="/pages/camps.html?campId=${camp.id}" class="btn btn-outline btn-block" style="margin-top: 8px;">
          📊 ক্যাম্প অ্যানালিটিক্স ও বিবরণ
        </a>
      </div>
    `;
  }).join('');
}
