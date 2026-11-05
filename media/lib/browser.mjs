// Headless Chrome for the recorder, driven over a DevTools pipe as tests/package/gmail-tab.mjs does it:
// commands on fd 3, replies on fd 4, each message ending in a NUL. Branded Chrome ignores
// --load-extension, so the extension goes in with Extensions.loadUnpacked.
//
// Nothing leaves the machine:
//   - every host name is unresolvable (--host-resolver-rules), so no page, worker or Chrome service
//     can reach the network;
//   - the stage tab answers https://mail.google.com/* itself (the Fetch domain) and fails everything else;
//   - in the service worker, copyText (the clipboard) and chrome.tabs.create (the new AI tab) are
//     replaced with stand-ins that only record what the extension asked for. No AI site is ever opened.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { findChrome, extraChromeFlags } from '../../tests/lib/chrome.mjs';

export const MEDIA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.dirname(MEDIA);
const STAGE = path.join(MEDIA, 'stage');
const DOCS = path.join(REPO, 'docs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- The extension, as it ships ----

// The runtime files: the manifest, root scripts and pages, icons, fonts and any _locales.
export function copyExtension(to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(REPO, { withFileTypes: true })) {
    if (e.isFile() && (e.name === 'manifest.json' || e.name === 'LICENSE' || /\.(js|html)$/.test(e.name))) fs.copyFileSync(path.join(REPO, e.name), path.join(to, e.name));
    if (e.isDirectory() && ['icons', 'fonts', '_locales'].includes(e.name)) fs.cpSync(path.join(REPO, e.name), path.join(to, e.name), { recursive: true });
  }
  return JSON.parse(fs.readFileSync(path.join(to, 'manifest.json'), 'utf8'));
}

// ---- The made-up mailbox (stage/data.js) and Gmail's print view of a thread ----

export function stageData() {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(STAGE, 'data.js'), 'utf8'), ctx, { filename: 'data.js' });
  return ctx.STAGE_DATA;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const printDate = (d) => d.replace(/^(\w+), (.*), (\d\d:\d\d)$/, '$1, $2 at $3');

// Shaped like Gmail's print view: a page header, then one table.message per message.
export function printView(data, id) {
  const th = data.THREADS.find((t) => t.id === id);
  if (!th) return null;
  const n = th.messages.length;
  const head =
    `<table width="100%"><tr><td>Gmail</td><td align="right"><b>${esc(data.ME.name)} &lt;${esc(data.ME.email)}&gt;</b></td></tr></table><hr>` +
    `<div class="maincontent"><table width="100%"><tr><td><font size="+1"><b>${esc(th.subject)}</b></font><br><font size="-1" color="#777">${n} ${n === 1 ? 'message' : 'messages'}</font></td></tr></table><hr>`;
  const msgs = th.messages
    .map(
      (m) =>
        `<table width="100%" class="message"><tr><td><font size="-1"><b>${esc(m.name)} </b>&lt;${esc(m.email)}&gt;</font></td><td align="right"><font size="-1">${esc(printDate(m.date))}</font></td></tr>` +
        `<tr><td colspan="2"><font size="-1" class="recipient"><div>To: ${esc(m.to)}</div></font></td></tr>` +
        `<tr><td colspan="2"><table width="100%" cellpadding="12" cellspacing="0" border="0"><tr><td><div style="overflow: hidden;"><font size="-1">${esc(m.body).replace(/\n/g, '<br>')}</font></div></td></tr></table></td></tr></table><hr>`,
    )
    .join('');
  return `<html><head><title>Gmail - ${esc(th.subject)}</title><style>body{font-family:arial}</style></head><body>${head}${msgs}</div></body></html>`;
}

// ---- Chrome ----

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

// The recordings are in British English, so the browser is too: the prompts the extension copies name
// the browser's language ("Write the summary in British English"). With these switches, navigator.language
// reads en-GB in the tabs and in the service worker (checked on a Mac, where the system is en-US).
const LANG = ['--lang=en-GB', '--accept-lang=en-GB,en'];

