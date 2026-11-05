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
  // Prompts: in each saved prompt, a box for each group that has an AI picked; text in a hidden box is kept and still
  // used. The section shows while any AI is picked.
  shownGroups = { desktop, web };
  for (const card of cards.values()) for (const box of Object.values(card.boxes)) box.box.hidden = !shownGroups[box.group];
  showHints();
  $('prompts').hidden = !desktop && !web;
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

// ---- Prompts (1.5.0): the default style and the saved prompts ----

// What storage.sync holds for the prompts (PROMPT_KEYS, in targets.js), absent keys absent. The page shows
// promptSettings(stored); its own writes change stored at once, and changes made elsewhere arrive through onChanged.
// Until 1.4.0's own instructions have moved (background.js moves them), they show as the saved prompt they will
// become, or, when every slot is taken, as a notice with a Delete.
let stored = {};
// This page's writes not yet seen coming back through onChanged: [key, value as JSON]. A change that matches one is
// this page's own and changes nothing, even when it arrives after a later write.
const ownWrites = [];
const cards = new Map(); // slot number -> the card of a saved prompt
let shownGroups = { desktop: false, web: false };
// While a deleted saved prompt (n), or 1.4.0's own instructions when every slot was taken (n: 0), can be put back:
// { n, snapshot: { set, remove }, timer, focus, hover }. The time runs only while neither focus nor the pointer is on
// the Undo line.
let undoState = null;
let stylesShown = '';
// The default style chosen on this page and not yet written. Moving through the radios with the arrow keys writes
// once, after a pause, so it cannot use up storage.sync's writes a minute.
let styleWanted = null;
let styleTimer = 0;
// The saved prompt background.js moved 1.4.0's own instructions into (promptsMoved, in local storage): its card says
// where it came from, on this visit only.
let movedSlot = 0;
const thousands = (n) => n.toLocaleString('en-GB');
const UNDO_MS = 10000;
const STYLE_PAUSE = 400;
const QUOTA_ITEM = /QUOTA_BYTES_PER_ITEM|QuotaBytesPerItem/i;
const ITEM_BYTES = globalThis.chrome?.storage?.sync?.QUOTA_BYTES_PER_ITEM || SYNC_ITEM_BYTES;
const PROMPT_GROUPS = [
  { group: 'desktop', label: 'For Claude Code and Codex', max: OWN.desktop.max },
  { group: 'web', label: 'For the web AIs and Copy', max: OWN.web.max },
];
const ORIGIN = 'From 1.4.0: your own instructions, kept as this saved prompt.';
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const settingsNow = () => promptSettings(styleWanted === null ? stored : { ...stored, [SAVED.styleKey]: styleWanted });
const presetName = (id) => PRESETS.find((p) => p.id === id)?.name || PRESETS[0].name;
const otherGroup = (group) => (group === 'desktop' ? 'web' : 'desktop');

// Writes items, then removes keys, keeping stored in step. done(error, stage) once both are through, where stage says
// which failed ('set' or 'remove'): a failed write puts back everything it would have changed, and a failed removal
// the keys it did not remove (what was written before it stays written). quiet: a failed removal is neither reported
// nor put back, for 1.4.0's keys once their text is a saved prompt: a copy left behind counts as nothing
// (legacyPlace, in targets.js), and background.js removes it at the next browser start.
function write(items, remove = [], done = () => {}, { quiet = false } = {}) {
  const before = Object.fromEntries([...Object.keys(items), ...remove].map((k) => [k, stored[k]]));
  const mine = [];
  const expect = (k, json) => {
    const w = [k, json];
    ownWrites.push(w);
    mine.push(w);
  };
  for (const [k, v] of Object.entries(items)) {
    stored[k] = v;
    expect(k, JSON.stringify(v));
  }
  const removing = remove.filter((k) => stored[k] !== undefined);
  for (const k of removing) {
    delete stored[k];
    expect(k, 'null');
  }
  const putBack = (keys) => {
    for (const k of keys) {
      if (before[k] === undefined) delete stored[k];
      else stored[k] = before[k];
    }
    for (const w of mine) {
      const i = keys.includes(w[0]) ? ownWrites.indexOf(w) : -1;
      if (i >= 0) ownWrites.splice(i, 1);
    }
  };
  const removeKeys = () => {
    if (!remove.length) return done(undefined);
    chrome.storage.sync.remove(remove, () => {
      const error = chrome.runtime.lastError;
      if (!error || quiet) return done(undefined);
      putBack(removing);
      done(error, 'remove');
    });
  };
  if (!Object.keys(items).length) return removeKeys();
  chrome.storage.sync.set(items, () => {
    const error = chrome.runtime.lastError;
    if (!error) return removeKeys();
    putBack([...Object.keys(items), ...removing]);
    done(error, 'set');
  });
}

