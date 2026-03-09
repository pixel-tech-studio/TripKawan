/* ============================================================
   TRIPKAWAN — Gold & Silver Price Dashboard
   Reads from Google Sheets gviz JSON API (public read-only)
   ============================================================ */

const SHEET_ID  = '1q_kujQAzMPdCA0QDA8XCgB_E6TjH89nvVim9jas5qBw';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Daily`;
const TROY_OZ   = 31.1035; // grams per troy ounce

// State
let _allRows   = [];
let _currency  = 'MYR'; // 'MYR' | 'USD'
let _unit      = 'g';   // 'g'   | 'oz'
const _charts  = {};

// ── Boot ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchAndRender();

  // Range buttons
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAll(filterRows(_allRows, parseInt(btn.dataset.days, 10)));
    });
  });

  // Currency toggle
  document.querySelectorAll('[data-currency]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-currency]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currency = btn.dataset.currency;
      const days = parseInt(document.querySelector('.range-btn.active').dataset.days, 10);
      renderAll(filterRows(_allRows, days));
    });
  });

  // Unit toggle
  document.querySelectorAll('[data-unit]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-unit]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _unit = btn.dataset.unit;
      const days = parseInt(document.querySelector('.range-btn.active').dataset.days, 10);
      renderAll(filterRows(_allRows, days));
    });
  });
});

// ── Fetch ────────────────────────────────────────────────────
async function fetchAndRender() {
  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    _allRows = parseSheetRows(text);

    if (_allRows.length === 0) {
      showState('No data yet — check back after the first nightly run.', false);
      return;
    }

    hideState();
    renderAll(filterRows(_allRows, 30));
  } catch (err) {
    showState(`Failed to load data: ${err.message}`, true);
  }
}

// ── Parse gviz response ──────────────────────────────────────
function parseSheetRows(text) {
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const rows = json.table?.rows ?? [];

  return rows
    .filter(r => r.c && r.c[0] && r.c[0].v)
    .map(r => ({
      date: parseGvizDate(r.c[0].v),
      time: r.c[1]?.v ? parseGvizTime(r.c[1].v) : '',
      gap:  toNum(r.c[2]?.v),   // MYR/g
      sap:  toNum(r.c[3]?.v),   // MYR/g
      xau:  toNum(r.c[4]?.v),   // USD/oz
      xag:  toNum(r.c[5]?.v),   // USD/oz
      fx:   toNum(r.c[6]?.v),   // USD/MYR rate
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// gviz encodes dates as "Date(year,month,day)" with 0-indexed months
// gviz encodes time-of-day as "Date(1899,11,30,H,M,S)"
function parseGvizTime(v) {
  const s = String(v);
  const m = s.match(/^Date\(\d+,\d+,\d+,(\d+),(\d+)/);
  if (m) return `${String(m[1]).padStart(2, '0')}:${String(m[2]).padStart(2, '0')}`;
  return s;
}

function parseGvizDate(v) {
  const s = String(v);
  const m = s.match(/^Date\((\d+),(\d+),(\d+)\)/);
  if (m) {
    const y  = m[1];
    const mo = String(parseInt(m[2], 10) + 1).padStart(2, '0');
    const d  = String(m[3]).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return s; // already "YYYY-MM-DD"
}

function toNum(v) {
  if (v === null || v === undefined || v === 'N/A') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ── Filter by range ──────────────────────────────────────────
function filterRows(rows, days) {
  if (!days) return rows;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter(r => r.date >= cutoffStr);
}

// ── Conversions ──────────────────────────────────────────────
// GAP/SAP are stored as MYR/g. Spot Gold/Silver as USD/oz.
// Convert everything to the currently selected currency + unit.

function convertPG(val, fx) {
  // Input: MYR/g
  if (val === null || fx === null) return null;
  let v = val;
  if (_currency === 'USD') v = v / fx;
  if (_unit === 'oz')      v = v * TROY_OZ;
  return v;
}

function convertSpot(val, fx) {
  // Input: USD/oz
  if (val === null || fx === null) return null;
  let v = val;
  if (_currency === 'MYR') v = v * fx;
  if (_unit === 'g')       v = v / TROY_OZ;
  return v;
}

function unitLabel() {
  return `(${_currency}/${_unit})`;
}

// ── Render everything ────────────────────────────────────────
function renderAll(rows) {
  updateCards(rows);
  renderCharts(rows);
  document.getElementById('summary-cards').style.display = '';
  document.getElementById('charts-grid').style.display = '';

  const latest = rows[rows.length - 1];
  if (latest) {
    const [y, mo, d] = latest.date.split('-');
    document.getElementById('last-updated').textContent =
      `Last updated: ${d}/${mo}/${y} ${latest.time} MYT`;
  } else {
    document.getElementById('last-updated').textContent = 'No data';
  }

  // Update chart heading labels
  const lbl = unitLabel();
  ['gap','sap','xau','xag'].forEach(id => {
    const el = document.getElementById(`label-${id}`);
    if (el) el.textContent = lbl;
  });
}

// ── Summary cards ────────────────────────────────────────────
function updateCards(rows) {
  const latest = rows[rows.length - 1];
  const prev   = rows[rows.length - 2];
  if (!latest) return;

  const fx = latest.fx;

  setCard('gap', convertPG(latest.gap, fx),    convertPG(prev?.gap, prev?.fx),    2);
  setCard('sap', convertPG(latest.sap, fx),    convertPG(prev?.sap, prev?.fx),    4);
  setCard('xau', convertSpot(latest.xau, fx),  convertSpot(prev?.xau, prev?.fx),  2);
  setCard('xag', convertSpot(latest.xag, fx),  convertSpot(prev?.xag, prev?.fx),  4);
  setCard('fx',  latest.fx,                    prev?.fx,                           4);

  // Update card unit labels
  const lbl = `${_currency} / ${_unit}`;
  ['gap','sap','xau','xag'].forEach(id => {
    const el = document.querySelector(`#val-${id} ~ .card-unit`);
    if (el) el.textContent = lbl;
  });
}

