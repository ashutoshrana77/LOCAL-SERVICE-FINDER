import { apiFetch } from './api.js';
import { getStoredUser } from './auth.js';
import { escapeHtml, initChrome, renderProviderCard, showToast } from './ui.js';

initChrome('search');

const els = {
  q: document.getElementById('filter-q'),
  category: document.getElementById('filter-category'),
  location: document.getElementById('filter-location'),
  radius: document.getElementById('filter-radius'),
  rating: document.getElementById('filter-rating'),
  minPrice: document.getElementById('filter-min-price'),
  maxPrice: document.getElementById('filter-max-price'),
  availability: document.getElementById('filter-availability'),
  verified: document.getElementById('filter-verified'),
  sort: document.getElementById('filter-sort'),
  resetBtn: document.getElementById('reset-filters-btn'),
  summary: document.getElementById('results-summary'),
  grid: document.getElementById('results-grid'),
  pagination: document.getElementById('results-pagination'),
};

let currentPage = 1;
let debounceTimer = null;

function readUrlIntoControls() {
  const params = new URLSearchParams(window.location.search);
  els.q.value = params.get('q') || '';
  els.category.value = params.get('category') || '';
  els.location.value = params.get('location') || '';
  els.radius.value = params.get('radiusKm') || '';
  els.rating.value = params.get('minRating') || '';
  els.minPrice.value = params.get('minPrice') || '';
  els.maxPrice.value = params.get('maxPrice') || '';
  els.availability.value = params.get('availability') || '';
  els.verified.checked = params.get('verifiedOnly') === 'true';
  els.sort.value = params.get('sort') || 'relevance';
  currentPage = Math.max(1, Number(params.get('page')) || 1);
}

function buildSearchParams(page = 1) {
  const params = new URLSearchParams();
  if (els.q.value.trim()) params.set('q', els.q.value.trim());
  if (els.category.value) params.set('category', els.category.value);
  if (els.location.value.trim()) params.set('location', els.location.value.trim());
  if (els.radius.value) params.set('radiusKm', els.radius.value);
  if (els.rating.value) params.set('minRating', els.rating.value);
  if (els.minPrice.value) params.set('minPrice', els.minPrice.value);
  if (els.maxPrice.value) params.set('maxPrice', els.maxPrice.value);
  if (els.availability.value) params.set('availability', els.availability.value);
  if (els.verified.checked) params.set('verifiedOnly', 'true');
  if (els.sort.value && els.sort.value !== 'relevance') params.set('sort', els.sort.value);
  if (page > 1) params.set('page', String(page));
  return params;
}

function renderSkeletons() {
  els.grid.innerHTML = Array.from({ length: 6 })
    .map(
      () => `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="skeleton" style="aspect-ratio:4/3;border-radius:0;"></div>
        <div style="padding:18px;display:flex;flex-direction:column;gap:10px;">
          <div class="skeleton" style="height:20px;width:65%;"></div>
          <div class="skeleton" style="height:14px;width:85%;"></div>
          <div class="skeleton" style="height:36px;width:100%;margin-top:8px;"></div>
        </div>
      </div>`,
    )
    .join('');
}

async function fetchResults(page = 1, pushUrl = true) {
  currentPage = page;
  const params = buildSearchParams(page);
  if (pushUrl) {
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }

  params.set('limit', '8');
  renderSkeletons();

  try {
    const data = await apiFetch(`/providers?${params.toString()}`);
    const items = data.items || [];
    const pag = data.pagination || { page: 1, total: 0, totalPages: 1 };

    els.summary.textContent = `${pag.total} provider${pag.total === 1 ? '' : 's'} matched`;

    if (items.length === 0) {
      els.grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h3>No providers match your current filters</h3>
          <p class="muted" style="max-width:46ch;">Try widening your price range, clearing the availability filter, or searching another city or pincode.</p>
          <button type="button" id="empty-reset-btn" class="btn btn-primary btn-sm">Clear All Filters</button>
        </div>
      `;
      document.getElementById('empty-reset-btn')?.addEventListener('click', resetAllFilters);
      els.pagination.style.display = 'none';
      return;
    }

    const user = getStoredUser();
    const canFav = Boolean(user);
    els.grid.innerHTML = items.map((p) => renderProviderCard(p, { showFavorite: canFav })).join('');
    bindFavoriteButtons();

    if (pag.totalPages > 1) {
      els.pagination.style.display = 'flex';
      els.pagination.innerHTML = `
        <span class="muted tabular" style="font-size:0.8125rem;">Page ${pag.page} of ${pag.totalPages}</span>
        <div class="pagination-pages">
          <button type="button" class="btn btn-secondary btn-sm" id="prev-page-btn" ${pag.page <= 1 ? 'disabled' : ''}>Previous</button>
          <button type="button" class="btn btn-secondary btn-sm" id="next-page-btn" ${pag.page >= pag.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      `;
      document.getElementById('prev-page-btn')?.addEventListener('click', () => {
        fetchResults(pag.page - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      document.getElementById('next-page-btn')?.addEventListener('click', () => {
        fetchResults(pag.page + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      els.pagination.style.display = 'none';
    }
  } catch (err) {
    els.summary.textContent = 'Unable to load providers';
    els.grid.innerHTML = `<div class="alert-banner alert-error" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
    els.pagination.style.display = 'none';
  }
}

function bindFavoriteButtons() {
  document.querySelectorAll('.fav-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const providerId = btn.dataset.favId;
      const isFav = btn.getAttribute('aria-pressed') === 'true';
      try {
        if (isFav) {
          await apiFetch(`/favorites/${providerId}`, { method: 'DELETE' });
          btn.setAttribute('aria-pressed', 'false');
          btn.style.color = '';
          btn.style.borderColor = '';
          showToast('Removed from saved providers');
        } else {
          await apiFetch(`/favorites/${providerId}`, { method: 'POST' });
          btn.setAttribute('aria-pressed', 'true');
          btn.style.color = 'var(--danger)';
          btn.style.borderColor = 'rgba(255,92,108,0.45)';
          showToast('Saved to favorites');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function resetAllFilters() {
  els.q.value = '';
  els.category.value = '';
  els.location.value = '';
  els.radius.value = '';
  els.rating.value = '';
  els.minPrice.value = '';
  els.maxPrice.value = '';
  els.availability.value = '';
  els.verified.checked = false;
  els.sort.value = 'relevance';
  fetchResults(1);
}

function triggerDebouncedSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchResults(1), 240);
}

async function init() {
  try {
    const servicesData = await apiFetch('/services');
    (servicesData.categories || []).forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.slug;
      opt.textContent = cat.name;
      els.category.appendChild(opt);
    });
  } catch {
    // non-blocking
  }

  readUrlIntoControls();

  [els.q, els.location, els.minPrice, els.maxPrice].forEach((input) => {
    input.addEventListener('input', triggerDebouncedSearch);
  });
  [els.category, els.radius, els.rating, els.availability, els.verified, els.sort].forEach((sel) => {
    sel.addEventListener('change', () => fetchResults(1));
  });
  els.resetBtn.addEventListener('click', resetAllFilters);

  fetchResults(currentPage, false);
}

init();
