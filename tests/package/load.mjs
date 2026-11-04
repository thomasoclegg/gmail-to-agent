// Loads an unpacked copy of the extension (for example the unzipped release) into headless Chrome
// and checks that it starts: Chrome accepts the manifest, the background service worker registers,
// and the settings page renders its tiles with no script errors and no font that failed to load.
// Branded Chrome ignores --load-extension, so this uses the DevTools Extensions.loadUnpacked command
// over --remote-debugging-pipe (commands on fd 3, replies on fd 4, each message ending in a NUL).
//
//   node tests/package/load.mjs DIR

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { OUT_ROOT, findChrome, extraChromeFlags } from '../lib/chrome.mjs';

const WAIT_MS = 5000;
const dir = process.argv[2] ? path.resolve(process.argv[2]) : '';
if (!dir || !fs.existsSync(path.join(dir, 'manifest.json'))) {
  console.error(`Usage: node tests/package/load.mjs DIR, where DIR holds an unpacked extension (got "${process.argv[2] || ''}").`);
  process.exit(2);
}
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
} catch (e) {
  console.error(`FAIL  manifest.json: ${e.message}`);
  process.exit(1);
}
const workerFile = manifest.background?.service_worker;
const optionsFile = manifest.options_ui?.page || manifest.options_page;
const profile = path.join(OUT_ROOT, 'package', 'chrome-profile');
fs.mkdirSync(profile, { recursive: true });

const chrome = spawn(findChrome(), [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--disable-sync', '--disable-component-update', `--user-data-dir=${profile}`,
  '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', ...extraChromeFlags(), 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });

let stderr = '';
chrome.stdio[2].on('data', (d) => (stderr = (stderr + d).slice(-4000)));
function finish(code, message) {
  console[code ? 'error' : 'log'](message);
  if (code && stderr.trim()) console.error(`Chrome's last output:\n${stderr.trim()}`);
  chrome.kill('SIGKILL');
  process.exit(code);
}
chrome.on('error', (e) => finish(1, `FAIL  could not start Chrome: ${e.message}`));
chrome.on('exit', (code, signal) => finish(1, `FAIL  Chrome exited early (${code ?? signal}).`));
setTimeout(() => finish(1, 'FAIL  no result within 30 s.'), 30000).unref();

let seq = 0;
let inbox = '';
const pending = new Map();
const exceptions = [];
chrome.stdio[4].on('data', (d) => {
  inbox += d;
  for (let end; (end = inbox.indexOf('\0')) >= 0; inbox = inbox.slice(end + 1)) {
    const msg = JSON.parse(inbox.slice(0, end));
    if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    const p = pending.get(msg.id);
    if (!p) continue;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
    else p.resolve(msg.result);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { method, resolve, reject });
    chrome.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })}\0`);
  });
async function waitFor(what, probe) {
  for (const end = Date.now() + WAIT_MS; ; await new Promise((r) => setTimeout(r, 100))) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > end) throw new Error(`${what} within ${WAIT_MS / 1000} s`);
  }
}

try {
  const { id } = await send('Extensions.loadUnpacked', { path: dir });
  const base = `chrome-extension://${id}/`;
  await waitFor(`no service worker for ${workerFile}`, async () =>
    (await send('Target.getTargets')).targetInfos.some((t) => t.type === 'service_worker' && t.url === base + workerFile));

  // Open the settings page in a tab of its own, listening for exceptions before it loads.
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Page.navigate', { url: base + optionsFile }, sessionId);
  const page = await waitFor(`${optionsFile} rendered no tiles`, async () => {
    const r = await send('Runtime.evaluate', {
      expression: `document.fonts.ready.then(() => ({ tiles: document.querySelectorAll('#tiles .tile').length,
        loaded: [...document.fonts].filter((f) => f.status === 'loaded').length, failed: [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family + ' ' + f.weight) }))`,
      awaitPromise: true, returnByValue: true,
    }, sessionId);
    return r.result?.value?.tiles ? r.result.value : null;
  });
  if (page.failed.length || !page.loaded) throw new Error(`${optionsFile} fonts: ${page.loaded} loaded, failed: ${page.failed.join(', ') || 'none'}`);
  if (exceptions.length) throw new Error(`${optionsFile} rendered, but with script errors`);
  finish(0, `OK  ${manifest.name} ${manifest.version} loads from ${dir}: ${workerFile} registered as a service worker, ${optionsFile} rendered ${page.tiles} tiles with ${page.loaded} fonts.`);
} catch (e) {
  finish(1, `FAIL  ${e.message}${exceptions.length ? `\n      ${optionsFile} threw: ${exceptions.join(' | ')}` : ''}`);
}