function setCard(id, val, prevVal, decimals) {
  const valEl = document.getElementById(`val-${id}`);
  const dltEl = document.getElementById(`dlt-${id}`);

  valEl.textContent = val !== null ? val.toFixed(decimals) : '—';

  if (val !== null && prevVal !== null) {
    const diff = val - prevVal;
    const pct  = prevVal !== 0 ? (diff / prevVal * 100).toFixed(2) : '0.00';
    if (diff > 0) {
      dltEl.textContent = `▲ +${diff.toFixed(decimals)} (${pct}%)`;
      dltEl.className = 'card-delta up';
    } else if (diff < 0) {
      dltEl.textContent = `▼ ${diff.toFixed(decimals)} (${pct}%)`;
      dltEl.className = 'card-delta down';
    } else {
      dltEl.textContent = '→ No change';
      dltEl.className = 'card-delta flat';
    }
  } else {
    dltEl.textContent = '';
    dltEl.className = 'card-delta flat';
  }
}

// ── Charts ───────────────────────────────────────────────────
function renderCharts(rows) {
  const labels = rows.map(r => {
    const [y, mo, d] = r.date.split('-');
    return `${d}/${mo}/${y}`;
  });

  buildOrUpdate('chart-gap', labels, rows.map(r => convertPG(r.gap, r.fx)),    `GAP ${unitLabel()}`,       '#F59E0B');
  buildOrUpdate('chart-sap', labels, rows.map(r => convertPG(r.sap, r.fx)),    `SAP ${unitLabel()}`,       '#94A3B8');
  buildOrUpdate('chart-xau', labels, rows.map(r => convertSpot(r.xau, r.fx)),  `Spot Gold ${unitLabel()}`, '#F97316');
  buildOrUpdate('chart-xag', labels, rows.map(r => convertSpot(r.xag, r.fx)),  `Spot Silver ${unitLabel()}`,'#64748B');
}

function buildOrUpdate(id, labels, data, label, color) {
  if (_charts[id]) {
    _charts[id].data.labels = labels;
    _charts[id].data.datasets[0].data = data;
    _charts[id].data.datasets[0].label = label;
    _charts[id].update('none');
    return;
  }

  const canvas = document.getElementById(id);
  _charts[id] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.07),
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2,
        spanGaps: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              return v !== null ? `${ctx.dataset.label}: ${v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}` : 'N/A';
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 8, font: { family: 'Poppins', size: 11 }, color: '#94A3B8' },
          grid: { display: false },
        },
        y: {
          beginAtZero: false,
          ticks: { font: { family: 'Poppins', size: 11 }, color: '#94A3B8', callback: v => v.toLocaleString() },
          grid: { color: '#F1F5F9' },
        }
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
    }
  });
}

// ── Helpers ──────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function showState(msg, isError) {
  const el = document.getElementById('dash-state');
  el.textContent = msg;
  el.className = isError ? 'dash-state error' : 'dash-state';
  el.style.display = '';
}

function hideState() {
  document.getElementById('dash-state').style.display = 'none';
}