// ---- The default style ----

// The saved prompts as the page shows them now: what is typed in each card, cleaned.
const shownSaved = () => Array.from({ length: SAVED.count }, (_, i) => (cards.has(i + 1) ? cardItem(cards.get(i + 1)) : null));

// What an empty box of saved prompt n uses, as promptPlan (targets.js) does: the default style's task when it is a
// preset; when the default is another saved prompt with text for that group, its text; else Resolve fully's.
// style and shown: the default style and the saved prompts as shown, when the caller has them already.
function fallbackLabel(n, group, style = settingsNow().style, shown = shownSaved()) {
  if (isPreset(style)) return presetName(style);
  const d = Number(style.slice(5));
  const def = shown[d - 1];
  return d !== n && def?.[group] ? `the text of ${savedName(def, d)}, the default` : presetName(DEFAULT_STYLE);
}

// The placeholder of an empty box: "Empty, so Resolve fully is used.", or "Empty, so the text of X, the default, is used."
function emptyNote(n, group, style, shown) {
  const label = fallbackLabel(n, group, style, shown);
  return `Empty, so ${label}${PRESETS.some((p) => p.name === label) ? '' : ','} is used.`;
}

// What a saved prompt does, under its name in the list of styles.
function savedNote(prompt, n, style, shown) {
  const has = PROMPT_GROUPS.filter(({ group }) => prompt[group]).map(({ group }) => group);
  if (has.length === 2) return 'Your text for Claude Code and Codex and for the web AIs and Copy.';
  const label = (g) => fallbackLabel(n, g, style, shown);
  if (!has.length) {
    const [desktop, web] = ['desktop', 'web'].map(label);
    return desktop === web
      ? `No text yet, so it works as ${desktop}.`
      : `No text yet: Claude Code and Codex get ${desktop}, and the web AIs and Copy get ${web}.`;
  }
  return has[0] === 'desktop'
    ? `Your text for Claude Code and Codex; the web AIs and Copy get ${label('web')}.`
    : `Your text for the web AIs and Copy; Claude Code and Codex get ${label('desktop')}.`;
}

function styleRow(id, name, note) {
  const row = element('label', 'style');
  const input = element('input');
  input.type = 'radio';
  input.name = 'style';
  input.value = id;
  input.id = `style-${id}`;
  const nameEl = span('style-name', name);
  const noteEl = span('style-note', note);
  nameEl.id = `style-${id}-name`;
  noteEl.id = `style-${id}-note`;
  input.setAttribute('aria-labelledby', nameEl.id);
  input.setAttribute('aria-describedby', noteEl.id);
  row.htmlFor = input.id;
  row.append(input, nameEl, noteEl);
  input.addEventListener('change', () => input.checked && chooseStyle(id));
  return row;
}

// The presets, then the saved prompts by name, with the default chosen. The rows are rebuilt only when a name or a
// note changes, and a radio that had focus keeps it; a new default only moves the check, so the arrow keys never
// lose their place. Each card's empty-box hints, whether it is in use, and its name line follow.
function renderStyles() {
  const { style } = settingsNow();
  const saved = shownSaved();
  const rows = [
    ...PRESETS.map((p) => [p.id, p.name, p.note]),
    ...saved.flatMap((p, i) => (p ? [[savedStyle(i + 1), savedName(p, i + 1), savedNote(p, i + 1, style, saved)]] : [])),
  ];
  const shown = JSON.stringify(rows);
  if (shown !== stylesShown) {
    stylesShown = shown;
    const focused = document.activeElement?.name === 'style' ? document.activeElement.value : null;
    $('style-list').replaceChildren(...rows.map(([id, name, note]) => styleRow(id, name, note)));
    if (focused) document.getElementById(`style-${focused}`)?.focus();
  }
  const checked = document.getElementById(`style-${style}`);
  if (checked && !checked.checked) checked.checked = true;
  for (const card of cards.values()) {
    for (const box of Object.values(card.boxes)) box.field.placeholder = emptyNote(card.n, box.group, style, saved);
    showUse(card, style);
    showName(card);
  }
}

