// Settings page suite: the REAL options.html/options.js/targets.js, and the toolbar list (popup.html and
// popup.js), in headless Chrome, driven over the Chrome DevTools Protocol with a stub chrome.*
// (stub-chrome.js). Checks behaviour, copy, keyboard use, overflow and contrast. Writes only to
// tests/.out/settings/.
// Usage: node tests/settings/run.mjs            (tests + screenshots)
//        SHOTS=0 node tests/settings/run.mjs    (tests only)
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO, OUT_ROOT, findChrome, extraChromeFlags, PASTE_KEY } from '../lib/chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(OUT_ROOT, 'settings');
const PAGES = join(OUT, 'pages');
const SHOTS = join(OUT, 'shots');
const PROFILE = join(OUT, 'chrome-profile');
const CHROME = findChrome();
const fileUrl = (p) => 'file://' + p.split('/').map(encodeURIComponent).join('/');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Rejects with `message` if `promise` has not settled within `ms`, so a broken page fails fast instead of hanging.
const withDeadline = (promise, ms, message) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms).unref())]);
const TILES_WAIT_MS = 10000;
for (const d of [PAGES, SHOTS, PROFILE]) mkdirSync(d, { recursive: true });

// ---------- build wrapper pages from the real files ----------
const realHtml = readFileSync(join(REPO, 'options.html'), 'utf8');
const realTargets = readFileSync(join(REPO, 'targets.js'), 'utf8');
const replaceOnce = (s, a, b, label) => {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`wrapper build: expected 1 x ${label}, found ${n}`);
  return s.replace(a, b);
};
// DONATION is filled in (Friends of Larnaca Cats) and spans several lines; variants replace the whole object.
const DONATION_RE = /const DONATION = \{[\s\S]*?\n?\};/;
const targetVariants = {
  real: null,
  'donate-empty': "const DONATION = { charity: '', url: '' };",
  donate: "const DONATION = { charity: 'Test Charity', url: 'https://example.org/donate' };",
  'donate-http': "const DONATION = { charity: 'Test Charity', url: 'http://example.org/donate' };",
  'donate-partial': "const DONATION = { charity: 'Test Charity', url: '' };",
  'donate-markup': "const DONATION = { charity: '<img src=x onerror=\"window.__xss=1\">Kids & Co', url: 'https://example.org/d?a=1&b=2' };",
};
const pageFor = {};
for (const [name, line] of Object.entries(targetVariants)) {
  let targetsPath = join(REPO, 'targets.js');
  if (line) {
    targetsPath = join(PAGES, `targets-${name}.js`);
    if ((realTargets.match(new RegExp(DONATION_RE.source, 'g')) || []).length !== 1) throw new Error('wrapper build: expected 1 DONATION object');
    writeFileSync(targetsPath, realTargets.replace(DONATION_RE, line));
  }
  let html = realHtml;
  html = replaceOnce(html, '<script src="targets.js"></script>',
    `<script src="${fileUrl(join(HERE, 'stub-chrome.js'))}"></script>\n<script src="${fileUrl(targetsPath)}"></script>`, 'targets.js tag');
  html = replaceOnce(html, '<script src="options.js"></script>', `<script src="${fileUrl(join(REPO, 'options.js'))}"></script>`, 'options.js tag');
  html = replaceOnce(html, 'src="icons/icon48.png"', `src="${fileUrl(join(REPO, 'icons/icon48.png'))}"`, 'icon48');
  html = replaceOnce(html, 'href="icons/icon32.png"', `href="${fileUrl(join(REPO, 'icons/icon32.png'))}"`, 'icon32');
  // The page loads its own fonts from the extension's fonts/ folder: Libre Franklin 400 and 600.
  if (html.split('url(fonts/').length - 1 !== 2) throw new Error('wrapper build: expected 2 font URLs');
  html = html.replaceAll('url(fonts/', `url(${fileUrl(join(REPO, 'fonts'))}/`);
  const out = join(PAGES, `options-${name}.html`);
  writeFileSync(out, html);
  pageFor[name] = fileUrl(out);
}

// The toolbar list, from the real popup.html, popup.js and targets.js.
{
  let html = readFileSync(join(REPO, 'popup.html'), 'utf8');
  html = replaceOnce(html, '<script src="targets.js"></script>',
    `<script src="${fileUrl(join(HERE, 'stub-chrome.js'))}"></script>\n<script src="${fileUrl(join(REPO, 'targets.js'))}"></script>`, 'popup targets.js tag');
  html = replaceOnce(html, '<script src="popup.js"></script>', `<script src="${fileUrl(join(REPO, 'popup.js'))}"></script>`, 'popup.js tag');
  html = replaceOnce(html, 'src="icons/icon48.png"', `src="${fileUrl(join(REPO, 'icons/icon48.png'))}"`, 'popup icon48');
  if (html.split('url(fonts/').length - 1 !== 2) throw new Error('wrapper build: expected 2 font URLs in popup.html');
  html = html.replaceAll('url(fonts/', `url(${fileUrl(join(REPO, 'fonts'))}/`);
  const out = join(PAGES, 'popup.html');
  writeFileSync(out, html);
  pageFor.popup = fileUrl(out);
}

