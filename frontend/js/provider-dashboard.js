import { apiFetch } from './api.js';
import { requireRoleAccess } from './auth.js';
import {
  closeModal,
  escapeHtml,
  formatDateShort,
  formatINR,
  getIconSvg,
  initChrome,
  openModal,
  showToast,
} from './ui.js';

initChrome('');

const panelEl = document.getElementById('provider-panel');
const tabsEl = document.getElementById('provider-tabs');
const urlTab = new URLSearchParams(window.location.search).get('tab');
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const state = {
  user: null,
  activeTab: urlTab || 'overview',
  dashboard: null,
  threads: [],
};

function setActiveTab(tab) {
  state.activeTab = tab;
  tabsEl.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url);
  renderTab();
}

function updateSidebarCounts() {
  const d = state.dashboard;
  if (!d) return;
  document.getElementById('prov-biz-name').textContent = d.profile.businessName;
  document.getElementById('prov-biz-meta').textContent = `${d.profile.categoryName} · ${d.profile.city}`;
  document.getElementById('p-count-bookings').textContent = d.bookings.length;
  document.getElementById('p-count-quotes').textContent = d.quotes.length;
  document.getElementById('p-count-services').textContent = d.services.length;
  document.getElementById('p-count-reviews').textContent = d.reviews.length;
  document.getElementById('p-count-messages').textContent = state.threads.length;
}

