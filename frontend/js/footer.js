/**
 * Global System Footer & Developer Profile Controller
 * Official Technical Partner: Regnons Bangladesh
 * System Developer: Mohaiminul Islam
 */

(function () {
  const DEVELOPER_INFO = {
    name: 'Mohaiminul Islam',
    role: 'Lead Software Engineer & System Architect',
    company: 'Regnons Bangladesh',
    companyUrl: 'https://www.facebook.com/profile.php?id=61594499150741',
    photoUrl: '/assets/developer.jpg',
    facebook: 'https://www.facebook.com/Mohai.xoxx',
    instagram: 'https://www.instagram.com/mohai_minull/',
    linkedin: 'https://www.linkedin.com/in/mohaiminul-islam-a29354194/'
  };

  // Build and inject developer modal into DOM
  function ensureDeveloperModal() {
    if (document.getElementById('developer-profile-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'developer-profile-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10099';
    modal.innerHTML = `
      <div class="modal-content dev-modal-card" style="padding: 0; max-width: 440px;">
        <div class="dev-profile-hero">
          <button type="button" class="modal-close" onclick="closeDeveloperModal()" style="position:absolute; top:12px; right:12px; color:#ffffff; background:rgba(255,255,255,0.15); border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; padding:0; font-size:1.3rem;" title="বন্ধ করুন">&times;</button>
          
          <div class="dev-avatar-wrapper">
            <img src="${DEVELOPER_INFO.photoUrl}" alt="${DEVELOPER_INFO.name}" class="dev-avatar-img" onerror="this.onerror=null; this.src='/assets/logo.png';">
          </div>
          
          <h3 class="dev-name">${DEVELOPER_INFO.name}</h3>
          <div class="dev-title">${DEVELOPER_INFO.role}</div>
          
          <a href="${DEVELOPER_INFO.companyUrl}" target="_blank" rel="noopener noreferrer" class="dev-company-badge" title="Visit Regnons Bangladesh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>${DEVELOPER_INFO.company}</span>
          </a>
        </div>

        <div style="padding: 16px 20px 8px 20px; font-size: 0.88rem; color: #475569; text-align: center; line-height: 1.5;">
          উই ক্যান চেঞ্জ (WCC) শিশু স্বাস্থ্য রেজিস্ট্রি ও মাল্টি-ক্যাম্প অটোমেশন প্ল্যাটফর্মের একক আর্কিটেকচার ও পূর্ণাঙ্গ সিস্টেম ডেভেলপমেন্ট।
        </div>

        <div class="dev-social-grid">
          <a href="${DEVELOPER_INFO.facebook}" target="_blank" rel="noopener noreferrer" class="dev-social-btn fb" title="Facebook Profile">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            <span>Facebook</span>
          </a>

          <a href="${DEVELOPER_INFO.instagram}" target="_blank" rel="noopener noreferrer" class="dev-social-btn insta" title="Instagram Profile">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            <span>Instagram</span>
          </a>

          <a href="${DEVELOPER_INFO.linkedin}" target="_blank" rel="noopener noreferrer" class="dev-social-btn linkedin" title="LinkedIn Profile">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            <span>LinkedIn</span>
          </a>

          <a href="${DEVELOPER_INFO.companyUrl}" target="_blank" rel="noopener noreferrer" class="dev-social-btn company" title="Official Company Page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>Regnons</span>
          </a>
        </div>

        <div style="padding: 12px 20px 20px 20px;">
          <button type="button" onclick="closeDeveloperModal()" class="btn btn-outline btn-block" style="font-weight:600;">বন্ধ করুন</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeDeveloperModal();
      }
    });
  }

  // Generate Footer HTML
  function generateFooterHtml() {
    return `
      <footer class="system-footer">
        <div class="footer-inner">
          <div class="footer-left">
            <span>© 2026 <strong>We Can Change (WCC)</strong> • শিশু স্বাস্থ্য রেজিস্ট্রি</span>
          </div>
          <div class="footer-right">
            <span>কারিগরি সহযোগিতায়:</span>
            <a href="${DEVELOPER_INFO.companyUrl}" target="_blank" rel="noopener noreferrer" class="company-brand-link" title="Regnons Bangladesh">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <span>Regnons Bangladesh</span>
            </a>
            <span style="color:#cbd5e1;">•</span>
            <button type="button" class="btn-dev-profile" onclick="openDeveloperModal()" title="সিস্টেম ডেভেলপার পরিচিতি">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>সিস্টেম ডেভেলপার</span>
            </button>
          </div>
        </div>
      </footer>
    `;
  }

  // Inject footer automatically into current page
  function injectFooter() {
    if (document.querySelector('.system-footer')) return;

    ensureDeveloperModal();

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.insertAdjacentHTML('beforeend', generateFooterHtml());
      return;
    }

    const appWrapper = document.querySelector('.app-wrapper') || document.querySelector('.login-container')?.parentElement || document.body;
    if (appWrapper) {
      appWrapper.insertAdjacentHTML('beforeend', generateFooterHtml());
    }
  }

  // Global functions exposed to window
  window.openDeveloperModal = function () {
    ensureDeveloperModal();
    const modal = document.getElementById('developer-profile-modal');
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    }
  };

  window.closeDeveloperModal = function () {
    const modal = document.getElementById('developer-profile-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  };

  // Keyboard shortcut: Escape to close developer modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeDeveloperModal();
    }
  });

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
