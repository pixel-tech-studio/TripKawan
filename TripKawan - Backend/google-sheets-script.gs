/**
 * TripKawan — Google Apps Script
 * ================================
 * Receives feedback form submissions, saves them to this Google Sheet,
 * and sends a confirmation email to the submitter (if an email was provided).
 *
 * HOW TO DEPLOY:
 *  1. Open your Google Sheet
 *  2. Click Extensions → Apps Script
 *  3. Delete any existing code and paste this entire file
 *  4. Click Save (floppy disk icon)
 *  5. Click Deploy → New deployment
 *  6. Type: Web app
 *  7. Execute as: Me
 *  8. Who has access: Anyone
 *  9. Click Deploy → Authorise access → Allow
 *     (Grant both Sheets and Gmail/Mail permissions when prompted)
 * 10. Copy the Web app URL and paste it into js/main.js as GOOGLE_SCRIPT_URL
 */

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data  = JSON.parse(e.postData.contents);

    // Write column headers on the very first submission
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'Name',
        'Email',
        'Travels in Groups?',
        'Tools Currently Used',
        'Other Tools',
        'Biggest Pain Point',
        'Most Wanted Feature',
        'Likelihood to Use TripKawan',
        'Feature They Wish Existed',
      ]);

      // Bold the header row
      sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    }

    sheet.appendRow([
      data.timestamp    || new Date().toISOString(),
      data.name         || '',
      data.email        || '',
      data.group_travel || '',
      Array.isArray(data.tools) ? data.tools.join(', ') : (data.tools || ''),
      data.tools_other  || '',
      data.pain_point   || '',
      data.feature      || '',
      data.likelihood   || '',
      data.wish_feature || '',
    ]);

    // Send confirmation email — best-effort, won't break the sheet save if it fails
    if (data.email) {
      sendConfirmationEmail(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Feedback received!' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Sends a thank-you confirmation email to the feedback submitter.
 * Wrapped in its own try/catch so a mail failure doesn't affect the sheet save.
 * @param {Object} data - The parsed form submission data
 */
function sendConfirmationEmail(data) {
  try {
    const firstName = data.name ? data.name.split(' ')[0] : 'there';
    const subject   = 'Thanks for shaping TripKawan! ✈️';

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#333;">
        <div style="background:#1a73e8;padding:24px 32px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:22px;">TripKawan</h1>
        </div>
        <div style="padding:32px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
          <p style="font-size:16px;">Hey ${firstName},</p>
          <p>Thanks so much for taking the time to fill out our survey — your feedback means a lot and will directly shape what we build.</p>
          <p>We're working hard to make group trip planning less stressful, and people like you are the reason we're building TripKawan.</p>
          <p>We'll keep you in the loop as things progress. In the meantime, if you have friends who travel in groups, feel free to share the survey with them!</p>
          <p style="margin-top:32px;">Cheers,<br><strong>The TripKawan Team</strong></p>
        </div>
        <p style="font-size:11px;color:#999;text-align:center;margin-top:16px;">
          You're receiving this because you submitted feedback at tripkawan.vercel.app.
        </p>
      </div>
    `;

    const plainBody =
      `Hey ${firstName},\n\n` +
      `Thanks so much for taking the time to fill out our survey — your feedback means a lot and will directly shape what we build.\n\n` +
      `We're working hard to make group trip planning less stressful, and people like you are the reason we're building TripKawan.\n\n` +
      `We'll keep you in the loop as things progress.\n\n` +
      `Cheers,\nThe TripKawan Team`;

    MailApp.sendEmail({
      to:       data.email,
      subject:  subject,
      body:     plainBody,
      htmlBody: htmlBody,
    });

  } catch (mailErr) {
    // Log the error but don't re-throw — the sheet save already succeeded
    console.error('TripKawan: confirmation email failed —', mailErr.message);
  }
}

/** Optional: health check — visit the web app URL in browser to confirm it's live */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', service: 'TripKawan Sheets API' }))
    .setMimeType(ContentService.MimeType.JSON);
}
