// Loads the extension into headless Chrome next to a Gmail tab that is already open, as it is for
// someone who installs or updates it, and checks what only a real Chrome shows. Four runs, each with a
// new throwaway profile and package folder under tests/.out/package/tmp:
//
//   install  The Gmail tab is open first. The content script arrives without a reload, background.js
//            reads Gmail's session key in the page's main world, Chrome shows the same permission
//            warnings as for 1.1.1, and a bulk copy of two selected rows runs end to end. The toolbar list
//            opens as a real popup over Gmail (action.openPopup) and a pick in it runs in the Gmail tab.
//   update   1.1.1 is installed and running in the tab, then the same folder is loaded again with this
//            version, so Chrome treats it as an update. The tab gets the new copy without a reload, the
//            1.1.1 copy is left orphaned, and the menu shows the new items once.
//   update from 1.2.0  1.2.0 runs in the tab and the user right-clicks a row; then this version replaces
//            it, as the update Chrome users get now. The first right-click after the update must show the
//            new copy's items, and picking one must work.
//   next update  The same, from this code with a lower version number, as the update after this one.
//
// 1.1.1 and 1.2.0 are rebuilt from tests/content/oracle (their manifest, background.js, content.js and
// targets.js as released) plus the settings page, offscreen document, icons and fonts of the copy under
// test.
// Gmail is a mock: every https://mail.google.com/* request from the tab is answered locally through the
// DevTools Fetch domain, and every other host is unresolvable, so nothing leaves the machine. Branded
// Chrome ignores --load-extension, so this uses Extensions.loadUnpacked over --remote-debugging-pipe,
// as load.mjs does. Writes its report to tests/.out/package/gmail-tab.json.
//
//   node tests/package/gmail-tab.mjs        the extension files in the repository
//   node tests/package/gmail-tab.mjs DIR    an unpacked copy, for example the unzipped release

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, OUT_ROOT, findChrome, extraChromeFlags } from '../lib/chrome.mjs';
import { TITLE, IK, GMAIL_PAGE, printView, SINGLE, BULK, BULK_RELEASED, TARGETS_SET, SINGLE_HINT, SHORTCUTS_OK, SELECTED_TEXT } from './mock-gmail.mjs';

// The same JSON whatever order the keys come back in (Chrome's storage returns them sorted).
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : REPO;
if (!fs.existsSync(path.join(SRC, 'manifest.json'))) {
  console.error(`Usage: node tests/package/gmail-tab.mjs [DIR], where DIR holds an unpacked extension (got "${process.argv[2] || ''}").`);
  process.exit(2);
}
const ORACLE = path.join(REPO, 'tests', 'content', 'oracle');
const OUT = path.join(OUT_ROOT, 'package');
fs.mkdirSync(OUT, { recursive: true });
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const manifest = readJson(path.join(SRC, 'manifest.json'));
const OLD_MANIFEST = path.join(ORACLE, 'v1.1.1-manifest.json');
const WORKER = manifest.background.service_worker;
const RUN_MS = 120000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const report = { source: path.relative(REPO, SRC) || '.', version: manifest.version, steps: [], warnings: {}, printViewRequests: [], exceptions: [], console: [] };
function step(what, ok, detail) {
  report.steps.push({ what, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${!ok && detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 600)}` : ''}`);
}

// ---- Packages ----