// ---------- launch headless Chrome ----------
const portFile = join(PROFILE, 'DevToolsActivePort');
if (existsSync(portFile)) writeFileSync(portFile, ''); // overwrite stale port info
const chromeProc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${PROFILE}`, '--remote-debugging-port=0',
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions',
  '--disable-sync', '--disable-component-update', ...extraChromeFlags(), 'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => chromeProc.kill('SIGTERM')); // no stray Chrome if a step throws
let port;
for (let i = 0; i < 150 && !port; i++) {
  const txt = existsSync(portFile) ? readFileSync(portFile, 'utf8') : '';
  if (txt.trim()) port = txt.split('\n')[0];
  else await sleep(100);
}
if (!port) throw new Error('Chrome did not start');
const pageTarget = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
const events = [];
const consoleErrors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d);
    pending.delete(d.id);
    return;
  }
  events.push(d);
  if (d.method === 'Runtime.exceptionThrown') consoleErrors.push('exception: ' + JSON.stringify(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type))
    consoleErrors.push(`console.${d.params.type}: ` + d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Log.entryAdded' && ['error', 'warning'].includes(d.params.entry.level))
    consoleErrors.push(`log.${d.params.entry.level}: ${d.params.entry.text} ${d.params.entry.url || ''}`);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (d) => (d.error ? reject(new Error(`${method}: ${d.error.message}`)) : resolve(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('evaluate: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

let seedScript = null;
// env: what the stub's other APIs answer (see stub-chrome.js).
async function load(variant, seed, { width = 1280, height = 900, scheme = 'light', hash = '', env = {} } = {}) {
  if (seedScript) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedScript });
  seedScript = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__seed = ${JSON.stringify(seed)}; window.__env = ${JSON.stringify(env)};` })).identifier;
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  const before = events.length;
  await send('Page.navigate', { url: pageFor[variant] + hash });
  for (let i = 0; i < 100 && !events.slice(before).some((e) => e.method === 'Page.loadEventFired'); i++) await sleep(50);
}
async function open(variant, seed = {}, opts = {}) {
  await load(variant, seed, opts);
  await withDeadline(
    evaluate(`new Promise((r) => { const t = () => document.querySelectorAll('#tiles .tile').length ? r() : setTimeout(t, 10); t(); })`),
    TILES_WAIT_MS,
    `open('${variant}'): the settings page showed no tiles within ${TILES_WAIT_MS / 1000} s`,
  );
  await sleep(50);
}
// The toolbar list, once it has said what it acts on.
async function openPopup(seed = {}, env = {}, opts = {}) {
  await send('Page.navigate', { url: 'about:blank' });
  await load('popup', seed, { width: 320, height: 600, ...opts, env });
  await withDeadline(
    evaluate(`new Promise((r) => { const t = () => document.getElementById('context')?.textContent ? r() : setTimeout(t, 10); t(); })`),
    TILES_WAIT_MS,
    'openPopup: the toolbar list showed no context line',
  );
  await sleep(80);
}
const store = () => evaluate('JSON.parse(JSON.stringify(window.__store))');
const sets = () => evaluate('window.__log.sets');
async function center(selector) {
  return evaluate(`(() => { const el = ${selector}; if (!el) return null; el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
}
async function click(selector) {
  const c = await center(selector);
  if (!c) throw new Error('click: not found ' + selector);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
}
const KEYS = {
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
};
async function press(name, modifiers = 0) {
  const k = KEYS[name];
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, ...k });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, ...k, text: undefined });
}
async function typeSlowly(text, gap = 40) {
  for (const ch of text) {
    await send('Input.insertText', { text: ch });
    await sleep(gap);
  }
}
const tileSel = (name) => `[...document.querySelectorAll('#tiles .tile')].find((b) => b.querySelector('.name').textContent === ${JSON.stringify(name)})`;
const pressedNames = () => evaluate(`[...document.querySelectorAll('#tiles .tile')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.querySelector('.name').textContent)`);
const hiddenState = () => evaluate(`({ folder: document.getElementById('folder-step').hidden, empty: document.getElementById('empty').hidden,
  donate: document.getElementById('donate').hidden, folderVisible: !!document.getElementById('folder-step').offsetParent,
  emptyVisible: !!document.getElementById('empty').offsetParent, donateVisible: !!document.getElementById('donate').offsetParent })`);

// ---------- tiny test runner ----------
const results = [];
async function scenario(name, fn) {
  const errsBefore = consoleErrors.length;
  const checks = [];
  const check = (cond, what, detail) => checks.push({ ok: !!cond, what, detail });
  try {
    await fn(check);
  } catch (e) {
    checks.push({ ok: false, what: 'threw', detail: e.message });
  }
  const newErrs = consoleErrors.slice(errsBefore).filter((e) => !/favicon/i.test(e));
  if (newErrs.length) checks.push({ ok: false, what: 'console errors', detail: newErrs });
  const passed = checks.every((c) => c.ok);
  results.push({ name, passed, checks });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
  for (const c of checks) if (!c.ok) console.log(`      x ${c.what}  ${JSON.stringify(c.detail ?? '')}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const TARGETS = await (async () => {
  await open('real');
  return evaluate('JSON.parse(JSON.stringify(TARGETS))');
})();
const name = (id) => TARGETS.find((t) => t.id === id).name;
// The cap on your own instructions, as targets.js sets it for both groups (1.4.0).
const OWN_MAX = await evaluate('OWN.desktop.max === OWN.web.max ? OWN.web.max : -1');
// The shortcuts as commands.getAll() reports them once the browser has given them their suggested keys.
const COMMANDS = [
  { name: '_execute_action', description: 'Open the list of your AIs', shortcut: 'Alt+Shift+O' },
  { name: 'send-to-last', description: 'Send to the AI you used last', shortcut: 'Alt+Shift+L' },
];

// ---------- scenarios ----------
await scenario('B01 harness control: stub active, real scripts, icon and fonts loaded, page meta', async (check) => {
  await open('real');
  const info = await evaluate(`({ stub: window.__stubActive === true, chromeIsStub: chrome.storage.sync.get.toString().includes('log.gets'),
    scripts: [...document.scripts].map((s) => s.src), iconW: document.querySelector('header img').naturalWidth,
    iconAlt: document.querySelector('header img').getAttribute('alt'), title: document.title, lang: document.documentElement.lang })`);
  check(info.stub && info.chromeIsStub, 'stub chrome in use', info);
  check(info.scripts.some((s) => s === fileUrl(join(REPO, 'options.js'))) && info.scripts.some((s) => s === fileUrl(join(REPO, 'targets.js'))), 'REAL options.js and targets.js loaded', info.scripts);
  check(info.iconW === 48, 'icon48.png loaded from repo (naturalWidth 48)', info.iconW);
  check(info.iconAlt === '', 'decorative icon has empty alt', info.iconAlt);
  check(info.title === 'Open in AI Agent for Gmail settings' && info.lang === 'en-GB', 'title and lang', info);
  // Without the bundled faces, B03, B12 and B19 would measure fallback fonts and still pass.
  const fonts = await evaluate(`document.fonts.ready.then(() => [...document.fonts].filter((f) => f.family.includes('Libre Franklin')).map((f) => f.weight + ' ' + f.status))`);
  check(same(fonts.slice().sort(), ['400 loaded', '600 loaded']), 'both bundled Libre Franklin faces (400 and 600) loaded from fonts/', fonts);
});

await scenario('B02 header copy', async (check) => {
  const h = await evaluate(`({ h1: document.querySelector('h1').textContent, line: document.querySelector('header p').textContent })`);
  check(h.h1 === 'Settings', 'h1', h.h1); // the product name sits in a small masthead above it
  // 1.4.0: the AIs show in Gmail's menus, its toolbar and the extension's icon, not only on a right-click.
  check(h.line === "Choose the AIs that appear in Gmail's menus, its toolbar and the extension's icon. Changes save as you go.", 'header line', h.line);
});

await scenario('B03 fresh install (no settings): 11 tiles with name+note, Claude and ChatGPT pressed, nothing written', async (check) => {
  await open('real', {});
  const tiles = await evaluate(`[...document.querySelectorAll('#tiles .tile')].map((b) => ({ tag: b.tagName, type: b.type,
    pressed: b.getAttribute('aria-pressed'), name: b.querySelector('.name').textContent, note: b.querySelector('.note').textContent,
    tickHidden: b.querySelector('.tick').getAttribute('aria-hidden'), h: Math.round(b.getBoundingClientRect().height) }))`);
  check(tiles.length === 11, '11 tiles', tiles.length);
  tiles.forEach((t, i) => {
    check(t.tag === 'BUTTON' && t.type === 'button', `tile ${i} is a type=button`, t);
    check(t.name === TARGETS[i].name && t.note === TARGETS[i].note, `tile ${i} name/note = TARGETS[${i}] (${TARGETS[i].id})`, t);
    check(t.tickHidden === 'true', `tile ${i} tick is aria-hidden`);
    check(t.h >= 44, `tile ${i} at least 44px tall`, t.h);
  });
  check(same(await pressedNames(), ['Claude', 'ChatGPT']), 'DEFAULT_TARGETS pressed', await pressedNames());
  check(same(await sets(), []), 'no storage writes on load', await sets());
  const group = await evaluate(`({ role: document.getElementById('tiles').getAttribute('role'), by: document.getElementById('tiles').getAttribute('aria-labelledby') })`);
  check(group.role === 'group' && group.by === 'pick-title', 'tile grid is a labelled group', group);
  const hs = await hiddenState();
  check(hs.folder && !hs.folderVisible, 'folder step hidden (no desktop target)', hs);
  check(hs.empty && !hs.emptyVisible, 'empty hint hidden', hs);
  check(!hs.donate && hs.donateVisible, 'donation shown (DONATION is filled in)', hs);
  const sub = await evaluate(`document.querySelector('.sub').textContent`);
  check(sub === "Each one you pick appears in Gmail's right-click menu, its toolbar button and the extension's icon, in this order.", 'step 1 subline', sub);
  const h2 = await evaluate(`[...document.querySelectorAll('h2')].map((h) => h.textContent)`);
  check(same(h2, ['Pick the AIs you use', 'Pick a working folder', 'Toolbars and shortcuts', 'Try it', 'Prompts', 'Something not working?']), 'section titles in the page\'s order (1.5.0: Prompts, in place of 1.4.0\'s Your own instructions, after the four steps)', h2);
  const groups = await evaluate(`[...document.querySelectorAll('#tiles [role=group]')].map((g) => ({ label: document.getElementById(g.getAttribute('aria-labelledby')).textContent,
    names: [...g.querySelectorAll('.tile .name')].map((n) => n.textContent) }))`);
  check(same(groups.map((g) => g.label), ['On your desktop', 'In the browser', 'Anywhere']) && same(groups.flatMap((g) => g.names), TARGETS.map((t) => t.name)),
    'tiles grouped by kind, labelled, in TARGETS order', groups);
  const webNote = await evaluate(`(() => { const n = document.getElementById('group-web-note'); const t = [...document.querySelectorAll('#tiles .tile')].find((b) => b.dataset.id === 'grok');
    return { text: n.textContent, kbd: n.querySelectorAll('kbd').length, describedby: t.getAttribute('aria-describedby') }; })()`);
  check(webNote.text === `Each opens in a new tab next to Gmail with the thread copied. Press ${PASTE_KEY}, then Enter.` && webNote.kbd >= 3 &&
    webNote.describedby === 'tile-grok-note group-web-note', 'one group note with keycaps for the web AIs, linked from each web tile', webNote);
});

await scenario('B04 saved settings: tiles pre-selected from storage, folder step and value shown', async (check) => {
  await open('real', { targets: ['codex', 'perplexity', 'copy'], folder: '/Users/me/Work' });
  check(same(await pressedNames(), ['Codex', 'Perplexity', 'Copy thread for any AI']), 'pressed from storage', await pressedNames());
  const hs = await hiddenState();
  check(!hs.folder && hs.folderVisible, 'folder step visible (Codex selected)', hs);
  check((await evaluate(`document.getElementById('folder').value`)) === '/Users/me/Work', 'folder value restored');
  check(same(await sets(), []), 'no writes on load');
});

await scenario('B05 odd stored values: non-array falls back to defaults; unknown ids only', async (check) => {
  await open('real', { targets: 'claude' });
  check(same(await pressedNames(), ['Claude', 'ChatGPT']), 'non-array -> DEFAULT_TARGETS shown', await pressedNames());
  await open('real', { targets: ['future-ai'] });
  const pressed = await pressedNames();
  const hs = await hiddenState();
  check(pressed.length === 0, 'unknown id: no tile pressed', pressed);
  check(!hs.empty, 'unknown-only selection shows the "Nothing picked yet" hint (menus will be empty)', hs);
});

await scenario('B06 mouse click toggles, saves instantly in TARGETS order, shows then clears "Saved"', async (check) => {
  await open('real', {});
  await click(tileSel('Gemini'));
  await sleep(60);
  check(same(await pressedNames(), ['Claude', 'ChatGPT', 'Gemini']), 'Gemini pressed', await pressedNames());
  check(same((await store()).targets, ['claude', 'chatgpt', 'gemini']), 'stored', (await store()).targets);
  // The fade-in takes 150 ms. Poll for up to 1 s, well before the 1.6 s clear, so a slow machine does not flake.
  let s1;
  for (const end = Date.now() + 1000; ; await sleep(25)) {
    s1 = await evaluate(`(() => { const e = document.getElementById('pick-saved'); return { text: e.textContent, show: e.classList.contains('show'), op: Number(getComputedStyle(e).opacity), role: e.getAttribute('role') }; })()`);
    if (s1.op > 0.95 || Date.now() > end) break;
  }
  check(s1.text === 'Saved' && s1.show && s1.op > 0.95 && s1.role === 'status', '"Saved" fully visible within 1 s, role=status', s1);
  await click(tileSel('Copy thread for any AI'));
  await click(tileSel('Claude Code'));
  await click(tileSel('Claude'));
  await sleep(60);
  check(same((await store()).targets, ['claude-code', 'chatgpt', 'gemini', 'copy']), 'stored in TARGETS order, Claude removed', (await store()).targets);
  check(same((await sets()).length, 4), 'one write per click', (await sets()).length);
  check(!(await hiddenState()).folder, 'folder step appeared after picking Claude Code');
  await sleep(1800);
  const s2 = await evaluate(`(() => { const e = document.getElementById('pick-saved'); return { text: e.textContent, show: e.classList.contains('show') }; })()`);
  check(s2.text === '' && !s2.show, '"Saved" cleared after ~1.6 s', s2);
});

await scenario('B07 keyboard: Tab reaches tiles with a visible focus ring; Space and Enter toggle', async (check) => {
  await open('real', {});
  await press('Tab');
  const f1 = await evaluate(`(() => { const a = document.activeElement; const cs = getComputedStyle(a);
    return { name: a.querySelector?.('.name')?.textContent, outline: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor }; })()`);
  check(f1.name === 'Claude Code', 'first Tab stop is the first tile', f1);
  check(f1.outline === 'solid' && f1.width === '3px', 'focus ring visible (3px solid)', f1);
  await press('Space');
  await sleep(40);
  check((await pressedNames()).includes('Claude Code'), 'Space toggles on', await pressedNames());
  await press('Enter');
  await sleep(40);
  check(!(await pressedNames()).includes('Claude Code'), 'Enter toggles off', await pressedNames());
  // walk the whole tab order
  const order = [];
  for (let i = 0; i < 22; i++) {
    order.push(await evaluate(`(() => { const a = document.activeElement; return a.querySelector?.('.name')?.textContent || a.id || a.textContent.trim().slice(0, 20); })()`));
    await press('Tab');
  }
  check(order.slice(11, 20).join('|') === "Show the button in Gmail's toolbar|Open Gmail|style-resolve|add-prompt|check-gmail|report|donate-link|Privacy|Help", "tab order: 11 tiles, the toolbar-button tile and Open Gmail (steps 1 to 4 together), then the prompts: the chosen default style (one stop for the radio group) and Add a saved prompt (where the text goes waits for a saved prompt), then Check Gmail, Report a problem, Donate, Privacy, Help", order);
  await click(tileSel('Gemini'));
  const mouseFocus = await evaluate(`getComputedStyle(document.activeElement).outlineStyle`);
  check(mouseFocus === 'none', 'no focus ring after a mouse click (focus-visible only)', mouseFocus);
});

await scenario('B08 empty selection: gentle hint, [] stored, survives reload (not reset to defaults)', async (check) => {
  await open('real', {});
  await click(tileSel('Claude'));
  await click(tileSel('ChatGPT'));
  await sleep(60);
  const hs = await hiddenState();
  check(!hs.empty && hs.emptyVisible, 'hint visible', hs);
  const txt = await evaluate(`document.getElementById('empty').textContent`);
  check(txt === 'Nothing picked yet, so nothing will be added to your right-click menu. Pick at least one.', 'hint text', txt);
  const persisted = await store();
  check(same(persisted.targets, []), '[] stored', persisted);
  await open('real', persisted);
  check(same(await pressedNames(), []), 'reload keeps the empty selection', await pressedNames());
  check(!(await hiddenState()).empty, 'hint still shown after reload');
  await click(tileSel('Perplexity'));
  await sleep(30);
  check((await hiddenState()).empty, 'hint hides once something is picked');
});

await scenario('B09 folder step only when Claude Code or Codex is selected', async (check) => {
  await open('real', { targets: ['codex'] });
  check(!(await hiddenState()).folder, 'visible with Codex');
  await click(tileSel('Codex'));
  await sleep(30);
  check((await hiddenState()).folder, 'hidden with neither');
  await click(tileSel('Claude Code'));
  await sleep(30);
  check(!(await hiddenState()).folder, 'visible with Claude Code');
  await click(tileSel('Codex'));
  await click(tileSel('Claude Code'));
  await sleep(30);
  check(!(await hiddenState()).folder, 'visible with Codex only (after deselecting Claude Code)');
  const parts = await evaluate(`({ label: document.querySelector('label[for=folder]').textContent, hint: document.getElementById('folder-hint').textContent.replace(/\\s+/g, ' '),
    describedby: document.getElementById('folder').getAttribute('aria-describedby') })`);
  check(parts.hint === "Recommended. Without one, Codex may ask you to pick a project and Claude Code uses its default folder. On a Mac, right-click the folder in Finder, hold Option and choose Copy as Pathname. On Windows, Shift+right-click it and choose Copy as path.", 'hint text', parts.hint);
  check(parts.label === 'Working folder' && parts.describedby === 'folder-hint', 'label and aria-describedby', parts);
});

await scenario('B10 folder saves on input, debounced 500 ms, Terminal escapes and quotes removed, normalised on blur', async (check) => {
  await open('real', { targets: ['claude-code'] });
  await click(`document.getElementById('folder')`);
  const t0 = Date.now();
  await typeSlowly("'/Users/me/My\\ Work\\ Folder'  ", 40);
  const typing = Date.now() - t0;
  const during = await sets();
  check(during.length === 0, `no write while typing (${typing} ms of keystrokes 40 ms apart)`, during);
  await sleep(300);
  check((await sets()).length === 0, 'still no write 300 ms after the last key');
  await sleep(350);
  const after = await sets();
  check(after.length === 1 && after[0].items.folder === '/Users/me/My Work Folder', 'exactly one write with the cleaned path', after);
  const saved = await evaluate(`document.getElementById('folder-saved').textContent`);
  check(saved === 'Saved', 'folder "Saved" indicator', saved);
  const raw = await evaluate(`document.getElementById('folder').value`);
  check(raw === "'/Users/me/My\\ Work\\ Folder'  ", 'input keeps what you typed until you leave it', raw);
  await press('Tab');
  await sleep(50);
  const norm = await evaluate(`document.getElementById('folder').value`);
  check(norm === '/Users/me/My Work Folder', 'normalised on blur', norm);
  check((await sets()).length === 1, 'no duplicate write on blur (value unchanged)', (await sets()).length);
  // persists across reload
  await open('real', await store());
  check((await evaluate(`document.getElementById('folder').value`)) === '/Users/me/My Work Folder', 'folder restored after reload');
});

await scenario('B11 folder: Windows path kept, blur before debounce saves immediately, clearing saves empty', async (check) => {
  await open('real', { targets: ['codex'] });
  await click(`document.getElementById('folder')`);
  await typeSlowly('C:\\Users\\me\\Work', 10);
  await press('Tab'); // change fires before the 500 ms timer
  await sleep(30);
  let s = await sets();
  check(s.length === 1 && s[0].items.folder === 'C:\\Users\\me\\Work', 'Windows backslashes kept, saved on blur', s);
  await sleep(600);
  check((await sets()).length === 1, 'pending debounce cancelled (no second write)', (await sets()).length);
  await click(`document.getElementById('folder')`);
  await evaluate(`(() => { const i = document.getElementById('folder'); i.select(); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await sleep(650);
  s = await sets();
  check(s.length === 2 && s[1].items.folder === '', 'clearing the field saves an empty folder', s);
});

await scenario('B12 Try it: Open Gmail link and copy', async (check) => {
  await open('real', {});
  const a = await evaluate(`(() => { const a = document.querySelector('.try a'); return { text: a.textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel,
    line: document.querySelector('.try p').textContent, h: Math.round(a.getBoundingClientRect().height) }; })()`);
  check(a.text === 'Open Gmail' && a.href === 'https://mail.google.com/' && a.target === '_blank' && /noopener/.test(a.rel), 'link attributes', a);
  check(a.line === `Right-click any email and pick your AI. Web AIs open with the thread copied: press ${PASTE_KEY}, then Enter.`, 'step 3 line', a.line);
  check(a.h >= 44, 'button at least 44px tall', a.h);
  await evaluate(`window.__clicks = []; document.addEventListener('click', (e) => { const l = e.target.closest('a'); if (l) { window.__clicks.push({ href: l.href, target: l.target }); e.preventDefault(); } }, true); 1`);
  await click(`document.querySelector('.try a')`);
  const clicks = await evaluate('window.__clicks');
  check(same(clicks, [{ href: 'https://mail.google.com/', target: '_blank' }]), 'real click activates the link (new tab, intercepted)', clicks);
  check(same(await evaluate('window.__log.tabsCreate'), []), 'no chrome.tabs.create needed (plain link)');
});

// Gmail tabs that were already open get the content script on install and update (1.2.0), so the
// Try it step no longer asks for a reload first; the #reload notice stays as the fallback.
await scenario('B22 reload line: new copy under Try it; the #reload fallback notice still works', async (check) => {
  await send('Page.navigate', { url: 'about:blank' });
  await open('real', {});
  const hint = await evaluate(`(() => { const p = document.querySelector('.try-hint'); return { text: p.textContent, visible: !!p.offsetParent,
    all: [...document.querySelectorAll('.try-hint')].length, body: document.body.innerText }; })()`);
  check(hint.text === "If the menu doesn't show in a Gmail tab, reload that tab." && hint.visible && hint.all === 1, 'try-hint line', hint.text);
  check(!/Gmail already open\?|Reload that tab first/.test(hint.body), 'old line gone from the page', null);
  check(!/\u2014/.test(hint.text), 'no em dash', hint.text);
  check((await evaluate(`document.getElementById('reload-notice').hidden`)) === true, 'reload notice hidden without #reload');
  await send('Page.navigate', { url: 'about:blank' });
  await open('real', {}, { hash: '#reload' });
  const notice = await evaluate(`(() => { const n = document.getElementById('reload-notice'); return { hidden: n.hidden, visible: !!n.offsetParent, text: n.textContent.replace(/\\s+/g, ' ').trim() }; })()`);
  check(!notice.hidden && notice.visible, 'reload notice shown with #reload (fallback kept)', notice);
  check(notice.text === 'One more step. Reload your Gmail tab, then try again. That Gmail tab could not pick up the extension by itself, so it needs one reload.', 'reload notice text', notice.text);
  // Leave the page as B12 left it: B13 reads the footer without reopening.
  await send('Page.navigate', { url: 'about:blank' });
  await open('real', {});
});

// Upgraders from 1.0 get options.html#new once (background.js); the notice says what is new since 1.0.
await scenario('B23 #new notice for upgraders from 1.0: shown only with #new; names the web AIs, bulk and Claude Code session names', async (check) => {
  await send('Page.navigate', { url: 'about:blank' });
  await open('real', {});
  check((await evaluate(`document.getElementById('new-notice').hidden`)) === true, 'new notice hidden without #new');
  await send('Page.navigate', { url: 'about:blank' });
  await open('real', { targets: ['claude-code', 'codex'] }, { hash: '#new' });
  const n = await evaluate(`(() => { const n = document.getElementById('new-notice'); return { hidden: n.hidden, visible: !!n.offsetParent, text: n.textContent.replace(/\\s+/g, ' ').trim(),
    reload: document.getElementById('reload-notice').hidden }; })()`);
  check(!n.hidden && n.visible && n.reload, 'new notice shown with #new; the reload notice stays hidden', n);
  check(n.text === 'New since 1.0. Pick Claude, ChatGPT, Gemini or another web AI below, or tick several emails in Gmail and send them all at once. Claude Code now names each session after its email.', 'notice text', n.text);
  check(!/\u2014/.test(n.text), 'no em dash', n.text);
  // Leave the page as B12 left it: B13 reads the footer without reopening.
  await send('Page.navigate', { url: 'about:blank' });
  await open('real', {});
});

await scenario('B13 footer copy and links', async (check) => {
  const f = await evaluate(`({ text: document.querySelector('footer span').textContent,
    links: [...document.querySelectorAll('footer a')].map((a) => ({ t: a.textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel })) })`);
  check(f.text === 'Runs on your computer. Nothing is sent to me.', 'footer line', f.text);
  check(same(f.links, [
    { t: 'Privacy', href: 'https://github.com/thomasoclegg/gmail-to-agent/blob/main/PRIVACY.md', target: '_blank', rel: 'noopener' },
    { t: 'Help', href: 'https://thomasoclegg.github.io/gmail-to-agent/', target: '_blank', rel: 'noopener' },
  ]), 'footer links', f.links);
});

await scenario('B14 donation block hidden while DONATION is empty, partial or non-https', async (check) => {
  for (const v of ['donate-empty', 'donate-partial', 'donate-http']) {
    await open(v, {});
    const d = await evaluate(`({ hidden: document.getElementById('donate').hidden, visible: !!document.getElementById('donate').offsetParent,
      text: document.getElementById('donate-text').textContent, link: document.getElementById('donate-link').getAttribute('href') })`);
    check(d.hidden && !d.visible && d.text === '' && d.link === null, `${v}: hidden and unfilled`, d);
  }
});

await scenario('B15 donation block shown when charity and https url are set (modified targets.js copy)', async (check) => {
  await open('donate', {});
  const d = await evaluate(`(() => { const s = document.getElementById('donate'); const a = document.getElementById('donate-link');
    return { visible: !!s.offsetParent, text: document.getElementById('donate-text').textContent, link: a.textContent, href: a.getAttribute('href'),
      target: a.target, rel: a.rel, small: s.querySelector('.small').textContent, h: Math.round(a.getBoundingClientRect().height) }; })()`);
  check(d.visible, 'visible', d);
  check(d.text === "It's free. If it saves you time, please give something to Test Charity.", 'text', d.text);
  check(d.link === 'Donate to Test Charity' && d.href === 'https://example.org/donate' && d.target === '_blank' && /noopener/.test(d.rel), 'button', d);
  check(d.small === 'Donations go straight to them. I never see the money. Paying by PayPal? Write \u201cAI Agent\u201d in the note so they know it came from here.', 'small print', d.small);
  check(d.h >= 44, 'donate button at least 44px tall', d.h);
});

await scenario('B15b the real targets.js shows the Friends of Larnaca Cats donation', async (check) => {
  await open('real', {});
  const d = await evaluate(`(() => { const s = document.getElementById('donate'); const a = document.getElementById('donate-link');
    return { visible: !!s.offsetParent, hidden: s.hidden, text: document.getElementById('donate-text').textContent, link: a.textContent, href: a.getAttribute('href'),
      target: a.target, rel: a.rel, small: s.querySelector('.small').textContent }; })()`);
  check(d.visible && !d.hidden, 'visible', d);
  check(d.text === "It's free. If it saves you time, please give something to Friends of Larnaca Cats, a volunteer group that neuters, feeds and treats street cats in Larnaca, Cyprus.", 'text names the charity and what it does', d.text);
  check(d.link === 'Donate to Friends of Larnaca Cats' && d.href === 'https://www.friendsoflarnacacats.org/donate?ref=ai-agent', 'https link to the charity', d);
  check(d.target === '_blank' && /noopener/.test(d.rel), 'opens in a new tab with rel=noopener', d);
  check(d.small === 'Donations go straight to them. I never see the money. Paying by PayPal? Write \u201cAI Agent\u201d in the note so they know it came from here.', 'small print', d.small);
});

await scenario('B16 donation charity with markup is rendered as text (no HTML injection)', async (check) => {
  await open('donate-markup', {});
  await sleep(100);
  const d = await evaluate(`({ imgs: document.querySelectorAll('#donate img').length, xss: window.__xss || 0,
    text: document.getElementById('donate-text').textContent, link: document.getElementById('donate-link').textContent,
    href: document.getElementById('donate-link').getAttribute('href') })`);
  check(d.imgs === 0 && d.xss === 0, 'no element created, no script run', d);
  check(d.text.includes('<img src=x') && d.link.startsWith('Donate to <img'), 'shown literally', d);
  check(d.href === 'https://example.org/d?a=1&b=2', 'href kept intact', d.href);
});

await scenario('B17 no innerHTML-style sinks in source', async (check) => {
  const sinks = /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write|createContextualFragment|srcdoc)\b/;
  for (const f of ['options.js', 'targets.js', 'options.html', 'background.js', 'offscreen.js', 'content.js']) {
    const src = readFileSync(join(REPO, f), 'utf8');
    const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => sinks.test(l));
    check(hits.length === 0, `${f}: no HTML sinks`, hits);
  }
  const inline = (realHtml.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []).length;
  check(inline === 0, 'options.html has no inline scripts (MV3 CSP)', inline);
  check(!/\son[a-z]+=/i.test(realHtml), 'options.html has no inline event handlers', null);
});

await scenario('B18 settings changed elsewhere (another tab / synced device) while the page is open', async (check) => {
  await open('real', { targets: ['claude', 'chatgpt'] });
  await evaluate(`window.__external({ targets: ['codex'] }); 1`);
  await sleep(50);
  const shown = await pressedNames();
  check(same(shown, ['Codex']), 'page reflects external change', shown);
  await click(tileSel('Gemini'));
  await sleep(50);
  const stored = (await store()).targets;
  check(same(stored, ['codex', 'gemini']), 'next click does not overwrite the external change', stored);
});

await scenario('B21 a failed storage write is not reported as "Saved"', async (check) => {
  await open('real', {});
  await evaluate(`window.__failNextSet = 'MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded'; 1`);
  await click(tileSel('Gemini'));
  await sleep(250);
  const st = await evaluate(`({ saved: document.getElementById('pick-saved').textContent, reads: window.__log.lastErrorReads, failed: window.__log.failedSets,
    pressed: [...document.querySelectorAll('#tiles .tile')].filter((b) => b.getAttribute('aria-pressed') === 'true').length })`);
  const stored = (await store()).targets;
  check(st.failed === 1 && stored === undefined, 'harness control: the write really failed', { st, stored });
  check(st.saved !== 'Saved', 'page does not claim "Saved" after a failed write', st);
  check(st.reads > 0, 'page checks chrome.runtime.lastError', st);
});

await scenario('B19 no horizontal overflow at 1280, 420, 360 and 320 px (light and dark)', async (check) => {
  for (const scheme of ['light', 'dark']) {
    for (const width of [1280, 420, 360, 320]) {
      await open('donate', { targets: TARGETS.map((t) => t.id), folder: '/Users/someone/Documents/A very long folder name/Projects/2026', promptStyle: 'saved1',
        savedPrompt1: { name: 'W'.repeat(40), desktop: `${'x'.repeat(300)}\nSecond line`, web: 'Short.' }, savedPrompt2: { name: 'Quick replies for the threads I open now', desktop: '', web: '' } }, { width, scheme, env: { commands: COMMANDS, gmailTabs: [] } });
      await evaluate(`document.getElementById('check-gmail').click(); document.querySelector('details.where-box').open = true; 1`);
      // The refusal for text too long to sync, under the web box and as the status by the heading; and the Undo line.
      await evaluate(`(() => { const f = document.getElementById('sp1-web'); f.value = '\u4e2d'.repeat(3000); f.dispatchEvent(new Event('change')); document.getElementById('sp2-delete').click(); })()`);
      await sleep(40);
      const o = await evaluate(`(() => { const w = innerWidth; const over = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > w + 0.5 || r.left < -0.5); }).map((e) => e.tagName + '.' + e.className);
        return { w, scroll: document.documentElement.scrollWidth, over }; })()`);
      const refused = await evaluate(`/^Not saved, too long to sync/.test(document.getElementById('sp1-web-count').textContent) && !document.getElementById('undo-line').hidden`);
      check(o.scroll <= o.w && o.over.length === 0 && refused, `${scheme} ${width}px fits, with a 40-character name, the too-long refusal, the Undo line and where the text goes showing`, o);
    }
  }
});

const contrastTable = {};
// contrast helpers run in page
const CONTRAST_FN = `
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) return c; } return parse(getComputedStyle(document.body).backgroundColor); };
`;
await scenario('B20 contrast: text >= 4.5:1 and UI boundaries >= 3:1 in light and dark', async (check) => {
  for (const scheme of ['light', 'dark']) {
    await open('donate', { targets: ['claude-code', 'claude'], folder: '/x', promptStyle: 'saved1', savedPrompt1: { name: 'Mine', desktop: 'Do the work first.', web: '' } }, { scheme, env: { commands: COMMANDS, gmailTabs: [] } });
    await evaluate(`document.getElementById('empty').hidden = false; document.getElementById('pick-saved').textContent = 'Saved'; document.getElementById('pick-saved').classList.add('show'); document.getElementById('check-gmail').click();
      document.querySelector('details.where-box').open = true; document.getElementById('undo-line').hidden = false; document.getElementById('undo-text').textContent = 'Deleted Other.'; 1`);
    await sleep(250);
    const rows = await evaluate(`(() => { ${CONTRAST_FN}
      const txt = (label, sel, kind = 'text') => { const el = document.querySelector(sel); return { label, kind, ratio: ratio(parse(getComputedStyle(el).color), bgOf(el)) }; };
      const border = (label, sel, prop, against) => { const el = document.querySelector(sel); return { label, kind: 'ui', ratio: ratio(parse(getComputedStyle(el)[prop]), against ? parse(getComputedStyle(document.querySelector(against)).backgroundColor) : bgOf(el.parentElement)) }; };
      const ph = (() => { const el = document.getElementById('folder'); return { label: 'placeholder on field', kind: 'text', ratio: ratio(parse(getComputedStyle(el, '::placeholder').color), bgOf(el)) }; })();
      return [
        txt('h1 on page', 'h1'), txt('header line on page', 'header p'), txt('subline on card', '.sub'),
        txt('tile name (unselected)', '.tile[aria-pressed=false] .name'), txt('tile note (unselected)', '.tile[aria-pressed=false] .note'),
        txt('tile name (selected)', '.tile[aria-pressed=true] .name'), txt('tile note (selected)', '.tile[aria-pressed=true] .note'),
        txt('"Saved" on card', '#pick-saved'), txt('empty hint', '#empty'), txt('folder label', 'label'), txt('folder text', '#folder'), ph,
        txt('folder hint', '#folder-hint'), txt('Open Gmail button', '.try a'), txt('try line', '.try p'), txt('donate text', '#donate-text'),
        txt('donate button', '#donate-link'), txt('donate small', '#donate .small'), txt('footer line', 'footer span'), txt('footer link', 'footer a'),
        txt('step number', '.num'),
        // No cards: rows are hairlines and the checkbox carries the control's boundary and state.
        border('tick box border vs page', '.tile[aria-pressed=false] .tick', 'borderTopColor'),
        { label: 'selected tick fill vs page', kind: 'ui', ratio: ratio(parse(getComputedStyle(document.querySelector('.tile[aria-pressed=true] .tick')).backgroundColor), bgOf(document.body)) },
        border('folder input underline vs page', '#folder', 'borderBottomColor', 'body'),
        { label: 'focus ring (rubric) vs page', kind: 'ui', ratio: ratio(parse(getComputedStyle(document.documentElement).getPropertyValue('--rubric').trim().replace(/^#(..)(..)(..)$/, (m, r, g, b) => 'rgb(' + [r, g, b].map((h) => parseInt(h, 16)).join(',') + ')')), bgOf(document.body)) },
        txt('group label', '.group-label'), txt('group note', '.group-note'), txt('keycap', '.group-note kbd kbd'),
        // 1.4.0: the toolbar tile, the shortcut keys, Check Gmail and Report a problem.
        txt('toolbar tile name', '#toolbar-tile .name'), txt('toolbar tile note', '#toolbar-tile .note'), txt('shortcut label', '.keys dt'),
        txt('shortcut keycap', '.keys dd kbd'), txt('change shortcuts link', '#shortcuts-change'), txt('Check Gmail button', '#check-gmail'),
        txt('Report a problem link', '#report'), txt('check answer', '#check-results li'), txt('report note', '#report-note'),
        border('Check Gmail button border vs page', '#check-gmail', 'borderTopColor'),
        // 1.5.0: the prompts.
        txt('prompts subline', '#prompts-sub'), txt('default style legend', 'fieldset.styles legend'), txt('style name', '.style-name'), txt('style note', '.style-note'), txt('styles hint', '#styles-hint'),
        border('style radio border vs page', 'label.style input:not(:checked)', 'borderTopColor', 'body'),
        { label: 'chosen style radio vs page', kind: 'ui', ratio: ratio(parse(getComputedStyle(document.querySelector('label.style input:checked')).borderTopColor), bgOf(document.body)) },
        txt('saved prompts heading', '#saved-title'), txt('saved prompts line', '#saved-sub'), txt('saved prompt title', '.sp-title'), txt('saved prompt Delete', '.sp-delete'), txt('in-use line', '.sp-use'), txt('make it the default', '.sp-use button.link'),
        txt('name label', 'label[for=sp1-name]'), txt('name text', '#sp1-name'), txt('name count', '#sp1-name-count'), border('name underline vs page', '#sp1-name', 'borderBottomColor', 'body'),
        txt('box label', 'label[for=sp1-desktop]'), txt('box text', '#sp1-desktop'), txt('box count', '#sp1-desktop-count'), txt('desktop hint', '#own-desktop-hint'), txt('web hint', '#own-web-hint'),
        txt('Add a saved prompt button', '#add-prompt'), border('Add button border vs page', '#add-prompt', 'borderTopColor'), txt('Undo line', '#undo-text'), txt('Undo link', '#undo'),
        txt('where it goes: disclosure', 'details.where-box summary'), txt('where it goes: label', '.where-label'), txt('where it goes: a part', '.where li:not(.you)'), txt('where it goes: your text', '.where li.you'),
        (() => { const el = document.getElementById('sp1-web'); return { label: 'empty box placeholder', kind: 'text', ratio: ratio(parse(getComputedStyle(el, '::placeholder').color), bgOf(el)) }; })(),
        border('box border vs page', '#sp1-desktop', 'borderTopColor', 'body'),
      ]; })()`);
    for (const r of rows) {
      const min = r.kind === 'ui' ? 3 : 4.5;
      check(r.ratio >= min, `${scheme}: ${r.label} ${r.ratio}:1 (min ${min})`, r.ratio);
    }
    contrastTable[scheme] = rows;
  }
});

// ---------- 1.4.0: Gmail's toolbar button setting, the shortcuts, Check Gmail and Report a problem ----------

const toolbarTile = () => evaluate(`(() => { const t = document.getElementById('toolbar-tile'); return { pressed: t.getAttribute('aria-pressed'), name: t.querySelector('.name').textContent,
  note: t.querySelector('.note').textContent, saved: document.getElementById('toolbar-saved').textContent, h: Math.round(t.getBoundingClientRect().height) }; })()`);

await scenario('B24 "Show the button in Gmail\'s toolbar": on by default, saves as you click, reverts a failed write, follows a change made elsewhere', async (check) => {
  await open('real', {});
  let t = await toolbarTile();
  check(t.pressed === 'true' && t.name === "Show the button in Gmail's toolbar" && t.note === "It sits before Gmail's More button and reads Send to AI, Send 3 to AI or Triage unread." && t.h >= 44, 'on by default, with its name and note', t);
  check(same(await sets(), []), 'nothing written on load');
  await click(`document.getElementById('toolbar-tile')`);
  await sleep(80);
  t = await toolbarTile();
  check(t.pressed === 'false' && (await store()).toolbarButton === false && t.saved === 'Saved', 'a click turns it off and saves false', { t, store: await store() });
  await click(`document.getElementById('toolbar-tile')`);
  await sleep(80);
  check((await store()).toolbarButton === true && (await toolbarTile()).pressed === 'true', 'a second click turns it on again');
  await evaluate(`window.__failNextSet = 'quota'; 1`);
  await click(`document.getElementById('toolbar-tile')`);
  await sleep(120);
  t = await toolbarTile();
  check(t.pressed === 'true' && t.saved === 'Not saved, try again', 'a failed write puts the tile back and says so', t);
  await evaluate(`window.__external({ toolbarButton: false }); 1`);
  await sleep(40);
  check((await toolbarTile()).pressed === 'false', 'a change from another tab or device shows');
  await open('real', { toolbarButton: false });
  check((await toolbarTile()).pressed === 'false', 'a stored false shows as off');
});

await scenario('B25 keyboard shortcuts: the keys the browser assigned, "Not set" for one it left unset, and a link to the shortcuts page (Chrome), Firefox\'s own method, or none', async (check) => {
  await open('real', {}, { env: { commands: [COMMANDS[0], { ...COMMANDS[1], shortcut: '' }] } });
  const keys = await evaluate(`(() => { const dl = document.getElementById('shortcuts'); return { hidden: dl.hidden, rows: [...dl.querySelectorAll('dt')].map((dt) => ({ label: dt.textContent,
    keys: [...dt.nextElementSibling.querySelectorAll('kbd')].map((k) => k.textContent), text: dt.nextElementSibling.textContent, unset: dt.nextElementSibling.classList.contains('unset') })),
    hint: document.getElementById('shortcuts-hint').hidden ? null : document.getElementById('shortcuts-hint').textContent.replace(/\\s+/g, ' ').trim() }; })()`);
  check(!keys.hidden && same(keys.rows, [
    { label: 'Open the list of your AIs', keys: ['Alt', 'Shift', 'O'], text: 'Alt+Shift+O', unset: false },
    { label: 'Send to the AI you used last', keys: [], text: 'Not set', unset: true },
  ]), 'two rows: keycaps for the assigned key (the "+" kept for screen readers), "Not set" for the other', keys.rows);
  check(keys.hint === 'A shortcut shows as not set when another extension already has its keys. Change the shortcuts', 'the hint and its link', keys.hint);
  await click(`document.getElementById('shortcuts-change')`);
  await sleep(40);
  check(same(await evaluate('window.__log.tabsCreate'), [{ url: 'chrome://extensions/shortcuts' }]), "Chrome: the link opens chrome://extensions/shortcuts in a tab", await evaluate('window.__log.tabsCreate'));
  await open('real', {}, { env: { commands: [{ name: '_execute_action', shortcut: '⌥⇧O' }, COMMANDS[1]], openShortcutSettings: true } });
  const mac = await evaluate(`[...document.querySelectorAll('#shortcuts dd')].map((dd) => [...dd.querySelectorAll('kbd')].map((k) => k.textContent))`);
  check(same(mac, [['⌥⇧O'], ['Alt', 'Shift', 'L']]), "Chrome on a Mac gives symbols with no '+': one keycap", mac);
  await click(`document.getElementById('shortcuts-change')`);
  await sleep(40);
  check((await evaluate('window.__log.shortcutSettings')) === 1 && same(await evaluate('window.__log.tabsCreate'), []), "Firefox: commands.openShortcutSettings, not a tab");
  await open('real', {}, { env: { commands: [{ name: '_execute_action', shortcut: 'MacCtrl+Shift+O' }, { name: 'send-to-last', shortcut: '⌃⇧L' }] } });
  const macKeys = await evaluate(`[...document.querySelectorAll('#shortcuts dd')].map((dd) => [...dd.querySelectorAll('kbd')].map((k) => k.textContent))`);
  check(same(macKeys, [['Control', 'Shift', 'O'], ['⌃⇧L']]), "the Mac keys (1.4.0): Firefox's MacCtrl shows as Control, the key's name on a Mac; Chrome's symbols stay one keycap", macKeys);
  await open('real', {});
  check((await evaluate(`document.getElementById('shortcuts').hidden && document.getElementById('shortcuts-hint').hidden`)) === true, 'no commands API: the shortcut rows stay hidden');
});

const checkState = () => evaluate(`({ lines: [...document.querySelectorAll('#check-results li')].map((li) => li.textContent), hidden: document.getElementById('check-results').hidden,
  status: document.getElementById('check-status').textContent, focus: document.activeElement?.id, verdict: document.querySelector('#check-results li.verdict')?.textContent ?? null,
  href: document.getElementById('report').href, target: document.getElementById('report').target, rel: document.getElementById('report').rel,
  sent: window.__log.tabsMessages })`);
const reportBody = (href) => new URL(href).searchParams.get('body');

await scenario('B26 Check Gmail: asks the Gmail tab in front (or the one used last) and lists plain answers; no tab, or no content script, says what to do', async (check) => {
  await open('real', {}, { env: { gmailTabs: [] } });
  let c = await checkState();
  check(c.hidden && reportBody(c.href).endsWith('Check Gmail:\n- not run'), 'before a check: no answers, and the report says the check was not run', reportBody(c.href));
  await click(`document.getElementById('check-gmail')`);
  await sleep(80);
  c = await checkState();
  check(!c.hidden && same(c.lines, ['Gmail tab: none open. Open Gmail, then check again.']) && c.sent.length === 0, 'no Gmail tab open', c.lines);
  check(c.status === 'Checked: 1 answer below.' && c.focus === 'check-gmail', 'the status line says the check is done, and keyboard focus stays on the button', c);
  await open('real', {}, { env: { gmailTabs: [{ id: 7, active: false, lastAccessed: 5 }], answers: {} } });
  await click(`document.getElementById('check-gmail')`);
  await sleep(80);
  c = await checkState();
  check(same(c.lines, ['Something is missing: reload the Gmail tab, then check again.', 'Gmail tab: found.', 'The extension in that tab: not running. Reload the Gmail tab, then check again.']), 'a Gmail tab with no content script: the verdict first, then the answers', c.lines);
  const answer = { ok: true, rows: 50, thread: false, menu: true, toolbar: true, button: true, buttonOn: true };
  await open('real', {}, { env: { gmailTabs: [{ id: 7, active: false, lastAccessed: 5 }, { id: 8, active: false, lastAccessed: 9 }, { id: 9, active: true, lastAccessed: 1 }], answers: { 9: { check: answer }, 8: { check: answer } } } });
  await click(`document.getElementById('check-gmail')`);
  await sleep(80);
  c = await checkState();
  check(same(c.sent, [{ tabId: 9, msg: { target: 'content', action: 'check' }, options: { frameId: 0 } }]), 'one message, to the Gmail tab in front (top frame)', c.sent);
  check(same(c.lines, ['Everything the extension needs is there.', 'Gmail tab: found.', 'The extension in that tab: running.', 'Email rows in the list: 50 found.', 'Open email: none open.', "Gmail's right-click menu: found.", "Gmail's toolbar: found, with the button in it."]), 'the verdict, then the plain answers', c.lines);
  check(c.verdict === 'Everything the extension needs is there.' && c.status === 'Checked: 7 answers below.', 'the verdict comes first and stands out; the status line (role=status, there and empty from the start) says how many answers there are', c);
  check((await evaluate(`(() => { const st = document.getElementById('check-status'); return st.getAttribute('role') === 'status' && !document.getElementById('check-results').hasAttribute('aria-live'); })()`)) === true, 'one live region: the status line, not the list');
  await open('real', {}, { env: { gmailTabs: [{ id: 7, active: false, lastAccessed: 5 }, { id: 8, active: false, lastAccessed: 9 }], answers: { 8: { check: { ...answer, rows: 0, thread: true, menu: false, toolbar: false, button: false } } } } });
  await click(`document.getElementById('check-gmail')`);
  await sleep(80);
  c = await checkState();
  check(c.sent[0]?.tabId === 8 && same(c.lines, ['Something is missing: reload the Gmail tab, then check again.', 'Gmail tab: found.', 'The extension in that tab: running.', 'Email rows in the list: not checked while an email is open.', 'Open email: found.', "Gmail's right-click menu: not seen yet. Right-click an email in Gmail, then check again.", "Gmail's toolbar: not found, so the extension's button cannot show there."]), 'none in front: the one used last; what was not found, in plain words; rows not counted with an email open', c.lines);
  await open('real', {}, { env: { gmailTabs: [{ id: 7, active: true }], answers: { 7: { check: { ...answer, rows: 0, menu: false } } } } });
  await click(`document.getElementById('check-gmail')`);
  await sleep(80);
  c = await checkState();
  check(c.lines[0] === "Nothing is missing so far. Right-click an email in Gmail, then check again to include Gmail's menu." && c.lines[3] === 'Email rows in the list: none found.', "nothing missing, Gmail's menu not seen yet: says how to finish the check", c.lines);
  await open('real', {}, { env: { gmailTabs: [{ id: 7, active: true }], answers: { 7: { check: { ...answer, button: false } } } } });
  await click(`document.getElementById('check-gmail')`);
  await sleep(80);
  c = await checkState();
  check(c.lines[0] === 'Something is missing: reload the Gmail tab, then check again.' && c.lines.at(-1) === "Gmail's toolbar: found, but the button is not in it yet. Reload the Gmail tab, then check again.", 'the toolbar found without the button: what to do', c.lines);
  // From the keyboard, focus stays on the button through the check (aria-disabled while it runs, never disabled).
  // The tab takes 400 ms to answer here, so the page can be seen while it waits.
  await open('real', {}, { env: { gmailTabs: [{ id: 7, active: true }], answers: { 7: { check: answer } }, answerDelay: 400 } });
  await evaluate(`document.getElementById('check-gmail').focus(); 1`);
  await press('Enter');
  await sleep(100);
  const during = await evaluate(`({ aria: document.getElementById('check-gmail').getAttribute('aria-disabled'), disabled: document.getElementById('check-gmail').disabled, focus: document.activeElement?.id })`);
  await sleep(500);
  c = await checkState();
  check(during.aria === 'true' && !during.disabled && during.focus === 'check-gmail' && c.focus === 'check-gmail' && (await evaluate(`document.getElementById('check-gmail').hasAttribute('aria-disabled')`)) === false, 'Enter: busy while it checks, focus kept on the button throughout', { during, after: c.focus });
  await open('real', {}, { env: { gmailTabs: [{ id: 7, active: true }], answers: { 7: { check: { ...answer, buttonOn: false, button: false } } } } });
  await click(`document.getElementById('check-gmail')`);
  await sleep(80);
  check((await checkState()).lines.at(-1) === "Gmail's toolbar: found (the button is turned off here).", 'the button turned off in settings', (await checkState()).lines);
});

await scenario('B27 Report a problem: a new GitHub issue with the version, the browser and the check\'s answers; never email text or the mailbox', async (check) => {
  const answer = { ok: true, rows: 12, thread: true, menu: true, toolbar: true, button: true, buttonOn: true, subject: 'Quarterly order', mailbox: 'sam@example.com' };
  await open('real', {}, { env: { version: '1.4.0', gmailTabs: [{ id: 7, active: true }], answers: { 7: { check: answer } } } });
  await click(`document.getElementById('check-gmail')`);
  await sleep(80);
  const c = await checkState();
  const url = new URL(c.href);
  const body = url.searchParams.get('body');
  check(url.origin + url.pathname === 'https://github.com/thomasoclegg/gmail-to-agent/issues/new' && url.searchParams.get('title') === 'Problem: ' && c.target === '_blank' && /noopener/.test(c.rel), "GitHub's new-issue form, in a new tab", c.href.slice(0, 120));
  const ua = await evaluate('navigator.userAgent');
  check(body.includes('\nVersion: 1.4.0\n') && /\nBrowser: .+\d+ on .+\n/.test(body) && body.startsWith('What happened:\n\n\nWhat I expected:\n\n\n---\n'), 'the version and the browser, under two questions for the person reporting', body);
  check(body.endsWith(['Check Gmail:', '- Everything the extension needs is there.', '- Gmail tab: found.', '- The extension in that tab: running.', '- Email rows in the list: not checked while an email is open.', '- Open email: found.', "- Gmail's right-click menu: found.", "- Gmail's toolbar: found, with the button in it."].join('\n')), 'the check\'s answers, as listed on the page', body.split('\n').slice(-8));
  const browserLine = body.split('\n').find((l) => l.startsWith('Browser: '));
  check(/ on (macOS|Windows|Linux|Chrome OS|ChromeOS|Android)$/.test(browserLine) && !/MacIntel|Win32|x86_64/.test(browserLine), 'the operating system by its name, not navigator.platform\'s code', browserLine);
  check(!/Quarterly|sam@example\.com|@/.test(body) && !body.includes(ua), 'no email text, no mailbox address, not the whole user-agent string', body);
  const note = await evaluate(`document.getElementById('report-note').textContent.replace(/\\s+/g, ' ').trim()`);
  // 1.4.0: the details travel in the link, so GitHub has them once the page opens; the note says so.
  check(note === "The report opens a new GitHub issue with the version, your browser's name, version and operating system, and the check's answers filled in. It never includes email text or your mailbox address. These details travel in that page's web address, so GitHub receives them when the page opens; nothing is posted until you submit the issue yourself.", 'the note under it', note);
});

await scenario('B28 pinning the icon: the step says how in Chrome, Edge and Firefox, which keep a new extension\'s icon in their Extensions menu; Safari shows it in the toolbar', async (check) => {
  const chromeUa = await evaluate('navigator.userAgent');
  const pinText = () => evaluate(`document.getElementById('pin-hint').textContent.replace(/\\s+/g, ' ').trim()`);
  const want = {
    chrome: 'Pin the extension: click the puzzle piece next to the address bar, then the pin next to Open in AI Agent. Its icon lists your AIs.',
    edge: 'Pin the extension: click the Extensions button (the puzzle piece) next to the address bar, then the eye next to Open in AI Agent. Its icon lists your AIs.',
    firefox: 'Pin the extension: click the Extensions button (the puzzle piece) in the toolbar, then the gear next to Open in AI Agent and Pin to Toolbar. Its icon lists your AIs.',
    safari: "The extension's icon in Safari's toolbar lists your AIs.",
  };
  const uas = {
    edge: `${chromeUa} Edg/156.0.0.0`,
    firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:159.0) Gecko/20100101 Firefox/159.0',
    safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15',
  };
  try {
    await open('real', {});
    check((await pinText()) === want.chrome, 'Chrome', await pinText());
    const where = await evaluate(`(() => { const pin = document.getElementById('pin-hint'); return pin.closest('section')?.id === 'toolbar-step' && pin.previousElementSibling?.classList.contains('rows'); })()`);
    check(where === true, 'in the toolbars step, under the toolbar-button tile');
    for (const [name, ua] of Object.entries(uas)) {
      await send('Emulation.setUserAgentOverride', { userAgent: ua });
      await open('real', {});
      check((await pinText()) === want[name], name, await pinText());
    }
  } finally {
    await send('Emulation.setUserAgentOverride', { userAgent: chromeUa });
  }
});

// The extension's note (toast.js) in a page of its own, as screen readers see it: the accessibility tree.
const toastPage = join(PAGES, 'toast.html');
writeFileSync(toastPage, `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Note</title></head><body><p>A page.</p><script src="${fileUrl(join(REPO, 'toast.js'))}"></script></body></html>`);
async function liveRegions() {
  const { nodes } = await send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  // Text as screen readers get it: StaticText names (their InlineTextBox children repeat them).
  const textOf = (n) => (n.role?.value === 'StaticText' ? n.name?.value || '' : (n.childIds || []).map((id) => byId.get(id)).filter((c) => c && !c.ignored).map(textOf).join(''));
  const regions = nodes.filter((n) => !n.ignored && ['status', 'alert'].includes(n.role?.value)).map((n) => ({ role: n.role.value, live: n.properties?.find((x) => x.name === 'live')?.value?.value, text: textOf(n) }));
  const texts = nodes.filter((n) => !n.ignored && n.role?.value === 'StaticText').map((n) => n.name?.value || '');
  return { regions, texts };
}

// ---------- 1.5.0: prompts (the default style and the saved prompts) ----------

// What the Prompts section shows: the styles, each saved prompt's card, Add, the Undo line, and where focus is.
const promptsState = () => evaluate(`(() => {
  const t = (id) => document.getElementById(id);
  const card = (el) => { const n = el.id.slice(2); const f = (p) => t('sp' + n + '-' + p);
    const box = (g) => ({ shown: !!f(g).offsetParent, value: f(g).value, count: f(g + '-count').textContent, full: f(g + '-count').classList.contains('full'),
      invalid: f(g).getAttribute('aria-invalid') === 'true', max: f(g).maxLength, placeholder: f(g).placeholder });
    return { n: Number(n), title: f('title').textContent, name: f('name').value, nameCount: f('name-count').textContent, nameMax: f('name').maxLength,
      namePlaceholder: f('name').placeholder, del: f('delete').getAttribute('aria-label'), desktop: box('desktop'), web: box('web'), status: f('saved').textContent,
      use: f('use').textContent, makeDefault: f('make-default').hidden ? null : f('make-default').getAttribute('aria-label'), origin: f('origin').hidden ? null : f('origin').textContent }; };
  return { section: !t('prompts').hidden,
    styles: [...document.querySelectorAll('#style-list input')].map((i) => ({ id: i.value, checked: i.checked, name: t(i.getAttribute('aria-labelledby')).textContent, note: t(i.getAttribute('aria-describedby')).textContent })),
    cards: [...document.querySelectorAll('#saved-list .saved-prompt')].map(card), add: !t('add-prompt').hidden, undo: t('undo-line').hidden ? null : t('undo-text').textContent,
    saved: t('prompts-saved').textContent, focus: document.activeElement?.id || document.activeElement?.tagName,
    hints: { desktop: !t('own-desktop-hint').hidden, web: !t('own-web-hint').hidden, where: !document.querySelector('details.where-box').hidden },
    legacy: t('legacy-notice').hidden ? null : t('legacy-text').textContent }; })()`);
const PROMPT_KEY = /^(promptStyle|savedPrompt\d|desktopInstructions|webInstructions)$/;
const promptSets = async () => (await sets()).filter((x) => Object.keys(x.items).some((k) => PROMPT_KEY.test(k))).map((x) => x.items);
const removes = () => evaluate('window.__log.removes.map((r) => r.keys)');
const checked = (st) => st.styles.find((s) => s.checked)?.id;
// The same stored items, whatever order the keys were written in.
const sameStore = (a, b) => same(Object.entries(a).sort(([x], [y]) => (x < y ? -1 : 1)), Object.entries(b).sort(([x], [y]) => (x < y ? -1 : 1)));
const PRESET_ROWS = [
  ['resolve', 'Resolve fully', 'Does the work behind each email first, then drafts, and sets aside what cannot be finished now. The most thorough.'],
  ['quick', 'Quick summary and reply', 'Where each email stands and what is asked of you, then a draft reply where one is needed. No deeper work.'],
  ['drafts', 'Draft replies only', 'Just a draft reply for each email that needs one, in as few words as will do.'],
];
// 1.5.0: a new default is written after a short pause (moving through the radios writes once).
const STYLE_PAUSE = 400;
const IN_USE = "In use: your default style, for Gmail's menus, its toolbar button and the shortcut.";
const NOT_IN_USE = 'Not in use until you make it the default, or pick it in the toolbar list for one send.';
const ORIGIN = 'From 1.4.0: your own instructions, kept as this saved prompt.';
async function arrowDown() {
  const k = { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
}
async function blurAll() {
  await evaluate(`document.activeElement.blur(); 1`);
  await sleep(40);
}
// Bytes as Chromium's storage.sync counts them: the key, then the value as JSON in UTF-8, "<" and the separators as six.
const chromiumBytes = (k, v) => new TextEncoder().encode(k + JSON.stringify(v).replace(/[<\u2028\u2029]/g, '\\u003C')).length;
// How many characters of a group's text fit in the item with the rest as it is (from the spec, not options.js).
function fitChars(key, item, group) {
  let n = item[group].length;
  while (n > 0 && chromiumBytes(key, { ...item, [group]: item[group].slice(0, n) }) > 8192) n--;
  return n;
}

await scenario('B29 Prompts: the section shows while any AI is picked, after steps 1 to 4 in the page\'s order (in the left-hand column on a wide screen); the default style is a labelled radio group of the presets, Resolve fully first; a click or the arrow keys choose it, written once after a pause; forced colours still show which is chosen; it follows a change made elsewhere', async (check) => {
  await open('real', {});
  let st = await promptsState();
  check(st.section && same(st.styles.map((s) => [s.id, s.name, s.note]), PRESET_ROWS) && checked(st) === 'resolve', 'defaults: the section, the three presets with their notes, Resolve fully chosen', st.styles);
  check(!st.cards.length && st.add && st.undo === null && !st.hints.web && !st.hints.desktop && !st.hints.where && st.legacy === null, 'no saved prompts yet: Add shows, and the writing hints and where the text goes wait until there is one', st);
  check(same(await sets(), []) && same(await removes(), []), 'nothing written on load');
  const copy = await evaluate(`(() => { const t = (id) => document.getElementById(id); const fs = document.querySelector('fieldset.styles');
    return { title: t('prompts-title').textContent, sub: t('prompts-sub').textContent.replace(/\\s+/g, ' '), legend: fs.querySelector('legend').textContent, fsDescribed: fs.getAttribute('aria-describedby'),
      hint: t('styles-hint').textContent.replace(/\\s+/g, ' '), savedTitle: t('saved-title').textContent, savedTag: t('saved-title').tagName, savedSub: t('saved-sub').textContent.replace(/\\s+/g, ' '),
      savedRole: t('prompts-saved').getAttribute('role'), radios: [...document.querySelectorAll('#style-list input')].map((i) => i.type + ':' + i.name),
      add: t('add-prompt').tagName + ':' + t('add-prompt').type + ':' + t('add-prompt').textContent, summary: document.querySelector('details.where-box summary').textContent,
      hintsFirst: !!(t('saved-sub').compareDocumentPosition(t('own-desktop-hint')) & 4) && !!(document.querySelector('details.where-box').compareDocumentPosition(t('saved-list')) & 4) }; })()`);
  check(copy.title === 'Prompts' && copy.savedRole === 'status', 'heading "Prompts" with a role=status "Saved"', copy);
  check(copy.sub === 'How your AIs are asked about one email or several. Triage unread and selected text always keep their built-in prompts.', 'the line under the heading', copy.sub);
  check(copy.legend === 'Default style' && copy.fsDescribed === 'styles-hint' && copy.radios.every((r) => r === 'radio:style'), 'a fieldset with the legend "Default style", described by its hint; one radio group', copy);
  check(copy.hint === "Gmail's menus, its toolbar button and the shortcut use the default. The extension's toolbar list can use another style for one send.", 'the hint: which routes use the default, and that the toolbar list can pick another for one send', copy.hint);
  check(copy.savedTitle === 'Saved prompts' && copy.savedTag === 'H3' && copy.savedSub === 'Up to 3 prompts of your own. Text in a box replaces the built-in task for its AIs when the prompt is the default style or is picked in the toolbar list; an empty box uses what the default style uses for those AIs (Resolve fully, if that is empty too). Saved with your settings, so it syncs with your browser: leave out passwords and other secrets.', 'the saved prompts: a heading and a line that says when the text is used, what an empty box uses, and that it syncs', copy.savedSub);
  check(copy.add === 'BUTTON:button:Add a saved prompt' && copy.summary === 'Where your text goes' && copy.hintsFirst, 'Add is a button; the hints and where the text goes come before the cards, to be read before writing', copy);
  const rowH = await evaluate(`Math.min(...[...document.querySelectorAll('#style-list label.style')].map((l) => l.getBoundingClientRect().height))`);
  check(rowH >= 44, 'each style row is at least 44 px tall', rowH);
  // Steps 1 to 4 stay together in the page's order (so for Tab and in one column), and Prompts follows them; on a wide
  // screen it sits in the left-hand column under the AIs, beside steps 2 to 4.
  const where = (w) => evaluate(`(() => { const box = (el) => el.getBoundingClientRect(); const t = (id) => document.getElementById(id);
    const order = [...document.querySelectorAll('main section, main > div')].filter((e) => e.offsetParent).map((e) => e.id || e.className.split(' ')[0]);
    const pick = box(document.querySelector('section.pick')), prompts = box(t('prompts')), later = box(document.querySelector('.later')), tryIt = box(t('try-title').closest('section'));
    return { w: ${w}, order, leftColumn: Math.abs(prompts.left - pick.left) < 1 && prompts.top > pick.bottom, beside: later.left > pick.right && later.top < prompts.top, belowTry: prompts.top > tryIt.bottom }; })()`);
  await open('real', { targets: ['claude-code', 'claude'] });
  let w = await where(1280);
  check(same(w.order, ['pick', 'later', 'folder-step', 'toolbar-step', 'step', 'prompts', 'check', 'donate']) && w.leftColumn && w.beside, '1280 px: in the page, the AIs, steps 2 to 4, then Prompts, the check and the donation; Prompts shows in the left-hand column under the AIs, beside the steps', w);
  const tabs = [];
  await evaluate(`document.getElementById('folder').focus(); 1`);
  for (let i = 0; i < 12; i++) {
    await press('Tab');
    tabs.push(await evaluate('document.activeElement.id || document.activeElement.textContent.trim().slice(0, 20)'));
  }
  check(tabs.indexOf('style-resolve') > tabs.indexOf('toolbar-tile') && tabs.indexOf('style-resolve') > tabs.indexOf('Open Gmail'), 'Tab from the working folder: the toolbar step and Try it, then the prompts', tabs);
  await open('real', { targets: ['claude-code', 'claude'] }, { width: 420 });
  w = await where(420);
  check(w.belowTry, '420 px, one column: Prompts after Try it', w);

  // A click chooses at once and writes after a short pause.
  await open('real', {});
  await click(`document.querySelector('label[for=style-quick]')`);
  await sleep(60);
  st = await promptsState();
  check(checked(st) === 'quick' && same(await promptSets(), []), 'a click on a row: Quick summary and reply chosen at once; nothing written yet', { st: checked(st), sets: await promptSets() });
  await sleep(STYLE_PAUSE + 100);
  check(same(await promptSets(), [{ promptStyle: 'quick' }]) && (await promptsState()).saved === 'Saved', 'written after the pause, then "Saved"', await promptSets());
  // The arrow keys move and choose, as in any radio group; Tab lands on the chosen one; moving through several writes once.
  await press('Tab', 8);
  await press('Tab');
  await sleep(40);
  const ring = await evaluate(`(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { id: a.id, outline: cs.outlineStyle, width: cs.outlineWidth }; })()`);
  check(ring.id === 'style-quick' && ring.outline === 'solid' && ring.width === '3px', 'Tab reaches the chosen style, with the 3px focus ring', ring);
  await arrowDown();
  await sleep(60);
  st = await promptsState();
  check(checked(st) === 'drafts' && st.focus === 'style-drafts', 'ArrowDown: Draft replies only', { c: checked(st) });
  await arrowDown();
  await sleep(60);
  check(checked(await promptsState()) === 'resolve', 'ArrowDown from the last wraps to Resolve fully');
  await sleep(STYLE_PAUSE + 100);
  check(same(await promptSets(), [{ promptStyle: 'quick' }, { promptStyle: 'resolve' }]), 'two moves within the pause: one write, of the last', await promptSets());
  const burst = (await sets()).length;
  for (let i = 0; i < 31; i++) {
    await arrowDown();
    await sleep(5);
  }
  await sleep(STYLE_PAUSE + 100);
  check((await sets()).length === burst + 1 && (await store()).promptStyle === checked(await promptsState()), 'holding ArrowDown through 31 moves: one write, so the write quota is never used up', { writes: (await sets()).length - burst });
  // A failed write puts the choice back.
  const before = (await store()).promptStyle;
  const other = before === 'drafts' ? 'quick' : 'drafts';
  await evaluate(`window.__failNextSet = 'MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded'; 1`);
  await click(`document.querySelector('label[for=style-${other}]')`);
  await sleep(STYLE_PAUSE + 100);
  st = await promptsState();
  check(checked(st) === before && st.saved === 'Not saved, try again' && (await store()).promptStyle === before, 'a failed write: "Not saved, try again" and the stored style chosen again', { c: checked(st), saved: st.saved });
  // Leaving the page within the pause writes it.
  await click(`document.querySelector('label[for=style-${other}]')`);
  await sleep(30);
  await evaluate(`dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); 1`);
  await sleep(40);
  check((await store()).promptStyle === other, 'pagehide within the pause: the choice is written', (await store()).promptStyle);

  // Windows High Contrast (forced colours) drops background images: the chosen radio must still look chosen.
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
  await sleep(60);
  const forced = await evaluate(`(() => { const look = (el) => { const cs = getComputedStyle(el); return [cs.backgroundColor, cs.backgroundImage, cs.boxShadow].join(' | '); };
    const on = document.querySelector('#style-list input:checked'); const off = document.querySelector('#style-list input:not(:checked)'); return { forced: matchMedia('(forced-colors: active)').matches, on: look(on), off: look(off) }; })()`);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'none' }] });
  check(forced.forced && forced.on !== forced.off && /inset/.test(forced.on), 'forced colours: the chosen radio is drawn with system colours (a dot), unlike the others', forced);

  // Elsewhere, and next time.
  await evaluate(`window.__external({ promptStyle: 'quick' }); 1`);
  await sleep(40);
  check(checked(await promptsState()) === 'quick', 'a change made elsewhere shows');
  await open('real', { targets: ['claude-code'], promptStyle: 'drafts' });
  st = await promptsState();
  check(checked(st) === 'drafts' && !st.hints.desktop && !st.hints.web, 'stored: Draft replies only chosen on load; no saved prompt, so no hints', st);
  await open('real', { targets: ['claude-code'], savedPrompt1: { name: 'One', desktop: '', web: '' } });
  st = await promptsState();
  check(st.hints.desktop && !st.hints.web && st.hints.where, 'a saved prompt and Claude Code alone: the desktop hint, and where the text goes', st.hints);
  await open('real', { targets: [] });
  check(!(await promptsState()).section, 'nothing picked: no section');
  await open('real', { targets: ['copy'], promptStyle: 'saved2' });
  check(checked(await promptsState()) === 'resolve', 'a default naming an empty slot: Resolve fully chosen');
});

await scenario('B30 saved prompts: Add makes one named "Saved prompt 1" and saves it; rename and type with live counts and titles; the style list and the empty-box hints follow; a box shows for each group picked; up to 3; reload and changes made elsewhere', async (check) => {
  await open('real', { targets: ['claude-code', 'claude'] });
  await click(`document.getElementById('add-prompt')`);
  await sleep(60);
  let st = await promptsState();
  let sel = await evaluate(`(() => { const f = document.activeElement; return { id: f.id, a: f.selectionStart, b: f.selectionEnd }; })()`);
  check(st.cards.length === 1 && st.cards[0].title === 'Saved prompt 1' && st.cards[0].name === 'Saved prompt 1' && same(sel, { id: 'sp1-name', a: 0, b: 14 }), 'Add: a card titled and named "Saved prompt 1", its name selected for typing over', { cards: st.cards, sel });
  check(same(await promptSets(), [{ savedPrompt1: { name: 'Saved prompt 1', desktop: '', web: '' } }]) && st.cards[0].status === 'Saved', 'saved at once, as its own storage item; "Saved" next to its title', await promptSets());
  check(st.cards[0].use === NOT_IN_USE && st.cards[0].makeDefault === 'Make Saved prompt 1 the default style' && st.cards[0].namePlaceholder === 'Saved prompt 1' && st.cards[0].origin === null,
    'the card says it is not in use until it is the default or picked in the toolbar list, offers to make it the default, and its name field shows the name it falls back to', st.cards[0]);
  check(st.hints.desktop && st.hints.web && st.hints.where, 'with a saved prompt: the writing hints and where the text goes show', st.hints);
  check(same(st.styles.at(-1), { id: 'saved1', checked: false, name: 'Saved prompt 1', note: 'No text yet, so it works as Resolve fully.' }), 'the style list gains it, by name, with what it does', st.styles.at(-1));
  const c = st.cards[0];
  check(c.desktop.shown && c.web.shown && c.desktop.max === 4000 && c.web.max === 4000 && c.nameMax === 40 && c.desktop.count === '0 of 4,000 characters' && c.nameCount === '14 of 40 characters',
    'a box for each group picked, capped at 4,000 (OWN in targets.js); the name at 40; live counts', c);
  check(c.desktop.placeholder === 'Empty, so Resolve fully is used.' && c.del === 'Delete the saved prompt Saved prompt 1', 'an empty box says what is used instead; Delete names the prompt', c);
  const a11y = await evaluate(`(() => { const t = (id) => document.getElementById(id); const card = t('sp1');
    const tabbable = [...card.querySelectorAll('input, textarea, button')].filter((e) => e.offsetParent).map((e) => e.id);
    const r = (id) => t(id).getBoundingClientRect();
    return { tabbable, delTop: Math.abs(r('sp1-delete').top - r('sp1-title').top) < 12 && r('sp1-delete').left > r('sp1-title').left, statusRole: t('sp1-saved').getAttribute('role'),
      role: card.getAttribute('role'), by: card.getAttribute('aria-labelledby'), titleTag: t('sp1-title').tagName, labels: [...card.querySelectorAll('label')].map((l) => l.textContent + '>' + l.htmlFor),
      nameBy: t('sp1-name').getAttribute('aria-describedby'), dBy: t('sp1-desktop').getAttribute('aria-describedby'), wBy: t('sp1-web').getAttribute('aria-describedby'),
      del: t('sp1-delete').tagName + ':' + t('sp1-delete').type + ':' + t('sp1-delete').textContent }; })()`);
  check(a11y.role === 'group' && a11y.by === 'sp1-title' && a11y.titleTag === 'H4' && same(a11y.labels, ['Name>sp1-name', 'For Claude Code and Codex>sp1-desktop', 'For the web AIs and Copy>sp1-web']), 'the card is a group named by its title (h4), with a label for each field', a11y);
  check(a11y.nameBy === 'sp1-name-count' && a11y.dBy === 'saved-sub own-desktop-hint sp1-desktop-count' && a11y.wBy === 'saved-sub own-web-hint sp1-web-count' && a11y.del === 'BUTTON:button:Delete', 'each field described by the line about saved prompts, its group\'s hint and its count', a11y);
  check(same(a11y.tabbable, ['sp1-name', 'sp1-desktop', 'sp1-web', 'sp1-make-default', 'sp1-delete']) && a11y.delTop && a11y.statusRole === 'status', 'Tab reaches the name and the boxes first and Delete last, though Delete shows on the right of the title; the card has its own status', a11y);

  // Rename: typed over the selection, the title and the style list follow each key; one write after a pause.
  await typeSlowly('Short replies', 30);
  st = await promptsState();
  check(st.cards[0].title === 'Short replies' && st.cards[0].nameCount === '13 of 40 characters' && st.styles.at(-1).name === 'Short replies' && st.cards[0].del === 'Delete the saved prompt Short replies' && (await promptSets()).length === 1,
    'rename: title, count, style list and Delete follow as you type; nothing written yet', st.cards[0]);
  await sleep(950);
  check(same((await promptSets()).at(-1), { savedPrompt1: { name: 'Short replies', desktop: '', web: '' } }), 'one write after a pause', await promptSets());
  await press('Tab');
  await typeSlowly('Draft it.', 20);
  st = await promptsState();
  check(st.cards[0].desktop.count === '9 of 4,000 characters' && st.styles.at(-1).note === 'Your text for Claude Code and Codex; the web AIs and Copy get Resolve fully.', 'the desktop box: its count, and the style note says who gets what', st.styles.at(-1));
  await sleep(950);
  check(same((await store()).savedPrompt1, { name: 'Short replies', desktop: 'Draft it.', web: '' }), 'saved', (await store()).savedPrompt1);
  // The default changes what an empty box falls back to.
  await click(`document.querySelector('label[for=style-quick]')`);
  await sleep(60);
  st = await promptsState();
  check(st.cards[0].web.placeholder === 'Empty, so Quick summary and reply is used.' && st.styles.at(-1).note === 'Your text for Claude Code and Codex; the web AIs and Copy get Quick summary and reply.', 'Quick as the default: an empty box falls back to it', st.cards[0].web.placeholder);
  // "Make it the default": written at once, and the card then says it is in use, with focus on that line.
  await click(`document.getElementById('sp1-make-default')`);
  await sleep(60);
  st = await promptsState();
  check(checked(st) === 'saved1' && (await store()).promptStyle === 'saved1' && st.cards[0].use === IN_USE && st.cards[0].makeDefault === null && st.focus === 'sp1-use' && st.cards[0].web.placeholder === 'Empty, so Resolve fully is used.',
    'Make it the default: chosen and written at once, the card says it is in use (focus on that line), and its own empty box falls back to Resolve fully', { c: checked(st), use: st.cards[0].use, focus: st.focus, ph: st.cards[0].web.placeholder });
  // Up to three.
  await click(`document.getElementById('add-prompt')`);
  await sleep(40);
  await click(`document.getElementById('add-prompt')`);
  await sleep(60);
  st = await promptsState();
  check(same(st.cards.map((x) => x.title), ['Short replies', 'Saved prompt 2', 'Saved prompt 3']) && !st.add && st.styles.length === 6, 'three saved prompts, in slot order; Add goes', st.cards.map((x) => x.title));
  check(st.cards[1].desktop.placeholder === 'Empty, so the text of Short replies, the default, is used.' && st.cards[1].web.placeholder === 'Empty, so Resolve fully is used.' &&
    st.styles[4].note === 'No text yet: Claude Code and Codex get the text of Short replies, the default, and the web AIs and Copy get Resolve fully.',
    'with a saved prompt as the default, another one\'s empty box uses the default\'s text for that group where it has some (Claude Code and Codex), else Resolve fully', { ph: [st.cards[1].desktop.placeholder, st.cards[1].web.placeholder], note: st.styles[4].note });
  // The name holds 40 characters; one cleared shows as "Saved prompt N".
  await evaluate(`(() => { const f = document.getElementById('sp2-name'); f.focus(); f.select(); })()`);
  await send('Input.insertText', { text: 'N'.repeat(50) });
  await sleep(40);
  check((await promptsState()).cards[1].name.length === 40 && (await promptsState()).cards[1].nameCount === '40 of 40 characters', 'a name stops at 40 characters');
  await evaluate(`(() => { const f = document.getElementById('sp2-name'); f.select(); document.execCommand('delete'); })()`);
  await blurAll();
  st = await promptsState();
  check(st.cards[1].title === 'Saved prompt 2' && (await store()).savedPrompt2?.name === '' && st.styles[4].name === 'Saved prompt 2', 'a cleared name: saved as empty, shown as "Saved prompt 2"', { title: st.cards[1].title, stored: (await store()).savedPrompt2 });
  // A name a built-in style or another saved prompt already has is warned about, as the toolbar list would show two alike.
  await evaluate(`(() => { const f = document.getElementById('sp3-name'); f.focus(); f.select(); })()`);
  await send('Input.insertText', { text: 'resolve  FULLY' });
  await sleep(40);
  st = await promptsState();
  check(st.cards[2].nameCount === '14 of 40 characters. A built-in style has this name too: give it another, so you can tell them apart in the toolbar list.', 'a name like a built-in style\'s, whatever its case or spaces: warned', st.cards[2].nameCount);
  await evaluate(`(() => { const f = document.getElementById('sp3-name'); f.select(); })()`);
  await send('Input.insertText', { text: 'Short replies' });
  await sleep(40);
  st = await promptsState();
  check(/^13 of 40 characters\. Another saved prompt has this name too/.test(st.cards[2].nameCount) && /^13 of 40 characters\. Another saved prompt has this name too/.test(st.cards[0].nameCount), 'two saved prompts of the same name: both warned', [st.cards[0].nameCount, st.cards[2].nameCount]);
  await evaluate(`(() => { const f = document.getElementById('sp3-name'); f.select(); })()`);
  await send('Input.insertText', { text: 'Saved prompt 3' });
  await blurAll();
  await sleep(950);
  st = await promptsState();
  check(st.cards[0].nameCount === '13 of 40 characters' && st.cards[2].nameCount === '14 of 40 characters', 'renamed apart: no warning on either', [st.cards[0].nameCount, st.cards[2].nameCount]);
  // A box for each group picked: Claude only hides the desktop boxes (their text is kept).
  await click(tileSel('Claude Code'));
  await sleep(60);
  st = await promptsState();
  check(st.cards.every((x) => !x.desktop.shown && x.web.shown) && !st.hints.desktop && st.cards[0].desktop.value === 'Draft it.', 'Claude Code unpicked: the desktop boxes and hint go, their text kept', st.cards.map((x) => x.desktop.shown));
  // Changes made elsewhere: shown at once, or once the card is left.
  await evaluate(`window.__external({ savedPrompt3: { name: 'From another device', desktop: '', web: 'Be brief.' } }); 1`);
  await sleep(40);
  st = await promptsState();
  check(st.cards[2].title === 'From another device' && st.cards[2].web.value === 'Be brief.', 'a change made elsewhere shows in its card', st.cards[2]);
  await click(`document.getElementById('sp3-web')`);
  await evaluate(`window.__external({ savedPrompt3: { name: 'Newer', desktop: '', web: 'Newer text.' } }); 1`);
  await sleep(40);
  check((await promptsState()).cards[2].web.value === 'Be brief.', 'not while you are in that card');
  await blurAll();
  check((await promptsState()).cards[2].web.value === 'Newer text.' && (await promptsState()).cards[2].title === 'Newer', 'left without an edit, the card shows the newer text from elsewhere');
  await evaluate(`window.__external({ savedPrompt2: undefined }); 1`);
  await sleep(40);
  st = await promptsState();
  check(same(st.cards.map((x) => x.n), [1, 3]) && st.add, 'a saved prompt deleted elsewhere goes, and Add is back', st.cards.map((x) => x.n));
  // Stored, it is all there next time.
  await open('real', await store());
  st = await promptsState();
  check(same(st.cards.map((x) => x.title), ['Short replies', 'Newer']) && checked(st) === 'saved1' && st.cards[0].desktop.value === 'Draft it.', 'kept across a reload', st.cards.map((x) => x.title));
});

await scenario('B31 saved prompts are cleaned, capped and size-checked as the prompts use them: invisible characters and the Mailbox lines go, 4,000 a box, a paste over the cap says what it lost, one item over 8,192 bytes is refused with how far to shorten it, failed writes are not "Saved"', async (check) => {
  const seed = { targets: ['claude-code', 'claude'], savedPrompt1: { name: 'Mine', desktop: '', web: '' } };
  await open('real', seed);
  await click(`document.getElementById('sp1-desktop')`);
  await send('Input.insertText', { text: '  Check\u200b the\u202e facts\u0007 first.  \r\nMailbox: someone@example.org\nThen\u{E0041}\u{E0042} draft.\u2028Last line.  ' });
  await sleep(950);
  const want = 'Check the facts first.\nThen draft.\nLast line.';
  check(same((await promptSets()).at(-1), { savedPrompt1: { name: 'Mine', desktop: want, web: '' } }), 'saved without zero-width, bidi, tag or control characters, CRs, line separators, edge spaces or a Mailbox line', await promptSets());
  check((await promptsState()).cards[0].desktop.value.includes('\u200b'), 'while you are in the box, it keeps what you typed');
  await blurAll();
  check((await promptsState()).cards[0].desktop.value === want, 'leaving the box shows the text as saved');
  await open('real', { ...seed, savedPrompt1: { name: 'Hidden\u200b name', desktop: '', web: 'Hidden\u200b\u2066 text.' } });
  check((await promptsState()).cards[0].web.value === 'Hidden text.' && (await promptsState()).cards[0].name === 'Hidden name', 'a stored value shows cleaned');

  // The cap: a paste stops at 4,000 and says what it lost; reaching the cap is said once.
  await open('real', seed);
  await click(`document.getElementById('sp1-web')`);
  await evaluate(`(() => { const f = document.getElementById('sp1-web'); const text = 'p'.repeat(4500); const data = new DataTransfer(); data.setData('text/plain', text);
    f.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })); document.execCommand('insertText', false, text); })()`);
  await sleep(60);
  let st = await promptsState();
  check(st.cards[0].web.value.length === 4000 && st.cards[0].web.count === 'Cut to 4,000 characters: the last 500 you pasted were not kept.' && st.cards[0].web.full && st.cards[0].status === '4,000 characters, the most it holds', 'a 4,500-character paste: cut to 4,000, the line says the last 500 were lost, and the status says the cap once', st.cards[0].web.count);
  await sleep(950);
  check((await store()).savedPrompt1.web.length === 4000, '4,000 saved');
  await evaluate(`(() => { const f = document.getElementById('sp1-web'); f.setSelectionRange(3990, 4000); document.execCommand('delete'); })()`);
  await sleep(40);
  check((await promptsState()).cards[0].web.count === '3,990 of 4,000 characters', 'the next edit: back to the count');
  await open('real', { ...seed, savedPrompt1: { name: 'Mine', desktop: '', web: 'b'.repeat(5000) } });
  check((await promptsState()).cards[0].web.value.length === 4000, 'a longer stored text (from a later version, say) shows cut to 4,000');

  // One storage item holds the whole saved prompt: 3,000 CJK characters (9,000 bytes) are refused, and the box keeps them.
  await open('real', seed);
  await click(`document.getElementById('sp1-web')`);
  await send('Input.insertText', { text: '\u4e2d'.repeat(3000) });
  await sleep(950);
  const fit = fitChars('savedPrompt1', { name: 'Mine', desktop: '', web: '\u4e2d'.repeat(3000) }, 'web');
  st = await promptsState();
  check(!(await promptSets()).length && st.cards[0].status === 'Not saved' && st.cards[0].web.count === `Not saved, too long to sync: shorten this box to about ${fit.toLocaleString('en-GB')} characters. The built-in task is still in use.` && st.cards[0].web.invalid,
    `too long to sync: nothing written; "Not saved" next to the card's title, and the line says how far to shorten it (about ${fit}, by Chromium's count) and what is still in use; the box is marked invalid`, st.cards[0].web.count);
  await blurAll();
  await sleep(6500);
  st = await promptsState();
  check(st.cards[0].web.value.length === 3000 && /^Not saved, too long to sync/.test(st.cards[0].web.count) && st.cards[0].web.invalid, 'leaving the box keeps the text, and the refusal still shows after the status has gone', st.cards[0].web.count);
  await click(`document.getElementById('sp1-web')`);
  await evaluate(`(() => { const f = document.getElementById('sp1-web'); f.setSelectionRange(2600, 3000); document.execCommand('delete'); })()`);
  await sleep(950);
  st = await promptsState();
  check((await store()).savedPrompt1?.web.length === 2600 && st.cards[0].web.count === '2,600 of 4,000 characters' && !st.cards[0].web.invalid && st.cards[0].status === 'Saved', 'shortened to fit: saved, the count is back, no longer invalid', st.cards[0].web.count);

  // Both boxes count towards the one item: 4,000 in each can be too much, and the message is for the box being edited.
  await open('real', { ...seed, savedPrompt1: { name: 'Mine', desktop: 'a'.repeat(4000), web: '' } });
  await click(`document.getElementById('sp1-web')`);
  await send('Input.insertText', { text: 'b\n'.repeat(2000) });
  await sleep(950);
  const item = { name: 'Mine', desktop: 'a'.repeat(4000), web: ('b\n'.repeat(2000)).trimEnd() };
  const fit2 = fitChars('savedPrompt1', item, 'web');
  st = await promptsState();
  check(chromiumBytes('savedPrompt1', { ...item, web: '' }) < 8192 && st.cards[0].web.count === `Not saved, too long to sync: shorten this box to about ${fit2.toLocaleString('en-GB')} characters. The built-in task is still in use.` && /^4,000 of 4,000/.test(st.cards[0].desktop.count) && (await store()).savedPrompt1.web === '',
    `4,000 characters for Claude Code and Codex, then 4,000 with line breaks for the web AIs: refused under the web box, about ${fit2} would fit; the desktop text stays saved`, st.cards[0].web.count);
  // The line goes under the box that shortening can fix: with 3,000 CJK characters for Claude Code and Codex, typing in
  // the empty web box keeps it under the desktop box (shortening the web box could never make it fit).
  await open('real', seed);
  await click(`document.getElementById('sp1-desktop')`);
  await send('Input.insertText', { text: '\u4e2d'.repeat(3000) });
  await sleep(950);
  await click(`document.getElementById('sp1-web')`);
  await typeSlowly('Hi', 20);
  await sleep(950);
  st = await promptsState();
  const fit3 = fitChars('savedPrompt1', { name: 'Mine', desktop: '\u4e2d'.repeat(3000), web: 'Hi' }, 'desktop');
  check(st.cards[0].desktop.invalid && st.cards[0].desktop.count === `Not saved, too long to sync: shorten this box to about ${fit3.toLocaleString('en-GB')} characters. The built-in task is still in use.` && !st.cards[0].web.invalid && st.cards[0].web.count === '2 of 4,000 characters',
    'typing in the other box: the line and the invalid mark stay on the box that is too long, with how far to shorten it', { d: st.cards[0].desktop.count, w: st.cards[0].web.count });
  // Both boxes too long by themselves: a line under each.
  await evaluate(`(() => { const f = document.getElementById('sp1-web'); f.focus(); f.select(); })()`);
  await send('Input.insertText', { text: '\u4e8c'.repeat(3000) });
  await sleep(950);
  st = await promptsState();
  check(st.cards[0].desktop.invalid && st.cards[0].web.invalid && st.cards[0].desktop.count === 'Not saved, too long to sync: shorten this box and the other one. The built-in task is still in use.' && st.cards[0].web.count === st.cards[0].desktop.count,
    'both boxes too long by themselves: a line under each', { d: st.cards[0].desktop.count, w: st.cards[0].web.count });
  // "<" counts six bytes, as Chromium writes it; a refusal by the browser itself says so; the previous text stays in use.
  await open('real', { ...seed, savedPrompt1: { name: 'Mine', desktop: '', web: 'Before.' } });
  await evaluate(`(() => { const f = document.getElementById('sp1-web'); f.focus(); f.select(); })()`);
  await send('Input.insertText', { text: '< '.repeat(1500) });
  await sleep(950);
  st = await promptsState();
  check((await store()).savedPrompt1.web === 'Before.' && /^Not saved, too long to sync: shorten this box to about [\d,]+ characters\. Your previous text is still in use\.$/.test(st.cards[0].web.count), '1,500 "<" are refused before the browser sees them, and the previous text is still in use', st.cards[0].web.count);
  await open('real', seed);
  await evaluate(`window.__failNextSet = 'Resource::kQuotaBytesPerItem quota exceeded'; 1`);
  await click(`document.getElementById('sp1-web')`);
  await typeSlowly('Hi', 20);
  await sleep(950);
  st = await promptsState();
  check(st.cards[0].status === 'Not saved' && st.cards[0].web.count === 'Not saved, too long to sync: shorten it a little. The built-in task is still in use.', 'the browser refusing it for size: said as too long, not "try again"', st.cards[0].web.count);
  await open('real', seed);
  await evaluate(`window.__failNextSet = 'MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded'; 1`);
  await click(`document.getElementById('sp1-web')`);
  await typeSlowly('Hi', 20);
  await sleep(950);
  check((await promptsState()).cards[0].status === 'Not saved, try again' && (await store()).savedPrompt1.web === '', 'a failed write says "Not saved, try again"');
  await typeSlowly('!', 20);
  await sleep(950);
  check((await store()).savedPrompt1.web === 'Hi!' && (await promptsState()).cards[0].status === 'Saved', 'the next edit saves', (await store()).savedPrompt1);
  // An edit still waiting for its pause is saved when the page goes or is hidden.
  await typeSlowly('?', 10);
  await evaluate(`dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); 1`);
  await sleep(40);
  check((await store()).savedPrompt1.web === 'Hi!?', 'pagehide within the 800 ms pause: the edit is saved', (await store()).savedPrompt1);
  await typeSlowly('.', 10);
  await evaluate(`Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; 1`);
  await sleep(40);
  check((await store()).savedPrompt1.web === 'Hi!?.', 'the tab hidden: the edit is saved', (await store()).savedPrompt1);
});

await scenario('B32 Delete takes a saved prompt away with an Undo, which puts back exactly what was stored, the default style included, and says when the default moved; its 10 seconds wait while focus or the pointer is on it; a removal that fails brings it all back; Add ends the Undo', async (check) => {
  const seed = { targets: ['claude-code', 'claude'], promptStyle: 'saved1', savedPrompt1: { name: 'Keep me', desktop: 'D', web: 'W' }, savedPrompt2: { name: 'Other', desktop: '', web: 'O' } };
  await open('real', seed);
  await click(`document.getElementById('sp1-delete')`);
  await sleep(80);
  let st = await promptsState();
  let s = await store();
  check(same(st.cards.map((x) => x.n), [2]) && st.undo === 'Deleted Keep me. The default style is now Resolve fully.' && st.focus === 'undo' && checked(st) === 'resolve', 'Delete: the card goes, "Deleted Keep me." says the default is now Resolve fully, with Undo, which has focus', st);
  check(s.savedPrompt1 === undefined && s.promptStyle === 'resolve' && same(await removes(), [['savedPrompt1']]), 'stored: the item removed, the default now Resolve fully', { s, removes: await removes() });
  const undoName = await evaluate(`document.getElementById('undo').getAttribute('aria-label') + '|' + document.getElementById('undo-text').getAttribute('role')`);
  check(undoName === 'Undo: put back the saved prompt Keep me|status', 'Undo says what it puts back; the line is a status, so it is read out', undoName);
  await press('Enter');
  await sleep(80);
  st = await promptsState();
  s = await store();
  check(sameStore(s, seed) && same(st.cards.map((x) => [x.n, x.title, x.desktop.value, x.web.value]), [[1, 'Keep me', 'D', 'W'], [2, 'Other', '', 'O']]) && checked(st) === 'saved1' && st.focus === 'sp1-name' && st.undo === null,
    'Undo (from the keyboard): everything back as stored, the default too, and focus on its name', { s, st });
  // The Undo waits while focus is on it, as the extension's notes do; once focus leaves, it goes after 10 seconds.
  await click(`document.getElementById('sp2-delete')`);
  await sleep(80);
  check((await promptsState()).undo === 'Deleted Other.' && (await promptsState()).add, 'deleting one that is not the default: "Deleted Other.", and Add is back');
  await sleep(10200);
  st = await promptsState();
  check(st.undo === 'Deleted Other.' && st.focus === 'undo', 'after 10 seconds with focus still on Undo: it waits', st);
  await blurAll();
  await sleep(5000);
  check((await promptsState()).undo === 'Deleted Other.', 'focus gone: still there 5 seconds later');
  // The pointer on the line holds it too, and the time starts again when it leaves.
  const c = await center(`document.getElementById('undo-text')`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
  await sleep(6000);
  check((await promptsState()).undo === 'Deleted Other.', 'the pointer on the line: it waits past the 10 seconds');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  await sleep(10200);
  st = await promptsState();
  check(st.undo === null && (await store()).savedPrompt2 === undefined && (await store()).promptStyle === 'saved1', 'the pointer gone: 10 seconds later the Undo goes, it stays deleted, the default untouched', st);
  // Add ends a waiting Undo; an edit waiting for its pause is saved before the delete, so Undo keeps it.
  await click(`document.getElementById('sp1-delete')`);
  await sleep(60);
  await click(`document.getElementById('add-prompt')`);
  await sleep(60);
  st = await promptsState();
  check(st.undo === null && same(st.cards.map((x) => [x.n, x.title]), [[1, 'Saved prompt 1']]), 'Add during an Undo: the Undo ends, and the new prompt takes the free slot', st.cards);
  await click(`document.getElementById('sp1-web')`);
  await typeSlowly('Typed', 10);
  await click(`document.getElementById('sp1-delete')`);
  await sleep(60);
  await click(`document.getElementById('undo')`);
  await sleep(80);
  check(same((await store()).savedPrompt1, { name: 'Saved prompt 1', desktop: '', web: 'Typed' }) && (await promptsState()).cards[0].web.value === 'Typed', 'an edit not yet saved when Delete is pressed: saved first, so Undo keeps it', (await store()).savedPrompt1);
  // A removal the browser refuses (its writes a minute used up, say): never "Deleted"; the card, and the default, come back.
  await open('real', seed);
  await evaluate(`window.__failNextRemove = 'MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded'; 1`);
  await click(`document.getElementById('sp1-delete')`);
  await sleep(120);
  st = await promptsState();
  s = await store();
  check(sameStore(s, seed) && same(st.cards.map((x) => [x.n, x.title]), [[1, 'Keep me'], [2, 'Other']]) && checked(st) === 'saved1' && st.undo === null && st.saved === 'Not deleted, try again' && st.focus === 'sp1-delete',
    'the removal refused: the card and the default back as stored, no Undo, "Not deleted, try again", focus on its Delete', { s, cards: st.cards.map((x) => x.title), c: checked(st), saved: st.saved, focus: st.focus });
  await click(`document.getElementById('sp1-delete')`);
  await sleep(80);
  check((await store()).savedPrompt1 === undefined && (await promptsState()).undo === 'Deleted Keep me. The default style is now Resolve fully.', 'the next Delete goes through');
  // Deleting a saved prompt that is not the default never changes the default, even one never chosen (1.4.0's text in slot 1).
  await open('real', { targets: ['claude'], webInstructions: 'Old.', savedPrompt2: { name: 'Two', desktop: '', web: 'two' }, savedPrompt3: { name: 'Three', desktop: '', web: 'three' } });
  await click(`document.getElementById('sp3-delete')`);
  await sleep(80);
  check(checked(await promptsState()) === 'saved1' && (await store()).promptStyle === undefined, 'deleting saved prompt 3: the default (1.4.0\'s text, never chosen) stays, and nothing is written for it');
});

await scenario('B33 1.4.0\'s own instructions show as the saved prompt they will become (saved prompt 1, "My instructions", and the default; another slot, named apart, when slot 1 is taken), saying where they came from, until they move; editing moves them (the old keys go); too long for one item says how to finish the move; with every slot taken a notice shows their size with a Delete; deleting them can be undone; the move made by background.js changes nothing on the page and is said once', async (check) => {
  const old = { targets: ['claude-code', 'claude'], desktopInstructions: 'Old desktop steps.', webInstructions: 'Old web ask.' };
  await open('real', old);
  let st = await promptsState();
  check(same(st.cards.map((x) => [x.n, x.title, x.desktop.value, x.web.value]), [[1, 'My instructions', 'Old desktop steps.', 'Old web ask.']]) && checked(st) === 'saved1' && st.styles.at(-1).name === 'My instructions', 'shown as saved prompt 1, "My instructions", and chosen as the default', st);
  check(st.cards[0].origin === ORIGIN && st.cards[0].use === IN_USE, 'the card says where it came from, and that it is in use as the default', st.cards[0]);
  check(same(await sets(), []) && same(await removes(), []), 'nothing written on load');
  await click(`document.getElementById('sp1-name')`);
  await typeSlowly(' 2', 20);
  await sleep(950);
  let s = await store();
  check(same(await promptSets(), [{ savedPrompt1: { name: 'My instructions 2', desktop: 'Old desktop steps.', web: 'Old web ask.' }, promptStyle: 'saved1' }]) && same(await removes(), [['desktopInstructions', 'webInstructions']]) && s.desktopInstructions === undefined,
    'an edit: saved prompt 1 written with the default, then the old keys removed', { sets: await promptSets(), removes: await removes() });
  await open('real', { ...old, promptStyle: 'quick' });
  st = await promptsState();
  check(checked(st) === 'quick' && st.cards[0].title === 'My instructions', 'with a style chosen, they still show as saved prompt 1, and the chosen style stays the default');
  await click(`document.getElementById('sp1-web')`);
  await typeSlowly('!', 20);
  await sleep(950);
  check(same(await promptSets(), [{ savedPrompt1: { name: 'My instructions', desktop: 'Old desktop steps.', web: 'Old web ask.!' } }]), 'an edit: the chosen style is not changed', await promptSets());
  // Too long for one item: said at once under the longer box; nothing written; shortening moves them.
  const big = { targets: ['claude-code', 'claude'], desktopInstructions: 'a'.repeat(4000), webInstructions: 'b\n'.repeat(2000) };
  await open('real', big);
  st = await promptsState();
  const fit = fitChars('savedPrompt1', { name: 'My instructions', desktop: 'a'.repeat(4000), web: ('b\n'.repeat(2000)).trimEnd() }, 'desktop');
  check(st.cards[0].desktop.count === `From 1.4.0: too long to keep as one saved prompt. Shorten this box to about ${fit.toLocaleString('en-GB')} characters to finish the move. Until then it works as before.` && st.cards[0].desktop.invalid && !st.cards[0].web.invalid && same(await sets(), []) && st.cards[0].origin === ORIGIN,
    'too long for one item: said at once under the box that shortening can fix, as finishing the move, not as a refusal; nothing written; the old text still works', st.cards[0].desktop.count);
  await click(`document.getElementById('sp1-desktop')`);
  await evaluate(`(() => { const f = document.getElementById('sp1-desktop'); f.setSelectionRange(1000, 4000); document.execCommand('delete'); })()`);
  await sleep(950);
  s = await store();
  check(s.savedPrompt1?.desktop.length === 1000 && s.promptStyle === 'saved1' && s.desktopInstructions === undefined && s.webInstructions === undefined && !(await promptsState()).cards[0].desktop.invalid, 'shortened: moved into saved prompt 1, the default, and the old keys gone', { len: s.savedPrompt1?.desktop.length, style: s.promptStyle });
  // Deleting them: the old keys go, and Undo puts them back as they were.
  await open('real', old);
  await click(`document.getElementById('sp1-delete')`);
  await sleep(80);
  s = await store();
  check(s.desktopInstructions === undefined && s.webInstructions === undefined && s.promptStyle === 'resolve' && !(await promptsState()).cards.length && (await promptsState()).undo === 'Deleted My instructions. The default style is now Resolve fully.', 'Delete: the old keys go and Resolve fully is the default, as the line says');
  await click(`document.getElementById('undo')`);
  await sleep(80);
  s = await store();
  check(sameStore(s, old) && (await promptsState()).cards[0].title === 'My instructions' && checked(await promptsState()) === 'saved1', 'Undo: the old keys back exactly, no style written', s);
  // background.js moving them while the page is open: the same prompt, so the page writes nothing.
  await open('real', old);
  await evaluate(`window.__external({ savedPrompt1: { name: 'My instructions', desktop: 'Old desktop steps.', web: 'Old web ask.' }, promptStyle: 'saved1' }); window.__external({ desktopInstructions: undefined, webInstructions: undefined }); 1`);
  await sleep(60);
  st = await promptsState();
  check(st.cards.length === 1 && st.cards[0].title === 'My instructions' && checked(st) === 'saved1' && same(await sets(), []), 'the move made elsewhere: the card stays as it was and nothing is written', st);
  await click(`document.getElementById('sp1-web')`);
  await typeSlowly('!', 20);
  await sleep(950);
  check(same(await promptSets(), [{ savedPrompt1: { name: 'My instructions', desktop: 'Old desktop steps.', web: 'Old web ask.!' } }]) && same(await removes(), []), 'and an edit after it writes the item only', await promptSets());

  // Saved prompt 1 taken (a computer still on 1.4.0 wrote them after this one moved them): saved prompt 2, named apart,
  // not the default; editing it moves them there and leaves the default alone.
  const later = { targets: ['claude-code', 'claude'], savedPrompt1: { name: 'Mine', desktop: 'M', web: '' }, desktopInstructions: 'Written later on 1.4.0.' };
  await open('real', later);
  st = await promptsState();
  check(same(st.cards.map((x) => [x.n, x.title]), [[1, 'Mine'], [2, 'My instructions (from 1.4.0)']]) && checked(st) === 'resolve' && st.cards[1].origin === ORIGIN && st.cards[1].use === NOT_IN_USE && st.legacy === null,
    'slot 1 taken: shown as saved prompt 2, "My instructions (from 1.4.0)", saying where it came from, not the default', st.cards.map((x) => [x.title, x.origin, x.use]));
  await click(`document.getElementById('sp2-web')`);
  await typeSlowly('Web too.', 10);
  await sleep(950);
  s = await store();
  check(same((await promptSets()).at(-1), { savedPrompt2: { name: 'My instructions (from 1.4.0)', desktop: 'Written later on 1.4.0.', web: 'Web too.' } }) && s.desktopInstructions === undefined && s.promptStyle === undefined, 'an edit: saved prompt 2 written, the old keys gone, no default written', { sets: await promptSets(), s });
  // The finding's case: slot 1 taken and the old texts too long for one item: they show as saved prompt 2 with how to finish the move, never hidden.
  const bigLater = { targets: ['claude-code', 'claude'], savedPrompt1: { name: 'Mine', desktop: 'M', web: '' }, desktopInstructions: '\u4e2d'.repeat(3000), webInstructions: 'old web text' };
  await open('real', bigLater);
  st = await promptsState();
  const fitLater = fitChars('savedPrompt2', { name: 'My instructions (from 1.4.0)', desktop: '\u4e2d'.repeat(3000), web: 'old web text' }, 'desktop');
  check(st.cards[1]?.title === 'My instructions (from 1.4.0)' && st.cards[1].desktop.count === `From 1.4.0: too long to keep as one saved prompt. Shorten this box to about ${fitLater.toLocaleString('en-GB')} characters to finish the move. Until then it still works.` && checked(st) === 'resolve',
    'slot 1 taken and too long for one item: saved prompt 2, with how far to shorten it', st.cards[1]?.desktop.count);
  // Every slot taken: a notice with their size and a Delete, which Undo puts back.
  const full = { targets: ['claude'], savedPrompt1: { name: 'A', desktop: '', web: 'a' }, savedPrompt2: { name: 'B', desktop: '', web: 'b' }, savedPrompt3: { name: 'C', desktop: '', web: 'c' }, desktopInstructions: 'Old desktop steps.', webInstructions: 'Old web ask.' };
  await open('real', full);
  st = await promptsState();
  const NOTICE = 'Your own instructions from 1.4.0 (30 characters) are still stored with your settings, but are not in use: all 3 saved prompts are taken. Delete a saved prompt and they take its place, or delete them.';
  check(st.legacy === NOTICE && st.cards.length === 3 && !st.add, 'every slot taken: the notice, with their size', st.legacy);
  const delName = await evaluate(`document.getElementById('legacy-delete').getAttribute('aria-label')`);
  check(delName === 'Delete your own instructions from 1.4.0', 'its Delete says what it deletes', delName);
  await click(`document.getElementById('legacy-delete')`);
  await sleep(80);
  st = await promptsState();
  s = await store();
  check(st.legacy === null && st.undo === 'Deleted your own instructions from 1.4.0.' && st.focus === 'undo' && s.desktopInstructions === undefined && s.webInstructions === undefined && same(await removes(), [['desktopInstructions', 'webInstructions']]), 'Delete: the old keys go, with an Undo that has focus', { st, removes: await removes() });
  await press('Enter');
  await sleep(80);
  st = await promptsState();
  check(sameStore(await store(), full) && st.legacy === NOTICE && st.focus === 'legacy-delete', 'Undo: the old keys back exactly, the notice again, focus on its Delete', { focus: st.focus });
  // Deleting a saved prompt then frees a slot: they take its place, shown as that saved prompt, not the default.
  await click(`document.getElementById('sp2-delete')`);
  await sleep(80);
  st = await promptsState();
  check(st.legacy === null && same(st.cards.map((x) => [x.n, x.title]), [[1, 'A'], [2, 'My instructions (from 1.4.0)'], [3, 'C']]) && checked(st) === 'resolve', 'a slot freed: they show in it', st.cards.map((x) => x.title));
  // A copy already moved (the old keys not yet gone, as when two computers move them at once): nothing shows twice.
  await open('real', { targets: ['claude'], savedPrompt1: { name: 'Renamed', desktop: 'Old desktop steps.', web: 'Old web ask.' }, desktopInstructions: 'Old desktop steps.', webInstructions: 'Old web ask.' });
  st = await promptsState();
  check(same(st.cards.map((x) => x.title), ['Renamed']) && st.legacy === null, 'a copy already in a saved prompt: shown once, no notice', st.cards.map((x) => x.title));
  // The move made by background.js, said once on this computer: the card says where it came from, and the note is cleared.
  await open('real', { targets: ['claude'], savedPrompt1: { name: 'My instructions', desktop: 'Old desktop steps.', web: '' }, promptStyle: 'saved1' }, { env: { local: { promptsMoved: 1 } } });
  await sleep(60);
  st = await promptsState();
  const localRemoves = await evaluate('window.__log.localRemoves');
  check(st.cards[0].origin === ORIGIN && same(localRemoves, ['promptsMoved']), 'after background.js moved them: the card says where it came from, and the note is cleared so it shows on this visit only', { origin: st.cards[0].origin, localRemoves });
  await open('real', { targets: ['claude'], savedPrompt1: { name: 'Something else', desktop: 'New.', web: '' } }, { env: { local: { promptsMoved: 1 } } });
  await sleep(60);
  check((await promptsState()).cards[0].origin === null, 'a saved prompt made since in that slot is not said to come from 1.4.0');
});

await scenario('T01 notes reach screen readers: a role=status region (polite) and a role=alert one (assertive) are in the accessibility tree, empty, before anything is said; a note is said in the first, an error in the second, once each', async (check) => {
  await send('Accessibility.enable');
  await send('Page.navigate', { url: fileUrl(toastPage) });
  await sleep(400);
  let a = await liveRegions();
  check(same(a.regions, [{ role: 'status', live: 'polite', text: '' }, { role: 'alert', live: 'assertive', text: '' }]), 'both regions there and empty from the start (rendered, though visually hidden)', a.regions);
  await evaluate(`toast('Copied. Paste it into any AI with Cmd+V.', false, 6000, true); 1`);
  await sleep(400);
  a = await liveRegions();
  const note = 'Copied. Paste it into any AI with Cmd+V.';
  check(same(a.regions, [{ role: 'status', live: 'polite', text: note }, { role: 'alert', live: 'assertive', text: '' }]), 'a note: said in the status region', a.regions);
  check(a.texts.filter((t) => t.includes('Paste it into')).length === 1, 'and only there: the visible note is hidden from screen readers, so it is not read twice', a.texts);
  await evaluate(`toast('Could not copy the selected text. Try again.', true); 1`);
  await sleep(400);
  a = await liveRegions();
  check(same(a.regions, [{ role: 'status', live: 'polite', text: '' }, { role: 'alert', live: 'assertive', text: 'Could not copy the selected text. Try again.' }]), 'an error: said in the alert region, the status region emptied', a.regions);
  const close = (await send('Accessibility.getFullAXTree')).nodes.find((n) => !n.ignored && n.role?.value === 'button');
  check(close?.name?.value === 'Close', 'the close button is there for screen readers, named Close', close?.name);
  await evaluate(`quietToast('Reading 2 of 5 emails...', 6000); 1`);
  await sleep(400);
  a = await liveRegions();
  check(!a.regions.some((r) => r.text.includes('Reading')) && !a.texts.some((t) => t.includes('Reading')), 'a step shown quietly is not said at all', a);
  await send('Accessibility.disable');
  await send('Page.navigate', { url: 'about:blank' });
});

// ---------- 1.4.0: the toolbar list (popup.html, popup.js) ----------

const GMAIL_TAB = { id: 7, url: 'https://mail.google.com/mail/u/0/#inbox' };
const popupState = () => evaluate(`({ context: document.getElementById('context').textContent, hint: document.getElementById('context').classList.contains('hint'),
  buttons: [...document.querySelectorAll('.ai')].map((b) => ({ id: b.dataset.id, label: b.querySelector('.label').textContent, note: b.querySelector('.note').textContent, disabled: b.disabled })),
  focus: document.activeElement?.dataset?.id || document.activeElement?.id || document.activeElement?.tagName, empty: !document.getElementById('empty').hidden, list: !document.getElementById('list').hidden,
  last: document.getElementById('last').hidden ? null : document.getElementById('last').textContent, settings: document.getElementById('settings').textContent,
  sent: window.__log.tabsMessages, run: window.__log.runtimeMessages, closed: window.__log.closed, options: window.__log.optionsOpened, query: window.__log.tabsQuery })`);
const KEYS_EXTRA = { ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }, ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 } };
async function pressKey(name) {
  const k = KEYS[name] || KEYS_EXTRA[name];
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k, text: undefined });
}

await scenario('P01 toolbar list outside Gmail: the hint, the AIs picked shown but not pickable, the Settings link; the tab is not asked', async (check) => {
  await openPopup({ targets: ['chatgpt', 'claude'] }, { activeTab: { id: 5 } });
  const p = await popupState();
  check(p.context === 'Open Gmail, or select some text on a page and right-click it.' && p.hint, 'the hint, as a notice', p.context);
  check(same(p.buttons, [{ id: 'claude', label: 'Ask Claude', note: 'claude.ai', disabled: true }, { id: 'chatgpt', label: 'Ask ChatGPT', note: 'chatgpt.com', disabled: true }]), 'the picked AIs in TARGETS order, disabled', p.buttons);
  check(p.settings === 'Settings' && same(p.query, [{ active: true, currentWindow: true }]) && !p.sent.length, 'a Settings link; only the active tab was looked up; no message to any tab', p);
  const meta = await evaluate(`({ title: document.title, lang: document.documentElement.lang, w: document.body.getBoundingClientRect().width, alt: document.querySelector('.mast img').getAttribute('alt') })`);
  check(meta.title === 'Open in AI Agent' && meta.lang === 'en-GB' && meta.w === 320 && meta.alt === '', 'title, language, 320 px wide, decorative icon', meta);
});

await scenario('P02 toolbar list in Gmail with an email open: "For the email you have open.", the single labels, the first AI focused', async (check) => {
  await openPopup({ targets: ['claude-code', 'claude', 'copy'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } } });
  const p = await popupState();
  check(p.context === 'For the email you have open.' && !p.hint, 'context line', p.context);
  check(same(p.buttons.map((b) => [b.label, b.note, b.disabled]), [['Open in Claude Code', 'desktop app', false], ['Ask Claude', 'claude.ai', false], ['Copy thread for any AI', 'clipboard', false]]), 'the labels of Gmail\'s row menu, enabled', p.buttons);
  check(p.focus === 'claude-code', 'focus on the first AI, ready for Enter', p.focus);
  check(same(p.sent, [{ tabId: 7, msg: { target: 'content', action: 'state' }, options: { frameId: 0 } }]), 'one state message to the Gmail tab\'s top frame', p.sent);
});

await scenario('P03 toolbar list with ticked emails: the count in the line and the bulk labels; one ticked; nothing open', async (check) => {
  await openPopup({ targets: ['claude', 'codex'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 3, total: 3, thread: false } } } });
  let p = await popupState();
  check(p.context === 'For the 3 emails you ticked.' && same(p.buttons.map((b) => b.label), ['Open 3 in Codex', 'Ask Claude about 3 emails']), 'three ticked', p);
  await openPopup({ targets: ['claude'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 25, total: 30, thread: false } } } });
  p = await popupState();
  check(p.context === 'For the first 25 of the 30 emails you ticked.' && p.buttons[0].label === 'Ask Claude about 25 emails', 'thirty ticked: the 25 that will go', p);
  await openPopup({ targets: ['claude'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 1, total: 1, thread: false } } } });
  check((await popupState()).context === 'For the email you ticked.', 'one ticked');
  await openPopup({ targets: ['claude'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: false } } } });
  p = await popupState();
  check(p.context === 'Open an email or tick some in Gmail, then pick an AI.' && !p.buttons[0].disabled, 'nothing open or ticked: says so; the pick still goes (the note in Gmail repeats it)', p);
});

await scenario('P04 a pick from the toolbar list: one message to background.js with the AI and the tab, then the list closes; arrow keys move between the AIs', async (check) => {
  await openPopup({ targets: ['claude', 'chatgpt', 'copy'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } } });
  await pressKey('ArrowDown');
  let p = await popupState();
  check(p.focus === 'chatgpt', 'ArrowDown moves to the next AI', p.focus);
  await pressKey('ArrowUp');
  await pressKey('ArrowUp');
  p = await popupState();
  check(p.focus === 'copy', 'ArrowUp from the first wraps to the last', p.focus);
  await pressKey('Enter');
  await sleep(80);
  p = await popupState();
  check(same(p.run, [{ target: 'background', action: 'run', platform: 'copy', tabId: 7, style: 'resolve' }]) && p.closed === 1, 'Enter picks Copy: the run message, with the style the list shows (the default), then the list closes', p);
  await openPopup({ targets: ['claude'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 2, total: 2, thread: false } } } });
  await click(`document.querySelector('.ai')`);
  await sleep(80);
  p = await popupState();
  check(same(p.run, [{ target: 'background', action: 'run', platform: 'claude', tabId: 7, style: 'resolve' }]) && p.closed === 1, 'a click picks it too', p);
});

await scenario('P05 toolbar list when the Gmail tab cannot be reached: a refused pick or no content script asks for a reload', async (check) => {
  await openPopup({ targets: ['claude'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } }, runReply: { ok: false, error: 'Not a Gmail tab' } });
  await click(`document.querySelector('.ai')`);
  await sleep(80);
  let p = await popupState();
  check(p.closed === 0 && p.context === 'Reload this Gmail tab, then open this list again.' && p.hint && !p.buttons[0].disabled, 'refused: the list stays open with the reload line', p);
  check(p.focus === 'claude' && (await evaluate(`document.querySelector('.ai').hasAttribute('aria-disabled')`)) === false, 'keyboard focus stays on the AI picked (never disabled under it), and the AIs take a pick again', p.focus);
  await openPopup({ targets: ['claude'] }, { activeTab: GMAIL_TAB, answers: {} });
  p = await popupState();
  check(p.context === 'Reload this Gmail tab, then open this list again.' && p.buttons[0].disabled, 'no content script in the tab: the reload line, nothing pickable', p);
});

await scenario('P06 toolbar list: nothing picked says so; Settings opens the settings page and closes the list; the shortcut line names the AI it would use', async (check) => {
  await openPopup({ targets: [] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } } });
  let p = await popupState();
  const emptyText = await evaluate(`document.getElementById('empty').textContent`);
  check(p.empty && !p.list && emptyText === 'Nothing picked yet. Pick your AIs in Settings.', 'nothing picked', { p, emptyText });
  await click(`document.getElementById('settings')`);
  await sleep(40);
  p = await popupState();
  check(p.options === 1 && p.closed === 1, 'Settings: the settings page, then the list closes', p);
  await openPopup({ targets: ['claude', 'chatgpt'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } }, commands: COMMANDS, local: { lastTarget: 'chatgpt' } });
  await sleep(40);
  check((await popupState()).last === 'Alt+Shift+L sends to ChatGPT', 'the shortcut and the AI used last', (await popupState()).last);
  await openPopup({ targets: ['claude', 'chatgpt'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } }, commands: COMMANDS, local: { lastTarget: 'gemini' } });
  await sleep(40);
  check((await popupState()).last === 'Alt+Shift+L sends to Claude', 'the AI used last is not picked any more: the first one picked', (await popupState()).last);
  await openPopup({ targets: ['claude'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } }, commands: [{ ...COMMANDS[1], shortcut: '' }] });
  await sleep(40);
  check((await popupState()).last === null, 'no key set: no line');
  await openPopup({ targets: ['codex', 'claude', 'copy'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } }, commands: COMMANDS, local: { lastTarget: 'copy' } });
  await sleep(40);
  check((await popupState()).last === 'Alt+Shift+L sends to Copy', 'Copy goes by its short name', (await popupState()).last);
  await openPopup({ targets: ['codex', 'claude'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } }, commands: COMMANDS });
  await sleep(40);
  check((await popupState()).last === 'Alt+Shift+L sends to Claude', 'nothing used yet: never Codex, which would start at once on a guess', (await popupState()).last);
  await openPopup({ targets: ['codex'] }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } }, commands: COMMANDS });
  await sleep(40);
  check((await popupState()).last === null, 'Codex alone and not used yet: no line (the shortcut opens this list to ask)');
});

await scenario('P08 toolbar list on another site with text selected: the selected-text items, enabled; a pick asks background.js to send that tab\'s selection, then the list closes; a refused pick asks to select again', async (check) => {
  const other = { id: 5, url: 'https://outlook.live.com/mail/0/inbox' };
  await openPopup({ targets: ['claude-code', 'chatgpt', 'copy'] }, { activeTab: other, runReplies: { selection: { ok: true, selected: true } } });
  let p = await popupState();
  check(p.context === 'For the text you selected on this page.' && !p.hint, 'the context line', p.context);
  check(same(p.buttons.map((b) => [b.label, b.disabled]), [['Ask Claude Code about the selected text', false], ['Ask ChatGPT about the selected text', false], ['Copy selected text for any AI', false]]), "the browser menu's selected-text labels, enabled", p.buttons);
  check(same(p.run, [{ target: 'background', action: 'selection', tabId: 5 }]) && !p.sent.length, 'one question to background.js about the tab; nothing sent to the tab itself', p);
  await pressKey('ArrowDown');
  await pressKey('Enter');
  await sleep(80);
  p = await popupState();
  check(same(p.run.slice(1), [{ target: 'background', action: 'runSelection', platform: 'chatgpt', tabId: 5 }]) && p.closed === 1, 'ArrowDown, Enter: runSelection for ChatGPT on that tab, then the list closes', p.run);
  await openPopup({ targets: ['chatgpt'] }, { activeTab: other, runReplies: { selection: { ok: true, selected: true }, runSelection: { ok: false, error: 'No selected text' } } });
  await click(`document.querySelector('.ai')`);
  await sleep(80);
  p = await popupState();
  check(p.closed === 0 && p.context === 'Select the text again, then open this list again.' && p.hint && p.focus === 'chatgpt', 'the selection gone: says so, focus stays on the AI', p);
  await openPopup({ targets: ['chatgpt'] }, { activeTab: other, runReplies: { selection: { ok: true, selected: false } } });
  p = await popupState();
  check(p.context === 'Open Gmail, or select some text on a page and right-click it.' && p.buttons[0].disabled && p.buttons[0].label === 'Ask ChatGPT', 'nothing selected there: the hint, nothing pickable', p);
});

await scenario('P09 toolbar list (1.5.0): a compact "Style for this send" picker above the AIs, on the default, marked as such, with the built-in styles and the saved prompts in two labelled groups; every pick carries what it shows, from the keyboard too, and it starts on the default each time; none outside Gmail or for selected text', async (check) => {
  const picker = () => evaluate(`(() => { const p = document.getElementById('style-pick'); const s = document.getElementById('style');
    return { shown: !p.hidden && !!p.offsetParent, label: p.querySelector('label').textContent, forId: p.querySelector('label').htmlFor, value: s.value,
      groups: [...s.children].map((g) => [g.tagName, g.label, [...g.children].map((o) => [o.value, o.textContent])]), title: s.title,
      above: !!(p.compareDocumentPosition(document.getElementById('list')) & Node.DOCUMENT_POSITION_FOLLOWING) }; })()`);
  const seed = { targets: ['claude-code', 'claude'], promptStyle: 'quick', savedPrompt2: { name: 'Resolve fully', desktop: 'D', web: '' } };
  const env = { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 0, total: 0, thread: true } } } };
  await openPopup(seed, env);
  let p = await picker();
  check(p.shown && p.above && p.label === 'Style for this send' && p.forId === 'style' && p.value === 'quick', 'in Gmail: the picker above the AIs, labelled "Style for this send", on the default (Quick summary and reply)', p);
  check(same(p.groups, [['OPTGROUP', 'Built-in', [['resolve', 'Resolve fully'], ['quick', 'Quick summary and reply (default)'], ['drafts', 'Draft replies only']]], ['OPTGROUP', 'Saved', [['saved2', 'Resolve fully']]]]) && p.title === 'Change the default in Settings.',
    'two labelled groups, Built-in and Saved, so a saved prompt named like a built-in style is told apart; the default says so', p.groups);
  check((await popupState()).focus === 'claude-code', 'focus still starts on the first AI, ready for Enter');
  // From the keyboard: Shift+Tab to the picker, "d" for Draft replies only, Tab back to the AI, Enter.
  await press('Tab', 8);
  await sleep(40);
  check((await evaluate('document.activeElement.id')) === 'style', 'Shift+Tab from the first AI reaches the picker');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', text: 'd', windowsVirtualKeyCode: 68 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
  await sleep(40);
  check((await picker()).value === 'drafts', 'typing "d" picks Draft replies only', (await picker()).value);
  const ring = await evaluate(`(() => { const cs = getComputedStyle(document.activeElement); return cs.outlineStyle + ' ' + cs.outlineWidth; })()`);
  check(ring === 'solid 3px', 'the picker shows the focus ring', ring);
  await press('Tab');
  await pressKey('Enter');
  await sleep(80);
  p = await popupState();
  check(same(p.run, [{ target: 'background', action: 'run', platform: 'claude-code', tabId: 7, style: 'drafts' }]) && p.closed === 1, 'the pick carries the style for that send, then the list closes', p.run);
  check(same(await promptSets(), []), 'nothing is saved: the default stays as it was');
  // It starts on the default again, and a pick left on the default carries it too, so a default changed on another
  // computer meanwhile cannot change what this send gets.
  await openPopup(seed, env);
  check((await picker()).value === 'quick', 'opened again: on the default');
  await click(`document.querySelector('.ai')`);
  await sleep(80);
  check(same((await popupState()).run, [{ target: 'background', action: 'run', platform: 'claude-code', tabId: 7, style: 'quick' }]), 'a pick left on the default: the default\'s id in the message', (await popupState()).run);
  // A saved prompt, by the mouse.
  await openPopup(seed, env);
  await evaluate(`(() => { const s = document.getElementById('style'); s.value = 'saved2'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await click(`document.querySelectorAll('.ai')[1]`);
  await sleep(80);
  check(same((await popupState()).run, [{ target: 'background', action: 'run', platform: 'claude', tabId: 7, style: 'saved2' }]), 'a saved prompt picked: its style id goes with the pick', (await popupState()).run);
  // 1.4.0's own instructions show by their new name, and are the default until a style is chosen.
  await openPopup({ targets: ['claude'], webInstructions: 'Old web ask.' }, env);
  p = await picker();
  check(p.value === 'saved1' && same(p.groups.at(-1), ['OPTGROUP', 'Saved', [['saved1', 'My instructions (default)']]]), '1.4.0\'s own instructions: "My instructions", the default', p);
  await openPopup({ targets: ['claude'], promptStyle: 'drafts' }, env);
  check((await picker()).groups.length === 1, 'no saved prompts: no Saved group');
  // No picker where a pick does not go to emails in Gmail.
  await openPopup(seed, { activeTab: { id: 5, url: 'https://outlook.live.com/mail/0/inbox' }, runReplies: { selection: { ok: true, selected: true } } });
  check(!(await picker()).shown, 'selected text on another site: no picker (it keeps its built-in prompt)');
  await click(`document.querySelector('.ai')`);
  await sleep(80);
  check(same((await popupState()).run.at(-1), { target: 'background', action: 'runSelection', platform: 'claude-code', tabId: 5 }), 'and its pick carries no style');
  await openPopup(seed, { activeTab: { id: 5 } });
  check(!(await picker()).shown, 'outside Gmail with nothing selected: no picker');
  await openPopup(seed, { activeTab: GMAIL_TAB, answers: {} });
  check(!(await picker()).shown, 'a Gmail tab that cannot be reached: no picker');
  await openPopup({ ...seed, targets: [] }, env);
  check(!(await picker()).shown, 'nothing picked: no picker');
});

