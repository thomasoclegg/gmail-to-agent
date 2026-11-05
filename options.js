// Settings and first-run page. Saves as you go; content.js and background.js
// pick changes up through chrome.storage.onChanged. Also shows the keyboard
// shortcuts the browser assigned, and runs the Gmail self-check.
const $ = (id) => document.getElementById(id);
const DESKTOP_IDS = TARGETS.filter((t) => t.kind === 'app').map((t) => t.id);
const WEB_IDS = TARGETS.filter((t) => t.kind !== 'app').map((t) => t.id);

let chosen = new Set();
let savedFolder = '';
let folderTimer = 0;
let pendingWrites = 0;
let staleTargets = false;
const savedTimers = new Map();

function flash(el, text, ms = 1600) {
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(savedTimers.get(el));
  savedTimers.set(
    el,
    setTimeout(() => {
      el.classList.remove('show');
      el.textContent = '';
    }, ms),
  );
}
const flashSaved = (el) => flash(el, 'Saved');
const flashFailed = (el) => flash(el, 'Not saved, try again', 4000);

function updateSteps() {
  const desktop = DESKTOP_IDS.some((id) => chosen.has(id));
  const web = WEB_IDS.some((id) => chosen.has(id));
  $('empty').hidden = pickTargets([...chosen]).length > 0;
  $('folder-step').hidden = !desktop;
  // Your own instructions: a box for each group that has an AI picked; text in a hidden box is kept and still used.
  $('own-desktop-box').hidden = !desktop;
  $('own-web-box').hidden = !web;
  $('own').hidden = !desktop && !web;
}

function showTargets(targets) {
  chosen = new Set(Array.isArray(targets) ? targets : DEFAULT_TARGETS);
  document.querySelectorAll('#tiles .tile').forEach((b) => b.setAttribute('aria-pressed', String(chosen.has(b.dataset.id))));
  updateSteps();
}

// Shows what is stored, once this page has no writes in flight.
function reloadTargets() {
  if (pendingWrites) return void (staleTargets = true);
  staleTargets = false;
  chrome.storage.sync.get({ targets: DEFAULT_TARGETS }, (s) => {
    if (pendingWrites) staleTargets = true;
    else showTargets(s.targets);
  });
}

// TARGETS order; ids this version does not know (synced from a newer one) are kept.
const targetsToSave = () => [
  ...pickTargets([...chosen]).map((t) => t.id),
  ...[...chosen].filter((id) => !targetById(id)),
];

function toggle(id, button) {
  if (chosen.has(id)) chosen.delete(id);
  else chosen.add(id);
  button.setAttribute('aria-pressed', String(chosen.has(id)));
  updateSteps();
  pendingWrites++;
  chrome.storage.sync.set({ targets: targetsToSave() }, () => {
    pendingWrites--;
    const failed = chrome.runtime.lastError;
    if (failed) staleTargets = true;
    if (staleTargets) reloadTargets();
    if (failed) flashFailed($('pick-saved'));
    else flashSaved($('pick-saved'));
  });
}

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}
const span = (className, text) => element('span', className, text);

// "Cmd+V" becomes keycaps (the "+" stays in the text for screen readers); so does "Enter".
function keycap(text) {
  if (text === 'Enter') return element('kbd', '', text);
  const [mod, key] = text.split('+');
  const combo = element('kbd', 'combo');
  combo.append(element('kbd', '', mod), span('plus', '+'), element('kbd', '', key));
  return combo;
}

// A keycap stays on one line with the word before it and the punctuation after it.
function keyGroup(part) {
  const [, before, key, after] = part.match(/^(.*?)\b((?:Cmd|Ctrl)\+V|Enter)\b(.*)$/);
  const group = span('nw');
  group.append(before, keycap(key), after);
  return group;
}

function withKeys(text) {
  return text
    .split(/((?:\S+ )?\b(?:(?:Cmd|Ctrl)\+V|Enter)\b\S*)/)
    .map((part, i) => (i % 2 ? keyGroup(part) : document.createTextNode(part)))
    .filter((node) => node.textContent);
}