// A new default shows at once and is written after a short pause, or at once (now) for a single deliberate choice.
function chooseStyle(id, now = false) {
  styleWanted = id;
  clearTimeout(styleTimer);
  styleTimer = setTimeout(saveStyle, STYLE_PAUSE);
  renderStyles();
  if (now) saveStyle();
}

function saveStyle() {
  clearTimeout(styleTimer);
  styleTimer = 0;
  if (styleWanted === null) return;
  const id = styleWanted;
  styleWanted = null;
  if (stored[SAVED.styleKey] === id) return renderStyles();
  write({ [SAVED.styleKey]: id }, [], (error) => {
    if (!error) return flashSaved($('prompts-saved'));
    renderStyles();
    flashFailed($('prompts-saved'));
  });
  renderStyles();
}

// ---- Saved prompts ----

// A card's text as the prompts would use it: the name and both boxes, cleaned (promptName, ownInstructions).
const cardItem = (card) => ({
  name: promptName(card.nameField.value),
  desktop: ownInstructions(card.boxes.desktop.field.value, OWN.desktop.max),
  web: ownInstructions(card.boxes.web.field.value, OWN.web.max),
});

// About how many characters of the group's text would fit in one storage.sync item with the rest as it is, for the
// message when the whole is refused.
function fitFor(card, item, group) {
  const text = item[group];
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fitsSync(card.key, { ...item, [group]: text.slice(0, mid) }, ITEM_BYTES)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Which box to shorten when the card is too long for one item, and to about how much: the box first (the one last
// edited, or the longer) when shortening it alone can make the item fit, else the other one; when neither alone can,
// both (null: no figure). fit: 0 when the browser's count, not this page's, refused it ("shorten it a little").
function refusalFits(card, item, first, fit) {
  if (fit === 0) return { [first]: 0 };
  const alone = (g) => !!item[g] && fitsSync(card.key, { ...item, [g]: '' }, ITEM_BYTES);
  const group = [first, otherGroup(first)].find(alone);
  if (group) return { [group]: fitFor(card, item, group) };
  return Object.fromEntries(PROMPT_GROUPS.filter(({ group: g }) => item[g]).map(({ group: g }) => [g, null]));
}
const longerGroup = (item) => (item.desktop.length >= item.web.length ? 'desktop' : 'web');

// Whether the card's text still stands refused: the very text the browser refused, or text that is still too long by
// this page's count and not what is saved.
function stillRefused(card, item) {
  if (!card.refused) return false;
  return same(item, card.refused.item) || (!same(item, card.saved) && !fitsSync(card.key, item, ITEM_BYTES));
}

// The line under a box that must be shortened. For 1.4.0's own instructions not yet moved, it says that shortening
// finishes the move and that they work meanwhile.
function refusalLine(card, group, fit) {
  const shorten =
    fit === null ? 'shorten this box and the other one' : fit ? `shorten this box to about ${thousands(fit)} characters` : 'shorten it a little';
  if (card.legacy) {
    const meanwhile = card.n === 1 ? 'it works as before' : 'it still works';
    return `From 1.4.0: too long to keep as one saved prompt. ${shorten[0].toUpperCase()}${shorten.slice(1)} to finish the move. Until then ${meanwhile}.`;
  }
  const still = card.saved?.[group] ? 'Your previous text is still in use.' : 'The built-in task is still in use.';
  return `Not saved, too long to sync: ${shorten}. ${still}`;
}

// The name's count, and a warning when a built-in style or another saved prompt has the same name, since the toolbar
// list would show two alike.
function showName(card) {
  const name = savedName(cardItem(card), card.n).toLowerCase();
  const clash = PRESETS.some((p) => p.name.toLowerCase() === name)
    ? 'A built-in style'
    : [...cards.values()].some((c) => c !== card && savedName(cardItem(c), c.n).toLowerCase() === name)
      ? 'Another saved prompt'
      : '';
  const count = `${thousands(card.nameField.value.length)} of ${SAVED.nameMax} characters`;
  card.nameCount.textContent = clash ? `${count}. ${clash} has this name too: give it another, so you can tell them apart in the toolbar list.` : count;
  card.nameCount.classList.toggle('full', !!clash);
}

// Whether the card is in use: the default style, or only when picked in the toolbar list, with a way to make it the
// default.
function showUse(card, style = settingsNow().style) {
  const on = style === card.style;
  card.use.classList.toggle('on', on);
  card.useText.textContent = on
    ? "In use: your default style, for Gmail's menus, its toolbar button and the shortcut."
    : 'Not in use until you make it the default, or pick it in the toolbar list for one send.';
  card.useButton.hidden = on;
  card.useButton.setAttribute('aria-label', `Make ${card.title.textContent} the default style`);
}

// The card's title, its Delete button's name, where it came from, and the line under each field: the count, or while
// it stands, why the text was not saved or what a paste lost. A refused box is marked invalid, and its line, which
// describes it, says so.
function showCard(card) {
  const item = cardItem(card);
  card.title.textContent = savedName(item, card.n);
  card.del.setAttribute('aria-label', `Delete the saved prompt ${card.title.textContent}`);
  card.origin.hidden = !(card.legacy || (card.n === movedSlot && card.saved?.name === legacyName(card.n)));
  card.origin.textContent = ORIGIN;
  showName(card);
  showUse(card);
  const refused = stillRefused(card, item);
  if (!refused) card.refused = null;
  for (const box of Object.values(card.boxes)) {
    const n = box.field.value.length;
    const full = n >= box.max;
    const mine = refused && box.group in card.refused.fits;
    let line = `${thousands(n)} of ${thousands(box.max)} characters${full ? ', the most it holds' : ''}`;
    if (mine) line = refusalLine(card, box.group, card.refused.fits[box.group]);
    else if (box.cut) line = `Cut to ${thousands(box.max)} characters: the last ${thousands(box.cut)} you pasted were not kept.`;
    box.count.textContent = line;
    box.count.classList.toggle('full', full || mine || !!box.cut);
    if (mine) box.field.setAttribute('aria-invalid', 'true');
    else box.field.removeAttribute('aria-invalid');
    // Reaching the cap is said once, next to the card's title, as the count line is not read out by itself.
    if (full && !box.atCap) flash(card.status, `${thousands(box.max)} characters, the most it holds`, 4000);
    box.atCap = full;
  }
}

// Refuses text storage.sync will not take: the line under the box that shortening can fix says so until it fits, and
// "Not saved" is said once, next to the card's title. fit: 0 when the browser's count, not this page's, refused it.
function refuseCard(card, item, fit) {
  if (!card.refused) flash(card.status, 'Not saved', 4000);
  card.refused = { item, fits: refusalFits(card, item, card.last !== 'name' ? card.last : longerGroup(item), fit) };
  showCard(card);
}

// Saves the card as the prompts will use it. False when it was not saved because it is too long to sync, so the
// card keeps what was typed. Saving 1.4.0's instructions as a saved prompt also removes their old keys, and makes
// saved prompt 1 the default if no style was ever chosen, as background.js would.
function saveCard(card) {
  clearTimeout(card.timer);
  card.timer = 0;
  const item = cardItem(card);
  if (same(item, card.saved) && !card.legacy) {
    card.refused = null;
    showCard(card);
    return true;
  }
  if (!fitsSync(card.key, item, ITEM_BYTES)) {
    refuseCard(card, item);
    return false;
  }
  const previous = card.saved;
  const wasLegacy = card.legacy;
  if (wasLegacy) saveStyle(); // a default chosen a moment ago is written first, so it is not overruled here
  card.saved = item;
  card.legacy = false;
  card.refused = null;
  card.pending = undefined; // what is saved here now wins over a change from elsewhere not yet shown
  const items = { [card.key]: item };
  if (wasLegacy && card.n === 1 && typeof stored[SAVED.styleKey] !== 'string') items[SAVED.styleKey] = card.style;
  write(
    items,
    wasLegacy ? LEGACY_KEYS : [],
    (error) => {
      if (!error) return flashSaved(card.status);
      if (card.saved === item) {
        card.saved = previous; // so the next edit tries again
        card.legacy = wasLegacy;
      }
      // The browser's own count can differ from this page's; a refusal for size is said as one, not as "try again".
      if (QUOTA_ITEM.test(error.message || '')) return refuseCard(card, item, 0);
      flashFailed(card.status);
      showCard(card);
    },
    { quiet: true },
  );
  showCard(card);
  renderStyles();
  return true;
}

// Fills a card with what is stored. legacy: it is 1.4.0's own instructions, not yet moved; when the two texts are
// too long for one item, the card says so at once, under the box that shortening can fix.
function fillCard(card, item, legacy = false) {
  card.saved = item;
  card.legacy = legacy;
  card.refused = null;
  card.pending = undefined;
  card.nameField.value = item.name;
  for (const box of Object.values(card.boxes)) {
    box.field.value = item[box.group];
    box.cut = 0;
  }
  if (legacy && !fitsSync(card.key, item, ITEM_BYTES)) card.refused = { item, fits: refusalFits(card, item, longerGroup(item)) };
  showCard(card);
}

// A card: its title and status, where it came from (1.4.0), the name and a box per group, whether it is in use, and
// Delete last, so Tab reaches the fields first (the page shows it on the right of the title).
function makeCard(n) {
  const id = (part) => `sp${n}-${part}`;
  const el = element('div', 'saved-prompt');
  el.id = `sp${n}`;
  el.setAttribute('role', 'group');
  const head = element('div', 'sp-head');
  const title = element('h4', 'sp-title');
  title.id = id('title');
  el.setAttribute('aria-labelledby', title.id);
  const status = span('saved');
  status.id = id('saved');
  status.setAttribute('role', 'status');
  head.append(title, status);
  const origin = element('p', 'sp-origin');
  origin.id = id('origin');
  origin.hidden = true;
  const nameLabel = element('label', '', 'Name');
  nameLabel.htmlFor = id('name');
  const nameField = element('input', 'sp-name');
  nameField.type = 'text';
  nameField.id = id('name');
  nameField.maxLength = SAVED.nameMax;
  nameField.autocomplete = 'off';
  nameField.spellcheck = false;
  nameField.placeholder = `Saved prompt ${n}`;
  const nameFoot = element('div', 'own-foot');
  const nameCount = span('count');
  nameCount.id = id('name-count');
  nameField.setAttribute('aria-describedby', nameCount.id);
  nameFoot.append(nameCount);
  el.append(head, origin, nameLabel, nameField, nameFoot);
  const boxes = {};
  for (const { group, label, max } of PROMPT_GROUPS) {
    const box = element('div', 'own-box');
    box.dataset.group = group;
    box.hidden = !shownGroups[group];
    const fieldLabel = element('label', '', label);
    fieldLabel.htmlFor = id(group);
    const field = element('textarea');
    field.id = id(group);
    field.rows = 6;
    field.spellcheck = true;
    field.maxLength = max;
    field.setAttribute('autocomplete', 'off');
    const foot = element('div', 'own-foot');
    const count = span('count');
    count.id = id(`${group}-count`);
    field.setAttribute('aria-describedby', `saved-sub own-${group}-hint ${count.id}`);
    foot.append(count);
    box.append(fieldLabel, field, foot);
    el.append(box);
    boxes[group] = { group, max, box, field, count, cut: 0, pasting: false, atCap: false };
  }
  const use = element('p', 'sp-use');
  const useText = span('', '');
  useText.id = id('use');
  useText.tabIndex = -1;
  const useButton = element('button', 'link', 'Make it the default');
  useButton.type = 'button';
  useButton.id = id('make-default');
  use.append(useText, useButton);
  const del = element('button', 'link sp-delete', 'Delete');
  del.type = 'button';
  del.id = id('delete');
  el.append(use, del);
  const card = {
    n, key: SAVED.key(n), style: savedStyle(n), el, title, status, origin, del, use, useText, useButton, nameField, nameCount, boxes,
    saved: null, legacy: false, refused: null, pending: undefined, timer: 0, last: 'desktop',
  };

  const edited = (part) => {
    card.last = part;
    showCard(card);
    renderStyles();
    clearTimeout(card.timer);
    card.timer = setTimeout(() => saveCard(card), 800);
  };
  nameField.addEventListener('input', () => edited('name'));
  for (const box of Object.values(boxes)) {
    box.field.addEventListener('input', () => {
      if (!box.pasting) box.cut = 0;
      edited(box.group);
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
        showCard(card);
      });
    });
  }
  // Leaving a field saves at once and shows the text as the prompts will use it.
  for (const [part, field] of [['name', nameField], ...Object.values(boxes).map((b) => [b.group, b.field])]) {
    field.addEventListener('change', () => {
      card.last = part;
      if (saveCard(card)) field.value = card.saved[part];
      showCard(card);
    });
  }
  // A change made elsewhere while the card had focus shows once the card is left, unless it holds an edit of its own.
  el.addEventListener('focusout', (e) => {
    if (el.contains(e.relatedTarget) || card.pending === undefined) return;
    const pending = card.pending;
    card.pending = undefined;
    if (same(cardItem(card), card.saved)) fillCard(card, pending, card.legacy);
  });
  // Making it the default is one deliberate choice, so it is written at once; focus moves to the line that now says so.
  useButton.addEventListener('click', () => {
    chooseStyle(card.style, true);
    card.useText.focus();
  });
  del.addEventListener('click', () => deleteCard(card));
  return card;
}

