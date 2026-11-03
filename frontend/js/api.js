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
  toast.style.cursor = 'pointer';
  toast.innerHTML = `
    <span style="flex:1; margin-right:8px;">${message}</span>
    <button type="button" class="toast-close-btn" aria-label="বন্ধ করুন" title="বন্ধ করুন">&times;</button>
  `;

  const closeToast = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  };

  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeToast);
  toast.addEventListener('click', closeToast);

  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) closeToast();
  }, 4000);
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
    // Backdrop click
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal')) {
      window.closeModal(e.target);
    }
    // Any button with data-close, close cross, or cancel button in modal
    if (e.target.closest('.modal-close, [data-close], .btn-close-modal, .close-btn, .close')) {
      const m = e.target.closest('.modal-overlay, .modal');
      if (m) window.closeModal(m);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active, .modal.active, .modal-overlay[style*="display: flex"]').forEach(m => {
        window.closeModal(m);
      });
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
  // If current page is served from backend port 5000, keep relative path
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && window.location.port === '5000') {
    return endpoint;
  }
  // Fallback to backend server on port 5000 (e.g. if opened via Live Server 5500 or file://)
  return `http://localhost:5000${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
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
