// Loads the extension into headless Chrome next to a Gmail tab that is already open, as it is for
// someone who installs or updates it, and checks what only a real Chrome shows. Two runs, each with a
// new throwaway profile and package folder under tests/.out/package/tmp:
//
//   install  The Gmail tab is open first. The content script arrives without a reload, background.js
//            reads Gmail's session key in the page's main world, Chrome shows the same permission
//            warnings as for 1.1.1, and a bulk copy of two selected rows runs end to end.
//   update   1.1.1 is installed and running in the tab, then the same folder is loaded again with this
//            version, so Chrome treats it as an update. The tab gets the new copy without a reload, the
//            1.1.1 copy is left orphaned, and the menu shows the new items once.
//
// 1.1.1 is rebuilt from tests/content/oracle (its manifest, background.js, content.js and targets.js as
// released) plus the settings page, offscreen document, icons and fonts of the copy under test.
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
function copyV111(to) {
  copyRuntime(SRC, to);
  for (const f of ['manifest.json', 'background.js', 'content.js', 'targets.js']) fs.copyFileSync(path.join(ORACLE, `v1.1.1-${f}`), path.join(to, f));
}
const TMP = path.join(OUT, 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const tempDir = (name) => fs.mkdtempSync(path.join(TMP, `gmail-tab-${name}-`));

// ---- Mock Gmail ----

const TITLE = 'Inbox (3) - tester@example.com - Test Mail';
const IK = 'a1b2c3d4e5';
const GMAIL_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>${TITLE}</title>
<script>window.GLOBALS = [null, 1, 2, 3, 4, 5, 6, 7, 8, '${IK}'];</script></head><body>
<table><tbody>
<tr class="zA" id="r1"><td><div role="checkbox" aria-checked="true"></div></td><td><span class="bog"><span class="bqe" data-legacy-thread-id="19a0b1c2d3e4f501">Re: Pallet order for Fernhill</span></span><span class="y2"><span>&nbsp;-&nbsp;</span>Could we get a mixed pallet</span></td></tr>
<tr class="zA" id="r2"><td><div role="checkbox" aria-checked="true"></div></td><td><span class="bog"><span class="bqe" data-legacy-thread-id="19a0b1c2d3e4f502">Invoice 4471</span></span><span class="y2"><span>&nbsp;-&nbsp;</span>Please find attached</span></td></tr>
<tr class="zA" id="r3"><td><div role="checkbox" aria-checked="false"></div></td><td><span class="bog"><span class="bqe" data-legacy-thread-id="19a0b1c2d3e4f503">Unselected row</span></span></td></tr>
</tbody></table>
<div class="J-M" role="menu" style="display:none; position:fixed; top:10px; left:10px"><div class="J-N" role="menuitem"><div class="J-N-Jz">Reply</div></div></div>
<script>
  const menu = document.querySelector('.J-M');
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('tr.zA')) return; e.preventDefault(); setTimeout(() => (menu.style.display = 'block'), 20); });
  document.body.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.style.display = 'none'; });
</script></body></html>`;
const printView = (th) =>
  '<html><head><title>Gmail - x</title><style>b{}</style></head><body><table><tr><td><b>Tester &lt;tester@example.com&gt;</b></td></tr></table><hr>' +
  `<div>Thread ${th}: Hello &amp; welcome.<br>Second line.</div></body></html>`;

const SINGLE = ['Open in Claude Code', 'Open in Codex', 'Ask Claude', 'Copy thread for any AI'];
const BULK = ['Open 2 in Claude Code', 'Open 2 in Codex (GPT)', 'Ask Claude about 2 emails', 'Copy 2 emails for any AI'];
const TARGETS_SET = ['claude-code', 'codex', 'claude', 'copy'];
// The copy goes through the offscreen document; a headless Chrome may refuse the clipboard, which still
// shows the hand-off reached background.js.
const COPIED = /^Copied 2 emails\. Paste them into any AI with (Cmd|Ctrl)\+V\.$|^Could not copy the emails/;

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
    let toast = '';
    for (let i = 0; i < 60 && !/^(Copied|Could not|The extension)/.test(toast); i++) {
      await sleep(100);
      toast = await s.evalIn(`document.getElementById('vpa-toast')?.textContent || ''`);
    }
    return { labels, toast };
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
});

// ---- update: 1.1.1 runs in the tab, then this version replaces it ----

await withChrome('update', async (s) => {
  const pkg = tempDir('update');
  copyV111(pkg);
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
});

fs.writeFileSync(path.join(OUT, 'gmail-tab.json'), JSON.stringify(report, null, 2));
const failed = report.steps.filter((x) => !x.ok).length;
console.log(`\n${report.steps.length - failed}/${report.steps.length} steps passed for ${manifest.name} ${manifest.version} from ${SRC}. Report: ${path.relative(REPO, path.join(OUT, 'gmail-tab.json'))}`);
process.exitCode = failed ? 1 : 0;
