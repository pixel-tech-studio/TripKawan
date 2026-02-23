/**
 * TripKawan — Feedback API Server
 * ================================
 * Stack   : Node.js + Express
 * Storage : JSON flat-file (data/feedback.json) — no database needed
 * Endpoints:
 *   POST /api/feedback  — save a feedback submission
 *   GET  /api/feedback  — admin view of all submissions (token-protected)
 *   GET  /health        — health check (for hosting platforms)
 *
 * To run locally:
 *   npm install
 *   npm run dev   (with auto-reload via nodemon)
 *   npm start     (production)
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
require('dotenv').config();

/* ============================================================
   CONFIG
   ============================================================ */
const app  = express();
const PORT = process.env.PORT || 3001;

// Path to the JSON storage file
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'feedback.json');

// Admin token — set ADMIN_TOKEN in your .env file to protect the GET endpoint
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';

// Allowed origins for CORS — add your deployed frontend URL here
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5500',  // Live Server (VS Code)
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  process.env.FRONTEND_URL,  // e.g. https://tripkawan.netlify.app
].filter(Boolean); // remove undefined

/* ============================================================
   MIDDLEWARE
   ============================================================ */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS setup — allow the frontend origins to talk to this API
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

/* ============================================================
   STORAGE HELPERS
   ============================================================ */

/** Ensure the data directory and file exist */
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

/** Read all feedback records from the JSON file */
function readFeedback() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Storage] Error reading feedback file:', err.message);
    return [];
  }
}

/** Append a new feedback record to the JSON file */
function writeFeedback(record) {
  const records = readFeedback();
  records.push(record);
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
}

/* ============================================================
   INPUT VALIDATION / SANITISATION
   ============================================================ */

/**
 * Trim a string value and cap its length to prevent abuse.
 * @param {*} val
 * @param {number} maxLen
 * @returns {string}
 */
function cleanString(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

/**
 * Validate an email address (basic format check).
 * Returns the cleaned email or an empty string if invalid.
 */
function cleanEmail(val) {
  const str = cleanString(val, 254);
  // Simple RFC-compatible regex — not exhaustive, but good enough
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str) ? str : '';
}

/**
 * Validate and clean an incoming feedback payload.
 * Returns a sanitised object with only the expected fields.
 */
function sanitiseFeedback(body) {
  const allowedTools = ['whatsapp', 'google_sheets', 'notes'];
  const allowedFeature = ['expense_splitting', 'shared_itinerary', 'budget_tracking', 'all_in_one'];
  const allowedLikelihood = ['definitely', 'maybe', 'not_sure'];

  // tools array — only accept known values
  let tools = [];
  if (Array.isArray(body.tools)) {
    tools = body.tools.filter(t => allowedTools.includes(t));
  }

  return {
    name:         cleanString(body.name, 100),
    email:        cleanEmail(body.email),
    group_travel: body.group_travel === 'yes' ? 'yes' : body.group_travel === 'no' ? 'no' : '',
    tools,
    tools_other:  cleanString(body.tools_other, 200),
    pain_point:   cleanString(body.pain_point, 1000),
    feature:      allowedFeature.includes(body.feature)    ? body.feature    : '',
    likelihood:   allowedLikelihood.includes(body.likelihood) ? body.likelihood : '',
    wish_feature: cleanString(body.wish_feature, 1000),
    timestamp:    new Date().toISOString(), // always use server time
    ip:           '', // we deliberately do NOT store IPs for privacy
  };
}

/* ============================================================
   ROUTES
   ============================================================ */

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'TripKawan API', time: new Date().toISOString() });
});

// ── POST /api/feedback — save a submission ────────────────────
app.post('/api/feedback', (req, res) => {
  try {
    const record = sanitiseFeedback(req.body);

    // Reject completely empty submissions (spam guard)
    if (!record.name && !record.email && !record.pain_point && !record.wish_feature) {
      return res.status(400).json({ success: false, message: 'Feedback appears to be empty.' });
    }

    writeFeedback(record);

    console.log(`[Feedback] New submission — name: "${record.name}" | email: "${record.email}"`);

    return res.status(201).json({
      success: true,
      message: 'Feedback received. Thank you!',
    });
  } catch (err) {
    console.error('[Feedback] Error saving submission:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error. Please try again.' });
  }
});

// ── GET /api/feedback — admin view of all responses ──────────
// Protected by a simple bearer token (set ADMIN_TOKEN in .env)
app.get('/api/feedback', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorised. Provide a valid admin token.' });
  }

  try {
    const records = readFeedback();
    return res.json({
      success: true,
      count:   records.length,
      data:    records,
    });
  } catch (err) {
    console.error('[Admin] Error reading feedback:', err.message);
    return res.status(500).json({ success: false, message: 'Could not read feedback data.' });
  }
});

// ── 404 fallback ──────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ success: false, message: err.message || 'Internal server error.' });
});

/* ============================================================
   START SERVER
   ============================================================ */
ensureDataFile(); // create data dir + file on startup

app.listen(PORT, () => {
  console.log(`\n✈️  TripKawan API running on http://localhost:${PORT}`);
  console.log(`   Health:   GET  http://localhost:${PORT}/health`);
  console.log(`   Feedback: POST http://localhost:${PORT}/api/feedback`);
  console.log(`   Admin:    GET  http://localhost:${PORT}/api/feedback  (Bearer token required)\n`);
});
