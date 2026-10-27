/**
 * app.js — Main orchestrator
 * Upload · Multi-select checkbox filters · Page routing · Re-render
 *
 * BUG FIX: The dropdown must NOT call stopPropagation broadly — that breaks
 * label→checkbox click delegation. Instead we use a targeted approach:
 * only prevent the document-level close listener from firing when the user
 * clicks *inside* a filter-group container (which includes both trigger and panel).
 */

const App = (() => {

  const PAGES = [
    { id: 'p01', module: Page01 },
    { id: 'p02', module: Page02 },
    { id: 'p03', module: Page03 },
    { id: 'p04', module: Page04 },
    { id: 'p05', module: Page05 },
    { id: 'p06', module: Page06 },
    { id: 'p07', module: Page07 },
  ];

  // Tracks selected values per filter key
  const _sel = {
    year:    new Set(),
    month:   new Set(),
    carrier: new Set(),
    airport: new Set(),
  };

  const MS_CONFIG = [
    { key: 'year',    triggerId: 'ms-year-trigger',    dropdownId: 'ms-year-dropdown',    listId: 'ms-year-list',    footerId: 'ms-year-footer',    searchId: null,               allLabel: 'All Years'    },
    { key: 'month',   triggerId: 'ms-month-trigger',   dropdownId: 'ms-month-dropdown',   listId: 'ms-month-list',   footerId: 'ms-month-footer',   searchId: null,               allLabel: 'All Months'   },
    { key: 'carrier', triggerId: 'ms-carrier-trigger', dropdownId: 'ms-carrier-dropdown', listId: 'ms-carrier-list', footerId: 'ms-carrier-footer', searchId: 'ms-carrier-search', allLabel: 'All Airlines' },
    { key: 'airport', triggerId: 'ms-airport-trigger', dropdownId: 'ms-airport-dropdown', listId: 'ms-airport-list', footerId: 'ms-airport-footer', searchId: 'ms-airport-search', allLabel: 'All Airports' },
  ];

  // ── Bootstrap ───────────────────────────────────────────────
  function init() {
    _bindUpload();
    _bindNav();
    _bindMultiSelects();
    document.getElementById('btn-reset-filters').addEventListener('click', _onReset);

    // Close all dropdowns when clicking anywhere outside a filter-group
    document.addEventListener('click', e => {
      const inside = e.target.closest('.filter-group');
      if (!inside) _closeAllDropdowns();
    });
  }

  // ── Upload ──────────────────────────────────────────────────
  function _bindUpload() {
    const zone       = document.getElementById('upload-zone');
    const fileInput  = document.getElementById('file-input');
    const btnTrigger = document.getElementById('btn-upload-trigger');
    const errEl      = document.getElementById('upload-error');
    const spinner    = document.getElementById('upload-spinner');

    btnTrigger.addEventListener('click', () => fileInput.click());
    zone.addEventListener('click',     () => fileInput.click());
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) _handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) _handleFile(fileInput.files[0]);
    });

    function _handleFile(file) {
      errEl.textContent = '';
      spinner.classList.add('show');
      DataEngine.parseFile(file,
        rows => { spinner.classList.remove('show'); _onDataLoaded(rows, file.name); },
        msg  => { spinner.classList.remove('show'); errEl.textContent = '⚠️ ' + msg; }
      );
    }
  }

  // ── Data loaded ─────────────────────────────────────────────
  function _onDataLoaded(rows, filename) {
    document.getElementById('upload-screen').style.display = 'none';
    document.getElementById('app-shell').classList.add('show');
    _populateAllMultiSelects();
    _updateBadge(filename);
    _renderAll();
  }

  // ── Populate lists ──────────────────────────────────────────
  function _populateAllMultiSelects() {
    const D = DataEngine;
    const MN = D.MONTH_NAMES;
    _populateMS('year',    D.getYears(),    v => String(v), v => String(v));
    _populateMS('month',   D.getMonths(),   v => String(v), v => MN[v - 1] || String(v));
    _populateMS('carrier', D.getCarriers(), v => v, v => `${D.getCarrierName(v)} (${v})`);
    _populateMS('airport', D.getAirports(), v => v, v => `${v} — ${D.getAirportName(v).split(':')[0].trim()}`);
  }

  function _populateMS(key, values, valueFn, labelFn) {
    const cfg  = MS_CONFIG.find(c => c.key === key);
    const list = document.getElementById(cfg.listId);
    if (!list) return;

    // Build checkbox items — use <div> not <label> to avoid double-fire issues
    list.innerHTML = values.map(v => {
      const val = valueFn(v);
      const lbl = labelFn(v);
      // Escape quotes in val for HTML attribute safety
      const safeVal = val.replace(/"/g, '&quot;');
      return `<div class="ms-item" data-value="${safeVal}" data-filter="${key}">
        <input type="checkbox" id="cb-${key}-${safeVal}" value="${safeVal}" tabindex="-1" />
        <label for="cb-${key}-${safeVal}" class="ms-item-label" title="${lbl}">${lbl}</label>
      </div>`;
    }).join('');

    // ── CRITICAL FIX: listen on the row div, not on the checkbox
    // This way clicks on the label text, the checkbox itself, or anywhere on
    // the row all funnel through one clean handler with no double-fire.
    list.addEventListener('click', e => {
      const item = e.target.closest('.ms-item');
      if (!item) return;

      // Prevent the document close-listener from seeing this as an "outside" click
      e.stopPropagation();

      const cb = item.querySelector('input[type="checkbox"]');
      if (!cb) return;

      // If the user clicked directly on the <label> (which also fires a change
      // on the checkbox), the checkbox state will already be toggled before we
      // get here only if the label's for= caused it. We need to detect this.
      // Simplest reliable approach: toggle manually when clicking the div/label,
      // but not when clicking directly on the native checkbox (it toggles itself).
      if (e.target.tagName !== 'INPUT') {
        cb.checked = !cb.checked;
      }

      if (cb.checked) _sel[key].add(cb.value);
      else             _sel[key].delete(cb.value);

      _applyFilters();
      _updateTriggerLabel(key);
      _updateFooter(key);
    });

    // Search (carrier + airport only)
    if (cfg.searchId) {
      const searchEl = document.getElementById(cfg.searchId);
      if (searchEl) {
        searchEl.addEventListener('input', () => {
          const q = searchEl.value.toLowerCase();
          list.querySelectorAll('.ms-item').forEach(item => {
            const text = item.querySelector('.ms-item-label').textContent.toLowerCase();
            item.style.display = text.includes(q) ? '' : 'none';
          });
        });
        // Don't let typing close the dropdown
        searchEl.addEventListener('click', e => e.stopPropagation());
      }
    }

    _updateTriggerLabel(key);
    _updateFooter(key);
  }

  // ── Open / close ────────────────────────────────────────────
  function _bindMultiSelects() {
    MS_CONFIG.forEach(cfg => {
      const trigger  = document.getElementById(cfg.triggerId);
      const dropdown = document.getElementById(cfg.dropdownId);
      if (!trigger || !dropdown) return;

      // Toggle on trigger click
      trigger.addEventListener('click', e => {
        e.stopPropagation();
        const alreadyOpen = dropdown.classList.contains('open');
        _closeAllDropdowns();
        if (!alreadyOpen) {
          dropdown.classList.add('open');
          trigger.classList.add('open');
          // Focus search box if present
          const cfg2 = MS_CONFIG.find(c => c.triggerId === cfg.triggerId);
          if (cfg2.searchId) {
            setTimeout(() => document.getElementById(cfg2.searchId)?.focus(), 50);
          }
        }
      });
    });

    // All / None buttons
    document.querySelectorAll('.ms-action-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const key    = btn.dataset.filter;
        const action = btn.dataset.action;
        const cfg    = MS_CONFIG.find(c => c.key === key);
        const list   = document.getElementById(cfg.listId);
        if (!list) return;

        // Only affect visible items (respects search filter)
        const visibleBoxes = [...list.querySelectorAll('.ms-item')]
          .filter(item => item.style.display !== 'none')
          .map(item => item.querySelector('input[type="checkbox"]'))
          .filter(Boolean);

        if (action === 'all') {
          visibleBoxes.forEach(cb => { cb.checked = true;  _sel[key].add(cb.value); });
        } else {
          visibleBoxes.forEach(cb => { cb.checked = false; _sel[key].delete(cb.value); });
        }
        _applyFilters();
        _updateTriggerLabel(key);
        _updateFooter(key);
      });
    });
  }

  function _closeAllDropdowns() {
    MS_CONFIG.forEach(cfg => {
      document.getElementById(cfg.dropdownId)?.classList.remove('open');
      document.getElementById(cfg.triggerId)?.classList.remove('open');
    });
  }

  // ── Trigger label ───────────────────────────────────────────
  function _updateTriggerLabel(key) {
    const cfg     = MS_CONFIG.find(c => c.key === key);
    const trigger = document.getElementById(cfg.triggerId);
    if (!trigger) return;
    const labelEl = trigger.querySelector('.ms-label');
    const count   = _sel[key].size;
    const total   = document.getElementById(cfg.listId)?.querySelectorAll('input[type="checkbox"]').length || 0;

    // Remove old badge
    trigger.querySelector('.ms-count')?.remove();

    if (count === 0 || count === total) {
      labelEl.textContent = cfg.allLabel;
    } else {
      labelEl.textContent = count === 1
        ? (document.getElementById(cfg.listId)?.querySelector('input:checked')
            ?.closest('.ms-item')?.querySelector('.ms-item-label')?.textContent || '1 selected')
        : `${count} selected`;

      const badge = document.createElement('span');
      badge.className = 'ms-count';
      badge.textContent = count;
      trigger.querySelector('.ms-caret').before(badge);
    }
  }

  function _updateFooter(key) {
    const cfg    = MS_CONFIG.find(c => c.key === key);
    const footer = document.getElementById(cfg.footerId);
    if (!footer) return;
    const count = _sel[key].size;
    const total = document.getElementById(cfg.listId)?.querySelectorAll('input[type="checkbox"]').length || 0;
    footer.textContent = count === 0 ? `All ${total} shown` : `${count} of ${total} selected`;
  }

  // ── Apply to DataEngine ─────────────────────────────────────
  function _applyFilters() {
    const D = DataEngine;
    D.setFilter('years',    _sel.year.size    ? [..._sel.year].map(Number)    : []);
    D.setFilter('months',   _sel.month.size   ? [..._sel.month].map(Number)   : []);
    D.setFilter('carriers', _sel.carrier.size ? [..._sel.carrier]             : []);
    D.setFilter('airports', _sel.airport.size ? [..._sel.airport]             : []);
    _updateBadge();
    _renderAll();
  }

  function _onReset() {
    ['year','month','carrier','airport'].forEach(key => {
      _sel[key].clear();
      const cfg = MS_CONFIG.find(c => c.key === key);
      document.getElementById(cfg.listId)?.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      if (cfg.searchId) {
        const s = document.getElementById(cfg.searchId);
        if (s) {
          s.value = '';
          // Show all items
          document.getElementById(cfg.listId)?.querySelectorAll('.ms-item').forEach(i => i.style.display = '');
        }
      }
      _updateTriggerLabel(key);
      _updateFooter(key);
    });
    DataEngine.resetFilters();
    _updateBadge();
    _renderAll();
  }

  // ── Badge ───────────────────────────────────────────────────
  function _updateBadge(filename) {
    const badge = document.getElementById('data-badge');
    if (!badge) return;
    const count = DataEngine.getFiltered().length;
    const suffix = filename
      ? ' · ' + filename
      : (badge.textContent.includes(' · ') ? ' · ' + badge.textContent.split(' · ')[1] : '');
    badge.textContent = count.toLocaleString() + ' records' + suffix;
  }

  // ── Navigation ──────────────────────────────────────────────
  function _bindNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => _switchPage(el.dataset.page));
    });
  }

  function _switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
    document.querySelector('.page-area').scrollTop = 0;
  }

  // ── Render ──────────────────────────────────────────────────
  function _renderAll() {
    PAGES.forEach(p => {
      try { p.module.render(); } catch(e) { console.warn('Render error', p.id, e); }
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Chart !== 'undefined' && typeof window['chartjs-plugin-annotation'] !== 'undefined') {
    Chart.register(window['chartjs-plugin-annotation']);
  }
  App.init();
});