export async function startChrome({ profile, log = () => {} }) {
  fs.mkdirSync(profile, { recursive: true });
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-sync',
      '--disable-component-update', '--disable-default-apps', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--hide-scrollbars', '--force-color-profile=srgb', '--mute-audio',
      `--user-data-dir=${profile}`, ...LANG, '--host-resolver-rules=MAP * ~NOTFOUND', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
      ...extraChromeFlags(), 'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] },
  );
  let stderr = '';
  chrome.stdio[2].on('data', (d) => (stderr = (stderr + d).slice(-4000)));
  chrome.stdio[3].on('error', () => {});
  const exited = new Promise((resolve) => chrome.once('exit', resolve));

  let seq = 0;
  let inbox = '';
  const pending = new Map();
  const listeners = new Set();
  const failAll = (e) => {
    for (const p of pending.values()) p.reject(e);
    pending.clear();
  };
  chrome.on('error', (e) => failAll(new Error(`could not start Chrome: ${e.message}`)));
  exited.then((code) => failAll(new Error(`Chrome exited (${code}). Its last output:\n${stderr.trim()}`)));
  chrome.stdio[4].on('data', (d) => {
    inbox += d;
    for (let end; (end = inbox.indexOf('\0')) >= 0; inbox = inbox.slice(end + 1)) {
      const msg = JSON.parse(inbox.slice(0, end));
      const p = msg.id && pending.get(msg.id);
      if (!p) {
        for (const fn of listeners) fn(msg);
        continue;
      }
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
    }
  });

  const b = {
    blocked: [],
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { method, resolve, reject });
        chrome.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })}\0`);
      }),
    on: (fn) => listeners.add(fn),
    async close() {
      chrome.kill('SIGKILL');
      await Promise.race([exited, sleep(5000)]);
    },
    async eval(sessionId, expression, contextId) {
      const r = await b.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, ...(contextId && { contextId }) }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    attach: async (targetId) => (await b.send('Target.attachToTarget', { targetId, flatten: true })).sessionId,
  };
  b.version = (await b.send('Browser.getVersion')).product;
  log(`Chrome: ${b.version}`);
  return b;
}

// ---- The extension in Chrome ----

export async function loadExtension(b, dir, { targets, log = () => {} }) {
  const { id } = await b.send('Extensions.loadUnpacked', { path: dir });
  const swUrl = `chrome-extension://${id}/background.js`;
  let sw = null;
  for (let i = 0; i < 80 && !sw; i++) {
    const { targetInfos } = await b.send('Target.getTargets');
    const t = targetInfos.find((x) => x.type === 'service_worker' && x.url === swUrl);
    if (t) sw = await b.attach(t.targetId);
    else await sleep(100);
  }
  if (!sw) throw new Error('the extension service worker did not start');
  await sleep(800);
  // The install opens the settings page in a tab; the recorder opens its own.
  const { targetInfos } = await b.send('Target.getTargets');
  for (const t of targetInfos) if (t.type === 'page' && t.url.startsWith(`chrome-extension://${id}/`)) await b.send('Target.closeTarget', { targetId: t.targetId });

  // Stand-ins: record the copy and the new tab instead of making them.
  await b.eval(
    sw,
    `(() => {
      globalThis.__copies = [];
      globalThis.__opened = [];
      copyText = async (text) => { __copies.push(String(text)); };
      chrome.tabs.create = async (props) => { __opened.push(props.url); return { id: -1, index: 0, windowId: -1 }; };
      return true;
    })()`,
  );
  await b.eval(sw, `chrome.storage.sync.set({ targets: ${JSON.stringify(targets)} })`);
  await sleep(300);
  log(`extension ${id} loaded, targets: ${targets.join(', ')}`);
  return { id, sw };
}

// ---- A tab ----

// The UA platform decides the paste key the extension shows: Ctrl+V on Windows, Cmd+V on a Mac.
function userAgent(version, platform) {
  const v = version.split('/')[1] || '156.0.0.0';
  const major = v.split('.')[0];
  const brands = [{ brand: 'Google Chrome', version: major }, { brand: 'Chromium', version: major }, { brand: 'Not.A/Brand', version: '99' }];
  return platform === 'mac'
    ? { userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`, platform: 'MacIntel',
        userAgentMetadata: { platform: 'macOS', platformVersion: '15.0.0', architecture: 'arm', model: '', mobile: false, brands } }
    : { userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`, platform: 'Win32',
        userAgentMetadata: { platform: 'Windows', platformVersion: '15.0.0', architecture: 'x86', model: '', mobile: false, brands } };
}

export async function openTab(b, { width, height, dsf, platform }) {
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
  const session = await b.attach(targetId);
  const tab = { targetId, session, contexts: [], exceptions: [], console: [] };
  b.on((m) => {
    if (m.sessionId !== session) return;
    if (m.method === 'Runtime.executionContextCreated') tab.contexts.push(m.params.context);
    if (m.method === 'Runtime.exceptionThrown') tab.exceptions.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) tab.console.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await b.send('Runtime.enable', {}, session);
  await b.send('Page.enable', {}, session);
  await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dsf, mobile: false }, session);
  await b.send('Emulation.setUserAgentOverride', userAgent(b.version, platform), session);
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] }, session);
  await b.send('Emulation.setFocusEmulationEnabled', { enabled: true }, session);
  return tab;
}