// Cards go in slot order.
function placeCard(card) {
  const after = [...cards.values()].filter((c) => c.n > card.n).sort((a, b) => a.n - b.n)[0];
  $('saved-list').insertBefore(card.el, after?.el || null);
  cards.set(card.n, card);
}

function dropCard(card) {
  const focused = card.el.contains(document.activeElement);
  clearTimeout(card.timer);
  card.el.remove();
  cards.delete(card.n);
  if (focused) focusAfterCards();
}

// Where focus goes when what had it goes away: Add a saved prompt, or else the heading of the saved prompts.
function focusAfterCards() {
  if (!$('add-prompt').hidden) return $('add-prompt').focus();
  $('saved-title').tabIndex = -1;
  $('saved-title').focus();
}

const updateAdd = () => ($('add-prompt').hidden = cards.size >= SAVED.count);

// The writing hints and where the text goes, for each group with an AI picked, while there is a saved prompt to
// write in.
function showHints() {
  const any = cards.size > 0;
  for (const group of ['desktop', 'web']) {
    $(`own-${group}-hint`).hidden = !any || !shownGroups[group];
    $(`own-${group}-where-box`).hidden = !shownGroups[group];
  }
  document.querySelector('details.where-box').hidden = !any;
}

// 1.4.0's own instructions still stored when every saved prompt is taken, so they cannot count as one: their size,
// and a Delete. They take the place of a saved prompt deleted later.
function showLegacyNotice() {
  const texts = settingsNow().stranded ? legacyTexts(stored) : null;
  const focused = document.activeElement === $('legacy-delete');
  $('legacy-notice').hidden = !texts;
  if (!texts) {
    if (focused) focusAfterCards();
    return;
  }
  const size = thousands(texts.desktop.length + texts.web.length);
  $('legacy-text').textContent =
    `Your own instructions from 1.4.0 (${size} characters) are still stored with your settings, but are not in use: all ${SAVED.count} ` +
    'saved prompts are taken. Delete a saved prompt and they take its place, or delete them.';
}

