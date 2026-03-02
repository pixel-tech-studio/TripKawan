/**
 * TripKawan — Landing Page JavaScript
 * ====================================
 * Handles:
 *  1. Navbar scroll behaviour
 *  2. Mobile hamburger menu
 *  3. Scroll-reveal animations (Intersection Observer)
 *  4. Radio / checkbox card highlight (selected state)
 *  5. Feedback form submission to Google Sheets
 *  6. Exit-intent popup
 *  7. Sticky CTA button visibility
 *  8. Social sharing URLs
 *  9. Analytics event tracking (GA4)
 */

/* ============================================================
   CONFIG
   ============================================================ */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwgD8QHdHJn6-G-n8HaXCU2l9Ojki7adtN04LxZkQ29BlYg65nzjQR7fiwhpcuHozKa/exec';

// Social sharing text & URL
const SHARE_URL  = encodeURIComponent(window.location.href);
const SHARE_TEXT = encodeURIComponent(
  "We're building a tool to make group trips less stressful 🌍 Can you spare 2 minutes to help shape it? "
);

/* ============================================================
   1. NAVBAR — SCROLL BEHAVIOUR
   ============================================================ */
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

/* ============================================================
   2. MOBILE HAMBURGER MENU
   ============================================================ */
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
  // Swap icon between bars and times
  const icon = hamburger.querySelector('i');
  icon.classList.toggle('fa-bars');
  icon.classList.toggle('fa-times');
});

// Close mobile menu when a link is clicked
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    const icon = hamburger.querySelector('i');
    icon.classList.add('fa-bars');
    icon.classList.remove('fa-times');
  });
});

/* ============================================================
   3. SCROLL-REVEAL ANIMATIONS (Intersection Observer)
   ============================================================ */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger sibling reveals slightly based on DOM order
        const siblings = Array.from(entry.target.parentElement.querySelectorAll('.reveal'));
        const index    = siblings.indexOf(entry.target);
        const delay    = Math.min(index * 80, 400); // max 400ms delay

        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);

        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.12,    // trigger when 12% of element is visible
    rootMargin: '0px 0px -40px 0px', // slight bottom offset
  }
);

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ============================================================
   4. RADIO & CHECKBOX CARD SELECTION HIGHLIGHT
   ============================================================ */
function initSelectionCards() {
  // Radio cards — only one selected per group
  document.querySelectorAll('.radio-card input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      // De-select all cards in the same group
      const groupName = radio.name;
      document.querySelectorAll(`.radio-card input[name="${groupName}"]`).forEach(r => {
        r.closest('.radio-card').classList.remove('selected');
      });
      // Select the changed one
      radio.closest('.radio-card').classList.add('selected');
    });
  });

  // Checkbox cards — multiple allowed
  document.querySelectorAll('.checkbox-card input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const card = cb.closest('.checkbox-card');
      card.classList.toggle('selected', cb.checked);
    });
  });
}

initSelectionCards();

/* ============================================================
   5. FEEDBACK FORM — SUBMIT TO BACKEND API
   ============================================================ */
const feedbackForm = document.getElementById('feedback-form');
const formSuccess  = document.getElementById('form-success');
const submitBtn    = document.getElementById('submit-btn');
const formError    = document.getElementById('form-error');
const formErrorMsg = document.getElementById('form-error-msg');

// Collect all form values into a plain object
function collectFormData(form) {
  const data = {};

  // Text / textarea inputs
  ['name', 'email', 'pain_point', 'wish_feature', 'tools_other'].forEach(field => {
    const el = form.elements[field];
    if (el) data[field] = el.value.trim();
  });

  // Radio values
  ['group_travel', 'feature', 'likelihood'].forEach(field => {
    const el = form.querySelector(`input[name="${field}"]:checked`);
    data[field] = el ? el.value : '';
  });

  // Checkboxes (tools) — collect all checked values as array
  const toolCheckboxes = form.querySelectorAll('input[name="tools"]:checked');
  data.tools = Array.from(toolCheckboxes).map(cb => cb.value);

  // Add timestamp
  data.timestamp = new Date().toISOString();

  return data;
}

feedbackForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Hide any previous error
  formError.style.display = 'none';

  // Show loading state
  const btnText   = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');
  btnText.style.display   = 'none';
  btnLoader.style.display = 'inline-flex';
  submitBtn.disabled      = true;

  const formData = collectFormData(feedbackForm);

  try {
    // Google Apps Script requires mode: 'no-cors' to avoid CORS preflight issues.
    // The response is opaque (unreadable) but the data is saved to the Sheet.
    // Content-Type is not sent with no-cors requests; Apps Script reads the raw body regardless.
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode:   'no-cors',
      body:   JSON.stringify(formData),
    });

    // === SUCCESS ===
    trackEvent('feedback_submitted', { email_provided: !!formData.email });

    // Show success panel, hide form
    feedbackForm.style.display   = 'none';
    formSuccess.style.display    = 'block';

    // Populate share URLs in success panel
    setShareUrls('success-wa', 'success-fb', 'success-x');

    // Scroll success into view
    formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    // Restore button
    btnText.style.display   = 'inline';
    btnLoader.style.display = 'none';
    submitBtn.disabled      = false;

    // Show error message
    formErrorMsg.textContent = 'Something went wrong. Please try again.';
    formError.style.display  = 'flex';

    console.error('[TripKawan] Form submission error:', err);
  }
});

/* ============================================================
   6. EXIT-INTENT POPUP
   ============================================================ */
const exitPopup       = document.getElementById('exit-popup');
const popupClose      = document.getElementById('popup-close');
const popupNo         = document.getElementById('popup-no');
const popupEmailForm  = document.getElementById('popup-email-form');
const popupEmailInput = document.getElementById('popup-email-input');
const popupSuccessMsg = document.getElementById('popup-success');

let popupShown = false;

// Show when mouse moves near the top edge of the page (heading toward browser UI)
document.addEventListener('mouseleave', (e) => {
  if (popupShown) return;
  if (e.clientY <= 5) {
    showPopup();
  }
});

// Also show after user has scrolled 60% of the page and then scrolls back up quickly
let lastScrollY    = 0;
let scrollUpCount  = 0;

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const total    = document.body.scrollHeight - window.innerHeight;

  if (scrolled < lastScrollY && scrolled / total > 0.3) {
    scrollUpCount++;
    if (scrollUpCount >= 3 && !popupShown) {
      showPopup();
    }
  } else {
    scrollUpCount = 0;
  }

  lastScrollY = scrolled;
});

function showPopup() {
  popupShown = true;
  exitPopup.style.display = 'flex';
  trackEvent('exit_popup_shown', {});
}

function hidePopup() {
  exitPopup.style.display = 'none';
}

popupClose.addEventListener('click', () => {
  hidePopup();
  trackEvent('exit_popup_closed', {});
});

popupNo.addEventListener('click', () => {
  hidePopup();
  trackEvent('exit_popup_declined', {});
});

// Inline email capture — best-effort POST, always show success
popupEmailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = popupEmailInput.value.trim();
  if (!email) return;

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode:   'no-cors',
      body:   JSON.stringify({
        email,
        timestamp: new Date().toISOString(),
        source:    'exit_popup',
      }),
    });
  } catch (_) {
    // best-effort — sheet save still likely succeeded
  }

  trackEvent('exit_popup_email_captured', {});
  popupEmailForm.style.display  = 'none';
  popupSuccessMsg.style.display = 'block';
  setTimeout(hidePopup, 2000);
});

// Close popup when clicking the overlay background
exitPopup.addEventListener('click', (e) => {
  if (e.target === exitPopup) hidePopup();
});

// Close popup with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hidePopup();
});

/* ============================================================
   7. STICKY CTA — SHOW AFTER SCROLLING PAST HERO
   ============================================================ */
const stickyCta = document.getElementById('sticky-cta');
const heroEl    = document.getElementById('hero');

const stickyObserver = new IntersectionObserver(
  ([entry]) => {
    // Show sticky CTA when hero is no longer visible
    stickyCta.classList.toggle('visible', !entry.isIntersecting);
  },
  { threshold: 0.1 }
);

stickyObserver.observe(heroEl);

// Hide sticky CTA when user is near the feedback section (they can see the form)
const feedbackSection = document.getElementById('feedback');
const feedbackObserver = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) {
      stickyCta.classList.remove('visible');
    }
  },
  { threshold: 0.3 }
);
feedbackObserver.observe(feedbackSection);

/* ============================================================
   8. SOCIAL SHARING URLS
   ============================================================ */

/**
 * Build and inject share URLs into elements by ID.
 * @param {string} waId       - WhatsApp anchor element ID
 * @param {string} fbId       - Facebook anchor element ID
 * @param {string} xId        - X (Twitter) anchor element ID
 */
