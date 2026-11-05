// Firefox for tests/package/firefox.mjs: which Firefox to run, and a small WebDriver BiDi client over the
// WebSocket that Firefox opens with --remote-debugging-port. No dependencies: Node 22 has WebSocket built in.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isExecutable, onPath } from './chrome.mjs';

const MAC_FIREFOX = '/Applications/Firefox.app/Contents/MacOS/firefox';
const PATH_NAMES = ['firefox', 'firefox-esr'];

// FIREFOX (a path or a command on PATH), then the macOS app, then firefox or firefox-esr on PATH.
export function findFirefox() {
  const fromEnv = process.env.FIREFOX;
  if (fromEnv) {
    const found = fromEnv.includes('/') || fromEnv.includes('\\') ? (isExecutable(fromEnv) ? fromEnv : null) : onPath(fromEnv);
    if (!found) throw new Error(`FIREFOX is set to "${fromEnv}", but no executable Firefox was found there.`);
    return found;
  }
  if (isExecutable(MAC_FIREFOX)) return MAC_FIREFOX;
  for (const name of PATH_NAMES) {
    const found = onPath(name);
    if (found) return found;
  }
  throw new Error(`Firefox not found. Set FIREFOX to the Firefox binary, or install Firefox (looked for the macOS app and ${PATH_NAMES.join(', ')} on PATH).`);
}

const prefLine = ([k, v]) => `user_pref(${JSON.stringify(k)}, ${JSON.stringify(v)});`;

// Starts headless Firefox on a new profile with the given prefs and opens a BiDi session.
// Resolves with { send, on, close, stderr, version }. send(method, params) resolves with the result or
// rejects with the BiDi error; on(fn) receives every event.
export async function startFirefox({ binary = findFirefox(), profile, prefs = {}, env = {}, timeoutMs = 30000 }) {
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'user.js'), `${Object.entries(prefs).map(prefLine).join('\n')}\n`);
  const ff = spawn(binary, ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', '0', 'about:blank'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  let output = '';
  const exited = new Promise((resolve) => ff.once('exit', (code, signal) => resolve(code ?? signal)));
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Firefox opened no WebDriver BiDi port within ${timeoutMs / 1000} s. Its output:\n${output.slice(-2000)}`)), timeoutMs);
    const read = (d) => {
      output += d;
      const m = output.match(/WebDriver BiDi listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    };
    ff.stdout.on('data', read);
    ff.stderr.on('data', read);
    ff.on('error', (e) => reject(new Error(`could not start Firefox: ${e.message}`)));
    exited.then((code) => reject(new Error(`Firefox exited (${code}) before opening its BiDi port. Its output:\n${output.slice(-2000)}`)));
  });

  const ws = new WebSocket(`${url}/session`);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error(`could not connect to ${url}/session`));
  });
  let seq = 0;
  const pending = new Map();
  const listeners = [];
  const failAll = (e) => {
    for (const p of pending.values()) p.reject(e);
    pending.clear();
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    const p = msg.id !== undefined && pending.get(msg.id);
    if (!p) {
      for (const fn of listeners) fn(msg);
      return;
    }
    pending.delete(msg.id);
    if (msg.type === 'error') p.reject(new Error(`${p.method}: ${msg.error}: ${msg.message}`));
    else p.resolve(msg.result);
  };
  ws.onclose = () => failAll(new Error('the BiDi connection closed'));
  exited.then((code) => failAll(new Error(`Firefox exited (${code})`)));

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { method, resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const session = await send('session.new', { capabilities: {} });
  return {
    send,
    on: (fn) => listeners.push(fn),
    stderr: () => output,
    version: session.capabilities.browserVersion,
    async close() {
      try {
        ws.close();
      } catch {
        // Already closed.
      }
      ff.kill('SIGKILL');
      await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    },
  };
}
