# TripKawan — Landing Page

> **Plan trips together. Split expenses without stress.**
>
> A validation landing page for the TripKawan group travel planning & expense sharing platform.

---

## Project Structure

```
TripKawan/
├── TripKawan - Frontend/       ← Static landing page (HTML/CSS/JS)
│   ├── index.html              ← Main landing page (all sections)
│   ├── css/
│   │   └── styles.css          ← Complete design system + responsive layout
│   ├── js/
│   │   └── main.js             ← Animations, form submission, popup, sharing
│   ├── vercel.json             ← Vercel config (security headers, caching)
│   ├── manifest.json           ← PWA manifest
│   ├── robots.txt              ← Crawler directives
│   ├── sitemap.xml             ← Sitemap for search engines
│   └── og-image.jpg            ← Open Graph social sharing image
│
└── TripKawan - Backend/        ← Google Apps Script (serverless)
    ├── google-sheets-script.gs ← Handles form submissions + confirmation emails
    └── .env.example            ← Environment variable template (reference only)
```

---

## Tech Stack

| Layer     | Tech                       | Why                                    |
|-----------|----------------------------|----------------------------------------|
| Frontend  | HTML + CSS + JS            | Zero build step, instant deploy        |
| Styling   | Pure CSS + Poppins font    | Fast, no framework overhead            |
| Icons     | Font Awesome 6 (CDN)       | Rich icon set                          |
| Backend   | Google Apps Script         | Serverless, no hosting needed          |
| Database  | Google Sheets              | Free, easy to view/export              |
| Hosting   | Vercel                     | Free tier, automatic SSL               |
| Domain    | tripkawan.my               | Custom `.my` domain via Vercel         |
| Analytics | Google Analytics 4         | Cookie-consent gated                   |

---

## Live Site

**https://tripkawan.my**

---

## Local Development

### Frontend

**Option A — VS Code Live Server (easiest)**

1. Install the **Live Server** extension in VS Code
2. Right-click `TripKawan - Frontend/index.html`
3. Select **Open with Live Server**

**Option B — Python**
```bash
cd "TripKawan - Frontend"
python3 -m http.server 5500
```

**Option C — Node**
```bash
npx serve "TripKawan - Frontend" -p 5500
```

### Backend (Google Apps Script)

The backend runs on Google's infrastructure — no local server needed.

To update the backend:
1. Open your Google Sheet → **Extensions → Apps Script**
2. Replace the code with the contents of `google-sheets-script.gs`
3. **Deploy → Manage deployments → Edit → New version → Deploy**

The script URL in `js/main.js` (`GOOGLE_SCRIPT_URL`) stays the same when updating an existing deployment.

---

## Deployment

### Frontend → Vercel

The site auto-deploys on push to `main`:

```bash
git push origin main
```

Manual deploy:
```bash
npm install -g vercel
cd "TripKawan - Frontend"
vercel --prod
```

### Backend → Google Apps Script

See the deployment instructions in the header of `google-sheets-script.gs`.

---

## SEO & Analytics

### Already Configured

- Canonical URL (`https://tripkawan.my/`)
- Open Graph tags (Facebook, LinkedIn)
- Twitter Card tags
- JSON-LD structured data (SoftwareApplication, Organization, FAQPage)
- `robots.txt` + `sitemap.xml`
- Google Analytics 4 (`G-48EF0Q4SGP`) — loads only after cookie consent
- Security headers via `vercel.json` (CSP, X-Frame-Options, etc.)

### Social Sharing

Share buttons are wired in two locations:
1. **Final CTA section** — always visible
2. **Form success panel** — shown after feedback submission

Platforms: WhatsApp, Facebook, X (Twitter)

---

## Conversion Features

| Feature               | Location             | Notes                                      |
|-----------------------|---------------------|---------------------------------------------|
| Sticky CTA button     | Bottom-right corner  | Appears after scrolling past the hero       |
| Exit-intent popup     | Full-screen overlay  | Triggers on mouse leave / scroll-up pattern |
| Email capture         | Feedback form        | Optional email field in questionnaire       |
| Social sharing        | CTA + Success panel  | WhatsApp, Facebook, X                       |

---

## Viewing Submitted Feedback

All form submissions are saved to your linked Google Sheet. Open the sheet directly to view, filter, or export responses.

---

## License

MIT — free to use, modify, and distribute.

---

*Built for group travelers everywhere. — TripKawan Team*
