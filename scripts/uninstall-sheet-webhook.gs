// Google Apps Script webhook for https://openinaiagent.com/uninstall/
//
// Setup (60 seconds, free, zero third-party SaaS):
// 1. Open https://sheets.new while signed into thomas.o.clegg@gmail.com and name it "Open in AI Agent - Uninstall Feedback".
// 2. Click Extensions -> Apps Script, replace Code.gs with this file, and press Save.
// 3. Click Deploy -> New deployment -> Select type: Web app.
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Click Deploy, copy the Web app URL (https://script.google.com/macros/s/.../exec),
//    and paste it into SHEET_WEBHOOK_URL in docs/uninstall/index.html.

const SHEET_NAME = 'Uninstalls';
const NOTIFY_EMAIL = true;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['Timestamp (UTC)', 'Version', 'Browser', 'Reasons', 'Comment', 'Follow-up Email']);
      sheet.setFrozenRows(1);
    }

    const row = [
      String(data.timestamp || new Date().toISOString()).slice(0, 40),
      String(data.version || '').slice(0, 24),
      String(data.browser || '').slice(0, 120),
      Array.isArray(data.reasons) ? data.reasons.join(', ').slice(0, 200) : '',
      String(data.comment || '').slice(0, 2000),
      String(data.email || '').slice(0, 254),
    ];
    sheet.appendRow(row);

    if (NOTIFY_EMAIL && (row[3] || row[4])) {
      const owner = Session.getEffectiveUser().getEmail();
      if (owner) {
        MailApp.sendEmail({
          to: owner,
          subject: '[Open in AI Agent] Uninstall feedback (' + (row[1] || 'unknown') + ')',
          body:
            'Reasons: ' + (row[3] || 'none selected') + '\n' +
            'Version: ' + row[1] + ' (' + row[2] + ')\n' +
            (row[5] ? 'Reply email: ' + row[5] + '\n' : '') +
            '\nComment:\n' + (row[4] || '(no comment)'),
          replyTo: row[5] || owner,
        });
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
