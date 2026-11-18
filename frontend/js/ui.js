import { dashboardUrlForRole, getStoredUser, logout } from './auth.js';

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatINR(amount) {
  const num = Number(amount || 0);
  return '₹' + num.toLocaleString('en-IN');
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return escapeHtml(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ICONS = {
  wrench: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  zap: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  sparkles: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>`,
  paintbrush: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/></svg>`,
  hammer: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/></svg>`,
  wind: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`,
  book: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
  truck: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
  cpu: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></svg>`,
  leaf: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  key: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  star: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  heart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  menu: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`,
};

export function getIconSvg(name) {
  return ICONS[name] || ICONS.wrench;
}

export function showToast(message, type = 'success') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button type="button" class="btn-ghost btn-sm" aria-label="Dismiss notification" style="min-height:24px;padding:2px 6px;">×</button>
  `;
  toast.querySelector('button').addEventListener('click', () => toast.remove());
  region.appendChild(toast);

  setTimeout(() => {
    if (toast.isConnected) toast.remove();
  }, 4500);
}

export function openModal({ title, contentHtml, onMount }) {
  let backdrop = document.getElementById('app-modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'app-modal-backdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
    });
  }

  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button type="button" class="btn btn-secondary btn-sm" data-modal-close aria-label="Close modal">Close</button>
      </div>
      <div class="modal-body">${contentHtml}</div>
    </div>
  `;

  backdrop.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  backdrop.classList.add('open');

  if (typeof onMount === 'function') {
    onMount(backdrop.querySelector('.modal-body'));
  }
}

export function closeModal() {
  const backdrop = document.getElementById('app-modal-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
  }
}

export function initChrome(activeNav = '') {
  const headerEl = document.getElementById('site-header');
  const footerEl = document.getElementById('site-footer');
  const user = getStoredUser();

  if (headerEl) {
    const dashboardHref = user ? dashboardUrlForRole(user.role) : '/login.html';
    const actionAreaHtml = user
      ? `<a href="${dashboardHref}" class="btn btn-secondary btn-sm">${escapeHtml(user.role === 'ADMIN' ? 'Admin Console' : user.role === 'PROVIDER' ? 'Provider Studio' : 'My Account')}</a>
         <button type="button" id="header-logout-btn" class="btn btn-ghost btn-sm">Log Out</button>`
      : `<a href="/login.html" class="nav-link">Log In</a>
         <a href="/register.html" class="btn btn-primary btn-sm">Register</a>`;

    headerEl.className = 'site-header';
    headerEl.innerHTML = `
      <div class="container header-inner">
        <a href="/index.html" class="brand-wordmark">Local Service <span>Finder</span></a>
        <nav class="primary-nav" aria-label="Primary Navigation">
          <a href="/search.html" class="nav-link ${activeNav === 'search' ? 'active' : ''}">Find a Professional</a>
          <a href="/index.html#categories" class="nav-link ${activeNav === 'categories' ? 'active' : ''}">Categories</a>
          <a href="/register.html?role=PROVIDER" class="nav-link ${activeNav === 'providers' ? 'active' : ''}">For Providers</a>
          <a href="/index.html#how-it-works" class="nav-link ${activeNav === 'how' ? 'active' : ''}">How It Works</a>
        </nav>
        <div class="header-actions header-desktop-actions">
          ${actionAreaHtml}
        </div>
        <button type="button" id="mobile-menu-toggle" class="mobile-menu-btn" aria-expanded="false" aria-label="Toggle navigation menu">
          ${getIconSvg('menu')}
        </button>
      </div>
      <div id="mobile-nav-drawer" class="mobile-nav-drawer">
        <div class="mobile-nav-links">
          <a href="/search.html" class="nav-link">Find a Professional</a>
          <a href="/index.html#categories" class="nav-link">Categories</a>
          <a href="/register.html?role=PROVIDER" class="nav-link">For Providers</a>
          <a href="/index.html#how-it-works" class="nav-link">How It Works</a>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${
            user
              ? `<a href="${dashboardHref}" class="btn btn-primary btn-sm">Dashboard</a>
                 <button type="button" id="mobile-logout-btn" class="btn btn-secondary btn-sm">Log Out</button>`
              : `<a href="/login.html" class="btn btn-secondary btn-sm">Log In</a>
                 <a href="/register.html" class="btn btn-primary btn-sm">Register</a>`
          }
        </div>
      </div>
    `;

    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const drawer = document.getElementById('mobile-nav-drawer');
    if (toggleBtn && drawer) {
      toggleBtn.addEventListener('click', () => {
        const isOpen = drawer.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
      });
    }

    const logoutBtn = document.getElementById('header-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout('/index.html'));
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', () => logout('/index.html'));
  }

  if (footerEl) {
    footerEl.className = 'site-footer';
    footerEl.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <a href="/index.html" class="brand-wordmark">Local Service <span>Finder</span></a>
            <p class="section-sub" style="margin-top:12px;font-size:0.875rem;">
              Verified residential and commercial tradespeople across Indian metro areas with transparent INR rate cards and direct booking tracking.
            </p>
          </div>
          <div>
            <div class="footer-heading">Platform</div>
            <ul class="footer-links">
              <li><a href="/search.html">Find a Professional</a></li>
              <li><a href="/register.html?role=PROVIDER">Provider Onboarding</a></li>
              <li><a href="/login.html">Customer &amp; Provider Login</a></li>
              <li><a href="/index.html#how-it-works">How Booking Works</a></li>
            </ul>
          </div>
          <div>
            <div class="footer-heading">Service Cities</div>
            <ul class="footer-links">
              <li><a href="/search.html?location=Bengaluru">Bengaluru</a></li>
              <li><a href="/search.html?location=Mumbai">Mumbai</a></li>
              <li><a href="/search.html?location=Pune">Pune</a></li>
              <li><a href="/search.html?location=Delhi+NCR">Delhi NCR</a></li>
              <li><a href="/search.html?location=Hyderabad">Hyderabad</a></li>
              <li><a href="/search.html?location=Chennai">Chennai</a></li>
            </ul>
          </div>
          <div>
            <div class="footer-heading">Support &amp; Trust</div>
            <ul class="footer-links">
              <li>support@localservicefinder.in</li>
              <li>+91 80 4120 8899 (Mon–Sat, 8 AM–8 PM)</li>
              <li><a href="/index.html#trust">Verification Standards</a></li>
              <li><a href="/admin-dashboard.html">Moderation Console</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 Local Service Finder. All rights reserved.</span>
          <span>Serving Bengaluru · Mumbai · Pune · Delhi NCR · Hyderabad · Chennai</span>
        </div>
      </div>
    `;
  }
}

export function renderProviderImage(url, altText, fallbackLabel) {
  const safeAlt = escapeHtml(altText);
  const safeFallback = escapeHtml(fallbackLabel || altText);
  if (!url) {
    return `<div class="provider-media-fallback">${getIconSvg('wrench')}<span>${safeFallback}</span></div>`;
  }
  return `
    <img src="${escapeHtml(url)}" alt="${safeAlt}" referrerpolicy="no-referrer" loading="lazy"
      onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'provider-media-fallback',innerHTML:'<span>${safeFallback.replace(/'/g, '')}</span>'}))" />
  `;
}

export function renderProviderCard(p, { showFavorite = false } = {}) {
  const ratingText = p.reviewCount > 0 ? `${Number(p.averageRating).toFixed(1)} (${p.reviewCount})` : 'New';
  const verifiedText = p.verified ? `<span class="verified-inline">${getIconSvg('check')} Verified</span>` : `<span>Pending verification</span>`;

  return `
    <article class="provider-card" data-provider-id="${p.id}">
      <a href="/provider.html?id=${p.id}" class="provider-media" aria-label="View ${escapeHtml(p.businessName)}">
        ${renderProviderImage(p.coverImageUrl, p.businessName, p.categoryName)}
      </a>
      <div class="provider-body">
        <div class="provider-title-row">
          <div>
            <a href="/provider.html?id=${p.id}" class="provider-name">${escapeHtml(p.businessName)}</a>
            <div class="meta-line" style="margin-top:4px;">
              <span>${escapeHtml(p.categoryName)}</span>
              <span class="meta-sep" aria-hidden="true">·</span>
              <span>${escapeHtml(p.area)}, ${escapeHtml(p.city)}</span>
            </div>
          </div>
          ${
            showFavorite
              ? `<button type="button" class="btn btn-secondary btn-sm fav-toggle-btn" data-fav-id="${p.id}" aria-pressed="${p.isFavorited ? 'true' : 'false'}" title="${p.isFavorited ? 'Remove from saved' : 'Save provider'}" style="min-height:34px;padding:6px 10px;${p.isFavorited ? 'color:var(--danger);border-color:rgba(255,92,108,0.45);' : ''}">
                   ${getIconSvg('heart')}
                 </button>`
              : ''
          }
        </div>

        <div class="meta-line">
          <span class="rating-inline">${getIconSvg('star')} ${ratingText}</span>
          <span class="meta-sep" aria-hidden="true">·</span>
          ${verifiedText}
          <span class="meta-sep" aria-hidden="true">·</span>
          <span>${escapeHtml(p.responseTime)}</span>
        </div>

        <p class="provider-desc">${escapeHtml(p.description || '')}</p>

        <div class="provider-footer">
          <div>
            <span class="muted" style="font-size:0.75rem;display:block;">Starts from</span>
            <span class="price-figure">${formatINR(p.startingPrice)}</span>
          </div>
          <a href="/provider.html?id=${p.id}" class="btn btn-secondary btn-sm">View Profile</a>
        </div>
      </div>
    </article>
  `;
}
