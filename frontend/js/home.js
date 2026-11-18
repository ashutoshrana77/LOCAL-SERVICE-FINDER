import { apiFetch } from './api.js';
import { escapeHtml, getIconSvg, initChrome, renderProviderCard } from './ui.js';

initChrome('home');

const form = document.getElementById('hero-search-form');
const categorySelect = document.getElementById('hero-category');
const categoryTilesEl = document.getElementById('category-tiles');
const featuredEl = document.getElementById('featured-providers');
const metricProvidersEl = document.getElementById('metric-providers');

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const location = document.getElementById('hero-location').value.trim();
  const category = categorySelect.value;
  const params = new URLSearchParams();
  if (location) params.set('location', location);
  if (category) params.set('category', category);
  window.location.href = `/search.html${params.toString() ? '?' + params.toString() : ''}`;
});

async function loadLandingData() {
  try {
    const [servicesRes, providersRes] = await Promise.all([
      apiFetch('/services'),
      apiFetch('/providers?verifiedOnly=true&sort=rating&limit=6'),
    ]);

    const categories = servicesRes.categories || [];
    if (categorySelect) {
      categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.slug;
        opt.textContent = cat.name;
        categorySelect.appendChild(opt);
      });
    }

    if (categoryTilesEl) {
      categoryTilesEl.innerHTML = categories
        .slice(0, 10)
        .map(
          (cat) => `
          <a href="/search.html?category=${encodeURIComponent(cat.slug)}" class="category-tile">
            <span class="category-tile-icon">${getIconSvg(cat.icon)}</span>
            <span class="category-tile-name">${escapeHtml(cat.name)}</span>
            <span class="category-tile-count">${cat.providerCount} provider${cat.providerCount === 1 ? '' : 's'}</span>
          </a>
        `,
        )
        .join('');
    }

    if (metricProvidersEl && providersRes.pagination?.total) {
      metricProvidersEl.textContent = `${providersRes.pagination.total}+`;
    }

    if (featuredEl) {
      const items = providersRes.items || [];
      featuredEl.innerHTML = items.length
        ? items.map((p) => renderProviderCard(p)).join('')
        : `<div class="empty-state"><h3>No featured providers available yet</h3></div>`;
    }
  } catch (err) {
    if (featuredEl) {
      featuredEl.innerHTML = `<div class="alert-banner alert-error">${escapeHtml(err.message)}</div>`;
    }
  }
}

loadLandingData();