function setShareUrls(waId, fbId, xId) {
  const waEl = document.getElementById(waId);
  const fbEl = document.getElementById(fbId);
  const xEl  = document.getElementById(xId);

  if (waEl) {
    waEl.href = `https://wa.me/?text=${SHARE_TEXT}${SHARE_URL}`;
    waEl.addEventListener('click', () => trackEvent('social_share', { platform: 'whatsapp' }));
  }
  if (fbEl) {
    fbEl.href = `https://www.facebook.com/sharer/sharer.php?u=${SHARE_URL}&quote=${SHARE_TEXT}`;
    fbEl.addEventListener('click', () => trackEvent('social_share', { platform: 'facebook' }));
  }
  if (xEl) {
    xEl.href = `https://twitter.com/intent/tweet?text=${SHARE_TEXT}&url=${SHARE_URL}`;
    xEl.addEventListener('click', () => trackEvent('social_share', { platform: 'x_twitter' }));
  }
}

// Inject share URLs on page load for the CTA section buttons
setShareUrls('cta-wa', 'cta-fb', 'cta-x');

/* ============================================================
   9. ANALYTICS EVENT TRACKING
   ============================================================ */
function trackEvent(eventName, params = {}) {
  // --- Google Analytics 4 ---
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
}

// Track CTA button clicks
document.querySelectorAll('[href="#feedback"]').forEach(btn => {
  btn.addEventListener('click', () => {
    trackEvent('cta_click', { label: btn.textContent.trim() });
  });
});

/* ============================================================
   10. SMOOTH SCROLL — OVERRIDE DEFAULT ANCHOR BEHAVIOUR
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const targetId = anchor.getAttribute('href');
    if (targetId === '#') return; // skip bare # links

    const target = document.querySelector(targetId);
    if (!target) return;

    e.preventDefault();
    const navbarHeight = navbar.offsetHeight;
    const targetTop    = target.getBoundingClientRect().top + window.scrollY - navbarHeight - 12;

    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  });
});

/* ============================================================
   11. FAQ ACCORDION
   ============================================================ */
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item     = btn.closest('.faq-item');
    const isOpen   = item.classList.contains('open');

    // Close all open items
    document.querySelectorAll('.faq-item.open').forEach(open => {
      open.classList.remove('open');
      open.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });

    // Open clicked item if it was closed
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      trackEvent('faq_opened', { question: btn.querySelector('span').textContent });
    }
  });
});

/* ============================================================
   12. SCROLL DEPTH TRACKING
   ============================================================ */
const depthMilestones = new Set();
let scrollTicking = false;

window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;

  requestAnimationFrame(() => {
    const total = document.body.scrollHeight - window.innerHeight;
    if (total > 0) {
      const pct = (window.scrollY / total) * 100;

      [
        [25, '25'],
        [50, '50'],
        [75, '75'],
        [90, 'reached_form_section'],
      ].forEach(([threshold, label]) => {
        if (pct >= threshold && !depthMilestones.has(threshold)) {
          depthMilestones.add(threshold);
          trackEvent('scroll_depth', { depth: label });
        }
      });
    }
    scrollTicking = false;
  });
});

/* ============================================================
   13. FORM FIELD FOCUS TRACKING
   ============================================================ */
const trackedFields = new Set();

feedbackForm.addEventListener('focusin', (e) => {
  const field = e.target.name;
  if (!field || trackedFields.has(field)) return;
  trackedFields.add(field);
  trackEvent('form_field_focus', { field });
});

/* ============================================================
   14. COOKIE CONSENT
   ============================================================ */
const cookieBanner  = document.getElementById('cookie-banner');
const cookieAccept  = document.getElementById('cookie-accept');
const cookieDecline = document.getElementById('cookie-decline');

function loadGA() {
  gtag('consent', 'update', { analytics_storage: 'granted' });
  // Only inject the script if it hasn't been loaded yet (i.e., no prior consent in localStorage)
  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-48EF0Q4SGP';
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', 'G-48EF0Q4SGP', { send_page_view: true });
  }
}

// Show banner only if user hasn't made a choice yet
if (!localStorage.getItem('cookie_consent')) {
  cookieBanner.classList.add('visible');
}

cookieAccept.addEventListener('click', () => {
  localStorage.setItem('cookie_consent', 'accepted');
  cookieBanner.classList.remove('visible');
  loadGA();
});

cookieDecline.addEventListener('click', () => {
  localStorage.setItem('cookie_consent', 'declined');
  cookieBanner.classList.remove('visible');
});

/* ============================================================
   INIT LOG
   ============================================================ */
console.info('TripKawan landing page loaded successfully!');
