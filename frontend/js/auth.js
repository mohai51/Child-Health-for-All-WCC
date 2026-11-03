/**
 * Authentication and Navigation Controller (Strict Production Auth)
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
  const currentPath = window.location.pathname;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('wcc_token') : null;

  // If no auth token stored and not already on login page, redirect immediately
  if (!token && !currentPath.includes('login.html')) {
    window.location.replace('/pages/login.html');
    return null;
  }

  try {
    const res = await apiFetch('/api/auth/me');
    if (res && res.success && res.data && res.data.user) {
      currentUser = res.data.user;
    } else {
      throw new Error('Authentication required');
    }
  } catch (error) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('wcc_token');
      localStorage.removeItem('wcc_user');
      localStorage.removeItem('wcc_active_role');
    }
    if (!currentPath.includes('login.html')) {
      window.location.replace('/pages/login.html');
    }
    return null;
  }

  // Doctor role restriction: Strictly restricted to consultation & prescription
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

  if (currentUser.role === 'DOCTOR' && forbiddenForDoctor.some(page => currentPath.includes(page))) {
    window.location.replace('/pages/consultation.html');
    return null;
  }

  // Volunteer role restriction: Restricted to patient registration desk
  const forbiddenForVolunteer = [
    'dashboard.html',
    'doctor-dashboard.html',
    'camps.html',
    'camp-details.html',
    'volunteers.html',
    'doctors.html',
    'reports.html',
    'consultation.html'
  ];

  if (currentUser.role === 'REGISTRATION_VOLUNTEER' && forbiddenForVolunteer.some(page => currentPath.includes(page))) {
    window.location.replace('/pages/registration.html');
    return null;
  }

  // Check required roles for current page
  if (requiredRoles.length > 0 && !requiredRoles.includes(currentUser.role)) {
    if (currentUser.role === 'DOCTOR') {
      window.location.replace('/pages/consultation.html');
    } else if (currentUser.role === 'REGISTRATION_VOLUNTEER') {
      window.location.replace('/pages/registration.html');
    } else {
      window.location.replace('/pages/dashboard.html');
    }
    return null;
  }

  window.currentUser = currentUser;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('wcc_user', JSON.stringify(currentUser));
  }

  renderUserHeader(currentUser);
  filterNavByRole(currentUser.role);

  return currentUser;
}

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
