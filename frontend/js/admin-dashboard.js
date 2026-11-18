import { apiFetch } from './api.js';
import { requireRoleAccess } from './auth.js';
import { escapeHtml, formatDateShort, formatINR, initChrome, showToast } from './ui.js';

initChrome('');

const panelEl = document.getElementById('admin-panel');
const tabsEl = document.getElementById('admin-tabs');
const urlTab = new URLSearchParams(window.location.search).get('tab');

const state = {
  activeTab: urlTab || 'overview',
  data: null,
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

function updateCounts() {
  const d = state.data;
  if (!d) return;
  document.getElementById('a-count-pending').textContent = d.totals.pendingVerifications;
  document.getElementById('a-count-reviews').textContent = d.reviews.length;
  document.getElementById('a-count-users').textContent = d.users.length;
}

function renderOverviewTab() {
  const { totals, recentBookings } = state.data;
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Platform Overview</h1>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Verified / Total Providers</div>
        <div class="kpi-value">${totals.verifiedProviders} / ${totals.providers}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Pending Verifications</div>
        <div class="kpi-value" style="color:var(--warning);">${totals.pendingVerifications}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Completed / Total Bookings</div>
        <div class="kpi-value" style="color:var(--accent-primary);">${totals.completedBookings} / ${totals.totalBookings}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Registered Accounts</div>
        <div class="kpi-value">${totals.users}</div>
      </div>
    </div>

    <h2 style="font-size:1.125rem;margin-bottom:12px;">Recent Platform Bookings</h2>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Customer</th>
            <th>Provider</th>
            <th>Scheduled Date</th>
            <th class="num">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${recentBookings
            .map(
              (b) => `
            <tr>
              <td class="mono">${escapeHtml(b.referenceCode)}</td>
              <td>${escapeHtml(b.customerName)}</td>
              <td>${escapeHtml(b.providerName)}</td>
              <td class="tabular">${escapeHtml(b.scheduledDate)}</td>
              <td class="num"><strong>${formatINR(b.quotedPrice)}</strong></td>
              <td><span class="status-chip status-${b.status}">${b.status}</span></td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderVerificationsTab() {
  const { providers } = state.data;
  panelEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
      <h1>Provider Verification Queue</h1>
      <span class="muted tabular">${providers.length} total providers</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Business &amp; Owner</th>
            <th>Category &amp; Location</th>
            <th class="num">Services</th>
            <th>Verification</th>
            <th>Moderation Action</th>
          </tr>
        </thead>
        <tbody>
          ${providers
            .map(
              (p) => `
            <tr>
              <td>
                <a href="/provider.html?id=${p.id}" style="font-weight:600;">${escapeHtml(p.businessName)}</a>
                <div class="muted" style="font-size:0.8125rem;">${escapeHtml(p.ownerName)} · <span class="mono">${escapeHtml(p.phone)}</span></div>
              </td>
              <td>
                <div>${escapeHtml(p.categoryName)}</div>
                <div class="muted" style="font-size:0.8125rem;">${escapeHtml(p.area)}, ${escapeHtml(p.city)} (${escapeHtml(p.pincode)})</div>
              </td>
              <td class="num">${p.serviceCount}</td>
              <td><span class="status-chip status-${p.verificationStatus}">${p.verificationStatus}</span></td>
              <td>
                <div style="display:flex;gap:8px;">
                  ${
                    p.verificationStatus !== 'VERIFIED'
                      ? `<button type="button" class="btn btn-primary btn-sm verify-prov-btn" data-id="${p.id}" data-status="VERIFIED">Approve</button>`
                      : `<button type="button" class="btn btn-danger btn-sm verify-prov-btn" data-id="${p.id}" data-status="REVOKED">Revoke</button>`
                  }
                </div>
              </td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  panelEl.querySelectorAll('.verify-prov-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/admin/providers/${btn.dataset.id}/verify`, {
          method: 'PATCH',
          body: { status: btn.dataset.status },
        });
        showToast(`Provider verification set to ${btn.dataset.status}`);
        await refreshOverview();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderReviewsTab() {
  const { reviews } = state.data;
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">Review Moderation</h1>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Customer</th>
            <th class="num">Rating</th>
            <th>Comment</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${reviews
            .map(
              (r) => `
            <tr>
              <td><a href="/provider.html?id=${r.providerId}" style="font-weight:600;">${escapeHtml(r.providerName)}</a></td>
              <td>${escapeHtml(r.customerName)}</td>
              <td class="num">${r.rating}.0</td>
              <td style="max-width:340px;"><span class="muted">${escapeHtml(r.comment)}</span></td>
              <td><span class="status-chip status-${r.moderationStatus}">${r.moderationStatus}</span></td>
              <td>
                ${
                  r.moderationStatus === 'VISIBLE'
                    ? `<button type="button" class="btn btn-danger btn-sm mod-review-btn" data-id="${r.id}" data-status="HIDDEN">Hide</button>`
                    : `<button type="button" class="btn btn-primary btn-sm mod-review-btn" data-id="${r.id}" data-status="VISIBLE">Restore</button>`
                }
              </td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  panelEl.querySelectorAll('.mod-review-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/admin/reviews/${btn.dataset.id}/moderate`, {
          method: 'PATCH',
          body: { moderationStatus: btn.dataset.status },
        });
        showToast(`Review marked ${btn.dataset.status}`);
        await refreshOverview();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderUsersTab() {
  const { users } = state.data;
  panelEl.innerHTML = `
    <h1 style="margin-bottom:18px;">User Directory</h1>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name &amp; Email</th>
            <th>Role</th>
            <th>City</th>
            <th>Joined</th>
            <th>Account State</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map(
              (u) => `
            <tr>
              <td>
                <strong>${escapeHtml(u.fullName)}</strong>
                <div class="muted mono" style="font-size:0.75rem;">${escapeHtml(u.email)}</div>
              </td>
              <td class="mono">${escapeHtml(u.role)}</td>
              <td>${escapeHtml(u.city || '—')}</td>
              <td class="tabular">${formatDateShort(u.createdAt)}</td>
              <td><span class="status-chip status-${u.active ? 'VERIFIED' : 'REVOKED'}">${u.active ? 'ACTIVE' : 'SUSPENDED'}</span></td>
              <td>
                ${
                  u.role === 'ADMIN'
                    ? `<span class="muted" style="font-size:0.75rem;">Protected</span>`
                    : `<button type="button" class="btn ${u.active ? 'btn-danger' : 'btn-primary'} btn-sm toggle-user-btn" data-id="${u.id}" data-active="${u.active ? 'false' : 'true'}">${u.active ? 'Suspend' : 'Reactivate'}</button>`
                }
              </td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  panelEl.querySelectorAll('.toggle-user-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/admin/users/${btn.dataset.id}/status`, {
          method: 'PATCH',
          body: { active: btn.dataset.active === 'true' },
        });
        showToast('User account status updated');
        await refreshOverview();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderTab() {
  if (!state.data) return;
  if (state.activeTab === 'verifications') renderVerificationsTab();
  else if (state.activeTab === 'reviews') renderReviewsTab();
  else if (state.activeTab === 'users') renderUsersTab();
  else renderOverviewTab();
}

async function refreshOverview() {
  state.data = await apiFetch('/admin/overview');
  updateCounts();
  renderTab();
}

async function init() {
  const user = await requireRoleAccess(['ADMIN']);
  if (!user) return;
  document.getElementById('admin-user-name').textContent = user.fullName;

  tabsEl.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  try {
    await refreshOverview();
    setActiveTab(state.activeTab);
  } catch (err) {
    panelEl.innerHTML = `<div class="alert-banner alert-error">${escapeHtml(err.message)}</div>`;
  }
}

init();