function tile(target, groupNote) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tile';
  button.dataset.id = target.id;
  button.setAttribute('aria-pressed', String(chosen.has(target.id)));
  const tick = span('tick');
  tick.setAttribute('aria-hidden', 'true');
  const name = span('name', target.name);
  const note = span(target.kind === 'web' ? 'note dom' : 'note', target.note);
  name.id = `tile-${target.id}-name`;
  note.id = `tile-${target.id}-note`;
  button.setAttribute('aria-labelledby', name.id);
  button.setAttribute('aria-describedby', groupNote ? `${note.id} ${groupNote.id}` : note.id);
  button.append(tick, name, note);
  button.addEventListener('click', () => toggle(target.id, button));
  return button;
}

// The tiles in three groups, in TARGETS order. Web AIs share one note with the paste keys.
const GROUPS = [
  { kind: 'app', label: 'On your desktop' },
  {
    kind: 'web',
    label: 'In the browser',
    note: `Each opens in a new tab next to Gmail with the thread copied. Press ${PASTE_KEYS}, then Enter.`,
  },
  { kind: 'copy', label: 'Anywhere' },
];

function group({ kind, label, note }) {
  const box = element('div', `group ${kind}`);
  box.setAttribute('role', 'group');
  const title = element('p', 'group-label', label);
  title.id = `group-${kind}`;
  box.setAttribute('aria-labelledby', title.id);
  box.append(title);
  let noteEl = null;
  if (note) {
    noteEl = element('p', 'group-note');
    noteEl.id = `group-${kind}-note`;
    noteEl.append(...withKeys(note));
    box.append(noteEl);
  }
  const rows = element('div', 'rows');
  rows.append(...TARGETS.filter((t) => t.kind === kind).map((t) => tile(t, noteEl)));
  box.append(rows);
  return box;
}