function renderOverviewTab() {
  const d = state.dashboard;
  const s = d.stats;
  const pendingBookings = d.bookings.filter((b) => b.status === 'PENDING');
  const pendingQuotes = d.quotes.filter((q) => q.status === 'PENDING');

  panelEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:20px;">
      <div>
        <h1>Provider Overview</h1>
        <div class="meta-line" style="margin-top:6px;">
          <span class="status-chip status-${d.profile.verificationStatus}">${d.profile.verificationStatus}</span>
          <span class="meta-sep">·</span>
          <span>Profile completeness: <strong class="tabular">${s.profileCompleteness}%</strong></span>
          <span class="meta-sep">·</span>
          <a href="/provider.html?id=${d.profile.id}" style="color:var(--accent-secondary);">View Public Profile</a>
        </div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Profile Views</div>
        <div class="kpi-value">${s.profileViews}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Bookings &amp; Quotes</div>
        <div class="kpi-value">${s.totalBookings} / ${s.totalQuotes}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Conversion Rate</div>
        <div class="kpi-value" style="color:var(--accent-primary);">${s.conversionRate}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Average Rating</div>
        <div class="kpi-value" style="color:var(--warning);">${s.reviewCount > 0 ? s.averageRating.toFixed(1) : '—'} <span class="muted" style="font-size:0.875rem;">(${s.reviewCount})</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2>Bookings Requiring Action</h2>
          <span class="mono muted">${pendingBookings.length}</span>
        </div>
        ${
          pendingBookings.length === 0
            ? `<p class="muted" style="font-size:0.875rem;">No pending booking requests right now.</p>`
            : `<div style="display:flex;flex-direction:column;gap:12px;">
                ${pendingBookings
                  .map(
                    (b) => `
                  <div class="surface-panel" style="padding:14px;">
                    <div style="display:flex;justify-content:space-between;gap:10px;">
                      <strong>${escapeHtml(b.customerName)}</strong>
                      <span class="price-figure">${formatINR(b.quotedPrice)}</span>
                    </div>
                    <div class="muted" style="font-size:0.8125rem;margin-top:4px;">${escapeHtml(b.serviceTitle)} · ${escapeHtml(b.scheduledDate)} (${escapeHtml(b.timeSlot)})</div>
                    <div style="display:flex;gap:8px;margin-top:10px;">
                      <button type="button" class="btn btn-primary btn-sm bk-action-btn" data-id="${b.id}" data-status="ACCEPTED">Accept</button>
                      <button type="button" class="btn btn-danger btn-sm bk-action-btn" data-id="${b.id}" data-status="REJECTED">Reject</button>
                    </div>
                  </div>`,
                  )
                  .join('')}
              </div>`
        }
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2>Pending Quote Requests</h2>
          <span class="mono muted">${pendingQuotes.length}</span>
        </div>
        ${
          pendingQuotes.length === 0
            ? `<p class="muted" style="font-size:0.875rem;">All quote requests have been answered.</p>`
            : `<div style="display:flex;flex-direction:column;gap:12px;">
                ${pendingQuotes
                  .map(
                    (q) => `
                  <div class="surface-panel" style="padding:14px;">
                    <strong>${escapeHtml(q.customerName)} — ${escapeHtml(q.addressArea)}</strong>
                    <p class="muted" style="font-size:0.8125rem;margin-top:4px;">${escapeHtml(q.description)}</p>
                    <div style="margin-top:10px;">
                      <button type="button" class="btn btn-secondary btn-sm respond-quote-btn" data-id="${q.id}">Send INR Quote</button>
                    </div>
                  </div>`,
                  )
                  .join('')}
              </div>`
        }
      </div>
    </div>
  `;

  bindBookingActionButtons();
  bindQuoteResponseButtons();
}

function renderBookingsTab() {
  const bookings = state.dashboard.bookings;
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">All Bookings</h1>
    ${
      bookings.length === 0
        ? `<div class="empty-state"><h3>No bookings yet</h3></div>`
        : `<div class="table-wrap"><table class="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Customer</th>
                <th>Service &amp; Area</th>
                <th>Date / Slot</th>
                <th class="num">Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${bookings
                .map(
                  (b) => `
                <tr>
                  <td class="mono">${escapeHtml(b.referenceCode)}</td>
                  <td>
                    <strong>${escapeHtml(b.customerName)}</strong>
                    <div class="muted mono" style="font-size:0.75rem;">${escapeHtml(b.customerPhone)}</div>
                  </td>
                  <td>
                    <div>${escapeHtml(b.serviceTitle)}</div>
                    <div class="muted" style="font-size:0.8125rem;">${escapeHtml(b.addressArea)}</div>
                  </td>
                  <td class="tabular">
                    <div>${escapeHtml(b.scheduledDate)}</div>
                    <div class="muted mono" style="font-size:0.75rem;">${escapeHtml(b.timeSlot)}</div>
                  </td>
                  <td class="num"><strong>${formatINR(b.quotedPrice)}</strong></td>
                  <td><span class="status-chip status-${b.status}">${b.status}</span></td>
                  <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                      ${
                        b.status === 'PENDING'
                          ? `<button type="button" class="btn btn-primary btn-sm bk-action-btn" data-id="${b.id}" data-status="ACCEPTED">Accept</button>
                             <button type="button" class="btn btn-danger btn-sm bk-action-btn" data-id="${b.id}" data-status="REJECTED">Reject</button>`
                          : ''
                      }
                      ${
                        ['ACCEPTED', 'RESCHEDULED'].includes(b.status)
                          ? `<button type="button" class="btn btn-primary btn-sm bk-action-btn" data-id="${b.id}" data-status="COMPLETED">Complete</button>
                             <button type="button" class="btn btn-secondary btn-sm bk-resched-btn" data-id="${b.id}" data-date="${escapeHtml(b.scheduledDate)}">Reschedule</button>`
                          : ''
                      }
                    </div>
                  </td>
                </tr>`,
                )
                .join('')}
            </tbody>
          </table></div>`
    }
  `;
  bindBookingActionButtons();
}

