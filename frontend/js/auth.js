/**
 * Authentication and Navigation Controller
 */

let currentUser = null;

// Bangla role display mapping
const ROLE_NAMES = {
  SUPER_ADMIN: 'সুপার অ্যাডমিন (Super Admin)',
  DOCTOR: 'চিকিৎসক (Doctor)',
  REGISTRATION_VOLUNTEER: 'রেজিস্ট্রেশন ভলান্টিয়ার',
  CAMP_COORDINATOR: 'ক্যাম্প সমন্বয়ক'
};

async function checkAuth(requiredRoles = []) {
  // Determine role from local storage or context of the page
  const pageRole = window.location.pathname.includes('consultation') ? 'DOCTOR' :
                   window.location.pathname.includes('registration') ? 'REGISTRATION_VOLUNTEER' : 'SUPER_ADMIN';

  let activeRole = (typeof localStorage !== 'undefined' && localStorage.getItem('wcc_active_role')) || pageRole;

  const currentPath = window.location.pathname;
  const forbiddenForDoctor = [
    'dashboard.html',
    'doctor-dashboard.html',
    'camps.html',
    'camp-details.html',
    'volunteers.html',
    'doctors.html',
    'reports.html',
    'registration.html'
  ];

  // If Doctor role tries to visit any prohibited page, immediately redirect to consultation
  if (activeRole === 'DOCTOR' && forbiddenForDoctor.some(page => currentPath.includes(page))) {
    window.location.replace('/pages/consultation.html');
    return null;
  }

  // Fallback default user for instant bypass testing
  const fallbackUser = {
    id: activeRole === 'DOCTOR' ? '6ae6ca6b8e6f78c4505854af' : '6ae6ca6b8e6f78c4505854ae',
    name: activeRole === 'DOCTOR' ? 'ডা. ফারহানা (চিকিৎসক)' :
          activeRole === 'REGISTRATION_VOLUNTEER' ? 'ভলান্টিয়ার ১ (রেজিস্ট্রেশন)' :
          'সুপার অ্যাডমিন (WCC)',
    email: activeRole === 'DOCTOR' ? 'dr.farhana@wcc.org.bd' :
           activeRole === 'REGISTRATION_VOLUNTEER' ? 'volunteer1@wcc.org.bd' :
           'admin@wcc.org.bd',
    role: activeRole,
    accountStatus: 'ACTIVE'
  };

  try {
    const res = await apiFetch('/api/auth/me');
    if (res && res.data && res.data.user) {
      currentUser = res.data.user;
    } else {
      currentUser = fallbackUser;
    }
  } catch (error) {
    currentUser = fallbackUser;
  }

  // Double check if resolved user is Doctor on forbidden page
  if (currentUser && currentUser.role === 'DOCTOR' && forbiddenForDoctor.some(page => currentPath.includes(page))) {
    window.location.replace('/pages/consultation.html');
    return null;
  }

  window.currentUser = currentUser;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('wcc_user', JSON.stringify(currentUser));
  }

  renderUserHeader(currentUser);
  filterNavByRole(currentUser.role);
  injectDevQuickBar(currentUser.role);

  return currentUser;
}

function injectDevQuickBar(currentRole) {
  let bar = document.getElementById('dev-bypass-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'dev-bypass-bar';
    bar.style.cssText = 'position:fixed; bottom:12px; right:12px; background:rgba(15,23,42,0.92); color:white; padding:8px 12px; border-radius:24px; font-size:0.8rem; display:flex; align-items:center; gap:8px; z-index:99999; box-shadow:0 4px 14px rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.15);';
    bar.innerHTML = `
      <span style="font-weight:700; color:#FCD34D;">টেস্ট মোড:</span>
      <button onclick="switchDevRole('SUPER_ADMIN', '/pages/dashboard.html')" style="background:${currentRole === 'SUPER_ADMIN' ? 'var(--primary, #0F4C81)' : '#334155'}; color:white; border:none; padding:4px 10px; border-radius:12px; cursor:pointer; font-weight:600; font-size:0.75rem;">অ্যাডমিন</button>
      <button onclick="switchDevRole('DOCTOR', '/pages/consultation.html')" style="background:${currentRole === 'DOCTOR' ? '#0D9488' : '#334155'}; color:white; border:none; padding:4px 10px; border-radius:12px; cursor:pointer; font-weight:600; font-size:0.75rem;">ডাক্তার</button>
      <button onclick="switchDevRole('REGISTRATION_VOLUNTEER', '/pages/registration.html')" style="background:${currentRole === 'REGISTRATION_VOLUNTEER' ? '#1E7E34' : '#334155'}; color:white; border:none; padding:4px 10px; border-radius:12px; cursor:pointer; font-weight:600; font-size:0.75rem;">ভলান্টিয়ার</button>
    `;
    document.body.appendChild(bar);
  }
}

window.switchDevRole = function(role, targetUrl) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('wcc_active_role', role);
  }
  window.location.href = targetUrl;
};

function renderUserHeader(user) {
  const nameEl = document.getElementById('header-user-name');
  const roleEl = document.getElementById('header-user-role');
  if (nameEl) nameEl.innerText = user.name;
  if (roleEl) roleEl.innerText = ROLE_NAMES[user.role] || user.role;
}

function filterNavByRole(role) {
  const adminOnlyElements = document.querySelectorAll('.nav-admin-only');
  const doctorOnlyElements = document.querySelectorAll('.nav-doctor-only');
  const volunteerOnlyElements = document.querySelectorAll('.nav-volunteer-only');

  if (role === 'SUPER_ADMIN') {
    // Admin panel: only administrative controls; doctor corner and registration desk are omitted
    adminOnlyElements.forEach(el => el.style.display = 'flex');
    doctorOnlyElements.forEach(el => el.style.display = 'none');
    volunteerOnlyElements.forEach(el => el.style.display = 'none');
  } else if (role === 'DOCTOR') {
    // DOCTOR IS STRICTLY CONFINED TO PATIENT SEARCH & PRESCRIPTION UPLOAD
    // Hide all admin, camp, volunteer, and report elements
    adminOnlyElements.forEach(el => el.style.display = 'none');
    doctorOnlyElements.forEach(el => el.style.display = 'flex');
    volunteerOnlyElements.forEach(el => el.style.display = 'none');

    // If doctor tries to view dashboard, health camps, volunteers, or reports, redirect to consultation
    const currentPath = window.location.pathname;
    const forbiddenForDoctor = [
      'dashboard.html',
      'doctor-dashboard.html',
      'camps.html',
      'camp-details.html',
      'volunteers.html',
      'doctors.html',
      'reports.html',
      'registration.html'
    ];
    if (forbiddenForDoctor.some(page => currentPath.includes(page))) {
      window.location.replace('/pages/consultation.html');
      return;
    }
  } else if (role === 'REGISTRATION_VOLUNTEER' || role === 'CAMP_COORDINATOR') {
    adminOnlyElements.forEach(el => el.style.display = 'none');
    doctorOnlyElements.forEach(el => el.style.display = 'none');
    volunteerOnlyElements.forEach(el => el.style.display = 'flex');
  }
}

async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    // Ignore error on logout
  } finally {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('wcc_token');
      localStorage.removeItem('wcc_user');
    }
    showToast('লগআউট সম্পন্ন হয়েছে', 'info');
    setTimeout(() => {
      window.location.href = '/pages/login.html';
    }, 400);
  }
}

// Mobile sidebar drawer toggle helper
function initMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  let backdrop = document.querySelector('.sidebar-backdrop');

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
});
