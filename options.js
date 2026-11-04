// Settings and first-run page. Saves as you go; content.js and background.js
// pick changes up through chrome.storage.onChanged.
const $ = (id) => document.getElementById(id);
const DESKTOP_IDS = TARGETS.filter((t) => t.kind === 'app').map((t) => t.id);

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
  $('empty').hidden = pickTargets([...chosen]).length > 0;
  $('folder-step').hidden = !DESKTOP_IDS.some((id) => chosen.has(id));
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
});

chrome.storage.sync.get({ targets: DEFAULT_TARGETS, folder: '' }, (s) => {
  savedFolder = s.folder;
  $('folder').value = s.folder;
  $('tiles').replaceChildren(...GROUPS.map(group));
  showTargets(s.targets);
});
// Opened by background.js after a menu click in a Gmail tab that needs a reload.
$('reload-notice').hidden = location.hash !== '#reload';
// Opened by background.js for upgrades from 1.0.
$('new-notice').hidden = location.hash !== '#new';
$('try-line').replaceChildren(
  ...withKeys(`Right-click any email and pick your AI. Web AIs open with the thread copied: press ${PASTE_KEYS}, then Enter.`),
);
showDonation();