function bindBookingActionButtons() {
  panelEl.querySelectorAll('.bk-action-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/bookings/${btn.dataset.id}/status`, {
          method: 'PATCH',
          body: { status: btn.dataset.status },
        });
        showToast(`Booking marked ${btn.dataset.status}`);
        await refreshDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  panelEl.querySelectorAll('.bk-resched-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      openModal({
        title: 'Reschedule Booking',
        contentHtml: `
          <form id="prov-resched-form" style="display:flex;flex-direction:column;gap:14px;">
            <div class="form-group">
              <label for="prs-date" class="form-label">New Date</label>
              <input id="prs-date" type="date" class="input" min="${todayIso}" value="${escapeHtml(btn.dataset.date)}" required />
            </div>
            <div class="form-group">
              <label for="prs-slot" class="form-label">Time Slot</label>
              <select id="prs-slot" class="select">
                <option value="09:00 - 11:00">09:00 - 11:00</option>
                <option value="11:30 - 13:30">11:30 - 13:30</option>
                <option value="14:30 - 16:30">14:30 - 16:30</option>
                <option value="17:00 - 19:00">17:00 - 19:00</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary">Confirm Reschedule</button>
          </form>
        `,
        onMount: (bodyEl) => {
          bodyEl.querySelector('#prov-resched-form').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            try {
              await apiFetch(`/bookings/${btn.dataset.id}/status`, {
                method: 'PATCH',
                body: {
                  status: 'RESCHEDULED',
                  scheduledDate: bodyEl.querySelector('#prs-date').value,
                  timeSlot: bodyEl.querySelector('#prs-slot').value,
                },
              });
              closeModal();
              showToast('Booking rescheduled');
              await refreshDashboard();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        },
      });
    });
  });
}