// Brings the cards in line with stored: new ones added, gone ones dropped, and a change from elsewhere shown, or
// held while the card has focus or an edit waiting.
function syncCards() {
  const { saved, legacy } = settingsNow();
  for (let n = 1; n <= SAVED.count; n++) {
    const want = saved[n - 1];
    let card = cards.get(n);
    if (!want) {
      if (card) dropCard(card);
      continue;
    }
    const isLegacy = n === legacy;
    if (!card) {
      card = makeCard(n);
      placeCard(card);
      fillCard(card, want, isLegacy);
      continue;
    }
    card.legacy = isLegacy;
    if (same(want, card.saved)) continue;
    if (card.el.contains(document.activeElement) || card.timer) card.pending = want;
    else fillCard(card, want, isLegacy);
  }
  updateAdd();
  showHints();
  showLegacyNotice();
  renderStyles();
}

// The Undo line for what was just deleted, with focus on Undo. Its 10 seconds run only while neither focus nor the
// pointer is on the line, as the extension's notes wait.
function startUndo(state, text, label) {
  undoState = { ...state, timer: 0, focus: false, hover: false };
  $('undo-text').textContent = text;
  $('undo').setAttribute('aria-label', label);
  $('undo-line').hidden = false;
  armUndo();
  $('undo').focus();
}

