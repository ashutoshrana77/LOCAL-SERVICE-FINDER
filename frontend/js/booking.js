import { apiFetch } from './api.js';
import { getStoredUser, requireRoleAccess } from './auth.js';
import { escapeHtml, formatINR, initChrome, showToast } from './ui.js';

initChrome('');

const params = new URLSearchParams(window.location.search);
const providerId = Number(params.get('providerId'));

const subtitleEl = document.getElementById('booking-provider-subtitle');
const cardEl = document.getElementById('booking-card');
const stepperEls = document.querySelectorAll('.stepper-step');

const TIME_SLOTS = ['09:00 - 11:00', '11:30 - 13:30', '14:30 - 16:30', '17:00 - 19:00'];

const state = {
  step: 1,
  provider: null,
  serviceId: Number(params.get('serviceId')) || null,
  scheduledDate: params.get('date') || new Date().toISOString().slice(0, 10),
  timeSlot: params.get('slot') || TIME_SLOTS[0],
  propertyType: params.get('propertyType') || 'Apartment',
  addressArea: '',
  pincode: '',
  description: '',
  confirmedBooking: null,
};

function updateStepper() {
  stepperEls.forEach((el) => {
    const num = Number(el.dataset.step);
    el.classList.remove('active', 'done');
    if (num < state.step) el.classList.add('done');
    if (num === state.step) el.classList.add('active');
  });
}

function getSelectedService() {
  return state.provider?.services.find((s) => s.id === Number(state.serviceId)) || state.provider?.services[0];
}