await scenario('P07 toolbar list: fits 320 px in light and dark with the longest labels; text 4.5:1 and the focus ring 3:1; no HTML sinks or inline scripts', async (check) => {
  for (const scheme of ['light', 'dark']) {
    await openPopup({ targets: TARGETS.map((t) => t.id), promptStyle: 'saved3', savedPrompt3: { name: 'W'.repeat(40), desktop: 'D', web: '' } }, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 25, total: 30, thread: false } } }, commands: COMMANDS }, { scheme });
    await sleep(40);
    const o = await evaluate(`(() => { const w = document.documentElement.clientWidth; const over = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > w + 0.5 || r.left < -0.5); }).map((e) => e.tagName + '.' + e.className);
      return { w, scroll: document.documentElement.scrollWidth, over }; })()`);
    check(o.scroll <= o.w && !o.over.length && (await evaluate(`!document.getElementById('style-pick').hidden`)), `${scheme}: no horizontal overflow, with the style picker showing a 40-character name`, o);
    const rows = await evaluate(`(() => { ${CONTRAST_FN}
      const txt = (label, sel) => { const el = document.querySelector(sel); return { label, ratio: ratio(parse(getComputedStyle(el).color), bgOf(el)) }; };
      const line = (label, sel) => { const el = document.querySelector(sel); return { label, ratio: ratio(parse(getComputedStyle(el).borderTopColor), bgOf(el.parentElement)), ui: true }; };
      return [txt('masthead', '.mast span'), txt('context line', '#context'), txt('AI label', '.ai .label'), txt('AI note', '.ai .note'), txt('Settings link', '#settings'), txt('shortcut line', '#last'), txt('keycap', '#last kbd'),
        txt('style picker label', '.style-pick label'), txt('style picker', '#style'), line('style picker border', '#style'),
        { label: 'focus ring', ratio: ratio(parse(getComputedStyle(document.documentElement).getPropertyValue('--rubric').trim().replace(/^#(..)(..)(..)$/, (m, r, g, b) => 'rgb(' + [r, g, b].map((h) => parseInt(h, 16)).join(',') + ')')), bgOf(document.body)), ui: true }]; })()`);
    for (const r of rows) check(r.ratio >= (r.ui ? 3 : 4.5), `${scheme}: ${r.label} ${r.ratio}:1`, r.ratio);
  }
  const sinks = /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write|createContextualFragment|srcdoc)\b/;
  for (const f of ['popup.js', 'popup.html', 'toast.js']) check(!sinks.test(readFileSync(join(REPO, f), 'utf8')), `${f}: no HTML sinks`);
  const html = readFileSync(join(REPO, 'popup.html'), 'utf8');
  check(!(html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []).length && !/\son[a-z]+=/i.test(html), 'popup.html: no inline scripts or handlers (MV3 CSP)');
  await send('Page.navigate', { url: 'about:blank' });
});

