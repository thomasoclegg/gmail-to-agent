// Shared helpers for the browser suites: where the repository is, where test
// output goes, which Chrome to run and which paste key the extension should
// show on this machine.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_ROOT = path.join(REPO, 'tests', '.out');

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PATH_NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function onPath(name) {
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const file = path.join(dir, name + ext);
      if (isExecutable(file)) return file;
    }
  }
  return null;
}

// CHROME (a path or a command on PATH), then the macOS app, then the usual
// Linux names on PATH. Throws with a clear message when none is found.
export function findChrome() {
  const fromEnv = process.env.CHROME;
  if (fromEnv) {
    const found = fromEnv.includes('/') || fromEnv.includes('\\') ? (isExecutable(fromEnv) ? fromEnv : null) : onPath(fromEnv);
    if (!found) throw new Error(`CHROME is set to "${fromEnv}", but no executable Chrome was found there.`);
    return found;
  }
  if (isExecutable(MAC_CHROME)) return MAC_CHROME;
  for (const name of PATH_NAMES) {
    const found = onPath(name);
    if (found) return found;
  }
  throw new Error(`Chrome not found. Set CHROME to the Chrome binary, or install Google Chrome (looked for the macOS app and ${PATH_NAMES.join(', ')} on PATH).`);
}

// Extra Chrome switches from CHROME_FLAGS, separated by spaces. CI passes
// --no-sandbox so Chrome starts on Ubuntu runners, which can restrict the user
// namespaces its sandbox uses.
export const extraChromeFlags = () => (process.env.CHROME_FLAGS || '').split(/\s+/).filter(Boolean);

// targets.js picks the paste key from the browser's platform: Cmd+V on a Mac,
// Ctrl+V elsewhere. Headless Chrome reports the platform it runs on, so the
// expected key follows the operating system running the tests.
export const PASTE_KEY = process.platform === 'darwin' ? 'Cmd+V' : 'Ctrl+V';
export const OS_LABEL = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' }[process.platform] || process.platform;