function armUndo() {
  if (!undoState) return;
  clearTimeout(undoState.timer);
  undoState.timer = undoState.focus || undoState.hover ? 0 : setTimeout(endUndo, UNDO_MS);
}

function endUndo() {
  if (!undoState) return;
  clearTimeout(undoState.timer);
  const focused = document.activeElement === $('undo');
  undoState = null;
  $('undo-line').hidden = true;
  $('undo-text').textContent = '';
  if (focused) focusAfterCards();
}

for (const [type, part, on] of [['focusin', 'focus', true], ['focusout', 'focus', false], ['mouseenter', 'hover', true], ['mouseleave', 'hover', false]]) {
  $('undo-line').addEventListener(type, (e) => {
    if (!undoState || (type === 'focusout' && $('undo-line').contains(e.relatedTarget))) return;
    undoState[part] = on;
    armUndo();
  });
}

// A delete that did not go through: what was deleted comes back, with focus on its Delete.
function deleteFailed(n) {
  flash($('prompts-saved'), 'Not deleted, try again', 4000);
  endUndo();
  syncCards();
  const card = cards.get(n);
  if (card) card.del.focus();
  else if (!n && !$('legacy-notice').hidden) $('legacy-delete').focus();
}

// Delete: the card goes at once, with an Undo that puts back exactly what was stored, the default style included. A
// deleted default gives way to Resolve fully, and the line says so; any other default stays the default, even one
// that was never chosen (1.4.0's instructions in saved prompt 1).
function deleteCard(card) {
  endUndo();
  saveStyle();
  if (card.timer) saveCard(card); // an edit still waiting is kept for the Undo, if it fits
  const removing = [card.key, ...(card.legacy ? LEGACY_KEYS : [])];
  const snapshot = { set: {}, remove: [] };
  for (const k of removing) if (stored[k] !== undefined) snapshot.set[k] = stored[k];
  const style = settingsNow().style;
  const wasDefault = style === card.style;
  const after = { ...stored };
  for (const k of removing) delete after[k];
  const items = {};
  if (wasDefault || promptSettings(after).style !== style) items[SAVED.styleKey] = wasDefault ? DEFAULT_STYLE : style;
  const styleBack = { set: {}, remove: [] };
  if (SAVED.styleKey in items) {
    if (typeof stored[SAVED.styleKey] === 'string') styleBack.set[SAVED.styleKey] = stored[SAVED.styleKey];
    else styleBack.remove.push(SAVED.styleKey);
  }
  Object.assign(snapshot.set, styleBack.set);
  snapshot.remove.push(...styleBack.remove);
  const name = card.title.textContent;
  dropCard(card);
  write(items, removing, (error, stage) => {
    if (!error) return;
    // The default had already moved when the removal failed: it goes back too.
    if (stage === 'remove' && SAVED.styleKey in items) write(styleBack.set, styleBack.remove, () => syncCards());
    deleteFailed(card.n);
  });
  // 1.4.0's own instructions, when every slot was taken, now count as the slot freed, and show there.
  syncCards();
  const text = wasDefault ? `Deleted ${name}. The default style is now ${presetName(DEFAULT_STYLE)}.` : `Deleted ${name}.`;
  startUndo({ n: card.n, snapshot }, text, `Undo: put back the saved prompt ${name}`);
}