// Strips quotes, and the backslash escapes Terminal adds when a folder is dragged in.
function cleanFolder(value) {
  let folder = value.trim().replace(/^['"]|['"]$/g, '').trim();
  if (folder.startsWith('/')) folder = folder.replace(/\\(.)/g, '$1');
  return folder;
}

function saveFolder() {
  clearTimeout(folderTimer);
  const folder = cleanFolder($('folder').value);
  if (folder === savedFolder) return;
  const previous = savedFolder;
  savedFolder = folder;
  chrome.storage.sync.set({ folder }, () => {
    if (!chrome.runtime.lastError) return flashSaved($('folder-saved'));
    if (savedFolder === folder) savedFolder = previous; // so the next edit tries again
    flashFailed($('folder-saved'));
  });
}

// ---- Your own instructions ----

// One box per group in OWN (targets.js): 'desktop' for Claude Code and Codex, 'web' for the web AIs and Copy.
// What is saved is what the prompts use: ownInstructions (targets.js) drops what a reader cannot see and caps it.
// saved: the text stored now. refused: the cleaned text storage.sync would not take, with fit, about how many
// characters of it would (0 when unknown); '' when none was refused. pending: a change made elsewhere while the box had focus,
// shown once the box is left without an edit. undo: the text the reset cleared, while its Undo shows. cut: how
// many characters the last paste lost at the cap.
const ownBoxes = Object.entries(OWN).map(([group, { key, max }]) => ({
  group,
  key,
  max,
  saved: '',
  refused: '',
  fit: 0,
  pending: undefined,
  undo: null,
  undoTimer: 0,
  cut: 0,
  pasting: false,
  atCap: false,
  timer: 0,
  field: $(`own-${group}`),
  count: $(`own-${group}-count`),
  reset: $(`own-${group}-reset`),
  undoButton: $(`own-${group}-undo`),
}));
const thousands = (n) => n.toLocaleString('en-GB');
const UNDO_MS = 10000;

// storage.sync refuses an item over 8,192 bytes, counted as its key plus its value as JSON in UTF-8. Chromium's
// JSON writer also escapes "<" (and the line and paragraph separators, which the cleaning turns into newlines) as
// six-character \u escapes, so they count six bytes each here. 4,000 characters fit in most alphabets, but not in
// every one (a CJK character takes 3 bytes).
const SYNC_ITEM_BYTES = globalThis.chrome?.storage?.sync?.QUOTA_BYTES_PER_ITEM || 8192;
const syncBytes = (key, value) => new TextEncoder().encode(key + JSON.stringify(value).replace(/[<\u2028\u2029]/g, '\\u003C')).length;
const fitsSync = (key, value) => syncBytes(key, value) <= SYNC_ITEM_BYTES;
const QUOTA_ITEM = /QUOTA_BYTES_PER_ITEM|QuotaBytesPerItem/i;

// About how many characters of text storage.sync would take, for the message when it refuses the whole.
function syncFit(key, text) {
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fitsSync(key, text.slice(0, mid))) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Whether the box's text, as the prompts would use it, still stands refused: the very text the browser refused, or
// text that is still too long by this page's count and not what is saved.
function stillRefused(box, text) {
  if (!box.refused) return false;
  return text === box.refused || (text !== box.saved && !fitsSync(box.key, text));
}

// The line under a box: the count, or while it stands, why the text was not saved or what a paste lost. The box is
// marked invalid while its text is refused, and the line, which describes the box, says so.
function showOwn(box) {
  const n = box.field.value.length;
  const full = n >= box.max;
  const refused = stillRefused(box, ownInstructions(box.field.value, box.max));
  if (!refused) box.refused = '';
  let line = `${thousands(n)} of ${thousands(box.max)} characters${full ? ', the most it holds' : ''}`;
  if (refused) {
    const shorten = box.fit ? `shorten it to about ${thousands(box.fit)} characters` : 'shorten it a little';
    const still = box.saved ? 'Your previous instructions are still in use.' : 'The built-in instructions are still in use.';
    line = `Not saved, too long to sync: ${shorten}. ${still}`;
  } else if (box.cut) {
    line = `Cut to ${thousands(box.max)} characters: the last ${thousands(box.cut)} you pasted were not kept.`;
  }
  box.count.textContent = line;
  box.count.classList.toggle('full', full || refused || !!box.cut);
  if (refused) box.field.setAttribute('aria-invalid', 'true');
  else box.field.removeAttribute('aria-invalid');
  box.reset.hidden = (!box.field.value.trim() && !box.saved) || !box.undoButton.hidden;
  // Reaching the cap is said once, as the count line is not read out by itself.
  if (full && !box.atCap) flash($('own-saved'), `${thousands(box.max)} characters, the most it holds`, 4000);
  box.atCap = full;
}

// Refuses text storage.sync will not take: the line under the box says so until the text fits, and "Not saved" is
// said once. fit: about how many characters would fit, or 0 when the browser's count, not this page's, refused it.
function refuse(box, text, fit) {
  if (!box.refused) flash($('own-saved'), 'Not saved', 4000);
  box.refused = text;
  box.fit = fit;
  showOwn(box);
}

// Saves the box's text as the prompts will use it. False when it was not saved because it is too long to sync,
// so the box keeps what was typed.
function saveOwn(box) {
  clearTimeout(box.timer);
  box.timer = 0;
  const text = ownInstructions(box.field.value, box.max);
  if (text === box.saved) {
    box.refused = '';
    showOwn(box);
    return true;
  }
  if (!fitsSync(box.key, text)) {
    refuse(box, text, syncFit(box.key, text));
    return false;
  }
  const previous = box.saved;
  box.saved = text;
  box.refused = '';
  box.pending = undefined; // what is saved here now wins over a change from elsewhere not yet shown
  chrome.storage.sync.set({ [box.key]: text }, () => {
    const error = chrome.runtime.lastError;
    if (!error) return flashSaved($('own-saved'));
    if (box.saved === text) box.saved = previous; // so the next edit tries again
    // The browser's own count can differ from this page's; a refusal for size is said as one, not as "try again".
    if (QUOTA_ITEM.test(error.message || '')) return refuse(box, text, 0);
    flashFailed($('own-saved'));
    showOwn(box);
  });
  showOwn(box);
  return true;
}

function showSavedOwn(box, value) {
  box.saved = ownInstructions(value, box.max);
  box.refused = '';
  box.cut = 0;
  box.field.value = box.saved;
  showOwn(box);
}

// The Undo after a reset: it shows in the reset's place for a while, and puts the cleared text back.
function hideUndo(box) {
  clearTimeout(box.undoTimer);
  const focused = document.activeElement === box.undoButton;
  box.undoButton.hidden = true;
  box.undo = null;
  showOwn(box);
  if (focused) box.field.focus();
}

for (const box of ownBoxes) {
  box.field.maxLength = box.max;
  box.field.addEventListener('input', () => {
    if (!box.pasting) box.cut = 0;
    if (box.undo !== null) hideUndo(box);
    showOwn(box);
    clearTimeout(box.timer);
    box.timer = setTimeout(() => saveOwn(box), 800);
  });
  // A paste that will not fit is cut at the cap; the line under the box says how much was lost.
  box.field.addEventListener('paste', (e) => {
    const pasted = e.clipboardData?.getData('text/plain') ?? '';
    const { selectionStart: a, selectionEnd: b, value } = box.field;
    const room = Math.max(0, box.max - (value.length - (b - a)));
    box.cut = pasted.length > room ? pasted.length - room : 0;
    box.pasting = true;
    setTimeout(() => {
      box.pasting = false;
      showOwn(box);
    });
  });
  // Leaving the box saves at once and shows the text as the prompts will use it.
  box.field.addEventListener('change', () => {
    if (saveOwn(box)) box.field.value = box.saved;
    showOwn(box);
  });
  // A change made elsewhere while the box had focus shows once it is left, unless the box holds an edit of its own.
  box.field.addEventListener('blur', () => {
    if (box.pending === undefined) return;
    const pending = box.pending;
    box.pending = undefined;
    if (ownInstructions(box.field.value, box.max) === box.saved) showSavedOwn(box, pending);
  });
  // Back to the built-in instructions, with an Undo in the reset's place for a while, which takes focus.
  box.reset.addEventListener('click', () => {
    const before = box.field.value;
    box.field.value = '';
    box.cut = 0;
    saveOwn(box);
    box.undo = before;
    box.undoButton.hidden = false;
    showOwn(box);
    box.undoButton.focus();
    clearTimeout(box.undoTimer);
    box.undoTimer = setTimeout(() => hideUndo(box), UNDO_MS);
  });
  box.undoButton.addEventListener('click', () => {
    const text = box.undo ?? '';
    hideUndo(box);
    box.field.value = text;
    saveOwn(box);
    box.field.value = box.refused ? text : box.saved;
    showOwn(box);
    box.field.focus();
  });
}

// An edit still waiting for its pause is saved before the page goes, or is hidden, so closing the tab loses nothing.
function flushEdits() {
  for (const box of ownBoxes) if (box.timer) saveOwn(box);
  if (folderTimer) saveFolder();
}
addEventListener('pagehide', flushEdits);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushEdits();
});

