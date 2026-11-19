/**
 * ZD Christmas 2026 – RSVP backend
 *
 * Paste this into the Apps Script editor of the RSVP Google Sheet
 * (Extensions → Apps Script) and deploy it as a Web app.
 * See README.md for the step-by-step guide.
 */

const SHEET_NAME = 'Sheet1';
const HEADERS = [
  'Timestamp',
  'Name',
  'Email',
  'Department',
  'Attending',
  'Plus one',
  'Plus one name',
  'Dietary requirements',
  'Message',
  'Last updated',
];

/** Allowed values, so random POSTs can't write arbitrary data into the sheet. */
const ATTENDING_VALUES = ['Yes', 'No', 'Maybe'];
const MAX_LEN = 500;

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clean_(value) {
  let s = String(value == null ? '' : value).trim().slice(0, MAX_LEN);
  // Prevent formula injection when the sheet is opened / exported.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Headcount for the page ("23 colleagues are coming"). */
function doGet() {
  const sheet = getSheet_();
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues()
    : [];
  let attending = 0;
  rows.forEach(function (r) {
    if (r[4] === 'Yes') attending += 1 + (r[5] === 'Yes' ? 1 : 0);
  });
  return json_({ ok: true, attending: attending, responses: rows.length });
}

/**
 * Saves an RSVP. If the same email has already responded, that row is
 * updated instead of adding a duplicate, so people can change their answer.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Honeypot field – real users never fill it in.
    if (data.website) return json_({ ok: true });

    const name = clean_(data.name);
    const email = clean_(data.email).toLowerCase();
    const attending = clean_(data.attending);

    if (!name || !email) return json_({ ok: false, error: 'Name and email are required.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json_({ ok: false, error: 'Please enter a valid email.' });
    if (ATTENDING_VALUES.indexOf(attending) === -1) return json_({ ok: false, error: 'Please choose whether you are attending.' });

    const plusOne = attending !== 'No' && data.plusOne === true ? 'Yes' : 'No';
    const now = new Date();
    const sheet = getSheet_();

    const values = [
      now,
      name,
      email,
      clean_(data.department),
      attending,
      plusOne,
      plusOne === 'Yes' ? clean_(data.plusOneName) : '',
      attending !== 'No' ? clean_(data.dietary) : '',
      clean_(data.message),
      now,
    ];

    // Look for an existing response with this email.
    const last = sheet.getLastRow();
    let rowIndex = -1;
    if (last > 1) {
      const emails = sheet.getRange(2, 3, last - 1, 1).getValues();
      for (let i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).toLowerCase() === email) { rowIndex = i + 2; break; }
      }
    }

    if (rowIndex > 0) {
      values[0] = sheet.getRange(rowIndex, 1).getValue(); // keep original timestamp
      sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
      return json_({ ok: true, updated: true });
    }

    sheet.appendRow(values);
    return json_({ ok: true, updated: false });
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong. Please try again.' });
  } finally {
    lock.releaseLock();
  }
}
