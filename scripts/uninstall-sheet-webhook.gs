// Google Apps Script webhook for https://openinaiagent.com/uninstall/
//
// Setup (60 seconds, free, zero third-party SaaS):
// 1. Open https://docs.google.com/spreadsheets/d/100NW2YpxCKI39sFsWfNHjEJ6XLw8dJ2116w88QY18Zs/edit while signed into thomas.o.clegg@gmail.com.
// 2. Click Extensions -> Apps Script, replace Code.gs with this file, and press Save.
// 3. Click Deploy -> New deployment -> Select type: Web app.
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Click Deploy, copy the Web app URL (https://script.google.com/macros/s/.../exec),
//    and paste it into SHEET_WEBHOOK_URL in docs/uninstall/index.html.

const SHEET_NAME = 'Uninstalls';
const NOTIFY_EMAIL = true;
const MAX_PER_10_MIN = 15;
const MAX_MAIL_PER_DAY = 10;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

// Neutralises Google Sheets and CSV/Excel formula prefixes (=, +, -, @, leading tab/CR) and control nulls.
function safeCell(value, maxLen) {
  const s = String(value == null ? '' : value).replace(/\u0000/g, '').slice(0, maxLen);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function allowBurst() {
  try {
    const cache = CacheService.getScriptCache();
    const bucket = 'uninstall_burst_' + Math.floor(Date.now() / 600000);
    const count = Number(cache.get(bucket) || '0') + 1;
    cache.put(bucket, String(count), 660);
    return count <= MAX_PER_10_MIN;
  } catch (err) {
    return true;
  }
}

function allowDailyMail() {
  try {
    const cache = CacheService.getScriptCache();
    const dayKey = 'uninstall_mail_' + new Date().toISOString().slice(0, 10);
    const sent = Number(cache.get(dayKey) || '0') + 1;
    cache.put(dayKey, String(sent), 86400);
    return sent <= MAX_MAIL_PER_DAY;
  } catch (err) {
    return false;
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    if (raw.length > 16384) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Payload too large' })).setMimeType(ContentService.MimeType.JSON);
    }
    const data = JSON.parse(raw);
    if (data.website) {
      // Honeypot triggered: drop quietly.
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (!allowBurst()) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Rate limit exceeded' })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['Timestamp (UTC)', 'Version', 'Browser', 'Reasons', 'Comment', 'Follow-up Email']);
      sheet.setFrozenRows(1);
    }

    const rawEmail = String(data.email || '').trim().slice(0, 254);
    const validEmail = EMAIL_RE.test(rawEmail) ? rawEmail : '';
    const reasonsStr = Array.isArray(data.reasons)
      ? data.reasons.map((r) => String(r || '').replace(/[^a-z0-9-]/gi, '').slice(0, 32)).filter(Boolean).slice(0, 10).join(', ')
      : '';

    const row = [
      safeCell(data.timestamp || new Date().toISOString(), 40),
      safeCell(data.version || '', 24),
      safeCell(data.browser || '', 40),
      safeCell(reasonsStr, 200),
      safeCell(data.comment || '', 2000),
      safeCell(validEmail, 254),
    ];
    sheet.appendRow(row);

    if (NOTIFY_EMAIL && (reasonsStr || data.comment) && allowDailyMail()) {
      const owner = Session.getEffectiveUser().getEmail();
      if (owner) {
        const opts = {
          to: owner,
          subject: '[Open in AI Agent] Uninstall feedback (' + String(data.version || 'unknown').slice(0, 24) + ')',
          body:
            'Reasons: ' + (reasonsStr || 'none selected') + '\n' +
            'Version: ' + String(data.version || 'unknown').slice(0, 24) + ' (' + String(data.browser || 'unknown').slice(0, 40) + ')\n' +
            (validEmail ? 'Reply email: ' + validEmail + '\n' : '') +
            '\nComment:\n' + String(data.comment || '(no comment)').slice(0, 2000),
        };
        if (validEmail) opts.replyTo = validEmail;
        MailApp.sendEmail(opts);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Invalid request' }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
