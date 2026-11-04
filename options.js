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

function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  if (text) el.textContent = text;
  return el;
}

function tile(target) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tile';
  button.dataset.id = target.id;
  button.setAttribute('aria-pressed', String(chosen.has(target.id)));
  const tick = span('tick');
  tick.setAttribute('aria-hidden', 'true');
  const name = span('name', target.name);
  const note = span('note', target.note);
  name.id = `tile-${target.id}-name`;
  note.id = `tile-${target.id}-note`;
  button.setAttribute('aria-labelledby', name.id);
  button.setAttribute('aria-describedby', note.id);
  button.append(tick, name, note);
  button.addEventListener('click', () => toggle(target.id, button));
  return button;
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
  $('donate-text').textContent = `Free forever. If it saves you time, please give to ${DONATION.charity}.`;
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
  $('tiles').replaceChildren(...TARGETS.map(tile));
  showTargets(s.targets);
});
// Opened by background.js after a menu click in a Gmail tab that needs a reload.
$('reload-notice').hidden = location.hash !== '#reload';
// Opened by background.js for upgrades from 1.0.
$('new-notice').hidden = location.hash !== '#new';
$('try-line').textContent =
  `Right-click any email and pick your AI. Web AIs open with the email copied: press ${PASTE_KEYS}, then Enter.`;
showDonation();