// Deleting 1.4.0's own instructions when they cannot count as a saved prompt, with the same Undo.
$('legacy-delete').addEventListener('click', () => {
  endUndo();
  const snapshot = { set: {}, remove: [] };
  for (const k of LEGACY_KEYS) if (stored[k] !== undefined) snapshot.set[k] = stored[k];
  write({}, LEGACY_KEYS, (error) => error && deleteFailed(0));
  syncCards();
  startUndo({ n: 0, snapshot }, 'Deleted your own instructions from 1.4.0.', 'Undo: put back your own instructions from 1.4.0');
});

$('undo').addEventListener('click', () => {
  const state = undoState;
  if (!state) return;
  clearTimeout(state.timer);
  undoState = null;
  $('undo-line').hidden = true;
  $('undo-text').textContent = '';
  write(state.snapshot.set, state.snapshot.remove, (error) => {
    if (!error) return flashSaved($('prompts-saved'));
    flashFailed($('prompts-saved'));
    syncCards();
  });
  syncCards();
  const card = cards.get(state.n || settingsNow().legacy);
  if (card) card.nameField.focus();
  else if (!$('legacy-notice').hidden) $('legacy-delete').focus();
  else focusAfterCards();
});

// Add a saved prompt: the first empty slot, named "Saved prompt N" until renamed, saved at once with its name selected.
$('add-prompt').addEventListener('click', () => {
  endUndo();
  const n = Array.from({ length: SAVED.count }, (_, i) => i + 1).find((i) => !cards.has(i));
  if (!n) return;
  const item = { name: `Saved prompt ${n}`, desktop: '', web: '' };
  const card = makeCard(n);
  placeCard(card);
  fillCard(card, item);
  write({ [card.key]: item }, [], (error) => {
    if (!error) return flashSaved(card.status);
    flashFailed($('prompts-saved'));
    syncCards();
  });
  updateAdd();
  showHints();
  renderStyles();
  card.nameField.focus();
  card.nameField.select();
});