function renderStep() {
  updateStepper();
  const p = state.provider;
  const svc = getSelectedService();
  const todayIso = new Date().toISOString().slice(0, 10);

  if (state.step === 1) {
    cardEl.innerHTML = `
      <h2 style="margin-bottom:14px;">Step 1: Choose a Service</h2>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${p.services
          .map(
            (s) => `
          <label class="surface-panel" style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;cursor:pointer;border-color:${Number(state.serviceId) === s.id ? 'var(--accent-primary)' : 'var(--border)'};">
            <div style="display:flex;gap:12px;align-items:flex-start;">
              <input type="radio" name="serviceChoice" value="${s.id}" ${Number(state.serviceId) === s.id ? 'checked' : ''} style="margin-top:4px;accent-color:var(--accent-primary);" />
              <div>
                <strong>${escapeHtml(s.title)}</strong>
                <div class="muted" style="font-size:0.875rem;margin-top:4px;">${escapeHtml(s.description)}</div>
                <div class="muted tabular" style="font-size:0.75rem;margin-top:4px;">Est. duration: ${s.durationMinutes} mins · ${escapeHtml(s.priceUnit)}</div>
              </div>
            </div>
            <strong class="price-figure">${formatINR(s.basePrice)}</strong>
          </label>`,
          )
          .join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:20px;">
        <button type="button" id="step1-next" class="btn btn-primary">Continue to Date &amp; Slot</button>
      </div>
    `;
    cardEl.querySelectorAll('input[name="serviceChoice"]').forEach((r) => {
      r.addEventListener('change', () => {
        state.serviceId = Number(r.value);
        renderStep();
      });
    });
    document.getElementById('step1-next').addEventListener('click', () => {
      state.step = 2;
      renderStep();
    });
    return;
  }

  if (state.step === 2) {
    cardEl.innerHTML = `
      <h2 style="margin-bottom:14px;">Step 2: Choose Date &amp; Time Slot</h2>
      <div class="form-group" style="max-width:280px;margin-bottom:18px;">
        <label for="bk-date" class="form-label">Preferred Service Date</label>
        <input id="bk-date" type="date" class="input" min="${todayIso}" value="${escapeHtml(state.scheduledDate)}" />
      </div>
      <div class="form-group">
        <span class="form-label">Select Arrival Window</span>
        <div class="slot-grid" style="margin-top:6px;">
          ${TIME_SLOTS.map(
            (slot) => `
            <button type="button" class="slot-option ${state.timeSlot === slot ? 'selected' : ''}" data-slot="${slot}">
              ${slot}
            </button>`,
          ).join('')}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:24px;">
        <button type="button" id="step2-back" class="btn btn-secondary">Back</button>
        <button type="button" id="step2-next" class="btn btn-primary">Continue to Job Details</button>
      </div>
    `;
    document.getElementById('bk-date').addEventListener('change', (e) => {
      state.scheduledDate = e.target.value;
    });
    cardEl.querySelectorAll('.slot-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.timeSlot = btn.dataset.slot;
        renderStep();
      });
    });
    document.getElementById('step2-back').addEventListener('click', () => {
      state.step = 1;
      renderStep();
    });
    document.getElementById('step2-next').addEventListener('click', () => {
      if (!state.scheduledDate) {
        showToast('Please select a service date', 'error');
        return;
      }
      state.step = 3;
      renderStep();
    });
    return;
  }

  if (state.step === 3) {
    cardEl.innerHTML = `
      <h2 style="margin-bottom:14px;">Step 3: Job Details &amp; Address Area</h2>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="grid-2" style="gap:12px;">
          <div class="form-group">
            <label for="bk-property" class="form-label">Property Type</label>
            <select id="bk-property" class="select">
              <option value="Apartment" ${state.propertyType === 'Apartment' ? 'selected' : ''}>Apartment / Flat</option>
              <option value="Independent House" ${state.propertyType === 'Independent House' ? 'selected' : ''}>Independent House / Villa</option>
              <option value="Office" ${state.propertyType === 'Office' ? 'selected' : ''}>Office / Shop</option>
            </select>
          </div>
          <div class="form-group">
            <label for="bk-pincode" class="form-label">6-Digit Pincode</label>
            <input id="bk-pincode" type="text" maxlength="6" class="input mono" placeholder="${escapeHtml(p.pincode)}" value="${escapeHtml(state.pincode)}" />
          </div>
        </div>
        <div class="form-group">
          <label for="bk-address" class="form-label">Street / Locality / Landmark</label>
          <input id="bk-address" type="text" class="input" placeholder="e.g. 100 Feet Road, Indiranagar, Bengaluru" value="${escapeHtml(state.addressArea)}" />
        </div>
        <div class="form-group">
          <label for="bk-desc" class="form-label">Work Description</label>
          <textarea id="bk-desc" class="textarea" placeholder="Describe the fault, fixture brand, or access notes...">${escapeHtml(state.description)}</textarea>
        </div>
        <div id="step3-error" class="alert-banner alert-error" style="display:none;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:24px;">
        <button type="button" id="step3-back" class="btn btn-secondary">Back</button>
        <button type="button" id="step3-next" class="btn btn-primary">Review Request</button>
      </div>
    `;
    document.getElementById('step3-back').addEventListener('click', () => {
      state.propertyType = document.getElementById('bk-property').value;
      state.pincode = document.getElementById('bk-pincode').value.trim();
      state.addressArea = document.getElementById('bk-address').value.trim();
      state.description = document.getElementById('bk-desc').value.trim();
      state.step = 2;
      renderStep();
    });
    document.getElementById('step3-next').addEventListener('click', () => {
      state.propertyType = document.getElementById('bk-property').value;
      state.pincode = document.getElementById('bk-pincode').value.trim();
      state.addressArea = document.getElementById('bk-address').value.trim();
      state.description = document.getElementById('bk-desc').value.trim();

      const errEl = document.getElementById('step3-error');
      if (state.addressArea.length < 4) {
        errEl.textContent = 'Please enter your locality or street address.';
        errEl.style.display = 'block';
        return;
      }
      if (state.pincode && !/^[1-9]\d{5}$/.test(state.pincode)) {
        errEl.textContent = 'Enter a valid 6-digit Indian pincode.';
        errEl.style.display = 'block';
        return;
      }
      if (state.description.length < 8) {
        errEl.textContent = 'Please describe the job (at least 8 characters).';
        errEl.style.display = 'block';
        return;
      }
      state.step = 4;
      renderStep();
    });
    return;
  }

  if (state.step === 4) {
    cardEl.innerHTML = `
      <h2 style="margin-bottom:14px;">Step 4: Review Your Booking Request</h2>
      <div class="surface-panel" style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span class="muted">Provider</span>
          <strong>${escapeHtml(p.businessName)} (${escapeHtml(p.city)})</strong>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span class="muted">Selected Service</span>
          <strong>${escapeHtml(svc.title)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span class="muted">Scheduled Window</span>
          <strong class="mono">${escapeHtml(state.scheduledDate)} · ${escapeHtml(state.timeSlot)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span class="muted">Location</span>
          <span>${escapeHtml(state.propertyType)} — ${escapeHtml(state.addressArea)} ${state.pincode ? `(${escapeHtml(state.pincode)})` : ''}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;padding-top:10px;border-top:1px solid var(--border);">
          <span class="muted">Estimated Base Rate</span>
          <strong class="price-figure">${formatINR(svc.basePrice)} (${escapeHtml(svc.priceUnit)})</strong>
        </div>
      </div>
      <p class="muted" style="font-size:0.8125rem;margin-top:12px;">
        No online payment is charged now. The provider will confirm your slot and final spare-part costs if applicable.
      </p>
      <div id="step4-error" class="alert-banner alert-error" style="display:none;margin-top:12px;"></div>
      <div style="display:flex;justify-content:space-between;margin-top:22px;">
        <button type="button" id="step4-back" class="btn btn-secondary">Back</button>
        <button type="button" id="step4-submit" class="btn btn-primary">Confirm Booking Request</button>
      </div>
    `;
    document.getElementById('step4-back').addEventListener('click', () => {
      state.step = 3;
      renderStep();
    });
    document.getElementById('step4-submit').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const errEl = document.getElementById('step4-error');
      btn.disabled = true;
      btn.textContent = 'Submitting...';
      errEl.style.display = 'none';
      try {
        const res = await apiFetch('/bookings', {
          method: 'POST',
          body: {
            providerId: p.id,
            serviceId: svc.id,
            scheduledDate: state.scheduledDate,
            timeSlot: state.timeSlot,
            propertyType: state.propertyType,
            addressArea: state.addressArea,
            pincode: state.pincode,
            description: state.description,
          },
        });
        state.confirmedBooking = res;
        state.step = 5;
        renderStep();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Confirm Booking Request';
      }
    });
    return;
  }

  if (state.step === 5 && state.confirmedBooking) {
    const bk = state.confirmedBooking;
    cardEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <h2>Booking Request Submitted</h2>
          <span class="status-chip status-PENDING">PENDING</span>
        </div>
        <p class="muted">Reference <strong class="mono">${escapeHtml(bk.referenceCode)}</strong> has been sent to <strong>${escapeHtml(bk.providerName)}</strong>.</p>
        <div class="surface-panel" style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;justify-content:space-between;"><span class="muted">Service</span><strong>${escapeHtml(bk.serviceTitle)}</strong></div>
          <div style="display:flex;justify-content:space-between;"><span class="muted">Date &amp; Slot</span><span class="mono">${escapeHtml(bk.scheduledDate)} · ${escapeHtml(bk.timeSlot)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span class="muted">Quoted Base Price</span><strong class="price-figure">${formatINR(bk.quotedPrice)}</strong></div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
          <a href="/customer-dashboard.html?tab=bookings" class="btn btn-primary">Track in My Dashboard</a>
          <a href="/search.html" class="btn btn-secondary">Browse More Providers</a>
        </div>
      </div>
    `;
  }
}

async function init() {
  const user = await requireRoleAccess(['CUSTOMER', 'ADMIN']);
  if (!user) return;

  if (!providerId) {
    subtitleEl.textContent = 'Select a provider first';
    cardEl.innerHTML = `<div class="empty-state"><h3>No provider selected</h3><a href="/search.html" class="btn btn-primary btn-sm">Find a Provider</a></div>`;
    return;
  }

  try {
    const provider = await apiFetch(`/providers/${providerId}`);
    state.provider = provider;
    if (!state.serviceId && provider.services.length) {
      state.serviceId = provider.services[0].id;
    }
    const storedUser = getStoredUser();
    if (storedUser?.area && !state.addressArea) {
      state.addressArea = `${storedUser.area}${storedUser.city ? ', ' + storedUser.city : ''}`;
    }
    subtitleEl.textContent = `${provider.businessName} · ${provider.area}, ${provider.city}`;
    renderStep();
  } catch (err) {
    cardEl.innerHTML = `<div class="alert-banner alert-error">${escapeHtml(err.message)}</div>`;
  }
}

init();