// ---------- screenshots ----------
async function shoot(file, { width, scheme, variant = 'real', seed = {}, prep, chunk = 900, env = {} }) {
  await open(variant, seed, { width, height: 900, scheme, env });
  if (prep) await prep();
  await sleep(250);
  const h = await evaluate('document.documentElement.scrollHeight');
  await evaluate('window.scrollTo(0, 0)');
  const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } });
  writeFileSync(join(SHOTS, `${file}.png`), Buffer.from(full.data, 'base64'));
  const parts = [];
  for (let y = 0, i = 0; y < h; y += chunk, i++) {
    const p = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: Math.min(chunk, h - y), scale: 1 } });
    const name = `${file}-part${i}.png`;
    writeFileSync(join(SHOTS, name), Buffer.from(p.data, 'base64'));
    parts.push(name);
  }
  return { file: `${file}.png`, height: h, parts };
}
const shotsMade = [];
if (process.env.SHOTS !== '0') {
  for (const scheme of ['light', 'dark']) {
    for (const width of [1280, 420]) {
      shotsMade.push(await shoot(`${scheme}-${width}`, { width, scheme }));
      shotsMade.push(await shoot(`${scheme}-${width}-full`, {
        width, scheme, variant: 'donate', seed: { targets: ['claude-code', 'codex', 'claude', 'gemini', 'copy'], folder: '/Users/you/Documents/Work' },
      }));
    }
  }
  shotsMade.push(await shoot('light-420-empty', { width: 420, scheme: 'light', seed: { targets: [] } }));
  shotsMade.push(await shoot('light-1280-focus', {
    width: 1280, scheme: 'light', seed: { targets: ['claude-code', 'claude'] },
    prep: async () => { await press('Tab'); await press('Tab'); await press('Tab'); await click(tileSel('Gemini')); await press('Tab'); },
  }));
  // The toolbar list, in Gmail with three emails ticked and outside Gmail.
  async function shootPopup(file, seed, env, scheme) {
    await openPopup(seed, env, { scheme });
    await sleep(250);
    const h = await evaluate('document.documentElement.scrollHeight');
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 320, height: h, scale: 1 } });
    writeFileSync(join(SHOTS, `${file}.png`), Buffer.from(shot.data, 'base64'));
    return { file: `${file}.png`, height: h, parts: [] };
  }
  for (const scheme of ['light', 'dark']) {
    const seed = { targets: ['claude-code', 'claude', 'chatgpt', 'copy'] };
    shotsMade.push(await shootPopup(`popup-${scheme}-ticked`, seed, { activeTab: GMAIL_TAB, answers: { 7: { state: { ok: true, ticked: 3, total: 3, thread: false } } }, commands: COMMANDS, local: { lastTarget: 'claude' } }, scheme));
    shotsMade.push(await shootPopup(`popup-${scheme}-outside`, seed, { activeTab: { id: 5 } }, scheme));
  }
  shotsMade.push(await shoot('light-1280-toolbar-step', {
    width: 1280, scheme: 'light', seed: { targets: ['claude-code', 'claude'] }, env: { commands: COMMANDS, gmailTabs: [{ id: 7, active: true }], answers: { 7: { check: { ok: true, rows: 50, thread: false, menu: true, toolbar: true, button: true, buttonOn: true } } } },
    prep: async () => {
      await evaluate(`document.getElementById('check-gmail').click(); 1`);
      await sleep(80);
    },
  }));
  // 1.5.0: the prompts, with two saved prompts and one of them the default.
  for (const scheme of ['light', 'dark']) {
    for (const width of [1280, 420]) {
      shotsMade.push(await shoot(`${scheme}-${width}-prompts`, {
        width, scheme, seed: { targets: ['claude-code', 'claude'], promptStyle: 'saved1',
          savedPrompt1: { name: 'Resolve, then short replies', desktop: 'Work through these threads and resolve what you can.\nCheck the facts in my tools before you draft anything.', web: '' },
          savedPrompt2: { name: 'Polite follow-ups', desktop: '', web: 'Draft a polite follow-up for each email still waiting on a reply, in two lines.' } },
      }));
    }
  }
  shotsMade.push(await shoot('dark-1280-focus-input', {
    width: 1280, scheme: 'dark', seed: { targets: ['claude-code'] },
    prep: async () => { await click(`document.getElementById('folder')`); await typeSlowly('/Users/me/Work', 5); await sleep(700); },
  }));
}

// ---------- report ----------
const summary = { passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length, total: results.length };
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ summary, chrome: CHROME, expectedPasteKey: PASTE_KEY, results, contrast: contrastTable, shots: shotsMade, consoleErrors }, null, 2));
console.log(`\n${summary.passed}/${summary.total} scenarios passed. Details: ${relative(REPO, join(OUT, 'results.json'))}`);
for (const [scheme, rows] of Object.entries(contrastTable)) console.log(scheme, rows.map((r) => `${r.label}=${r.ratio}`).join('; '));
ws.close();
chromeProc.kill('SIGTERM');
process.exit(summary.failed ? 1 : 0);
