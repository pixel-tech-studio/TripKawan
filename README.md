# ✈️ TripKawan — Landing Page

> **Plan trips together. Split expenses without stress.**
>
> A validation landing page for the TripKawan group travel planning &amp; expense sharing platform.

---

## 📁 Project Structure

```
TripKawan/
├── TripKawan - Frontend/       ← Static landing page (HTML/CSS/JS)
│   ├── index.html              ← Main landing page (all sections)
│   ├── css/
│   │   └── styles.css          ← Complete design system + responsive layout
│   └── js/
│       └── main.js             ← Animations, form submission, popup, sharing
│
└── TripKawan - Backend/        ← Feedback API (Node.js + Express)
    ├── server.js               ← Express server with REST endpoints
    ├── package.json            ← Dependencies
    ├── .env.example            ← Environment variable template
    └── data/
        └── feedback.json       ← Auto-created on first run
```

---

## 🚀 Quick Start (Local Development)

### 1. Start the Backend API

```bash
cd "TripKawan - Backend"

# Install dependencies
npm install

# Copy environment file and edit values
cp .env.example .env

# Start the dev server (auto-reloads on changes)
npm run dev

# OR for production
npm start

The API will be available at `http://localhost:3001`.

**Test it:**
```bash
# Health check
curl http://localhost:3001/health

# Submit test feedback
curl -X POST http://localhost:3001/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex","email":"alex@example.com","group_travel":"yes","tools":["whatsapp"],"pain_point":"Hard to track expenses","feature":"expense_splitting","likelihood":"definitely"}'

# View all feedback (admin)
curl http://localhost:3001/api/feedback \
  -H "Authorization: Bearer changeme_replace_with_a_strong_secret"
```

---

### 2. Open the Frontend

**Option A — VS Code Live Server (easiest)**

1. Install the **Live Server** extension in VS Code
2. Right-click `TripKawan - Frontend/index.html`
3. Select **Open with Live Server**
4. Opens at `http://127.0.0.1:5500`

**Option B — Python simple server**
```bash
cd "TripKawan - Frontend"
python3 -m http.server 5500
# Open http://localhost:5500
```

**Option C — Node serve**
```bash
npx serve "TripKawan - Frontend" -p 5500
```

---

## 🌍 Deployment (Free Hosting)

### Frontend → Netlify (Recommended)

1. Push this project to a GitHub repository
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Set **Base directory** to `TripKawan - Frontend`
4. Set **Publish directory** to `TripKawan - Frontend`
5. Click **Deploy**

**Or use Netlify CLI:**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --dir "TripKawan - Frontend" --prod
```

Your site will be at `https://your-site-name.netlify.app`.

---

### Frontend → Vercel (Alternative)

```bash
npm install -g vercel
cd "TripKawan - Frontend"
vercel --prod
```

---

### Frontend → GitHub Pages

1. Push to GitHub
2. Go to **Settings → Pages**
3. Set **Source** to `Deploy from a branch`
4. Set branch to `main`, folder to `/` (root) or `/TripKawan - Frontend`
5. Your site will be at `https://yourusername.github.io/repo-name`

---

### Backend → Render (Recommended — Free Tier)

1. Push to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Set **Root Directory** to `TripKawan - Backend`
5. Set **Build Command**: `npm install`
6. Set **Start Command**: `npm start`
7. Add **Environment Variables** (see below)
8. Click **Create Web Service**

Your API will be at `https://your-service.onrender.com`.

---

### Backend → Railway (Alternative)

```bash
npm install -g @railway/cli
railway login
cd "TripKawan - Backend"
railway init
railway up
```

---

### Backend → Fly.io (Alternative)

```bash
brew install flyctl
flyctl auth login
cd "TripKawan - Backend"
flyctl launch
flyctl deploy
```

---

## ⚙️ Environment Variables

### Backend (`TripKawan - Backend/.env`)

| Variable        | Default         | Description                                        |
|-----------------|----------------|----------------------------------------------------|
| `PORT`          | `3001`          | Port the API listens on                            |
| `FRONTEND_URL`  | *(empty)*       | Your frontend URL for CORS (e.g. Netlify URL)      |
| `ADMIN_TOKEN`   | `changeme`      | Bearer token for `GET /api/feedback` admin access  |

**Generate a secure admin token:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔗 Connecting Frontend to Backend