// The runtime files, as scripts/package.mjs allows them: the manifest, LICENSE, root scripts and pages, icons and fonts.
function copyRuntime(from, to) {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.isFile() && (e.name === 'manifest.json' || e.name === 'LICENSE' || /\.(js|html)$/.test(e.name))) fs.copyFileSync(path.join(from, e.name), path.join(to, e.name));
    if (e.isDirectory() && (e.name === 'icons' || e.name === 'fonts')) fs.cpSync(path.join(from, e.name), path.join(to, e.name), { recursive: true });
  }
}
// A released version: its four files from tests/content/oracle over the rest of the copy under test.
function copyReleased(version, to) {
  copyRuntime(SRC, to);
  for (const f of ['manifest.json', 'background.js', 'content.js', 'targets.js']) fs.copyFileSync(path.join(ORACLE, `v${version}-${f}`), path.join(to, f));
}
const TMP = path.join(OUT, 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const tempDir = (name) => fs.mkdtempSync(path.join(TMP, `gmail-tab-${name}-`));

// ---- Mock Gmail ----

// The copy goes through the offscreen document; a headless Chrome may refuse the clipboard, which still
// shows the hand-off reached background.js.
const COPIED = /^Copied 2 emails\. Paste them into any AI with (Cmd|Ctrl)\+V\.$|^Could not copy the emails/;
const COPIED_SELECTION = /^Copied\. Paste it into any AI with (Cmd|Ctrl)\+V\.$|^Could not copy the selected text/;
// The note in the tab while it is shown, or ''.
const SHOWN_TOAST = `(() => { const t = document.getElementById('vpa-toast'); return t && t.style.opacity === '1' ? t.textContent : ''; })()`;
const CLOSE_TOAST = `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`;

// ---- Chrome over a DevTools pipe (commands on fd 3, replies on fd 4, each message ending in a NUL) ----

async function withChrome(label, run) {
  const profile = tempDir('profile');
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-sync', '--disable-component-update', `--user-data-dir=${profile}`, '--host-resolver-rules=MAP * ~NOTFOUND',
      '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', ...extraChromeFlags(), 'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] },
  );
  let stderr = '';
  chrome.stdio[2].on('data', (d) => (stderr = (stderr + d).slice(-4000)));
  chrome.stdio[3].on('error', () => {}); // a write after Chrome has gone; the pending command fails instead
  const exited = new Promise((resolve) => chrome.once('exit', resolve));

  let seq = 0;
  let inbox = '';
  const pending = new Map();
  const s = { pageSession: null, contexts: [] };
  const fail = (e) => {
    for (const p of pending.values()) p.reject(e);
    pending.clear();
  };
  chrome.on('error', (e) => fail(new Error(`could not start Chrome: ${e.message}`)));
  exited.then((code) => fail(new Error(`Chrome exited (${code}). Its last output:\n${stderr.trim()}`)));

  s.send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { method, resolve, reject });
      chrome.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })}\0`);
    });
  const onEvent = (m) => {
    if (m.sessionId !== s.pageSession) return;
    if (m.method === 'Runtime.executionContextCreated') {
      const c = m.params.context;
      s.contexts.push({ id: c.id, name: c.name, origin: c.origin, type: c.auxData?.type });
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      report.exceptions.push({ phase: label, text: d.text, description: d.exception?.description?.slice(0, 300), url: d.url });
    }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      report.console.push({ phase: label, text: m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300) });
    }
    if (m.method === 'Fetch.requestPaused') {
      const { requestId, request } = m.params;
      const url = new URL(request.url);
      if (url.hostname !== 'mail.google.com') return s.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, m.sessionId).catch(() => {});
      let body = GMAIL_PAGE;
      if (url.searchParams.get('view') === 'pt') {
        report.printViewRequests.push({ phase: label, url: request.url, method: request.method });
        body = printView(url.searchParams.get('th'));
      }
      s.send(
        'Fetch.fulfillRequest',
        { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: Buffer.from(body).toString('base64') },
        m.sessionId,
      ).catch(() => {});
    }
  };
  chrome.stdio[4].on('data', (d) => {
    inbox += d;
    for (let end; (end = inbox.indexOf('\0')) >= 0; inbox = inbox.slice(end + 1)) {
      const msg = JSON.parse(inbox.slice(0, end));
      const p = msg.id && pending.get(msg.id);
      if (!p) {
        onEvent(msg);
        continue;
      }
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
    }
  });

  // Evaluates in the tab (its main world, or the given context) or, with a session, in that target.
  s.evalIn = async (expression, contextId, sessionId = s.pageSession) => {
    const r = await s.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, ...(contextId && { contextId }) }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  s.isolated = (extId) => s.contexts.filter((c) => c.type === 'isolated' && c.origin === `chrome-extension://${extId}`);
  s.attach = async (targetId) => (await s.send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  s.serviceWorker = async (extId) => {
    for (let i = 0; i < 50; i++) {
      const { targetInfos } = await s.send('Target.getTargets');
      const sw = targetInfos.find((t) => t.type === 'service_worker' && t.url === `chrome-extension://${extId}/${WORKER}`);
      if (sw) return s.attach(sw.targetId);
      await sleep(100);
    }
    throw new Error(`no service worker for ${WORKER}`);
  };
  // A tab that answers https://mail.google.com/* with the mock, with its contexts and errors recorded.
  s.openTab = async () => {
    await s.send('Target.setDiscoverTargets', { discover: true });
    const { targetId } = await s.send('Target.createTarget', { url: 'about:blank' });
    s.targetId = targetId;
    s.pageSession = await s.attach(targetId);
    await s.send('Fetch.enable', { patterns: [{ urlPattern: 'https://mail.google.com/*', requestStage: 'Request' }] }, s.pageSession);
    await s.send('Runtime.enable', {}, s.pageSession);
    await s.send('Page.enable', {}, s.pageSession);
  };
  s.openGmail = () => s.send('Page.navigate', { url: 'https://mail.google.com/mail/u/0/#inbox' }, s.pageSession);
  // Brings the Gmail tab to the front, as a user working in it would have it.
  s.front = async () => {
    await s.send('Target.activateTarget', { targetId: s.targetId });
    await s.send('Page.bringToFront', {}, s.pageSession);
    await s.send('Emulation.setFocusEmulationEnabled', { enabled: true }, s.pageSession);
  };
  // Right-clicks the first ticked row and, when given a label, clicks our item with it.
  s.rightClick = async (label) => {
    await s.evalIn(`(() => { const t = document.querySelector('#r1 .bqe'); const r = t.getBoundingClientRect();
      t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + 2, clientY: r.top + 2 })); })()`);
    await sleep(500);
    const labels = await s.evalIn(`[...document.querySelectorAll('.vpa-item')].map((i) => i.textContent)`);
    if (!label) {
      await s.evalIn(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
      return { labels };
    }
    await s.evalIn(`(() => { const item = [...document.querySelectorAll('.vpa-item')].find((i) => i.textContent === ${JSON.stringify(label)});
      const inner = item?.querySelector('.J-N-Jz');
      for (const t of ['mousedown', 'mouseup', 'click']) inner?.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true })); })()`);
    return { labels, toast: await s.waitToast(/^(Copied|Could not|The extension)/) };
  };
  // The note once it shows text matching re (only while shown: since 1.4.0 Escape fades the last one out).
  s.waitToast = async (re, tries = 60) => {
    let toast = '';
    for (let i = 0; i < tries && !re.test(toast); i++) {
      await sleep(100);
      toast = await s.evalIn(SHOWN_TOAST);
    }
    return toast;
  };
  // An extension page in a tab of its own (the settings page or the toolbar list), with its session.
  s.extensionPage = async (extId, file) => {
    const { targetInfos } = await s.send('Target.getTargets');
    let target = targetInfos.find((t) => t.type === 'page' && t.url.startsWith(`chrome-extension://${extId}/${file}`));
    if (!target) {
      const { targetId } = await s.send('Target.createTarget', { url: `chrome-extension://${extId}/${file}` });
      target = { targetId };
      await sleep(800);
    }
    return s.attach(target.targetId);
  };

  const watchdog = setTimeout(() => fail(new Error(`no result within ${RUN_MS / 1000} s`)), RUN_MS);
  try {
    await run(s);
  } catch (e) {
    step(`${label}: ran to the end`, false, e.message);
  } finally {
    clearTimeout(watchdog);
    chrome.kill('SIGKILL');
    await Promise.race([exited, sleep(5000)]);
  }
}

// ---- install: the Gmail tab is open first ----

await withChrome('install', async (s) => {
  await s.openTab();
  await s.openGmail();
  await sleep(1500);
  step('install: mock Gmail tab open before the install (served locally)', (await s.evalIn('document.title')) === TITLE);
  step('install: no content script in it yet', (await s.evalIn(`!document.getElementById('vpa-toast')`)) === true);

  const pkg = tempDir('install');
  copyRuntime(SRC, pkg);
  const { id } = await s.send('Extensions.loadUnpacked', { path: pkg });
  step(`install: Chrome accepts ${manifest.name} ${manifest.version} (Extensions.loadUnpacked)`, !!id, id);
  await sleep(2500);
  step('install: the content script reaches the open Gmail tab without a reload (one toast element)', (await s.evalIn(`document.querySelectorAll('#vpa-toast').length`)) === 1);
  const iso = s.isolated(id);
  step('install: one isolated world for the extension in the tab', iso.length === 1, iso);
  const state = await s.evalIn(`({ loaded: globalThis.vpaContentLoaded, targets: typeof TARGETS === 'object' && TARGETS.length })`, iso[0]?.id);
  step('install: content.js ran once, after targets.js', state.loaded === true && state.targets > 0, state);

  // The install opened the settings page in front; work in the Gmail tab, as a user would.
  await s.front();
  const sw = await s.serviceWorker(id);
  await s.evalIn(`chrome.storage.sync.set({ targets: ${JSON.stringify(TARGETS_SET)} })`, undefined, sw);
  const warn = async (m) => s.evalIn(`chrome.management.getPermissionWarningsByManifest(${JSON.stringify(JSON.stringify(m))})`, undefined, sw);
  report.warnings.v111 = await warn(readJson(OLD_MANIFEST));
  report.warnings.current = await warn(manifest);
  const sorted = (a) => JSON.stringify([...a].sort());
  step(`install: Chrome shows the same permission warnings for ${manifest.version} as for 1.1.1, so an update is not held for new permissions`, sorted(report.warnings.v111) === sorted(report.warnings.current), report.warnings);

  const ik = await s.evalIn(`chrome.runtime.sendMessage({ target: 'background', action: 'ik' })`, iso[0]?.id);
  step("install: background.js reads Gmail's session key (window.GLOBALS[9]) in the tab's main world", ik?.ok === true && ik.ik === IK, ik);
  step('install: the content script cannot see GLOBALS itself (the reason background.js reads it)', (await s.evalIn(`typeof window.GLOBALS`, iso[0]?.id)) === 'undefined');

  const run = await s.rightClick('Copy 2 emails for any AI');
  step('install: two ticked rows give the bulk items in the real menu', JSON.stringify(run.labels) === JSON.stringify(BULK), run.labels);
  const views = report.printViewRequests.filter((r) => r.phase === 'install');
  step(`install: bulk copy reads both print views from the tab's own mailbox path with the session key`, views.length === 2 && views.every((r) => r.method === 'GET' && new RegExp(`^https://mail\\.google\\.com/mail/u/0/\\?ik=${IK}&view=pt&search=all&th=19a0b1c2d3e4f50[12]$`).test(r.url)), views);
  step('install: bulk copy ends with the result toast', COPIED.test(run.toast), run.toast);

  // ---- 1.4.0 in a real Chrome ----
  const state2 = await s.evalIn(`({ toast: globalThis.vpaToastLoaded })`, iso[0]?.id);
  step('install: toast.js ran in the same isolated world', state2.toast === true, state2);
  const tb = await s.evalIn(`[...document.querySelectorAll('.vpa-tb')].map((b) => b.textContent + (b.nextElementSibling?.classList.contains('nf') ? ' (before More)' : ''))`);
  step("install: one button in Gmail's toolbar, before More, reading Send 2 to AI with two rows ticked", JSON.stringify(tb) === '["Send 2 to AI (before More)"]', tb);
  const commands = await s.evalIn(`chrome.commands.getAll().then((c) => c.map((x) => ({ name: x.name, shortcut: x.shortcut })))`, undefined, sw);
  report.commands = commands;
  step('install: Chrome gives both shortcuts their suggested keys (Alt+Shift+O opens the toolbar list, Alt+Shift+L sends to the AI used last; Control+Shift on a Mac)', SHORTCUTS_OK(commands), commands);

  // The toolbar list's route: a pick sent from an extension page runs on the Gmail tab.
  await s.evalIn(CLOSE_TOAST);
  const settings = await s.extensionPage(id, 'options.html');
  const picked = await s.evalIn(`chrome.tabs.query({ url: 'https://mail.google.com/*' }).then(([tab]) => chrome.runtime.sendMessage({ target: 'background', action: 'run', platform: 'copy', tabId: tab.id }))`, undefined, settings);
  const listToast = await s.waitToast(COPIED);
  step('install: a pick from the toolbar list (an extension page) is accepted and copies the two ticked emails in the Gmail tab', picked?.ok === true && COPIED.test(listToast), { picked, listToast });
  const refused = await s.evalIn(`chrome.runtime.sendMessage({ target: 'background', action: 'run', platform: 'copy' })`, iso[0]?.id).catch((e) => ({ error: e.message }));
  step('install: the same message from the content script gets no answer (only extension pages may send it)', refused === undefined || refused?.error, refused);

  // A saved prompt (1.5.0) made on the real settings page, in real Chrome storage.sync, reaches the prompt the content
  // script builds when the toolbar list picks it for one send; with no style, the default (Resolve fully) is used.
  const OWN_TEXT = 'Settle each matter before drafting.\n- Check Sent mail first.';
  await s.evalIn(`(() => { document.getElementById('add-prompt').click(); const f = document.getElementById('sp1-desktop'); f.focus(); f.value = ${JSON.stringify(`${OWN_TEXT}\nMailbox: someone@example.org`)}; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`, undefined, settings);
  await sleep(300);
  const ownStored = await s.evalIn(`chrome.storage.sync.get({ savedPrompt1: null }).then((x) => x.savedPrompt1)`, undefined, settings);
  step('install: a saved prompt added and typed on the settings page is saved in storage.sync as its own item, as the prompts use it (the Mailbox line left out)', canon(ownStored) === canon({ name: 'Saved prompt 1', desktop: OWN_TEXT, web: '' }), ownStored);
  const codexPrompt = async (style) => {
    const url = await s.evalIn(`chrome.tabs.query({ url: 'https://mail.google.com/*' }).then(([tab]) => chrome.tabs.sendMessage(tab.id, { target: 'content', action: 'run', platform: 'codex', current: true${style ? `, style: '${style}'` : ''} }, { frameId: 0 })).then((r) => r && r.url)`, undefined, settings);
    return typeof url === 'string' ? new URL(url).searchParams.get('prompt') || '' : '';
  };
  const ownPrompt = await codexPrompt('saved1');
  step('install: the Codex link for the two ticked emails with saved prompt 1 picked for this send starts with its text and ends on the approval sentence; one Mailbox line', ownPrompt.startsWith(`${OWN_TEXT}\n\nMailbox: `) && /outside your working folder without my explicit approval; .*its risks\.$/.test(ownPrompt) && ownPrompt.split('Mailbox:').length === 2, ownPrompt.slice(0, 120));
  const defaultPrompt = await codexPrompt('');
  step('install: the next pick with no style (the shortcut, or the list left on the default): the default, Resolve fully', defaultPrompt.startsWith('Work through these 2 Gmail threads as one batch.') && !defaultPrompt.includes(OWN_TEXT), defaultPrompt.slice(0, 120));
  // Chrome's own per-item limit for one saved prompt, where the settings page's count (fitsSync) puts it: "<" takes six
  // bytes (Chromium's JSON writer escapes it), so 1,357 fit in { name: 'x', desktop, web: '' } and 1,358 do not.
  const quota = await s.evalIn(`(async () => { const item = (n) => ({ name: 'x', desktop: '<'.repeat(n), web: '' }); let n = 0; while (fitsSync('savedPrompt3', item(n + 1))) n++;
    const tryIt = (k) => chrome.storage.sync.set({ savedPrompt3: item(k) }).then(() => 'ok', (e) => String(e && e.message)); const r = [n, await tryIt(n), await tryIt(n + 1)];
    await chrome.storage.sync.remove(['savedPrompt3', 'savedPrompt1']); return r; })()`, undefined, settings);
  step('install: Chrome takes a saved prompt of 1,357 "<" and refuses 1,358 (8,188 and 8,194 bytes with "<" as six), exactly where the settings page\'s count puts the limit', quota?.[0] === 1357 && quota?.[1] === 'ok' && /quota/i.test(quota?.[2] || ''), quota);

  // The shortcut's route: send-to-last with Copy as the AI used last.
  await s.evalIn(CLOSE_TOAST);
  await s.evalIn(`(async () => { await chrome.storage.local.set({ lastTarget: 'copy' }); const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/*' }); await onCommand('send-to-last', tab); return 1; })()`, undefined, sw);
  const keyToast = await s.waitToast(COPIED);
  step('install: the send-to-last shortcut (onCommand in the service worker) copies the ticked emails with the AI used last', COPIED.test(keyToast), keyToast);

  // Selected text: the copy, then toast.js and the note put into the tab with scripting.executeScript.
  await s.evalIn(CLOSE_TOAST);
  await s.evalIn(`chrome.tabs.query({ url: 'https://mail.google.com/*' }).then(([tab]) => onSelection({ menuItemId: 'selection:copy', selectionText: ${JSON.stringify(SELECTED_TEXT)} }, tab)).then(() => 1)`, undefined, sw);
  const selToast = await s.waitToast(COPIED_SELECTION);
  step('install: Copy selected text for any AI: the note shows in the tab (toast.js and its message injected by background.js)', COPIED_SELECTION.test(selToast), selToast);
  step('install: still one toast element and one toolbar button in the tab', (await s.evalIn(`document.querySelectorAll('#vpa-toast').length + document.querySelectorAll('.vpa-tb').length`)) === 2);

  // The real toolbar list: the popup, opened with the Gmail tab in front, as a click on the icon or Alt+Shift+O
  // opens it. It asks the tab what is ticked, shows the bulk labels, and a pick runs there and closes it.
  await s.evalIn(CLOSE_TOAST);
  await s.front();
  const popupUrl = `chrome-extension://${id}/popup.html`;
  const opened = await s.evalIn(`chrome.action.openPopup().then(() => 'opened', (e) => 'refused: ' + e.message)`, undefined, sw);
  let popupTarget = null;
  for (let i = 0; i < 40 && !popupTarget; i++) {
    await sleep(100);
    popupTarget = (await s.send('Target.getTargets')).targetInfos.find((t) => t.url === popupUrl) || null;
  }
  const ps = popupTarget ? await s.attach(popupTarget.targetId) : null;
  const real = ps
    ? await s.evalIn(`new Promise((r) => { const t = () => document.querySelector('.ai') && document.getElementById('context').textContent ? r({ context: document.getElementById('context').textContent,
        labels: [...document.querySelectorAll('.ai .label')].map((l) => l.textContent), enabled: [...document.querySelectorAll('.ai')].every((b) => !b.disabled) }) : setTimeout(t, 50); t(); })`, undefined, ps)
    : null;
  step('install: the toolbar list opens as a real popup with the Gmail tab in front (action.openPopup): "For the 2 emails you ticked." and the bulk labels, every AI pickable', opened === 'opened' && real?.context === 'For the 2 emails you ticked.' && JSON.stringify(real.labels) === JSON.stringify(BULK) && real.enabled, { opened, real, type: popupTarget?.type });
  // 1.5.0: its style picker, changed from the keyboard ("d" for Draft replies only), and the run message the content
  // script gets for the pick, recorded in the content script's own world.
  const PICKER = `(() => { const p = document.getElementById('style-pick'); const s = document.getElementById('style'); return { shown: !p.hidden && !!p.offsetParent, value: s.value,
    groups: [...s.children].map((g) => g.label + ': ' + [...g.children].map((o) => o.textContent).join(', ')) }; })()`;
  const pickerBefore = ps ? await s.evalIn(PICKER, undefined, ps) : null;
  step('install: the popup shows the style picker on the default, with the built-in styles in their group', pickerBefore?.shown && pickerBefore.value === 'resolve' && pickerBefore.groups[0] === 'Built-in: Resolve fully (default), Quick summary and reply, Draft replies only', pickerBefore);
  if (ps) {
    await s.evalIn(`document.getElementById('style').focus(); 1`, undefined, ps);
    await s.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', text: 'd', windowsVirtualKeyCode: 68 }, ps);
    await s.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 }, ps);
    await sleep(100);
  }
  const pickerAfter = ps ? await s.evalIn(PICKER, undefined, ps) : null;
  step('install: typing "d" in the popup\'s picker chooses Draft replies only', pickerAfter?.value === 'drafts', pickerAfter);
  await s.evalIn(`globalThis.__runs = []; chrome.runtime.onMessage.addListener((m) => { if (m && m.action === 'run') globalThis.__runs.push(m); }); 1`, iso[0]?.id);
  if (ps) await s.evalIn(`document.querySelector('.ai[data-id="copy"]').click(); 1`, undefined, ps).catch(() => {});
  const popupToast = await s.waitToast(COPIED);
  const runs = await s.evalIn(`globalThis.__runs`, iso[0]?.id);
  step('install: the pick reaches the content script through the real service worker with the style picked, for that send', canon(runs) === canon([{ target: 'content', action: 'run', platform: 'copy', current: true, style: 'drafts' }]), runs);
  await sleep(300);
  const popupLeft = (await s.send('Target.getTargets')).targetInfos.some((t) => t.url === popupUrl);
  step('install: Copy picked in the popup copies the two ticked emails in the Gmail tab (the note there says so), and the popup closes', COPIED.test(popupToast) && !popupLeft, { popupToast, popupLeft });

  // The toolbar list itself, in a tab: the active tab is then the list, not Gmail, so it shows the hint.
  const popup = await s.extensionPage(id, 'popup.html');
  const list = await s.evalIn(`new Promise((r) => { const t = () => document.getElementById('context').textContent ? r({ context: document.getElementById('context').textContent,
    labels: [...document.querySelectorAll('.ai .label')].map((l) => l.textContent), disabled: [...document.querySelectorAll('.ai')].every((b) => b.disabled) }) : setTimeout(t, 50); t(); })`, undefined, popup);
  step('install: popup.html renders the AIs picked and, away from Gmail, the hint', list.context === SINGLE_HINT && JSON.stringify(list.labels) === JSON.stringify(SINGLE) && list.disabled, list);
  step('install: no script errors in the tab', !report.exceptions.some((x) => x.phase === 'install'), report.exceptions);
});

