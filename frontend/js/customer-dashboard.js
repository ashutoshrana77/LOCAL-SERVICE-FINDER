import { apiFetch } from './api.js';
import { requireRoleAccess, syncSessionUser } from './auth.js';
import {
  closeModal,
  escapeHtml,
  formatDateShort,
  formatINR,
  initChrome,
  openModal,
  renderProviderCard,
  showToast,
} from './ui.js';

initChrome('');

const panelEl = document.getElementById('customer-panel');
const tabsContainer = document.getElementById('customer-tabs');
const urlTab = new URLSearchParams(window.location.search).get('tab');

const state = {
  user: null,
  activeTab: urlTab || 'bookings',
  bookings: [],
  quotes: [],
  favorites: [],
  threads: [],
  notifications: [],
};

function updateCounts() {
  document.getElementById('count-bookings').textContent = state.bookings.length;
  document.getElementById('count-quotes').textContent = state.quotes.length;
  document.getElementById('count-favorites').textContent = state.favorites.length;
  const pendingReviewCount = state.bookings.filter((b) => b.status === 'COMPLETED' && !b.hasReview).length;
  document.getElementById('count-reviews').textContent = pendingReviewCount;
  document.getElementById('count-messages').textContent = state.threads.length;
  const unreadCount = state.notifications.filter((n) => !n.isRead).length;
  document.getElementById('count-notifs').textContent = unreadCount;
}

function setActiveTab(tab) {
  state.activeTab = tab;
  tabsContainer.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url);
  renderTab();
}