// Serves the stage and the print views at https://mail.google.com/ in this tab; fails every other request.
export async function serveStage(b, tab, data) {
  tab.held = [];
  const files = (p) => {
    if (p.startsWith('/__stage/fonts/')) return path.join(REPO, 'fonts', path.basename(p));
    if (p === '/__stage/icon32.png') return path.join(REPO, 'icons', 'icon32.png');
    if (p.startsWith('/__stage/')) return path.join(STAGE, path.basename(p));
    return path.join(STAGE, 'index.html');
  };
  b.on((m) => {
    if (m.sessionId !== tab.session || m.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = m.params;
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || url.hostname !== 'mail.google.com') {
      b.blocked.push(request.url);
      return b.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, tab.session).catch(() => {});
    }
    let body;
    let type = 'text/html; charset=utf-8';
    let held = false;
    let code = 200;
    if (url.pathname.startsWith('/__docs/')) {
      // The project's website (docs/), for the install video's page. Its videos are not served, so they
      // keep their posters and never play on the wall clock.
      const file = path.join(DOCS, path.normalize(decodeURIComponent(url.pathname.slice('/__docs/'.length))).replace(/^(\.\.[/\\])+/, ''));
      const ok = file.startsWith(DOCS + path.sep) && !/\.(webm|mp4)$/.test(file) && fs.existsSync(file) && fs.statSync(file).isFile();
      body = ok ? fs.readFileSync(file) : 'Not found';
      type = ok ? TYPES[path.extname(file)] || 'application/octet-stream' : 'text/plain';
      code = ok ? 200 : 404;
    } else if (url.searchParams.get('view') === 'pt') {
      body = printView(data, url.searchParams.get('th')) ?? '<html><body>Not found</body></html>';
      tab.printViews = (tab.printViews || 0) + 1;
      held = true; // answered on the video's clock (Director.frame), as a real mailbox takes a moment
    } else {
      const file = files(url.pathname);
      body = fs.readFileSync(file);
      type = TYPES[path.extname(file)] || 'application/octet-stream';
    }
    const fulfil = () =>
      b.send(
        'Fetch.fulfillRequest',
        { requestId, responseCode: code, responseHeaders: [{ name: 'Content-Type', value: type }, { name: 'Cache-Control', value: 'no-store' }], body: Buffer.from(body).toString('base64') },
        tab.session,
      ).catch(() => {});
    if (held) tab.held.push({ fulfil, n: tab.printViews });
    else fulfil();
  });
  await b.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, tab.session);
}

// The content script's own clock. Its timers (the menu's retry loop, waiting for Gmail to open the
// thread, how long the note stays) run on the recording's time instead of the wall clock, so every
// render matches. Runs in the extension's isolated world in the stage tab, where content.js lives.
// Desktop agents open through a claude:// or codex:// link: the link is kept, not followed.
export const CONTENT_CLOCK = `(() => {
  if (globalThis.__clock) return 'already';
  const realTimeout = globalThis.setTimeout;
  const base = Date.now();
  let now = 0;
  let seq = 1;
  const timers = new Map();
  globalThis.setTimeout = (fn, ms = 0, ...args) => {
    const id = seq++;
    timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, args });
    return id;
  };
  globalThis.clearTimeout = (id) => void timers.delete(id);
  Date.now = () => base + now;
  const nextTask = () => new Promise((r) => realTimeout(r, 0));
  globalThis.__launched = [];
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (/^(claude|codex):/i.test(this.href)) return void __launched.push(this.href);
    return click.call(this);
  };
  globalThis.__clock = {
    async to(t) {
      for (let guard = 0; guard < 5000; guard++) {
        let next = null;
        for (const [id, x] of timers) if (x.at <= t && (!next || x.at < next.x.at)) next = { id, x };
        if (!next) break;
        timers.delete(next.id);
        now = Math.max(now, next.x.at);
        try {
          if (typeof next.x.fn === 'function') next.x.fn(...next.x.args);
        } catch (e) {
          console.error(e);
        }
        await nextTask();
      }
      now = Math.max(now, t);
      await nextTask();
      return timers.size;
    },
  };
  return 'ok';
})()`;
