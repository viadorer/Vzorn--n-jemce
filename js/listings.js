// Aktuální pronájmy — načítá přes Vercel proxy /api/properties → PTF backend
// Lokální dev bez proxy: window.LISTINGS_API_BASE = 'https://api.ptf.cz' (CORS musí být povolen)
(function () {
  'use strict';

  // Same-origin proxy (Vercel serverless function api/properties.js).
  // Pokud běžíme bez proxy (statický GitHub Pages), `window.LISTINGS_FALLBACK_DIRECT = true`
  // přepne na přímé volání PTF backendu.
  const USE_DIRECT = !!window.LISTINGS_FALLBACK_DIRECT;
  const API_BASE = USE_DIRECT
    ? (window.LISTINGS_API_BASE || 'https://api.ptf.cz')
    : '';
  const PROXY_PATH = USE_DIRECT ? '/api/properties' : '/api/properties';
  const TENANT_SLUG = 'ptf-reality'; // používá se jen při USE_DIRECT
  // Detail otevíráme na vzornynajemce.cz/pronajmy/:slug (Vercel rewrite → pronajmy-detail.html).
  // Při USE_DIRECT (např. GitHub Pages bez rewrite) fallback na ptf.cz.
  const DETAIL_BASE = USE_DIRECT ? 'https://www.ptf.cz/nabidky' : '/pronajmy';
  const PER_PAGE = 12;
  const PLACEHOLDER_IMG = 'images/og-image.png';

  const els = {
    grid: document.getElementById('listings-grid'),
    count: document.getElementById('listings-count'),
    pagination: document.getElementById('listings-pagination'),
    empty: document.getElementById('listings-empty'),
    error: document.getElementById('listings-error'),
    loading: document.getElementById('listings-loading'),
    fCity: document.getElementById('f-city'),
    fDisposition: document.getElementById('f-disposition'),
    fPriceMax: document.getElementById('f-price-max'),
    fReset: document.getElementById('f-reset'),
    fForm: document.getElementById('listings-filter-form'),
  };

  const state = {
    page: 1,
    filters: {
      city: '',
      disposition: '',
      price_max: '',
    },
    pages: 1,
    total: 0,
  };

  // ---- URL state sync ------------------------------------------------------
  function readFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
    state.filters.city = params.get('city') || '';
    state.filters.disposition = params.get('disposition') || '';
    state.filters.price_max = params.get('price_max') || '';
  }

  function writeToUrl() {
    const params = new URLSearchParams();
    if (state.page > 1) params.set('page', String(state.page));
    if (state.filters.city) params.set('city', state.filters.city);
    if (state.filters.disposition) params.set('disposition', state.filters.disposition);
    if (state.filters.price_max) params.set('price_max', state.filters.price_max);
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }

  // ---- Helpers -------------------------------------------------------------
  function formatPrice(p) {
    if (p === null || p === undefined || p === '') return '—';
    const n = Number(p);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('cs-CZ').format(n) + ' Kč';
  }

  function priceLabel(item) {
    // pronajem → měsíčně, prodej → bez doplňku
    if (item.offer_type === 'pronajem') return ' / měsíc';
    return '';
  }

  function pickImage(item) {
    if (item.main_image_url) return item.main_image_url;
    const imgs = Array.isArray(item.images) ? item.images : [];
    const main = imgs.find((i) => i && i.is_main);
    const any = main || imgs[0];
    return (any && (any.url_thumbnail || any.url)) || PLACEHOLDER_IMG;
  }

  function locationLine(item) {
    const parts = [item.address_city, item.address_district].filter(Boolean);
    return parts.join(' – ') || '—';
  }

  function dispositionLabel(item) {
    if (item.disposition) return item.disposition;
    if (item.property_subtype) return item.property_subtype;
    if (item.property_type === 'komercni') return 'Komerční';
    return '';
  }

  // ---- API -----------------------------------------------------------------
  function apiHeaders() {
    const h = { 'Accept': 'application/json' };
    if (USE_DIRECT) h['X-Tenant-Slug'] = TENANT_SLUG;
    return h;
  }

  async function fetchListings() {
    const params = new URLSearchParams({
      offer_type: 'pronajem',
      page: String(state.page),
      limit: String(PER_PAGE),
    });
    if (state.filters.city) params.set('city', state.filters.city);
    if (state.filters.disposition) params.set('disposition', state.filters.disposition);
    if (state.filters.price_max) params.set('price_max', state.filters.price_max);

    const res = await fetch(`${API_BASE}${PROXY_PATH}?${params}`, {
      headers: apiHeaders(),
      cache: 'no-cache',
    });
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  async function fetchFilters() {
    try {
      const url = USE_DIRECT
        ? `${API_BASE}/api/properties/filters?offer_type=pronajem`
        : `/api/filters?offer_type=pronajem`;
      const res = await fetch(url, { headers: apiHeaders() });
      if (!res.ok) return null;
      return res.json();
    } catch (_) {
      return null;
    }
  }

  // ---- Rendering -----------------------------------------------------------
  function renderCard(item) {
    const card = document.createElement('article');
    card.className =
      'group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col';

    // Image (lazy)
    const imgWrap = document.createElement('div');
    imgWrap.className = 'relative aspect-[4/3] bg-gray-100 overflow-hidden';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = item.title || 'Pronájem';
    img.className = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500';
    img.src = pickImage(item);
    img.onerror = () => { img.src = PLACEHOLDER_IMG; };
    imgWrap.appendChild(img);

    // Badge — price overlay
    const badge = document.createElement('div');
    badge.className =
      'absolute bottom-3 left-3 bg-[#0D28F2] text-white text-sm font-semibold px-3 py-1.5 rounded-full shadow-md';
    badge.textContent = formatPrice(item.price) + priceLabel(item);
    imgWrap.appendChild(badge);

    card.appendChild(imgWrap);

    // Body
    const body = document.createElement('div');
    body.className = 'p-5 flex flex-col flex-grow';

    const loc = document.createElement('p');
    loc.className = 'text-xs text-gray-500 uppercase tracking-wider mb-2';
    loc.textContent = locationLine(item);
    body.appendChild(loc);

    const title = document.createElement('h3');
    title.className = 'text-lg font-bold text-gray-900 mb-3 line-clamp-2 min-h-[3.5rem]';
    title.textContent = item.title || 'Pronájem nemovitosti';
    body.appendChild(title);

    // Meta row
    const meta = document.createElement('div');
    meta.className = 'flex items-center gap-4 text-sm text-gray-600 mb-4';
    const disp = dispositionLabel(item);
    if (disp) {
      const dEl = document.createElement('span');
      dEl.className = 'inline-flex items-center gap-1';
      dEl.innerHTML = '<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>';
      const s = document.createElement('span');
      s.textContent = disp;
      dEl.appendChild(s);
      meta.appendChild(dEl);
    }
    if (item.area_usable || item.area_total) {
      const aEl = document.createElement('span');
      aEl.className = 'inline-flex items-center gap-1';
      aEl.innerHTML = '<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>';
      const s = document.createElement('span');
      s.textContent = (item.area_usable || item.area_total) + ' m²';
      aEl.appendChild(s);
      meta.appendChild(aEl);
    }
    body.appendChild(meta);

    // Spacer
    const spacer = document.createElement('div');
    spacer.className = 'flex-grow';
    body.appendChild(spacer);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'flex flex-col gap-2 pt-4 border-t border-gray-100';

    const detail = document.createElement('a');
    detail.href = `${DETAIL_BASE}/${encodeURIComponent(item.slug || '')}`;
    if (USE_DIRECT) {
      detail.target = '_blank';
      detail.rel = 'noopener';
    }
    detail.className =
      'inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-full text-gray-900 border border-gray-300 hover:bg-gray-50 transition-all';
    detail.textContent = 'Zobrazit detail nabídky';
    actions.appendChild(detail);

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.setAttribute('data-open-popup', '');
    cta.className =
      'inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-full text-white bg-[#0D28F2] hover:bg-[#0D28F2]/90 transition-all shadow-sm hover:shadow-md';
    cta.textContent = 'Tohle je vaše? Získat garanci nájmu';
    actions.appendChild(cta);

    body.appendChild(actions);
    card.appendChild(body);

    return card;
  }

  function renderPagination() {
    els.pagination.innerHTML = '';
    if (state.pages <= 1) return;

    function btn(label, page, opts = {}) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = [
        'px-3 py-2 text-sm rounded-lg border transition-colors',
        opts.active
          ? 'bg-[#0D28F2] text-white border-[#0D28F2]'
          : 'bg-white text-gray-700 border-gray-200 hover:border-[#0D28F2] hover:text-[#0D28F2]',
        opts.disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ');
      if (opts.disabled) b.disabled = true;
      else
        b.addEventListener('click', () => {
          state.page = page;
          load();
          window.scrollTo({ top: els.grid.offsetTop - 100, behavior: 'smooth' });
        });
      return b;
    }

    els.pagination.appendChild(btn('‹', state.page - 1, { disabled: state.page <= 1 }));
    const max = Math.min(state.pages, 7);
    let start = Math.max(1, state.page - 3);
    let end = Math.min(state.pages, start + max - 1);
    start = Math.max(1, end - max + 1);
    for (let i = start; i <= end; i++) {
      els.pagination.appendChild(btn(String(i), i, { active: i === state.page }));
    }
    els.pagination.appendChild(
      btn('›', state.page + 1, { disabled: state.page >= state.pages })
    );
  }

  function showState({ loading = false, error = false, empty = false }) {
    if (els.loading) els.loading.classList.toggle('hidden', !loading);
    if (els.error) els.error.classList.toggle('hidden', !error);
    if (els.empty) els.empty.classList.toggle('hidden', !empty);
    if (els.grid) els.grid.classList.toggle('hidden', loading || error || empty);
    if (els.pagination) els.pagination.classList.toggle('hidden', loading || error || empty);
  }

  // ---- Main load -----------------------------------------------------------
  async function load() {
    writeToUrl();
    showState({ loading: true });
    try {
      const result = await fetchListings();
      const items = Array.isArray(result.data) ? result.data : [];
      const p = result.pagination || {};
      state.pages = Math.max(1, parseInt(p.pages, 10) || 1);
      state.total = parseInt(p.total, 10) || items.length;

      els.grid.innerHTML = '';
      if (items.length === 0) {
        showState({ empty: true });
        if (els.count) els.count.textContent = '0 nabídek';
        renderPagination();
        return;
      }

      items.forEach((item) => els.grid.appendChild(renderCard(item)));
      if (els.count) {
        els.count.textContent =
          state.total === 1
            ? '1 nabídka'
            : state.total >= 2 && state.total <= 4
              ? `${state.total} nabídky`
              : `${state.total} nabídek`;
      }
      renderPagination();
      showState({});

      // Hookup CTA buttons rendered into cards
      attachPopupHandlers(els.grid);
    } catch (err) {
      console.error('Listings load error:', err);
      showState({ error: true });
    }
  }

  function attachPopupHandlers(scope) {
    (scope || document).querySelectorAll('[data-open-popup]').forEach((btn) => {
      if (btn._popupBound) return;
      btn._popupBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.ContactPopup && typeof window.ContactPopup.open === 'function') {
          window.ContactPopup.open();
          return;
        }
        // Fallback: dispatch custom event used elsewhere on the site
        window.dispatchEvent(new CustomEvent('open-contact-popup'));
      });
    });
  }

  // ---- Filter UI -----------------------------------------------------------
  function populateCityOptions(filters) {
    if (!els.fCity || !filters || !Array.isArray(filters.cities)) return;
    const current = state.filters.city;
    els.fCity.innerHTML = '<option value="">Všechna města</option>';
    filters.cities.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === current) opt.selected = true;
      els.fCity.appendChild(opt);
    });
  }

  function wireFilters() {
    if (els.fForm) {
      els.fForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.filters.city = els.fCity.value;
        state.filters.disposition = els.fDisposition.value;
        state.filters.price_max = els.fPriceMax.value.trim();
        state.page = 1;
        load();
      });
    }
    if (els.fReset) {
      els.fReset.addEventListener('click', () => {
        state.filters = { city: '', disposition: '', price_max: '' };
        state.page = 1;
        if (els.fCity) els.fCity.value = '';
        if (els.fDisposition) els.fDisposition.value = '';
        if (els.fPriceMax) els.fPriceMax.value = '';
        load();
      });
    }
  }

  // ---- Boot ----------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    if (!els.grid) return;
    readFromUrl();
    // Pre-fill UI from URL
    if (els.fCity) els.fCity.value = state.filters.city;
    if (els.fDisposition) els.fDisposition.value = state.filters.disposition;
    if (els.fPriceMax) els.fPriceMax.value = state.filters.price_max;

    wireFilters();
    const filters = await fetchFilters();
    populateCityOptions(filters);
    await load();
  });
})();