function renderBookingsTab() {
  const upcoming = state.bookings.filter((b) => ['PENDING', 'ACCEPTED', 'RESCHEDULED'].includes(b.status));
  const past = state.bookings.filter((b) => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(b.status));

  const renderRows = (list, isUpcoming) =>
    list.length === 0
      ? `<div class="empty-state" style="padding:28px;"><p class="muted">No ${isUpcoming ? 'upcoming' : 'past'} bookings found.</p></div>`
      : `<div class="table-wrap"><table class="data-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Provider &amp; Service</th>
              <th>Schedule</th>
              <th class="num">Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map(
                (b) => `
              <tr>
                <td class="mono" style="white-space:nowrap;">${escapeHtml(b.referenceCode)}</td>
                <td>
                  <a href="/provider.html?id=${b.providerId}" style="font-weight:600;">${escapeHtml(b.providerName)}</a>
                  <div class="muted" style="font-size:0.8125rem;">${escapeHtml(b.serviceTitle)}</div>
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
                      isUpcoming
                        ? `<button type="button" class="btn btn-secondary btn-sm resched-booking-btn" data-id="${b.id}" data-date="${escapeHtml(b.scheduledDate)}">Reschedule</button>
                           <button type="button" class="btn btn-danger btn-sm cancel-booking-btn" data-id="${b.id}">Cancel</button>`
                        : b.status === 'COMPLETED' && !b.hasReview
                          ? `<button type="button" class="btn btn-primary btn-sm write-review-btn" data-id="${b.id}" data-provider="${escapeHtml(b.providerName)}">Write Review</button>`
                          : `<a href="/provider.html?id=${b.providerId}" class="btn btn-secondary btn-sm">Rebook</a>`
                    }
                  </div>
                </td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table></div>`;

  panelEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <h1>Your Bookings</h1>
      <a href="/search.html" class="btn btn-primary btn-sm">Find Another Provider</a>
    </div>
    <h2 style="font-size:1.0625rem;margin-bottom:10px;">Upcoming &amp; Active</h2>
    ${renderRows(upcoming, true)}
    <h2 style="font-size:1.0625rem;margin:26px 0 10px;">Past Bookings</h2>
    ${renderRows(past, false)}
  `;

  panelEl.querySelectorAll('.cancel-booking-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/bookings/${btn.dataset.id}/status`, {
          method: 'PATCH',
          body: { status: 'CANCELLED', reason: 'Cancelled by customer from dashboard.' },
        });
        showToast('Booking cancelled');
        await refreshAll();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  panelEl.querySelectorAll('.resched-booking-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      openModal({
        title: 'Request Reschedule',
        contentHtml: `
          <form id="resched-form" style="display:flex;flex-direction:column;gap:14px;">
            <div class="form-group">
              <label for="rs-date" class="form-label">New Date</label>
              <input id="rs-date" type="date" class="input" min="${todayIso}" value="${escapeHtml(btn.dataset.date)}" required />
            </div>
            <div class="form-group">
              <label for="rs-slot" class="form-label">New Time Slot</label>
              <select id="rs-slot" class="select">
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
          bodyEl.querySelector('#resched-form').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            try {
              await apiFetch(`/bookings/${btn.dataset.id}/status`, {
                method: 'PATCH',
                body: {
                  status: 'RESCHEDULED',
                  scheduledDate: bodyEl.querySelector('#rs-date').value,
                  timeSlot: bodyEl.querySelector('#rs-slot').value,
                },
              });
              closeModal();
              showToast('Booking rescheduled');
              await refreshAll();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        },
      });
    });
  });

  panelEl.querySelectorAll('.write-review-btn').forEach((btn) => {
    btn.addEventListener('click', () => openReviewModal(Number(btn.dataset.id), btn.dataset.provider));
  });
}

function openReviewModal(bookingId, providerName) {
  openModal({
    title: `Review ${providerName}`,
    contentHtml: `
      <form id="review-form" style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-group">
          <label for="rev-rating" class="form-label">Rating</label>
          <select id="rev-rating" class="select">
            <option value="5">5 — Excellent workmanship &amp; punctuality</option>
            <option value="4">4 — Good service</option>
            <option value="3">3 — Satisfactory</option>
            <option value="2">2 — Below expectations</option>
            <option value="1">1 — Poor experience</option>
          </select>
        </div>
        <div class="form-group">
          <label for="rev-comment" class="form-label">Your Review</label>
          <textarea id="rev-comment" class="textarea" placeholder="Share punctuality, pricing transparency, and quality of work..." required></textarea>
        </div>
        <div id="rev-error" class="alert-banner alert-error" style="display:none;"></div>
        <button type="submit" class="btn btn-primary">Submit Review</button>
      </form>
    `,
    onMount: (bodyEl) => {
      const errBox = bodyEl.querySelector('#rev-error');
      bodyEl.querySelector('#review-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        errBox.style.display = 'none';
        try {
          await apiFetch('/reviews', {
            method: 'POST',
            body: {
              bookingId,
              rating: Number(bodyEl.querySelector('#rev-rating').value),
              comment: bodyEl.querySelector('#rev-comment').value.trim(),
            },
          });
          closeModal();
          showToast('Review published');
          await refreshAll();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.style.display = 'block';
        }
      });
    },
  });
}

function renderQuotesTab() {
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Quote Requests</h1>
    ${
      state.quotes.length === 0
        ? `<div class="empty-state"><h3>No quote requests yet</h3><p class="muted">Request custom estimates from any provider profile page.</p><a href="/search.html" class="btn btn-primary btn-sm">Browse Providers</a></div>`
        : `<div style="display:flex;flex-direction:column;gap:14px;">
            ${state.quotes
              .map(
                (q) => `
              <article class="card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                  <div>
                    <a href="/provider.html?id=${q.providerId}" style="font-size:1.0625rem;font-weight:600;">${escapeHtml(q.providerName)}</a>
                    <div class="meta-line" style="margin-top:4px;">
                      <span>${escapeHtml(q.serviceTitle)}</span>
                      <span class="meta-sep">·</span>
                      <span>Preferred: ${escapeHtml(q.preferredDate)}</span>
                      <span class="meta-sep">·</span>
                      <span>${escapeHtml(q.addressArea)}</span>
                    </div>
                  </div>
                  <span class="status-chip status-${q.status}">${q.status}</span>
                </div>
                <p class="muted" style="margin-top:10px;font-size:0.875rem;">${escapeHtml(q.description)}</p>
                <div class="hairline-divider"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                  <div class="meta-line">
                    <span>Your target: <strong class="tabular">${q.estimatedBudget ? formatINR(q.estimatedBudget) : 'Open'}</strong></span>
                    ${q.quotedAmount ? `<span class="meta-sep">·</span><span style="color:var(--accent-primary);">Quoted: <strong class="tabular">${formatINR(q.quotedAmount)}</strong></span>` : ''}
                  </div>
                  <a href="/booking.html?providerId=${q.providerId}${q.serviceId ? '&serviceId=' + q.serviceId : ''}" class="btn btn-secondary btn-sm">Book Provider</a>
                </div>
                ${q.providerNote ? `<div class="provider-reply-box"><strong>Provider Note:</strong> <span class="muted">${escapeHtml(q.providerNote)}</span></div>` : ''}
              </article>`,
              )
              .join('')}
          </div>`
    }
  `;
}

