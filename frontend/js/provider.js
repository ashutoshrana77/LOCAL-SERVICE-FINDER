import { apiFetch } from './api.js';
import { getStoredUser } from './auth.js';
import {
  closeModal,
  escapeHtml,
  formatDateShort,
  formatINR,
  getIconSvg,
  initChrome,
  openModal,
  renderProviderCard,
  renderProviderImage,
  showToast,
} from './ui.js';

initChrome('search');

const rootEl = document.getElementById('provider-root');
const breadcrumbEl = document.getElementById('breadcrumb-name');
const params = new URLSearchParams(window.location.search);
const providerId = Number(params.get('id'));
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let providerData = null;

async function loadProvider() {
  if (!providerId) {
    rootEl.innerHTML = `
      <div class="empty-state">
        <h2>Provider not specified</h2>
        <p class="muted">Select a service professional from our search directory to inspect their profile.</p>
        <a href="/search.html" class="btn btn-primary btn-sm">Browse Providers</a>
      </div>`;
    return;
  }

  try {
    providerData = await apiFetch(`/providers/${providerId}`);
    document.title = `${providerData.businessName} — Local Service Finder`;
    breadcrumbEl.textContent = providerData.businessName;
    renderPage(providerData);
  } catch (err) {
    rootEl.innerHTML = `<div class="alert-banner alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function renderPage(p) {
  const user = getStoredUser();
  const todayIso = new Date().toISOString().slice(0, 10);
  const ratingText = p.reviewCount > 0 ? `${Number(p.averageRating).toFixed(1)} (${p.reviewCount} reviews)` : 'New provider';
  const galleryItems = p.gallery && p.gallery.length ? p.gallery : [p.coverImageUrl].filter(Boolean);

  rootEl.innerHTML = `
    <section class="profile-header-card">
      <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;flex:1;">
        <div style="width:92px;height:92px;border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--border);flex-shrink:0;">
          ${renderProviderImage(p.coverImageUrl, p.businessName, p.categoryName)}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <h1 style="font-size:1.75rem;">${escapeHtml(p.businessName)}</h1>
          <div class="meta-line">
            <span>${escapeHtml(p.categoryName)}</span>
            <span class="meta-sep">·</span>
            <span>Managed by ${escapeHtml(p.ownerName)}</span>
            <span class="meta-sep">·</span>
            <span>${escapeHtml(p.yearsExperience)} yrs experience</span>
          </div>
          <div class="meta-line">
            <span class="rating-inline">${getIconSvg('star')} ${ratingText}</span>
            <span class="meta-sep">·</span>
            ${p.verified ? `<span class="verified-inline">${getIconSvg('check')} Verified Professional</span>` : `<span>Verification Pending</span>`}
            <span class="meta-sep">·</span>
            <span>${escapeHtml(p.area)}, ${escapeHtml(p.city)} (${escapeHtml(p.pincode)})</span>
            <span class="meta-sep">·</span>
            <span>${escapeHtml(p.responseTime)}</span>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <button type="button" id="toggle-fav-btn" class="btn btn-secondary btn-sm">
          ${getIconSvg('heart')} <span>${p.isFavorited ? 'Saved' : 'Save Provider'}</span>
        </button>
        <button type="button" id="open-msg-btn" class="btn btn-secondary btn-sm">Message Provider</button>
        <a href="/booking.html?providerId=${p.id}" class="btn btn-primary btn-sm">Start Booking</a>
      </div>
    </section>

    <div class="profile-layout">
      <div style="display:flex;flex-direction:column;gap:24px;">
        <section class="card">
          <h2>About</h2>
          <p class="muted" style="margin-top:10px;">${escapeHtml(p.description)}</p>
          ${
            galleryItems.length
              ? `<div class="gallery-grid" style="margin-top:18px;">
                   ${galleryItems
                     .map(
                       (imgUrl, idx) => `
                       <div class="gallery-item">
                         ${renderProviderImage(imgUrl, `${p.businessName} work sample ${idx + 1}`, p.categoryName)}
                       </div>`,
                     )
                     .join('')}
                 </div>`
              : ''
          }
        </section>

        <section class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;">
            <h2>Services &amp; INR Rate Card</h2>
            <span class="muted tabular" style="font-size:0.8125rem;">${p.services.length} service${p.services.length === 1 ? '' : 's'}</span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Est. Duration</th>
                  <th class="num">Starting Rate</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${p.services
                  .map(
                    (s) => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(s.title)}</strong>
                      <div class="muted" style="font-size:0.8125rem;margin-top:3px;">${escapeHtml(s.description)}</div>
                    </td>
                    <td class="tabular" style="white-space:nowrap;">${s.durationMinutes} mins</td>
                    <td class="num" style="white-space:nowrap;">
                      <strong>${formatINR(s.basePrice)}</strong>
                      <div class="muted" style="font-size:0.75rem;">${escapeHtml(s.priceUnit)}</div>
                    </td>
                    <td style="text-align:right;">
                      <button type="button" class="btn btn-secondary btn-sm select-service-btn" data-service-id="${s.id}">Select</button>
                    </td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <h2>Weekly Availability</h2>
          <p class="muted" style="margin-top:6px;font-size:0.875rem;">Standard 2-hour arrival windows in local time.</p>
          <div class="availability-grid" style="margin-top:16px;">
            ${p.availability
              .map(
                (a) => `
                <div class="avail-day ${a.isAvailable ? 'open' : 'closed'}">
                  <strong style="display:block;margin-bottom:4px;">${DAY_NAMES[a.dayOfWeek]}</strong>
                  <span class="mono" style="font-size:0.7rem;color:${a.isAvailable ? 'var(--accent-primary)' : 'var(--text-muted)'};">
                    ${a.isAvailable ? `${a.startTime}–${a.endTime}` : 'Closed'}
                  </span>
                </div>`,
              )
              .join('')}
          </div>
        </section>

        <section class="card">
          <h2>Service Areas &amp; Dispatch Coverage</h2>
          <div class="grid-2" style="margin-top:14px;align-items:start;">
            <div>
              <p class="muted" style="font-size:0.875rem;margin-bottom:10px;">Active localities around ${escapeHtml(p.area)}, ${escapeHtml(p.city)}:</p>
              <div class="meta-line" style="gap:10px;">
                ${p.serviceAreas.map((sa) => `<span style="color:var(--text-primary);">${escapeHtml(sa)}</span>`).join('<span class="meta-sep">·</span>')}
              </div>
              <p class="muted mono" style="font-size:0.8125rem;margin-top:14px;">Base Pincode: ${escapeHtml(p.pincode)} · Contact: ${escapeHtml(p.contactPhone)}</p>
            </div>
            <div class="map-preview-card">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <strong style="font-size:0.875rem;">Dispatch Zone Preview</strong>
                <span class="mono muted" style="font-size:0.75rem;">${Number(p.latitude).toFixed(4)}, ${Number(p.longitude).toFixed(4)}</span>
              </div>
              <svg viewBox="0 0 320 120" width="100%" height="120" role="img" aria-label="Service coverage preview for ${escapeHtml(p.area)}" style="background:#0b0f14;border:1px solid var(--border);border-radius:6px;">
                <path d="M0 30 H320 M0 60 H320 M0 90 H320 M60 0 V120 M140 0 V120 M220 0 V120 M280 0 V120" stroke="#1a222e" stroke-width="1"/>
                <circle cx="160" cy="60" r="42" fill="rgba(61,220,151,0.12)" stroke="#3ddc97" stroke-width="1.5" stroke-dasharray="4 3"/>
                <circle cx="160" cy="60" r="6" fill="#3ddc97"/>
                <text x="172" y="64" fill="#e7edf5" font-size="11" font-family="sans-serif">${escapeHtml(p.area)} (${escapeHtml(p.pincode)})</text>
              </svg>
            </div>
          </div>
        </section>

        <section class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <h2>Customer Reviews</h2>
            <span class="rating-inline">${getIconSvg('star')} ${ratingText}</span>
          </div>
          <div style="margin-top:8px;">
            ${
              p.reviews.length === 0
                ? `<p class="muted" style="padding-top:12px;">No reviews published yet for this provider.</p>`
                : p.reviews
                    .map(
                      (r) => `
                  <article class="review-item">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                      <strong>${escapeHtml(r.customerFirstName)}</strong>
                      <div class="meta-line">
                        <span class="rating-inline">${getIconSvg('star')} ${r.rating}.0</span>
                        <span class="meta-sep">·</span>
                        <span>${formatDateShort(r.createdAt)}</span>
                      </div>
                    </div>
                    <p class="muted" style="margin-top:8px;">${escapeHtml(r.comment)}</p>
                    ${
                      r.providerReply
                        ? `<div class="provider-reply-box">
                             <strong style="font-size:0.8125rem;color:var(--accent-primary);">Reply from ${escapeHtml(p.businessName)}</strong>
                             <p class="muted" style="margin-top:4px;">${escapeHtml(r.providerReply)}</p>
                           </div>`
                        : ''
                    }
                  </article>`,
                    )
                    .join('')
            }
          </div>
        </section>
      </div>

      <aside class="sticky-booking-panel" aria-label="Quick booking and quote panel">
        <div>
          <h3>Book or Request a Quote</h3>
          <p class="muted" style="font-size:0.8125rem;margin-top:4px;">${escapeHtml(p.responseTime)} · No upfront payment required</p>
        </div>

        <form id="sticky-booking-form" style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label for="sticky-service" class="form-label">Select Service</label>
            <select id="sticky-service" class="select">
              ${p.services
                .map((s) => `<option value="${s.id}">${escapeHtml(s.title)} — ${formatINR(s.basePrice)}</option>`)
                .join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="sticky-date" class="form-label">Preferred Date</label>
            <input id="sticky-date" type="date" class="input" min="${todayIso}" value="${todayIso}" />
          </div>

          <div class="form-group">
            <label for="sticky-slot" class="form-label">Preferred Time Slot</label>
            <select id="sticky-slot" class="select">
              <option value="09:00 - 11:00">09:00 - 11:00</option>
              <option value="11:30 - 13:30">11:30 - 13:30</option>
              <option value="14:30 - 16:30">14:30 - 16:30</option>
              <option value="17:00 - 19:00">17:00 - 19:00</option>
            </select>
          </div>

          <div class="form-group">
            <label for="sticky-property" class="form-label">Property Type</label>
            <select id="sticky-property" class="select">
              <option value="Apartment">Apartment / Flat</option>
              <option value="Independent House">Independent House / Villa</option>
              <option value="Office">Office / Commercial</option>
            </select>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
            <button type="submit" class="btn btn-primary">Continue to Booking</button>
            <button type="button" id="open-quote-modal-btn" class="btn btn-secondary">Request Custom Quote</button>
          </div>
        </form>

        ${
          user && user.role === 'PROVIDER'
            ? `<p class="muted" style="font-size:0.75rem;">You are signed in as a Provider. Switch to a Customer account to place bookings.</p>`
            : ''
        }
      </aside>
    </div>

    ${
      p.similarProviders && p.similarProviders.length
        ? `<section class="section section-bordered" style="padding-bottom:16px;">
             <div class="section-head">
               <h2>Similar Providers Nearby</h2>
               <a href="/search.html?category=${encodeURIComponent(p.categorySlug)}" class="btn btn-secondary btn-sm">See More in ${escapeHtml(p.categoryName)}</a>
             </div>
             <div class="grid-3">
               ${p.similarProviders.map((sp) => renderProviderCard(sp)).join('')}
             </div>
           </section>`
        : ''
    }
  `;

  bindEvents(p);
}

function bindEvents(p) {
  const stickyService = document.getElementById('sticky-service');

  document.querySelectorAll('.select-service-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      stickyService.value = btn.dataset.serviceId;
      stickyService.focus();
      showToast('Service selected in booking panel');
    });
  });

  document.getElementById('sticky-booking-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const qs = new URLSearchParams({
      providerId: String(p.id),
      serviceId: stickyService.value,
      date: document.getElementById('sticky-date').value,
      slot: document.getElementById('sticky-slot').value,
      propertyType: document.getElementById('sticky-property').value,
    });
    window.location.href = `/booking.html?${qs.toString()}`;
  });

  document.getElementById('toggle-fav-btn')?.addEventListener('click', async (e) => {
    const user = getStoredUser();
    if (!user) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    const btn = e.currentTarget;
    try {
      if (p.isFavorited) {
        await apiFetch(`/favorites/${p.id}`, { method: 'DELETE' });
        p.isFavorited = false;
        btn.querySelector('span').textContent = 'Save Provider';
        showToast('Removed from saved providers');
      } else {
        await apiFetch(`/favorites/${p.id}`, { method: 'POST' });
        p.isFavorited = true;
        btn.querySelector('span').textContent = 'Saved';
        showToast('Saved to favorites');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('open-quote-modal-btn')?.addEventListener('click', () => {
    const user = getStoredUser();
    if (!user) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    const todayIso = new Date().toISOString().slice(0, 10);
    openModal({
      title: `Request Quote — ${p.businessName}`,
      contentHtml: `
        <form id="quote-modal-form" style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label for="q-service" class="form-label">Related Service</label>
            <select id="q-service" class="select">
              <option value="">Custom / Multiple Services</option>
              ${p.services.map((s) => `<option value="${s.id}">${escapeHtml(s.title)} (${formatINR(s.basePrice)})</option>`).join('')}
            </select>
          </div>
          <div class="grid-2" style="gap:10px;">
            <div class="form-group">
              <label for="q-date" class="form-label">Preferred Date</label>
              <input id="q-date" type="date" class="input" min="${todayIso}" value="${todayIso}" required />
            </div>
            <div class="form-group">
              <label for="q-budget" class="form-label">Target Budget (₹)</label>
              <input id="q-budget" type="number" min="100" step="50" class="input tabular" placeholder="e.g. 1500" />
            </div>
          </div>
          <div class="form-group">
            <label for="q-area" class="form-label">Address / Locality</label>
            <input id="q-area" type="text" class="input" placeholder="e.g. 12th Main, Indiranagar, Bengaluru" required />
          </div>
          <div class="form-group">
            <label for="q-desc" class="form-label">Job Details</label>
            <textarea id="q-desc" class="textarea" placeholder="Describe scope, dimensions, or issue details..." required></textarea>
          </div>
          <div id="quote-modal-error" class="alert-banner alert-error" style="display:none;"></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="submit" class="btn btn-primary">Send Quote Request</button>
          </div>
        </form>
      `,
      onMount: (bodyEl) => {
        const form = bodyEl.querySelector('#quote-modal-form');
        const errBox = bodyEl.querySelector('#quote-modal-error');
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          errBox.style.display = 'none';
          try {
            await apiFetch('/quote-requests', {
              method: 'POST',
              body: {
                providerId: p.id,
                serviceId: bodyEl.querySelector('#q-service').value || null,
                preferredDate: bodyEl.querySelector('#q-date').value,
                estimatedBudget: Number(bodyEl.querySelector('#q-budget').value) || 0,
                propertyType: document.getElementById('sticky-property')?.value || 'Apartment',
                addressArea: bodyEl.querySelector('#q-area').value,
                description: bodyEl.querySelector('#q-desc').value,
              },
            });
            closeModal();
            showToast('Quote request sent. Track responses in your dashboard.');
          } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
          }
        });
      },
    });
  });

  document.getElementById('open-msg-btn')?.addEventListener('click', () => {
    const user = getStoredUser();
    if (!user) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    openModal({
      title: `Message ${p.businessName}`,
      contentHtml: `
        <form id="msg-modal-form" style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label for="m-body" class="form-label">Your Message</label>
            <textarea id="m-body" class="textarea" placeholder="Ask about availability, spare parts, or inspection scope..." required></textarea>
          </div>
          <div id="msg-modal-error" class="alert-banner alert-error" style="display:none;"></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="submit" class="btn btn-primary">Send Message</button>
          </div>
        </form>
      `,
      onMount: (bodyEl) => {
        const form = bodyEl.querySelector('#msg-modal-form');
        const errBox = bodyEl.querySelector('#msg-modal-error');
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          errBox.style.display = 'none';
          try {
            await apiFetch('/messages', {
              method: 'POST',
              body: {
                providerId: p.id,
                body: bodyEl.querySelector('#m-body').value,
              },
            });
            closeModal();
            showToast('Message delivered to provider');
          } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
          }
        });
      },
    });
  });
}

loadProvider();