function showPrompts(s) {
  stored = Object.fromEntries(Object.keys(PROMPT_KEYS).filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
  syncCards();
}

// A change in another tab or synced from another device, unless it is this page's own write coming back.
function promptsChanged(changes) {
  let changed = false;
  for (const k of Object.keys(PROMPT_KEYS)) {
    if (!changes[k]) continue;
    const value = changes[k].newValue;
    const json = value === undefined ? 'null' : JSON.stringify(value);
    const mine = ownWrites.findIndex(([key, v]) => key === k && v === json);
    if (mine >= 0) {
      ownWrites.splice(mine, 1);
      continue;
    }
    if (value === undefined) delete stored[k];
    else stored[k] = value;
    changed = true;
  }
  if (changed) syncCards();
}

// Which saved prompt background.js moved 1.4.0's own instructions into, if it did since this page was last open: its
// card says so on this visit, and the note is then cleared.
function showMoved() {
  Promise.resolve(chrome.storage.local?.get?.({ promptsMoved: 0 }))
    .then((x) => {
      movedSlot = Number(x?.promptsMoved) || 0;
      if (!movedSlot) return;
      Promise.resolve(chrome.storage.local.remove?.('promptsMoved')).catch(() => {});
      for (const card of cards.values()) showCard(card);
    })
    .catch(() => {});
}

// An edit still waiting for its pause is saved before the page goes, or is hidden, so closing the tab loses nothing.
function flushEdits() {
  saveStyle();
  for (const card of cards.values()) if (card.timer) saveCard(card);
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
  // The prompts: shown at once, or once a card is left if it has focus (see syncCards).
  promptsChanged(changes);
});

chrome.storage.sync.get({ targets: DEFAULT_TARGETS, folder: '', toolbarButton: true, ...PROMPT_KEYS }, (s) => {
  savedFolder = s.folder;
  $('folder').value = s.folder;
  savedToolbar = s.toolbarButton !== false;
  showToolbarSetting(savedToolbar);
  // Defaults stand for absent keys: null and '' are what PROMPT_KEYS gives for nothing stored.
  showPrompts(Object.fromEntries(Object.entries(s).filter(([k, v]) => !(k in PROMPT_KEYS) || (v !== null && v !== ''))));
  $('tiles').replaceChildren(...GROUPS.map(group));
  showTargets(s.targets);
});
showMoved();
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