// ---- Gmail's toolbar button ----

let savedToolbar = true;
const showToolbarSetting = (on) => $('toolbar-tile').setAttribute('aria-pressed', String(on !== false));

$('toolbar-tile').addEventListener('click', () => {
  const on = $('toolbar-tile').getAttribute('aria-pressed') !== 'true';
  showToolbarSetting(on);
  chrome.storage.sync.set({ toolbarButton: on }, () => {
    if (!chrome.runtime.lastError) {
      savedToolbar = on;
      return flashSaved($('toolbar-saved'));
    }
    showToolbarSetting(savedToolbar);
    flashFailed($('toolbar-saved'));
  });
});

// ---- Keyboard shortcuts ----

const SHORTCUTS = [
  { name: '_execute_action', label: 'Open the list of your AIs' },
  { name: 'send-to-last', label: 'Send to the AI you used last' },
];

// "Alt+Shift+O" as keycaps; Chrome on a Mac gives symbols with no "+" ("⌃⇧O"), which stay as one key.
function shortcutKeys(shortcut) {
  const box = span('nw');
  keyLabel(shortcut).split('+').forEach((key, i) => {
    if (i) box.append(span('plus', '+'));
    box.append(element('kbd', '', key));
  });
  return box;
}

// Where this browser lets you change an extension's keys: Firefox opens its own page; Chromium browsers
// take their extensions page's shortcuts view. Null where there is none to open (Safari).
function shortcutsPage() {
  if (typeof chrome.commands?.openShortcutSettings === 'function') return () => chrome.commands.openShortcutSettings();
  const ua = navigator.userAgent || '';
  if (!/Chrome\//.test(ua) || /Firefox\//.test(ua)) return null;
  const url = /Edg\//.test(ua) ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';
  return () => chrome.tabs.create({ url });
}

async function showShortcuts() {
  const commands = await Promise.resolve(chrome.commands?.getAll?.()).catch(() => null);
  if (!Array.isArray(commands)) return;
  $('shortcuts').replaceChildren(
    ...SHORTCUTS.flatMap(({ name, label }) => {
      const key = commands.find((c) => c.name === name)?.shortcut;
      const dd = element('dd', key ? '' : 'unset');
      dd.append(key ? shortcutKeys(key) : 'Not set');
      return [element('dt', '', label), dd];
    }),
  );
  $('shortcuts').hidden = false;
  const open = shortcutsPage();
  $('shortcuts-hint').hidden = !open;
  if (open) $('shortcuts-change').onclick = () => open();
}

// Where this browser keeps the extension's icon at first, and how to pin it there.
function pinHint() {
  const ua = navigator.userAgent || '';
  const pin = $('pin-hint');
  const lead = pin.querySelector('b');
  const lists = ' Its icon lists your AIs.';
  if (/Firefox\//.test(ua)) {
    pin.replaceChildren(lead, ' click the Extensions button (the puzzle piece) in the toolbar, then the gear next to Open in AI Agent and Pin to Toolbar.' + lists);
  } else if (/Edg\//.test(ua)) {
    pin.replaceChildren(lead, ' click the Extensions button (the puzzle piece) next to the address bar, then the eye next to Open in AI Agent.' + lists);
  } else if (!/Chrome\//.test(ua) && /Safari\//.test(ua)) {
    pin.replaceChildren('The extension\'s icon in Safari\'s toolbar lists your AIs.');
  }
}

// ---- Check Gmail and Report a problem ----

const REPO_ISSUES = 'https://github.com/thomasoclegg/gmail-to-agent/issues/new';

// "Google Chrome 156 on macOS", from the browser's own report of itself.
function browserName() {
  const ua = navigator.userAgent || '';
  const brand = navigator.userAgentData?.brands?.find((b) => !/Not.?A.?Brand|Chromium/i.test(b.brand));
  const m = ua.match(/(Firefox|Edg|OPR)\/(\d+)/) || ua.match(/(Chrome)\/(\d+)/) || ua.match(/Version\/(\d+)[\d.]* .*(Safari)/);
  const name = brand
    ? `${brand.brand} ${brand.version}`
    : m
      ? m[2] === 'Safari'
        ? `Safari ${m[1]}`
        : `${{ Edg: 'Microsoft Edge', OPR: 'Opera' }[m[1]] || m[1]} ${m[2]}`
      : 'unknown browser';
  // navigator.platform says "MacIntel", "Win32" or "Linux x86_64"; userAgentData already says "macOS".
  const raw = navigator.userAgentData?.platform || navigator.platform || '';
  const platform = /^Mac/i.test(raw) ? 'macOS' : /^Win/i.test(raw) ? 'Windows' : /^Linux/i.test(raw) ? 'Linux' : raw;
  return platform ? `${name} on ${platform}` : name;
}

// The Gmail tab to ask: the one in front, else the one used last.
function gmailTabToCheck(tabs) {
  return tabs.find((t) => t.active) || [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
}

const RELOAD_AND_CHECK = 'Something is missing: reload the Gmail tab, then check again.';

// Plain answers from the content script's counts and yes or no; nothing from the page itself. The first
// line is the verdict. Rows are counted in the list only: with an email open, Gmail hides them.
function checkLines(found, answer) {
  if (!found) return ['Gmail tab: none open. Open Gmail, then check again.'];
  if (!answer?.ok) return [RELOAD_AND_CHECK, 'Gmail tab: found.', 'The extension in that tab: not running. Reload the Gmail tab, then check again.'];
  const toolbar = !answer.toolbar
    ? "not found, so the extension's button cannot show there"
    : !answer.buttonOn
      ? 'found (the button is turned off here)'
      : answer.button
        ? 'found, with the button in it'
        : 'found, but the button is not in it yet. Reload the Gmail tab, then check again';
  const missing = !answer.toolbar || (answer.buttonOn && !answer.button);
  const verdict = missing
    ? RELOAD_AND_CHECK
    : answer.menu
      ? 'Everything the extension needs is there.'
      : "Nothing is missing so far. Right-click an email in Gmail, then check again to include Gmail's menu.";
  return [
    verdict,
    'Gmail tab: found.',
    'The extension in that tab: running.',
    `Email rows in the list: ${answer.thread ? 'not checked while an email is open' : answer.rows ? `${answer.rows} found` : 'none found'}.`,
    `Open email: ${answer.thread ? 'found' : 'none open'}.`,
    `Gmail's right-click menu: ${answer.menu ? 'found' : 'not seen yet. Right-click an email in Gmail, then check again'}.`,
    `Gmail's toolbar: ${toolbar}.`,
  ];
}

// A new GitHub issue with the version, the browser and the check's answers. Never email text or the mailbox.
function setReportLink(lines) {
  const version = chrome.runtime.getManifest?.()?.version || 'unknown';
  const body = [
    'What happened:',
    '',
    '',
    'What I expected:',
    '',
    '',
    '---',
    `Version: ${version}`,
    `Browser: ${browserName()}`,
    'Check Gmail:',
    ...(lines.length ? lines.map((l) => `- ${l}`) : ['- not run']),
  ].join('\n');
  $('report').href = `${REPO_ISSUES}?${new URLSearchParams({ title: 'Problem: ', body })}`;
}

// The button stays focusable while it checks (aria-disabled, not disabled, which would drop keyboard focus);
// a status line says when the answers are there.
let checking = false;
async function checkGmail() {
  if (checking) return;
  checking = true;
  $('check-gmail').setAttribute('aria-disabled', 'true');
  $('check-status').textContent = '';
  const tabs = await Promise.resolve(chrome.tabs?.query?.({ url: 'https://mail.google.com/*' })).catch(() => []);
  const tab = gmailTabToCheck(Array.isArray(tabs) ? tabs : []);
  let answer = null;
  if (tab) {
    answer = await Promise.resolve(chrome.tabs.sendMessage(tab.id, { target: 'content', action: 'check' }, { frameId: 0 })).catch(() => null);
  }
  const lines = checkLines(!!tab, answer);
  $('check-results').replaceChildren(...lines.map((l, i) => element('li', i === 0 && lines.length > 1 ? 'verdict' : '', l)));
  $('check-results').hidden = false;
  setReportLink(lines);
  $('check-status').textContent = `Checked: ${lines.length} ${lines.length === 1 ? 'answer' : 'answers'} below.`;
  $('check-gmail').removeAttribute('aria-disabled');
  checking = false;
}

$('check-gmail').addEventListener('click', checkGmail);

function showDonation() {
  if (!hasDonation() || !/^https:\/\//.test(DONATION.url)) return;
  const about = DONATION.about ? `, ${DONATION.about}` : '';
  $('donate-text').textContent = `It's free. If it saves you time, please give something to ${DONATION.charity}${about}.`;
  $('donate-link').href = DONATION.url;
  $('donate-link').textContent = `Donate to ${DONATION.charity}`;
  $('donate').hidden = false;
}

$('folder').addEventListener('input', () => {
  clearTimeout(folderTimer);
  folderTimer = setTimeout(saveFolder, 500);
});
$('folder').addEventListener('change', () => {
  saveFolder();
  $('folder').value = savedFolder;
});

// Changes made in another tab or synced from another device.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.targets) {
    if (pendingWrites) staleTargets = true;
    else showTargets(changes.targets.newValue);
  }
  if (changes.folder && document.activeElement !== $('folder')) {
    savedFolder = changes.folder.newValue || '';
    $('folder').value = savedFolder;
  }
  if (changes.toolbarButton) {
    savedToolbar = changes.toolbarButton.newValue !== false;
    showToolbarSetting(savedToolbar);
  }
  // A change from elsewhere shows at once, or once the box is left if it has focus (see the blur listener).
  for (const box of ownBoxes) {
    if (!changes[box.key]) continue;
    const value = changes[box.key].newValue ?? '';
    if (ownInstructions(value, box.max) === box.saved) continue; // this page's own write coming back
    if (document.activeElement === box.field) box.pending = value;
    else showSavedOwn(box, value);
  }
});

const OWN_DEFAULTS = Object.fromEntries(ownBoxes.map((b) => [b.key, '']));
chrome.storage.sync.get({ targets: DEFAULT_TARGETS, folder: '', toolbarButton: true, ...OWN_DEFAULTS }, (s) => {
  savedFolder = s.folder;
  $('folder').value = s.folder;
  savedToolbar = s.toolbarButton !== false;
  showToolbarSetting(savedToolbar);
  for (const box of ownBoxes) showSavedOwn(box, s[box.key]);
  $('tiles').replaceChildren(...GROUPS.map(group));
  showTargets(s.targets);
});
showShortcuts();
pinHint();
setReportLink([]);
// Opened by background.js after a menu click in a Gmail tab that needs a reload.
$('reload-notice').hidden = location.hash !== '#reload';
// Opened by background.js for upgrades from 1.0.
$('new-notice').hidden = location.hash !== '#new';
$('try-line').replaceChildren(
  ...withKeys(`Right-click any email and pick your AI. Web AIs open with the thread copied: press ${PASTE_KEYS}, then Enter.`),
);
showDonation();
