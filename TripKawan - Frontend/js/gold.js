/* ============================================================
   TRIPKAWAN — Gold & Silver Price Dashboard
   Reads from Google Sheets gviz JSON API (public read-only)
   ============================================================ */

const SHEET_ID = '1q_kujQAzMPdCA0QDA8XCgB_E6TjH89nvVim9jas5qBw';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Daily`;

// Chart.js instances — cached to allow range-switch updates without DOM rebuilds
const _charts = {};

// Full dataset after initial fetch
let _allRows = [];

// ── Boot ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchAndRender();

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const days = parseInt(btn.dataset.days, 10);
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
    renderAll(filterRows(_allRows, 30)); // default: 1M
  } catch (err) {
    showState(`Failed to load data: ${err.message}. Make sure the sheet is shared as "Anyone with the link — Viewer".`, true);
  }
}

// ── Parse gviz response ──────────────────────────────────────
function parseSheetRows(text) {
  // gviz wraps response in /*O_o*/ google.visualization.Query.setResponse({...});
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const rows = json.table?.rows ?? [];

  return rows
    .filter(r => r.c && r.c[0] && r.c[0].v)
    .map(r => ({
      date:   String(r.c[0].v),
      time:   r.c[1]?.v ? String(r.c[1].v) : '',
      gap:    toNum(r.c[2]?.v),
      sap:    toNum(r.c[3]?.v),
      xau:    toNum(r.c[4]?.v),
      xag:    toNum(r.c[5]?.v),
      fx:     toNum(r.c[6]?.v),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function toNum(v) {
  if (v === null || v === undefined || v === 'N/A') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ── Filter by range ──────────────────────────────────────────
function filterRows(rows, days) {
  if (!days) return rows; // 0 = All
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter(r => r.date >= cutoffStr);
}

// ── Render everything ────────────────────────────────────────
function renderAll(rows) {
  updateCards(rows);
  renderCharts(rows);
  document.getElementById('summary-cards').style.display = '';
  document.getElementById('charts-grid').style.display = '';

  const latest = rows[rows.length - 1];
  document.getElementById('last-updated').textContent =
    latest ? `Last updated: ${latest.date} ${latest.time} MYT` : 'No data';
}

// ── Summary cards ────────────────────────────────────────────
function updateCards(rows) {
  const latest = rows[rows.length - 1];
  const prev   = rows[rows.length - 2];
  if (!latest) return;

  setCard('gap', latest.gap,  prev?.gap,  2);
  setCard('sap', latest.sap,  prev?.sap,  4);
  setCard('xau', latest.xau,  prev?.xau,  2);
  setCard('xag', latest.xag,  prev?.xag,  4);
  setCard('fx',  latest.fx,   prev?.fx,   4);
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
  const labels = rows.map(r => r.date);

  buildOrUpdate('chart-gap', labels, rows.map(r => r.gap),  'GAP (MYR/g)',  '#F59E0B');
  buildOrUpdate('chart-sap', labels, rows.map(r => r.sap),  'SAP (MYR/g)',  '#94A3B8');
  buildOrUpdate('chart-xau', labels, rows.map(r => r.xau),  'Spot Gold USD','#F97316');
  buildOrUpdate('chart-fx',  labels, rows.map(r => r.fx),   'USD/MYR',      '#0EA5E9');
}

function buildOrUpdate(id, labels, data, label, color) {
  if (_charts[id]) {
    _charts[id].data.labels = labels;
    _charts[id].data.datasets[0].data = data;
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
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toLocaleString() : 'N/A'}`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 8,
            font: { family: 'Poppins', size: 11 },
            color: '#94A3B8',
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: false,
          ticks: {
            font: { family: 'Poppins', size: 11 },
            color: '#94A3B8',
            callback: v => v.toLocaleString(),
          },
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