function renderQuotesTab() {
  const quotes = state.dashboard.quotes;
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Quote Requests</h1>
    ${
      quotes.length === 0
        ? `<div class="empty-state"><h3>No quote requests yet</h3></div>`
        : `<div style="display:flex;flex-direction:column;gap:14px;">
            ${quotes
              .map(
                (q) => `
              <article class="card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                  <div>
                    <strong>${escapeHtml(q.customerName)}</strong>
                    <div class="meta-line" style="margin-top:4px;">
                      <span>${escapeHtml(q.serviceTitle)}</span>
                      <span class="meta-sep">·</span>
                      <span>${escapeHtml(q.addressArea)}</span>
                      <span class="meta-sep">·</span>
                      <span>Preferred: ${escapeHtml(q.preferredDate)}</span>
                    </div>
                  </div>
                  <span class="status-chip status-${q.status}">${q.status}</span>
                </div>
                <p class="muted" style="margin-top:10px;font-size:0.875rem;">${escapeHtml(q.description)}</p>
                <div class="hairline-divider"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                  <span class="muted">Customer budget: <strong class="tabular">${q.estimatedBudget ? formatINR(q.estimatedBudget) : 'Not specified'}</strong></span>
                  <div style="display:flex;gap:8px;">
                    ${
                      q.status === 'PENDING'
                        ? `<button type="button" class="btn btn-primary btn-sm respond-quote-btn" data-id="${q.id}">Send Quote</button>
                           <button type="button" class="btn btn-danger btn-sm decline-quote-btn" data-id="${q.id}">Decline</button>`
                        : q.quotedAmount
                          ? `<span class="price-figure">Quoted ${formatINR(q.quotedAmount)}</span>`
                          : ''
                    }
                  </div>
                </div>
              </article>`,
              )
              .join('')}
          </div>`
    }
  `;
  bindQuoteResponseButtons();
}

function bindQuoteResponseButtons() {
  panelEl.querySelectorAll('.respond-quote-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      openModal({
        title: 'Send Estimate to Customer',
        contentHtml: `
          <form id="send-quote-form" style="display:flex;flex-direction:column;gap:14px;">
            <div class="form-group">
              <label for="sq-amount" class="form-label">Quoted Amount (₹)</label>
              <input id="sq-amount" type="number" min="50" step="50" class="input tabular" placeholder="1800" required />
            </div>
            <div class="form-group">
              <label for="sq-note" class="form-label">Scope &amp; Spare-Parts Note</label>
              <textarea id="sq-note" class="textarea" placeholder="Specify what is included in this estimate..." required></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Send Quote</button>
          </form>
        `,
        onMount: (bodyEl) => {
          bodyEl.querySelector('#send-quote-form').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            try {
              await apiFetch(`/quote-requests/${btn.dataset.id}`, {
                method: 'PATCH',
                body: {
                  status: 'QUOTED',
                  quotedAmount: Number(bodyEl.querySelector('#sq-amount').value),
                  providerNote: bodyEl.querySelector('#sq-note').value.trim(),
                },
              });
              closeModal();
              showToast('Estimate sent to customer');
              await refreshDashboard();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        },
      });
    });
  });

  panelEl.querySelectorAll('.decline-quote-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/quote-requests/${btn.dataset.id}`, {
          method: 'PATCH',
          body: { status: 'DECLINED', providerNote: 'Currently booked for requested dates.' },
        });
        showToast('Quote declined');
        await refreshDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderServicesTab() {
  const services = state.dashboard.services;
  panelEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
      <h1>Services &amp; INR Rate Card</h1>
      <button type="button" id="add-service-btn" class="btn btn-primary btn-sm">Add Service</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Service Title</th>
            <th>Duration</th>
            <th class="num">Base Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            services.length === 0
              ? `<tr><td colspan="4" class="muted" style="text-align:center;padding:24px;">No active services yet. Add your first service rate above.</td></tr>`
              : services
                  .map(
                    (s) => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(s.title)}</strong>
                      <div class="muted" style="font-size:0.8125rem;">${escapeHtml(s.description)}</div>
                    </td>
                    <td class="tabular">${s.durationMinutes} mins</td>
                    <td class="num"><strong>${formatINR(s.basePrice)}</strong> <span class="muted">${escapeHtml(s.priceUnit)}</span></td>
                    <td style="text-align:right;">
                      <button type="button" class="btn btn-danger btn-sm del-service-btn" data-id="${s.id}">Remove</button>
                    </td>
                  </tr>`,
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('add-service-btn').addEventListener('click', () => {
    openModal({
      title: 'Add New Service',
      contentHtml: `
        <form id="add-service-form" style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label for="svc-title" class="form-label">Service Title</label>
            <input id="svc-title" type="text" class="input" placeholder="e.g. Split AC Jet Servicing" required />
          </div>
          <div class="grid-3" style="gap:10px;">
            <div class="form-group">
              <label for="svc-price" class="form-label">Price (₹)</label>
              <input id="svc-price" type="number" min="50" step="50" class="input tabular" value="499" required />
            </div>
            <div class="form-group">
              <label for="svc-unit" class="form-label">Unit</label>
              <input id="svc-unit" type="text" class="input" value="per visit" required />
            </div>
            <div class="form-group">
              <label for="svc-dur" class="form-label">Minutes</label>
              <input id="svc-dur" type="number" min="15" step="15" class="input tabular" value="60" required />
            </div>
          </div>
          <div class="form-group">
            <label for="svc-desc" class="form-label">Scope Description</label>
            <textarea id="svc-desc" class="textarea" placeholder="Describe tools, checks, and inclusions..." required></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Save Service</button>
        </form>
      `,
      onMount: (bodyEl) => {
        bodyEl.querySelector('#add-service-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try {
            await apiFetch('/provider/services', {
              method: 'POST',
              body: {
                title: bodyEl.querySelector('#svc-title').value.trim(),
                basePrice: Number(bodyEl.querySelector('#svc-price').value),
                priceUnit: bodyEl.querySelector('#svc-unit').value.trim(),
                durationMinutes: Number(bodyEl.querySelector('#svc-dur').value),
                description: bodyEl.querySelector('#svc-desc').value.trim(),
              },
            });
            closeModal();
            showToast('Service added to rate card');
            await refreshDashboard();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      },
    });
  });

  panelEl.querySelectorAll('.del-service-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/provider/services/${btn.dataset.id}`, { method: 'DELETE' });
        showToast('Service removed');
        await refreshDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderAvailabilityTab() {
  const avail = state.dashboard.availability;
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Weekly Availability</h1>
    <div class="card">
      <form id="avail-form" style="display:flex;flex-direction:column;gap:12px;">
        ${avail
          .map(
            (a) => `
          <div class="surface-panel" style="display:grid;grid-template-columns:160px 1fr 1fr;gap:12px;align-items:center;" data-dow="${a.dayOfWeek}">
            <label class="checkbox-row">
              <input type="checkbox" class="avail-open-cb" ${a.isAvailable ? 'checked' : ''} />
              <strong>${DAY_NAMES[a.dayOfWeek]}</strong>
            </label>
            <div class="form-group">
              <label class="form-label" style="font-size:0.75rem;">Start Time</label>
              <input type="time" class="input avail-start" value="${escapeHtml(a.startTime)}" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.75rem;">End Time</label>
              <input type="time" class="input avail-end" value="${escapeHtml(a.endTime)}" />
            </div>
          </div>`,
          )
          .join('')}
        <div style="margin-top:8px;">
          <button type="submit" class="btn btn-primary btn-sm">Save Weekly Schedule</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('avail-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const schedule = Array.from(panelEl.querySelectorAll('[data-dow]')).map((row) => ({
      dayOfWeek: Number(row.dataset.dow),
      isAvailable: row.querySelector('.avail-open-cb').checked,
      startTime: row.querySelector('.avail-start').value,
      endTime: row.querySelector('.avail-end').value,
    }));

    try {
      await apiFetch('/provider/availability', {
        method: 'PUT',
        body: { schedule },
      });
      showToast('Weekly availability saved');
      await refreshDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function renderReviewsTab() {
  const reviews = state.dashboard.reviews;
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Customer Reviews</h1>
    ${
      reviews.length === 0
        ? `<div class="empty-state"><h3>No reviews yet</h3></div>`
        : `<div style="display:flex;flex-direction:column;gap:14px;">
            ${reviews
              .map(
                (r) => `
              <article class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong>${escapeHtml(r.customerFirstName)}</strong>
                  <span class="rating-inline">${getIconSvg('star')} ${r.rating}.0 · <span class="muted">${formatDateShort(r.createdAt)}</span></span>
                </div>
                <p class="muted" style="margin-top:8px;">${escapeHtml(r.comment)}</p>
                ${
                  r.providerReply
                    ? `<div class="provider-reply-box"><strong>Your Reply:</strong> <span class="muted">${escapeHtml(r.providerReply)}</span></div>`
                    : `<form class="reply-review-form" data-review-id="${r.id}" style="display:flex;gap:10px;margin-top:12px;">
                         <input type="text" class="input" placeholder="Write a public response..." required />
                         <button type="submit" class="btn btn-secondary btn-sm">Reply</button>
                       </form>`
                }
              </article>`,
              )
              .join('')}
          </div>`
    }
  `;

  panelEl.querySelectorAll('.reply-review-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const replyText = form.querySelector('input').value.trim();
      try {
        await apiFetch(`/reviews/${form.dataset.reviewId}/reply`, {
          method: 'POST',
          body: { reply: replyText },
        });
        showToast('Reply published');
        await refreshDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderMessagesTab() {
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Customer Messages</h1>
    ${
      state.threads.length === 0
        ? `<div class="empty-state"><h3>No customer messages yet</h3></div>`
        : `<div style="display:flex;flex-direction:column;gap:18px;">
            ${state.threads
              .map(
                (t) => `
              <div class="message-thread">
                <div style="padding-bottom:10px;border-bottom:1px solid var(--border);">
                  <strong>${escapeHtml(t.customerName)}</strong>
                  ${t.referenceCode ? `<span class="mono muted" style="font-size:0.75rem;margin-left:8px;">${escapeHtml(t.referenceCode)}</span>` : ''}
                </div>
                ${t.messages
                  .map(
                    (m) => `
                  <div class="message-bubble ${m.senderId === state.user.id ? 'self' : ''}">
                    <div style="font-size:0.75rem;" class="muted">${escapeHtml(m.senderName)} · ${formatDateShort(m.createdAt)}</div>
                    <div style="margin-top:4px;font-size:0.875rem;">${escapeHtml(m.body)}</div>
                  </div>`,
                  )
                  .join('')}
                <form class="prov-reply-form" data-customer-id="${t.customerId}" data-booking-id="${t.bookingId || ''}" style="display:flex;gap:10px;margin-top:6px;">
                  <input type="text" class="input" placeholder="Reply to ${escapeHtml(t.customerName)}..." required />
                  <button type="submit" class="btn btn-primary btn-sm">Send</button>
                </form>
              </div>`,
              )
              .join('')}
          </div>`
    }
  `;

  panelEl.querySelectorAll('.prov-reply-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      try {
        await apiFetch('/messages', {
          method: 'POST',
          body: {
            customerId: Number(form.dataset.customerId),
            bookingId: form.dataset.bookingId ? Number(form.dataset.bookingId) : null,
            body: input.value.trim(),
          },
        });
        showToast('Message sent');
        await refreshDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderProfileTab() {
  const p = state.dashboard.profile;
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Business Profile</h1>
    <div class="card" style="max-width:640px;">
      <form id="prov-profile-form" style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-group">
          <label for="pp-name" class="form-label">Business Name</label>
          <input id="pp-name" type="text" class="input" value="${escapeHtml(p.businessName)}" required />
        </div>
        <div class="grid-3" style="gap:10px;">
          <div class="form-group">
            <label for="pp-city" class="form-label">City</label>
            <input id="pp-city" type="text" class="input" value="${escapeHtml(p.city)}" required />
          </div>
          <div class="form-group">
            <label for="pp-area" class="form-label">Primary Area</label>
            <input id="pp-area" type="text" class="input" value="${escapeHtml(p.area)}" required />
          </div>
          <div class="form-group">
            <label for="pp-pincode" class="form-label">Pincode</label>
            <input id="pp-pincode" type="text" maxlength="6" class="input mono" value="${escapeHtml(p.pincode)}" required />
          </div>
        </div>
        <div class="grid-2" style="gap:10px;">
          <div class="form-group">
            <label for="pp-resp" class="form-label">Response Time (mins)</label>
            <input id="pp-resp" type="number" min="5" max="240" class="input tabular" value="${p.responseMinutes}" required />
          </div>
          <div class="form-group">
            <label for="pp-exp" class="form-label">Years Experience</label>
            <input id="pp-exp" type="number" min="1" max="50" class="input tabular" value="${p.yearsExperience}" required />
          </div>
        </div>
        <div class="form-group">
          <label for="pp-areas" class="form-label">Covered Service Areas (comma-separated)</label>
          <input id="pp-areas" type="text" class="input" value="${escapeHtml(p.serviceAreas.join(', '))}" />
        </div>
        <div class="form-group">
          <label for="pp-desc" class="form-label">Business Description</label>
          <textarea id="pp-desc" class="textarea" required>${escapeHtml(p.description)}</textarea>
        </div>
        <div>
          <button type="submit" class="btn btn-primary btn-sm">Update Business Profile</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('prov-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/provider/profile', {
        method: 'PUT',
        body: {
          businessName: document.getElementById('pp-name').value.trim(),
          city: document.getElementById('pp-city').value.trim(),
          area: document.getElementById('pp-area').value.trim(),
          pincode: document.getElementById('pp-pincode').value.trim(),
          responseMinutes: Number(document.getElementById('pp-resp').value),
          yearsExperience: Number(document.getElementById('pp-exp').value),
          serviceAreas: document.getElementById('pp-areas').value,
          description: document.getElementById('pp-desc').value.trim(),
        },
      });
      showToast('Business profile saved');
      await refreshDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function renderTab() {
  if (!state.dashboard) return;
  if (state.activeTab === 'bookings') renderBookingsTab();
  else if (state.activeTab === 'quotes') renderQuotesTab();
  else if (state.activeTab === 'services') renderServicesTab();
  else if (state.activeTab === 'availability') renderAvailabilityTab();
  else if (state.activeTab === 'reviews') renderReviewsTab();
  else if (state.activeTab === 'messages') renderMessagesTab();
  else if (state.activeTab === 'profile') renderProfileTab();
  else renderOverviewTab();
}

async function refreshDashboard() {
  const [dash, msg] = await Promise.all([apiFetch('/provider/dashboard'), apiFetch('/messages')]);
  state.dashboard = dash;
  state.threads = msg.threads || [];
  updateSidebarCounts();
  renderTab();
}

async function init() {
  const user = await requireRoleAccess(['PROVIDER', 'ADMIN']);
  if (!user) return;
  state.user = user;

  tabsEl.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  try {
    await refreshDashboard();
    setActiveTab(state.activeTab);
  } catch (err) {
    panelEl.innerHTML = `<div class="alert-banner alert-error">${escapeHtml(err.message)}</div>`;
  }
}

init();
