/**
 * TripKawan — Google Apps Script
 * ================================
 * Receives feedback form submissions and saves them to this Google Sheet.
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

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Feedback received!' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Optional: health check — visit the web app URL in browser to confirm it's live */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', service: 'TripKawan Sheets API' }))
    .setMimeType(ContentService.MimeType.JSON);
}
