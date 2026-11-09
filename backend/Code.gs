/**
 * IRONDAY accounts backend — Google Apps Script (free).
 *
 * Stores accounts in a Google Sheet ("IRONDAY Accounts") and each user's
 * workout data as one JSON file in a Drive folder ("IRONDAY Data"),
 * all inside the Google account that deploys this script.
 *
 * Deploy: Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.
 * Run `setup` once first. See SETUP.md.
 */

const CFG = {
  HASH_ROUNDS: 800,              // iterated, salted SHA-256
  SESSION_DAYS: 60,
  MAX_SIGNUPS_PER_DAY: 100,
  MAX_FAILED_LOGINS: 6,          // per email, per 15 minutes
  LOCKOUT_SECONDS: 15 * 60,
  MAX_STATE_BYTES: 1500000,      // ~1.5 MB per user
  DRIVE_FULL_RATIO: 0.85,        // stop saving when the owner's Drive is 85% full
};

/* ------------------------------------------------------------------ */
/* One-time setup                                                      */
/* ------------------------------------------------------------------ */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const sid = props.getProperty('SHEET_ID');
  if (sid) { try { ss = SpreadsheetApp.openById(sid); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('IRONDAY Accounts');
    props.setProperty('SHEET_ID', ss.getId());
  }
  ensureSheet_(ss, 'Users', ['email', 'name', 'salt', 'hash', 'created', 'fileId', 'lastLogin']);
  ensureSheet_(ss, 'Sessions', ['token', 'email', 'expires']);
  const def = ss.getSheetByName('Sheet1'); if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  let folder;
  const fid = props.getProperty('FOLDER_ID');
  if (fid) { try { folder = DriveApp.getFolderById(fid); } catch (e) { folder = null; } }
  if (!folder) {
    folder = DriveApp.createFolder('IRONDAY Data');
    props.setProperty('FOLDER_ID', folder.getId());
  }
  Logger.log('Sheet: ' + ss.getUrl());
  Logger.log('Folder: ' + folder.getUrl());
  return 'ok';
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}

/* ------------------------------------------------------------------ */
/* HTTP entry points                                                   */
/* ------------------------------------------------------------------ */
function doGet() {
  return json_({ ok: true, app: 'IRONDAY', msg: 'Accounts server is running.' });
}

function doPost(e) {
  let req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'Bad request.' }); }
  try {
    switch (req.action) {
      case 'ping':          return json_({ ok: true });
      case 'signup':        return json_(signup_(req));
      case 'login':         return json_(login_(req));
      case 'logout':        return json_(logout_(req));
      case 'load':          return json_(load_(req));
      case 'save':          return json_(save_(req));
      case 'deleteAccount': return json_(deleteAccount_(req));
      default:              return json_({ ok: false, error: 'Unknown action.' });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Server error. Please try again.' });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function db_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (!id) throw new Error('Run setup() first.');
  const ss = SpreadsheetApp.openById(id);
  return { users: ss.getSheetByName('Users'), sessions: ss.getSheetByName('Sessions'),
           folder: DriveApp.getFolderById(props.getProperty('FOLDER_ID')) };
}
function normEmail_(s) { return String(s || '').trim().toLowerCase(); }
function validEmail_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 120; }
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join(''); }
function hash_(password, salt) {
  let h = salt + ':' + password;
  for (let i = 0; i < CFG.HASH_ROUNDS; i++) {
    h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + ':' + salt, Utilities.Charset.UTF_8));
  }
  return h;
}
function safeEq_(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function findUser_(sh, email) {
  const n = sh.getLastRow(); if (n < 2) return null;
  const rows = sh.getRange(2, 1, n - 1, 7).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === email) {
      return { row: i + 2, email: rows[i][0], name: rows[i][1], salt: rows[i][2], hash: rows[i][3],
               created: rows[i][4], fileId: rows[i][5] };
    }
  }
  return null;
}
function newSession_(sh, email) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const exp = Date.now() + CFG.SESSION_DAYS * 864e5;
  sh.appendRow([token, email, exp]);
  return token;
}
function sessionEmail_(sh, token) {
  if (!token || typeof token !== 'string' || token.length < 40) return null;
  const n = sh.getLastRow(); if (n < 2) return null;
  const rows = sh.getRange(2, 1, n - 1, 3).getValues();
  const now = Date.now();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][0] === token) return rows[i][2] > now ? rows[i][1] : null;
  }
  return null;
}
function pruneSessions_(sh) {
  const n = sh.getLastRow(); if (n < 2) return;
  const rows = sh.getRange(2, 1, n - 1, 3).getValues(); const now = Date.now();
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i][2] <= now) sh.deleteRow(i + 2);
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'Server is busy. Please try again.' };
  try { return fn(); } finally { lock.releaseLock(); }
}
function readState_(fileId) {
  if (!fileId) return { state: null, updated: 0 };
  try {
    const o = JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString());
    return { state: o.state || null, updated: o.updated || 0 };
  } catch (e) { return { state: null, updated: 0 }; }
}
function driveAlmostFull_() {
  try {
    const limit = DriveApp.getStorageLimit(); const used = DriveApp.getStorageUsed();
    return limit > 0 && used / limit > CFG.DRIVE_FULL_RATIO;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */
function signup_(req) {
  const email = normEmail_(req.email);
  const name = String(req.name || '').trim().slice(0, 60);
  const password = String(req.password || '');
  if (!name) return { ok: false, error: 'Please enter your name.' };
  if (!validEmail_(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (password.length < 6 || password.length > 128) return { ok: false, error: 'Password must be at least 6 characters.' };
  if (req.consent !== true) return { ok: false, error: 'Please accept the privacy policy to create an account.' };

  const cache = CacheService.getScriptCache();
  const dayKey = 'signups_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd');
  const count = Number(cache.get(dayKey) || 0);
  if (count >= CFG.MAX_SIGNUPS_PER_DAY) return { ok: false, error: 'Too many new accounts today. Please try again tomorrow.' };
  if (driveAlmostFull_()) return { ok: false, error: 'Sign-ups are paused right now. Please try again later.' };

  return withLock_(function () {
    const d = db_();
    if (findUser_(d.users, email)) return { ok: false, error: 'An account with this email already exists. Try signing in.' };
    const salt = Utilities.getUuid();
    const hash = hash_(password, salt);
    let state = null, updated = 0;
    if (typeof req.state === 'string' && req.state.length <= CFG.MAX_STATE_BYTES) {
      try { state = JSON.parse(req.state); updated = Number(req.updated) || Date.now(); } catch (e) { state = null; }
    }
    const file = d.folder.createFile(Utilities.getUuid() + '.json',
      JSON.stringify({ email: email, state: state, updated: updated }), 'application/json');
    d.users.appendRow([email, name, salt, hash, new Date(), file.getId(), new Date()]);
    cache.put(dayKey, String(count + 1), 86400);
    pruneSessions_(d.sessions);
    const token = newSession_(d.sessions, email);
    return { ok: true, token: token, user: { email: email, name: name }, state: state, updated: updated };
  });
}

function login_(req) {
  const email = normEmail_(req.email);
  const password = String(req.password || '');
  if (!validEmail_(email) || !password) return { ok: false, error: 'Wrong email or password.' };
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + email;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= CFG.MAX_FAILED_LOGINS) return { ok: false, error: 'Too many attempts. Please wait 15 minutes and try again.' };

  const d = db_();
  const u = findUser_(d.users, email);
  if (!u || !safeEq_(hash_(password, u.salt), u.hash)) {
    cache.put(failKey, String(fails + 1), CFG.LOCKOUT_SECONDS);
    return { ok: false, error: 'Wrong email or password.' };
  }
  cache.remove(failKey);
  return withLock_(function () {
    d.users.getRange(u.row, 7).setValue(new Date());
    const token = newSession_(d.sessions, email);
    const s = readState_(u.fileId);
    return { ok: true, token: token, user: { email: email, name: u.name }, state: s.state, updated: s.updated };
  });
}

function logout_(req) {
  return withLock_(function () {
    const d = db_(); const n = d.sessions.getLastRow();
    if (n >= 2) {
      const rows = d.sessions.getRange(2, 1, n - 1, 1).getValues();
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i][0] === req.token) d.sessions.deleteRow(i + 2);
    }
    return { ok: true };
  });
}

