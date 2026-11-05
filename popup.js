// The toolbar list: the AIs picked, for what the Gmail tab in front has open or ticked. A pick goes to
// background.js, which runs it in that tab as the browser's menu does, so the note in Gmail says what
// happened and the list closes. In Gmail a compact picker above the AIs chooses the prompt style for that pick
// only (1.5.0): it starts on the default every time the list opens, goes with every pick and is never saved. On
// another site it offers the AIs for the text selected there (opening the list lets the extension read it, through
// activeTab), which keeps its built-in prompt, or else shows a hint. It always links to the settings page.
const $ = (id) => document.getElementById(id);
const GMAIL = 'https://mail.google.com/';
const HINT = 'Open Gmail, or select some text on a page and right-click it.';
const RELOAD = 'Reload this Gmail tab, then open this list again.';
const SELECTED = 'For the text you selected on this page.';
const RESELECT = 'Select the text again, then open this list again.';

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

// What content.js sees in the tab: { ticked, total, thread }, or null when no content script answers.
async function gmailState(tab) {
  try {
    const state = await chrome.tabs.sendMessage(tab.id, { target: 'content', action: 'state' }, { frameId: 0 });
    return state?.ok ? state : null;
  } catch {
    return null;
  }
}

// Whether the tab in front, not Gmail, has text selected (background.js reads the page).
async function hasSelection(tab) {
  if (!tab?.id) return false;
  const res = await chrome.runtime.sendMessage({ target: 'background', action: 'selection', tabId: tab.id }).catch(() => null);
  return res?.ok === true && res.selected === true;
}

// The line above the list: what a pick acts on, or why nothing can be picked here.
function contextLine(onGmail, state, selected) {
  if (!onGmail) return selected ? { text: SELECTED } : { text: HINT, hint: true };
  if (!state) return { text: RELOAD, hint: true };
  if (state.ticked >= 2) {
    const n = state.total > state.ticked ? `the first ${state.ticked} of the ${state.total}` : `the ${state.ticked}`;
    return { text: `For ${n} emails you ticked.` };
  }
  if (state.thread) return { text: 'For the email you have open.' };
  if (state.total === 1) return { text: 'For the email you ticked.' };
  return { text: 'Open an email or tick some in Gmail, then pick an AI.' };
}

// The same labels as Gmail's row menu: "Ask Claude", or "Ask Claude about 3 emails" with rows ticked; for
// selected text, the browser menu's ("Ask Claude about the selected text").
const label = (target, state, selected) =>
  selected ? target.selectionMenu : state?.ticked >= 2 ? target.bulkMenu.replace('{n}', state.ticked) : target.menu;
const note = (target) => (target.kind === 'web' ? target.note : target.kind === 'app' ? 'desktop app' : 'clipboard');

// The prompt style picker: the presets, then the saved prompts by name (promptSettings, in targets.js), in two
// labelled groups so a saved prompt named like a built-in style cannot pass for it, on the default, which says so.
// Shown only when a pick here goes to emails in Gmail.
function showStyles(settings, show) {
  const option = (id, name) => {
    const el = element('option', '', id === settings.style ? `${name} (default)` : name);
    el.value = id;
    return el;
  };
  const group = (label, options) => {
    const el = element('optgroup');
    el.label = label;
    el.append(...options);
    return el;
  };
  const saved = settings.saved.flatMap((p, i) => (p ? [option(savedStyle(i + 1), savedName(p, i + 1))] : []));
  $('style').replaceChildren(group('Built-in', PRESETS.map((p) => option(p.id, p.name))), ...(saved.length ? [group('Saved', saved)] : []));
  $('style').value = settings.style;
  $('style-pick').hidden = !show;
}

// The style for this pick, always sent while the picker shows, so what the list showed is what the AI gets: the
// content script refuses one it no longer has rather than use another.
const pickedStyle = () => ($('style-pick').hidden ? {} : { style: $('style').value });

// While a pick is under way the AIs do not take another; keyboard focus stays on the one picked.
let busy = false;
async function pick(target, tab, selected, button) {
  if (busy) return;
  busy = true;
  for (const b of document.querySelectorAll('.ai')) b.setAttribute('aria-disabled', 'true');
  const action = selected ? 'runSelection' : 'run';
  const res = await chrome.runtime
    .sendMessage({ target: 'background', action, platform: target.id, tabId: tab.id, ...(selected ? {} : pickedStyle()) })
    .catch((e) => ({ ok: false, error: e?.message }));
  if (res?.ok) return window.close();
  $('context').textContent = selected ? RESELECT : RELOAD;
  $('context').classList.add('hint');
  for (const b of document.querySelectorAll('.ai')) b.removeAttribute('aria-disabled');
  busy = false;
  if (document.activeElement !== button) button.focus();
}

function aiButton(target, state, tab, enabled, selected) {
  const button = element('button', 'ai');
  button.type = 'button';
  button.dataset.id = target.id;
  button.disabled = !enabled;
  button.append(element('span', 'label', label(target, state, selected)), element('span', 'note', note(target)));
  button.addEventListener('click', () => pick(target, tab, selected, button));
  return button;
}

// The arrow keys move between the AIs, as in a menu; Tab still works.
$('list').addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const buttons = [...document.querySelectorAll('.ai:not(:disabled)')];
  if (!buttons.length) return;
  e.preventDefault();
  const at = buttons.indexOf(document.activeElement);
  const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: buttons.length - 1 }[e.key];
  buttons[(to + buttons.length) % buttons.length].focus();
});

$('settings').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});

// "Alt+Shift+L sends to Claude": the key the browser gave the shortcut, and the AI it would use now
// (shortcutTarget, in targets.js). Copy goes by its short name.
async function showLast(chosen) {
  const commands = await Promise.resolve(chrome.commands?.getAll?.()).catch(() => null);
  const key = Array.isArray(commands) ? commands.find((c) => c.name === 'send-to-last')?.shortcut : '';
  if (!key || !chosen.length) return;
  const { lastTarget } = await Promise.resolve(chrome.storage.local.get({ lastTarget: '' })).catch(() => ({}));
  const target = shortcutTarget(chosen, lastTarget);
  if (!target) return;
  $('last').replaceChildren(element('kbd', '', keyLabel(key)), ` sends to ${target.kind === 'copy' ? 'Copy' : target.name}`);
  $('last').hidden = false;
}

async function main() {
  const [stored, tab] = await Promise.all([chrome.storage.sync.get({ targets: DEFAULT_TARGETS, ...PROMPT_KEYS }), activeTab().catch(() => null)]);
  const chosen = pickTargets(stored.targets);
  const onGmail = typeof tab?.url === 'string' && tab.url.startsWith(GMAIL);
  const state = onGmail ? await gmailState(tab) : null;
  const selected = !onGmail && chosen.length > 0 && (await hasSelection(tab));
  const line = contextLine(onGmail, state, selected);
  $('context').textContent = line.text;
  $('context').classList.toggle('hint', !!line.hint);
  $('empty').hidden = chosen.length > 0;
  $('list').hidden = !chosen.length;
  showStyles(promptSettings(stored), onGmail && !!state && chosen.length > 0);
  $('list').replaceChildren(
    ...chosen.map((t) => {
      const li = element('li');
      li.append(aiButton(t, state, tab, (onGmail && !!state) || selected, selected));
      return li;
    }),
  );
  document.querySelector('.ai:not(:disabled)')?.focus();
  await showLast(chosen);
}

main().catch((e) => console.warn('Toolbar list:', e));
