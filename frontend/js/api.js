/**
 * WCC API Client and Utility Functions
 */

// Helper to read cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Global HTML escaper to prevent XSS and rendering errors
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// Global Toast Notifications with instant close button
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.style.cssText = 'pointer-events: auto !important; cursor: pointer;';
  toast.innerHTML = `
    <span style="flex:1; margin-right:8px; pointer-events:auto;">${escapeHtml(message)}</span>
    <button type="button" class="toast-close-btn" aria-label="বন্ধ করুন" title="বন্ধ করুন" style="pointer-events:auto !important; cursor:pointer;" onclick="event.stopPropagation(); this.closest('.toast').remove();">&times;</button>
  `;

  const closeToast = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      toast.remove();
    } catch (err) {
      toast.style.display = 'none';
    }
  };

  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeToast);
  toast.addEventListener('click', (e) => {
    if (e.target.closest('.toast-close-btn') || e.target === toast) {
      closeToast(e);
    }
  });

  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) closeToast();
  }, 4500);
}

// Global Modal Helpers to open & close any popup/modal
window.openModal = function(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
};

window.closeModal = function(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
};

// Global click-to-close handlers for any modal or overlay
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    // 1. Toast close button
    const toastBtn = e.target.closest('.toast-close-btn');
    if (toastBtn) {
      e.stopPropagation();
      const toast = toastBtn.closest('.toast');
      if (toast) toast.remove();
      return;
    }

    // 2. Modal close cross button in header or anywhere in modal
    const modalCloseBtn = e.target.closest('.modal-close, [data-close], .btn-close-modal, .close-btn, .close, .modal-header button, button[onclick*="closeModal"]');
    if (modalCloseBtn) {
      const m = modalCloseBtn.closest('.modal-overlay, .modal');
      if (m) window.closeModal(m);
      return;
    }

    // 3. Modal backdrop click
    if (e.target.classList && (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal'))) {
      window.closeModal(e.target);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active, .modal.active, .modal-overlay[style*="display: flex"]').forEach(m => {
        window.closeModal(m);
      });
      document.querySelectorAll('.toast').forEach(t => t.remove());
    }
  });
}

// Convert English numbers to Bangla numerals
function toBanglaNumber(num) {
  if (num === null || num === undefined) return '';
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, d => bnDigits[d]);
}

// Convert English date to Bangla format
function toBanglaDate(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}

// Central API fetch helper
function getApiUrl(endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    // If running on local dev server (e.g. Live Server port 5500 or 3000) while backend is on 5000
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port && window.location.port !== '5000') {
      return `http://localhost:5000${cleanEndpoint}`;
    }
    // On Vercel, on production domains, or on localhost:5000, always use relative path
    return cleanEndpoint;
  }

  // Fallback for file:// or non-browser environments
  return `http://localhost:5000${cleanEndpoint}`;
}

async function apiFetch(endpoint, options = {}) {
  const url = getApiUrl(endpoint);
  const csrfToken = getCookie('wcc_csrf');
  const authToken = typeof localStorage !== 'undefined' ? localStorage.getItem('wcc_token') : null;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // If body is FormData (file upload), remove Content-Type header so browser sets multipart boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  if (csrfToken && !['GET', 'HEAD'].includes(options.method || 'GET')) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  if (authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const activeRole = typeof localStorage !== 'undefined' ? localStorage.getItem('wcc_active_role') : null;
  if (activeRole && !headers['x-bypass-role']) {
    headers['x-bypass-role'] = activeRole;
  }

  try {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers
    });

    // Check for session expiration
    if (response.status === 401 && !window.location.pathname.includes('login.html')) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('wcc_token');
        localStorage.removeItem('wcc_user');
      }
      showToast('সেশনের মেয়াদ শেষ হয়েছে। পুনরায় লগইন করুন।', 'error');
      setTimeout(() => {
        window.location.href = '/pages/login.html';
      }, 1500);
      throw new Error('Unauthorized');
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'রিকোয়েস্ট ব্যর্থ হয়েছে');
      }
      return data;
    } else if (contentType.includes('text/csv') || contentType.includes('spreadsheetml')) {
      const blob = await response.blob();
      return blob;
    }

    return response;
  } catch (error) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('ইন্টারনেট সংযোগ বিচ্ছিন্ন! আপনার নেটওয়ার্ক চেক করুন।', 'error');
    }
    throw error;
  }
}

// Setup offline indicator banner
window.addEventListener('online', () => {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.remove('visible');
  showToast('ইন্টারনেট পুনরায় সংযুক্ত হয়েছে', 'success');
});

window.addEventListener('offline', () => {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.innerText = '⚠️ ইন্টারনেট সংযোগ বিচ্ছিন্ন! ডাটা সার্ভারে সংরক্ষিত হচ্ছে না। জরুরি তথ্য কাগজে লিখে রাখুন।';
    document.body.prepend(banner);
  }
  banner.classList.add('visible');
  showToast('ইন্টারনেট বিচ্ছিন্ন!', 'error');
});