// ---- update: 1.1.1 runs in the tab, then this version replaces it ----

await withChrome('update', async (s) => {
  const pkg = tempDir('update');
  copyReleased('1.1.1', pkg);
  await s.openTab();
  const { id } = await s.send('Extensions.loadUnpacked', { path: pkg });
  await sleep(1500);
  const sw = await s.serviceWorker(id);
  step('update: 1.1.1 installed', (await s.evalIn('chrome.runtime.getManifest().version', undefined, sw)) === '1.1.1');
  await s.evalIn(`chrome.storage.sync.set({ targets: ${JSON.stringify(TARGETS_SET)} })`, undefined, sw);
  await s.front();
  await s.openGmail();
  await sleep(2000);
  const old = s.isolated(id);
  step('update: the 1.1.1 content script runs in the Gmail tab (from the manifest, on load)', old.length === 1 && (await s.evalIn('typeof TARGETS', old[0]?.id)) === 'object', old);
  const before = await s.rightClick();
  step('update: the 1.1.1 menu has the single-thread items only', JSON.stringify(before.labels) === JSON.stringify(SINGLE), before.labels);

  // 1.4.0's own instructions, as an update from 1.4.0 finds them in storage.sync.
  await s.evalIn(`chrome.storage.sync.set({ desktopInstructions: 'Old desktop steps.', webInstructions: '' })`, undefined, sw);
  copyRuntime(SRC, pkg);
  const seen = s.contexts.length;
  const errors = report.exceptions.length;
  const again = await s.send('Extensions.loadUnpacked', { path: pkg });
  step('update: the same folder loaded again keeps the extension id (an update, not a second extension)', again.id === id, again.id);
  await sleep(3000);
  await s.front();
  const sw2 = await s.serviceWorker(id);
  step(`update: ${manifest.version} now running`, manifest.version !== '1.1.1' && (await s.evalIn('chrome.runtime.getManifest().version', undefined, sw2)) === manifest.version);
  const fresh = s.isolated(id).filter((c) => s.contexts.indexOf(c) >= seen);
  step('update: the open tab gets the new content script in a fresh isolated world, without a reload', fresh.length === 1, s.contexts.slice(seen));
  const state = fresh.length ? await s.evalIn(`({ loaded: globalThis.vpaContentLoaded, id: chrome.runtime?.id, bulk: TARGETS[0].bulkMenu })`, fresh[0].id) : null;
  step('update: the new copy runs with a live extension context and the bulk labels', state?.loaded === true && state.id === id && state.bulk === 'Open {n} in Claude Code', state);
  const orphan = await s.evalIn(`({ id: globalThis.chrome?.runtime?.id ?? null, bulk: TARGETS[0].bulkMenu ?? null })`, old[0]?.id).catch((e) => ({ error: e.message }));
  step('update: the 1.1.1 copy is orphaned (no extension context) in its own world', orphan.id === null && orphan.bulk === null && !orphan.error, orphan);
  step('update: no errors in the tab', report.exceptions.length === errors, report.exceptions.slice(errors));
  const run = await s.rightClick('Copy 2 emails for any AI');
  step("update: the menu shows the new bulk items once (the orphan's items are replaced, not added)", JSON.stringify(run.labels) === JSON.stringify(BULK), run.labels);
  step('update: bulk copy works in the open tab with no reload', COPIED.test(run.toast), run.toast);
  const moved = await s.evalIn(`chrome.storage.sync.get(null).then((x) => ({ saved: x.savedPrompt1 ?? null, style: x.promptStyle ?? null, old: ['desktopInstructions', 'webInstructions'].filter((k) => k in x) }))`, undefined, sw2);
  step('update: 1.4.0\'s own instructions moved by the real service worker into saved prompt 1, "My instructions", the default style; the old keys gone', canon(moved) === canon({ saved: { name: 'My instructions', desktop: 'Old desktop steps.', web: '' }, style: 'saved1', old: [] }), moved);
});