function load_(req) {
  const d = db_();
  const email = sessionEmail_(d.sessions, req.token);
  if (!email) return { ok: false, error: 'Session expired. Please sign in again.', auth: false };
  const u = findUser_(d.users, email);
  if (!u) return { ok: false, error: 'Account not found.', auth: false };
  const s = readState_(u.fileId);
  return { ok: true, user: { email: email, name: u.name }, state: s.state, updated: s.updated };
}

function save_(req) {
  const d = db_();
  const email = sessionEmail_(d.sessions, req.token);
  if (!email) return { ok: false, error: 'Session expired. Please sign in again.', auth: false };
  if (typeof req.state !== 'string') return { ok: false, error: 'Nothing to save.' };
  if (req.state.length > CFG.MAX_STATE_BYTES) return { ok: false, error: 'Your data is too large to back up.' };
  let state; try { state = JSON.parse(req.state); } catch (e) { return { ok: false, error: 'Bad data.' }; }
  if (driveAlmostFull_()) return { ok: false, error: 'Cloud backup is full right now. Your data is still saved on this device.' };
  return withLock_(function () {
    const u = findUser_(d.users, email);
    if (!u) return { ok: false, error: 'Account not found.', auth: false };
    const updated = Number(req.updated) || Date.now();
    const body = JSON.stringify({ email: email, state: state, updated: updated });
    let fileId = u.fileId;
    try { DriveApp.getFileById(fileId).setContent(body); }
    catch (e) {
      fileId = d.folder.createFile(Utilities.getUuid() + '.json', body, 'application/json').getId();
      d.users.getRange(u.row, 6).setValue(fileId);
    }
    return { ok: true, updated: updated };
  });
}

function deleteAccount_(req) {
  const d = db_();
  const email = sessionEmail_(d.sessions, req.token);
  if (!email) return { ok: false, error: 'Session expired. Please sign in again.', auth: false };
  return withLock_(function () {
    const u = findUser_(d.users, email);
    if (!u) return { ok: false, error: 'Account not found.' };
    if (!safeEq_(hash_(String(req.password || ''), u.salt), u.hash)) return { ok: false, error: 'Wrong password.' };
    try { DriveApp.getFileById(u.fileId).setTrashed(true); } catch (e) {}
    d.users.deleteRow(u.row);
    const n = d.sessions.getLastRow();
    if (n >= 2) {
      const rows = d.sessions.getRange(2, 1, n - 1, 2).getValues();
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i][1] === email) d.sessions.deleteRow(i + 2);
    }
    return { ok: true };
  });
}
