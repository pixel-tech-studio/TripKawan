/**
 * TripKawan — Landing Page JavaScript
 * ====================================
 * Handles:
 *  1. Navbar scroll behaviour
 *  2. Mobile hamburger menu
 *  3. Scroll-reveal animations (Intersection Observer)
 *  4. Radio / checkbox card highlight (selected state)
 *  5. Feedback form submission to backend API
 *  6. Exit-intent popup
 *  7. Sticky CTA button visibility
 *  8. Social sharing URLs
 *  9. Basic analytics event tracking (console stubs — replace with GA4)
 */

/* ============================================================
   CONFIG
   ============================================================ */

// Backend API URL — change this to your deployed backend URL.
// For local development: http://localhost:3001
// For production: https://your-backend.onrender.com
const API_BASE_URL = 'http://localhost:3001';

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
    const response = await fetch(`${API_BASE_URL}/api/feedback`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(formData),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Server error (${response.status})`);
    }

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
    formErrorMsg.textContent = err.message || 'Something went wrong. Please try again.';
    formError.style.display  = 'flex';

    console.error('[TripKawan] Form submission error:', err);

    // Fallback: if backend is unreachable, save locally and show success anyway
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      saveToLocalStorage(formData);
      feedbackForm.style.display = 'none';
      formSuccess.style.display  = 'block';
      setShareUrls('success-wa', 'success-fb', 'success-x');
    }
  }
});

// Fallback: save response to localStorage when backend is unreachable
function saveToLocalStorage(data) {
  try {
    const existing = JSON.parse(localStorage.getItem('tripkawan_feedback') || '[]');
    existing.push(data);
    localStorage.setItem('tripkawan_feedback', JSON.stringify(existing));
    console.info('[TripKawan] Feedback saved locally (backend unavailable).');
  } catch (_) { /* ignore */ }
}

/* ============================================================
   6. EXIT-INTENT POPUP
   ============================================================ */
const exitPopup   = document.getElementById('exit-popup');
const popupClose  = document.getElementById('popup-close');
const popupNo     = document.getElementById('popup-no');
const popupYes    = document.getElementById('popup-yes');

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

popupYes.addEventListener('click', () => {
  hidePopup();
  trackEvent('exit_popup_accepted', {});
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
   ============================================================
   These are stub functions.  Replace the console.log calls with
   real GA4 gtag() calls once you set up Google Analytics.

   Example GA4 call:
     gtag('event', 'feedback_submitted', { email_provided: true });
*/
function trackEvent(eventName, params = {}) {
  // --- Google Analytics 4 ---
  // Uncomment below after adding the GA4 script to index.html:
  // if (typeof gtag === 'function') {
  //   gtag('event', eventName, params);
  // }

  // Dev log (remove in production)
  console.info(`[Analytics] ${eventName}`, params);
}

// Track page view on load
trackEvent('page_view', { page: window.location.pathname });

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
   INIT LOG
   ============================================================ */
console.info('✈️ TripKawan landing page loaded successfully!');
console.info(`🔗 API endpoint: ${API_BASE_URL}`);
