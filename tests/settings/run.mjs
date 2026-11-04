// Settings page suite: the REAL options.html/options.js/targets.js in headless Chrome, driven over the
// Chrome DevTools Protocol with a stub chrome.* (stub-chrome.js). Checks behaviour, copy, keyboard use,
// overflow and contrast. Writes only to tests/.out/settings/.
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
async function open(variant, seed = {}, { width = 1280, height = 900, scheme = 'light', hash = '' } = {}) {
  if (seedScript) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedScript });
  seedScript = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__seed = ${JSON.stringify(seed)};` })).identifier;
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  const before = events.length;
  await send('Page.navigate', { url: pageFor[variant] + hash });
  for (let i = 0; i < 100 && !events.slice(before).some((e) => e.method === 'Page.loadEventFired'); i++) await sleep(50);
  await withDeadline(
    evaluate(`new Promise((r) => { const t = () => document.querySelectorAll('#tiles .tile').length ? r() : setTimeout(t, 10); t(); })`),
    TILES_WAIT_MS,
    `open('${variant}'): the settings page showed no tiles within ${TILES_WAIT_MS / 1000} s`,
  );
  await sleep(50);
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
  check(h.line === 'Choose what appears when you right-click an email in Gmail. Changes save as you go.', 'header line', h.line);
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
  check(sub === "Each one you pick appears when you right-click an email in Gmail, in this order.", 'step 1 subline', sub);
  const h2 = await evaluate(`[...document.querySelectorAll('h2')].map((h) => h.textContent)`);
  check(same(h2, ['Pick the AIs you use', 'Pick a working folder', 'Try it']), 'step titles', h2);
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
  for (let i = 0; i < 16; i++) {
    order.push(await evaluate(`(() => { const a = document.activeElement; return a.querySelector?.('.name')?.textContent || a.id || a.textContent.trim().slice(0, 20); })()`));
    await press('Tab');
  }
  check(order.slice(11, 15).join('|') === 'Open Gmail|donate-link|Privacy|Help', 'tab order: 11 tiles, Open Gmail, Donate, Privacy, Help', order);
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
  check(notice.text === 'One more step. Reload your Gmail tab, then right-click the email again. That Gmail tab could not pick up the extension by itself, so it needs one reload.', 'reload notice text', notice.text);
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
  check(d.link === 'Donate to Friends of Larnaca Cats' && d.href === 'https://friends-of-larnaca-cats.weebly.com/donate.html?ref=ai-agent', 'https link to the charity', d);
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
      await open('donate', { targets: TARGETS.map((t) => t.id), folder: '/Users/someone/Documents/A very long folder name/Projects/2026' }, { width, scheme });
      const o = await evaluate(`(() => { const w = innerWidth; const over = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > w + 0.5 || r.left < -0.5); }).map((e) => e.tagName + '.' + e.className);
        return { w, scroll: document.documentElement.scrollWidth, over }; })()`);
      check(o.scroll <= o.w && o.over.length === 0, `${scheme} ${width}px fits`, o);
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
    await open('donate', { targets: ['claude-code', 'claude'], folder: '/x' }, { scheme });
    await evaluate(`document.getElementById('empty').hidden = false; document.getElementById('pick-saved').textContent = 'Saved'; document.getElementById('pick-saved').classList.add('show'); 1`);
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
      ]; })()`);
    for (const r of rows) {
      const min = r.kind === 'ui' ? 3 : 4.5;
      check(r.ratio >= min, `${scheme}: ${r.label} ${r.ratio}:1 (min ${min})`, r.ratio);
    }
    contrastTable[scheme] = rows;
  }
});

// ---------- screenshots ----------
async function shoot(file, { width, scheme, variant = 'real', seed = {}, prep, chunk = 900 }) {
  await open(variant, seed, { width, height: 900, scheme });
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