After deploying your backend, update the API URL in `TripKawan - Frontend/js/main.js`:

```js
// Line ~15 in main.js — change this:
const API_BASE_URL = 'http://localhost:3001';

// To your deployed backend URL:
const API_BASE_URL = 'https://your-backend.onrender.com';
```

---

## 📈 Digital Marketing Setup

### Google Analytics 4

1. Create a GA4 property at [analytics.google.com](https://analytics.google.com)
2. Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)
3. In `index.html`, find the GA placeholder comment and uncomment it:
   ```html
   <!-- Find this block in <head> and uncomment: -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){ dataLayer.push(arguments); }
     gtag('js', new Date());
     gtag('config', 'G-XXXXXXXXXX');   ← replace with real ID
   </script>
   ```
4. In `main.js`, uncomment the `gtag()` calls inside `trackEvent()`.

### SEO

Already configured in `index.html`:
- `<title>` — TripKawan brand + keywords
- `<meta name="description">` — 155-char description
- `<meta name="keywords">` — group travel, split expenses, ASEAN travel
- Open Graph tags for Facebook/LinkedIn sharing
- Twitter Card for Twitter/X sharing
- `canonical` link tag

### Social Sharing

Share buttons are pre-wired in two locations:
1. **Final CTA section** — always visible
2. **Form success panel** — shown after feedback is submitted

Share text: *"We're building a tool to make group trips less stressful 🌍 Can you spare 2 minutes to help shape it?"*

### Conversion Features

| Feature               | Location             | Notes                                      |
|-----------------------|---------------------|--------------------------------------------|
| Sticky CTA button     | Bottom-right corner  | Appears after scrolling past the hero      |
| Exit-intent popup     | Full-screen overlay  | Triggers when mouse moves toward browser UI |
| Waitlist email capture| Feedback form        | Optional email field in the questionnaire  |
| Social sharing        | CTA + Success panel  | WhatsApp, Facebook, X                      |

---

## 📬 Viewing Submitted Feedback

**Option A — Admin API endpoint:**
```bash
curl https://your-backend.onrender.com/api/feedback \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Option B — Read the JSON file directly:**
```bash
cat "TripKawan - Backend/data/feedback.json"
```

**Option C — Pretty print with jq:**
```bash
cat "TripKawan - Backend/data/feedback.json" | jq '.[] | {name, email, likelihood, feature}'
```

---

## 🧪 Testing Checklist Before Launch

- [ ] Backend health check returns `{ status: 'ok' }`
- [ ] Form submits successfully and shows success message
- [ ] Share buttons generate correct WhatsApp/Facebook/X links
- [ ] Exit-intent popup appears when mouse leaves viewport
- [ ] Sticky CTA button appears after scrolling
- [ ] Page is fully responsive on mobile (375px)
- [ ] All internal anchor links scroll smoothly
- [ ] OG image displays correctly when sharing on social (use [opengraph.xyz](https://www.opengraph.xyz))
- [ ] GA4 events fire correctly in the Analytics DebugView

---

## 🚀 Go-to-Market Checklist

After deploying, spread the link:

- [ ] **Reddit** — r/travel, r/solotravel, r/digitalnomad, r/ASEAN
- [ ] **Product Hunt** — Upcoming page
- [ ] **Facebook Groups** — "Travel Malaysia", "Budget Travel Southeast Asia"
- [ ] **WhatsApp Broadcast** — University groups, friend circles
- [ ] **Instagram Reels / TikTok** — 30s screen recording of the landing page
- [ ] **Telegram Groups** — Travel & backpacker channels

**CTA message template:**
> *"We're building a tool to make group trips less stressful. Can you spare 2 minutes to help us shape it? [link] 🌍"*

---

## 🛠️ Tech Stack

| Layer     | Tech                  | Why                            |
|-----------|-----------------------|-------------------------------|
| Frontend  | HTML + CSS + JS       | Zero build step, instant deploy |
| Styling   | Pure CSS + Poppins    | Fast, no framework overhead    |
| Icons     | Font Awesome 6        | Rich icon set via CDN          |
| Backend   | Node.js + Express     | Minimal, beginner-friendly     |
| Storage   | JSON flat file        | No database setup required     |
| Hosting   | Netlify / Render      | Free tiers, instant deploy     |

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built with ❤️ for group travelers everywhere. — TripKawan Team*