// ---- update from 1.2.0 and next update: a right-click, then this version replaces the one running ----

// The new copy's first right-click must not take the old copy's items for its own: they are still in Gmail's
// menu, and the old copy can no longer act on them. 1.2.0 marks the items it adds with the right-click's
// number; from 1.3.0 on, each copy adds a mark of its own, since every copy counts from 1.
const AFTER_RIGHT_CLICK = [
  { label: 'update from 1.2.0', version: '1.2.0', what: '1.2.0 as released', make: (pkg) => copyReleased('1.2.0', pkg) },
  {
    label: 'next update',
    version: '1.2.99',
    what: '1.2.99 (this code, an earlier version number)',
    make: (pkg) => {
      copyRuntime(SRC, pkg);
      fs.writeFileSync(path.join(pkg, 'manifest.json'), JSON.stringify({ ...manifest, version: '1.2.99' }, null, 2));
    },
  },
];

for (const before of AFTER_RIGHT_CLICK) {
  await withChrome(before.label, async (s) => {
    const pkg = tempDir(before.label.replaceAll(' ', '-').replaceAll('.', ''));
    before.make(pkg);
    await s.openTab();
    const { id } = await s.send('Extensions.loadUnpacked', { path: pkg });
    await sleep(1500);
    const sw = await s.serviceWorker(id);
    const running = await s.evalIn('chrome.runtime.getManifest().version', undefined, sw);
    await s.evalIn(`chrome.storage.sync.set({ targets: ${JSON.stringify(TARGETS_SET)} })`, undefined, sw);
    await s.front();
    await s.openGmail();
    await sleep(2000);
    const old = await s.rightClick();
    const oldBulk = before.version === '1.2.0' ? BULK_RELEASED : BULK;
    step(`${before.label}: ${before.what} runs and adds its bulk items once`, running === before.version && JSON.stringify(old.labels) === JSON.stringify(oldBulk), { running, labels: old.labels });
    copyRuntime(SRC, pkg);
    await s.send('Extensions.loadUnpacked', { path: pkg });
    await sleep(3000);
    await s.front();
    const sw2 = await s.serviceWorker(id);
    step(`${before.label}: ${manifest.version} now running`, (await s.evalIn('chrome.runtime.getManifest().version', undefined, sw2)) === manifest.version);
    const run = await s.rightClick('Copy 2 emails for any AI');
    step(`${before.label}: the first right-click after the update shows the bulk items once`, JSON.stringify(run.labels) === JSON.stringify(BULK), run.labels);
    step(`${before.label}: picking one works at once (the new copy's item, not the old copy's)`, COPIED.test(run.toast), run.toast);
    await sleep(500);
    const tb = await s.evalIn(`[...document.querySelectorAll('.vpa-tb')].map((b) => b.textContent)`);
    step(`${before.label}: one button in Gmail's toolbar after the update (an orphaned copy's goes)`, JSON.stringify(tb) === '["Send 2 to AI"]', tb);
  });
}

fs.writeFileSync(path.join(OUT, 'gmail-tab.json'), JSON.stringify(report, null, 2));
const failed = report.steps.filter((x) => !x.ok).length;
console.log(`\n${report.steps.length - failed}/${report.steps.length} steps passed for ${manifest.name} ${manifest.version} from ${SRC}. Report: ${path.relative(REPO, path.join(OUT, 'gmail-tab.json'))}`);
process.exitCode = failed ? 1 : 0;