function renderFavoritesTab() {
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Saved Providers</h1>
    ${
      state.favorites.length === 0
        ? `<div class="empty-state"><h3>No saved providers</h3><p class="muted">Save trusted tradespeople while browsing to compare rate cards later.</p><a href="/search.html" class="btn btn-primary btn-sm">Explore Directory</a></div>`
        : `<div class="grid-2">
            ${state.favorites.map((p) => renderProviderCard({ ...p, isFavorited: true }, { showFavorite: true })).join('')}
          </div>`
    }
  `;

  panelEl.querySelectorAll('.fav-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/favorites/${btn.dataset.favId}`, { method: 'DELETE' });
        showToast('Removed from saved providers');
        await refreshAll();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderReviewsTab() {
  const pending = state.bookings.filter((b) => b.status === 'COMPLETED' && !b.hasReview);
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Reviews to Write</h1>
    ${
      pending.length === 0
        ? `<div class="empty-state"><h3>All completed bookings reviewed</h3><p class="muted">When a provider marks a booking completed, you can leave feedback here.</p></div>`
        : `<div style="display:flex;flex-direction:column;gap:14px;">
            ${pending
              .map(
                (b) => `
              <article class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
                <div>
                  <strong>${escapeHtml(b.providerName)}</strong>
                  <div class="meta-line" style="margin-top:4px;">
                    <span>${escapeHtml(b.serviceTitle)}</span>
                    <span class="meta-sep">·</span>
                    <span>Completed ${escapeHtml(b.scheduledDate)}</span>
                    <span class="meta-sep">·</span>
                    <span class="mono">${escapeHtml(b.referenceCode)}</span>
                  </div>
                </div>
                <button type="button" class="btn btn-primary btn-sm write-review-btn" data-id="${b.id}" data-provider="${escapeHtml(b.providerName)}">Write Review</button>
              </article>`,
              )
              .join('')}
          </div>`
    }
  `;
  panelEl.querySelectorAll('.write-review-btn').forEach((btn) => {
    btn.addEventListener('click', () => openReviewModal(Number(btn.dataset.id), btn.dataset.provider));
  });
}

function renderMessagesTab() {
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Messages</h1>
    ${
      state.threads.length === 0
        ? `<div class="empty-state"><h3>No conversations yet</h3><p class="muted">Use the "Message Provider" button on any provider profile to ask questions before booking.</p></div>`
        : `<div style="display:flex;flex-direction:column;gap:20px;">
            ${state.threads
              .map(
                (t) => `
              <div class="message-thread">
                <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--border);">
                  <div>
                    <strong>${escapeHtml(t.providerName)}</strong>
                    ${t.referenceCode ? `<span class="mono muted" style="font-size:0.75rem;margin-left:8px;">${escapeHtml(t.referenceCode)}</span>` : ''}
                  </div>
                  <a href="/provider.html?id=${t.providerId}" class="btn btn-secondary btn-sm">View Profile</a>
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
                <form class="reply-thread-form" data-provider-id="${t.providerId}" data-booking-id="${t.bookingId || ''}" style="display:flex;gap:10px;margin-top:6px;">
                  <input type="text" class="input" placeholder="Write a reply..." required />
                  <button type="submit" class="btn btn-primary btn-sm">Send</button>
                </form>
              </div>`,
              )
              .join('')}
          </div>`
    }
  `;

  panelEl.querySelectorAll('.reply-thread-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const body = input.value.trim();
      if (!body) return;
      try {
        await apiFetch('/messages', {
          method: 'POST',
          body: {
            providerId: Number(form.dataset.providerId),
            bookingId: form.dataset.bookingId ? Number(form.dataset.bookingId) : null,
            body,
          },
        });
        showToast('Reply sent');
        await refreshAll();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderNotificationsTab() {
  panelEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;">
      <h1>Notifications</h1>
      ${
        state.notifications.some((n) => !n.isRead)
          ? `<button type="button" id="mark-all-read-btn" class="btn btn-secondary btn-sm">Mark All Read</button>`
          : ''
      }
    </div>
    ${
      state.notifications.length === 0
        ? `<div class="empty-state"><h3>No notifications</h3></div>`
        : `<div style="display:flex;flex-direction:column;gap:10px;">
            ${state.notifications
              .map(
                (n) => `
              <div class="surface-panel" style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;border-color:${n.isRead ? 'var(--border)' : 'var(--accent-primary)'};">
                <div>
                  <strong>${escapeHtml(n.title)}</strong>
                  <p class="muted" style="font-size:0.875rem;margin-top:4px;">${escapeHtml(n.body)}</p>
                  <div class="muted" style="font-size:0.75rem;margin-top:6px;">${formatDateShort(n.createdAt)}</div>
                </div>
                ${!n.isRead ? `<button type="button" class="btn btn-secondary btn-sm mark-read-btn" data-id="${n.id}">Mark Read</button>` : `<span class="muted" style="font-size:0.75rem;">Read</span>`}
              </div>`,
              )
              .join('')}
          </div>`
    }
  `;

  document.getElementById('mark-all-read-btn')?.addEventListener('click', async () => {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    await refreshAll();
  });

  panelEl.querySelectorAll('.mark-read-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await apiFetch(`/notifications/${btn.dataset.id}/read`, { method: 'PATCH' });
      await refreshAll();
    });
  });
}

function renderSettingsTab() {
  const u = state.user;
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Profile Settings</h1>
    <div class="card" style="max-width:580px;">
      <form id="cust-settings-form" style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-group">
          <label for="set-name" class="form-label">Full Name</label>
          <input id="set-name" type="text" class="input" value="${escapeHtml(u.fullName)}" required />
        </div>
        <div class="form-group">
          <label for="set-phone" class="form-label">Mobile Number</label>
          <input id="set-phone" type="tel" class="input" value="${escapeHtml(u.phone)}" required />
        </div>
        <div class="grid-2" style="gap:12px;">
          <div class="form-group">
            <label for="set-city" class="form-label">City</label>
            <input id="set-city" type="text" class="input" value="${escapeHtml(u.city || '')}" />
          </div>
          <div class="form-group">
            <label for="set-area" class="form-label">Locality / Area</label>
            <input id="set-area" type="text" class="input" value="${escapeHtml(u.area || '')}" />
          </div>
        </div>
        <div>
          <button type="submit" class="btn btn-primary btn-sm">Save Profile</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('cust-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: {
          fullName: document.getElementById('set-name').value.trim(),
          phone: document.getElementById('set-phone').value.trim(),
          city: document.getElementById('set-city').value.trim(),
          area: document.getElementById('set-area').value.trim(),
        },
      });
      state.user = await syncSessionUser();
      document.getElementById('cust-user-name').textContent = state.user.fullName;
      showToast('Profile settings saved');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function renderTab() {
  if (state.activeTab === 'quotes') renderQuotesTab();
  else if (state.activeTab === 'favorites') renderFavoritesTab();
  else if (state.activeTab === 'reviews') renderReviewsTab();
  else if (state.activeTab === 'messages') renderMessagesTab();
  else if (state.activeTab === 'notifications') renderNotificationsTab();
  else if (state.activeTab === 'settings') renderSettingsTab();
  else renderBookingsTab();
}

async function refreshAll() {
  const [bk, qt, fav, msg, notif] = await Promise.all([
    apiFetch('/bookings/customer'),
    apiFetch('/quote-requests/customer'),
    apiFetch('/favorites'),
    apiFetch('/messages'),
    apiFetch('/notifications'),
  ]);
  state.bookings = bk.bookings || [];
  state.quotes = qt.quotes || [];
  state.favorites = fav.favorites || [];
  state.threads = msg.threads || [];
  state.notifications = notif.notifications || [];
  updateCounts();
  renderTab();
}

async function init() {
  const user = await requireRoleAccess(['CUSTOMER', 'ADMIN']);
  if (!user) return;
  state.user = user;
  document.getElementById('cust-user-name').textContent = user.fullName;
  document.getElementById('cust-user-meta').textContent = `${user.city || 'India'} · ${user.email}`;

  tabsContainer.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  await refreshAll();
  setActiveTab(state.activeTab);
}

init();
