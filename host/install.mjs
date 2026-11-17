#!/usr/bin/env node
// Registers com.openinaiagent.host for Chrome, Chromium, Brave, Edge, Arc and Vivaldi on macOS, Windows or Linux.
// Usage: node host/install.mjs [--extension-id <32-char-id>]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOST_NAME = 'com.openinaiagent.host';
const STORE_EXT_ID = 'edkjbbalbddogimodiepllbkpglcihjk';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOST_SCRIPT = path.join(HERE, 'open-in-ai-agent-host.mjs');
const IS_WIN = process.platform === 'win32';
const WRAPPER = path.join(HERE, IS_WIN ? 'run-host.cmd' : 'run-host.sh');
const shQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

const args = process.argv.slice(2);
const extraIds = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--extension-id' && args[i + 1]) extraIds.push(args[++i]);
}

function browserRoots() {
  const home = os.homedir();
  if (IS_WIN) {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [
      path.join(local, 'Google', 'Chrome', 'User Data'),
      path.join(local, 'Microsoft', 'Edge', 'User Data'),
      path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data'),
      path.join(local, 'Chromium', 'User Data'),
      path.join(local, 'Vivaldi', 'User Data'),
    ];
  }
  if (process.platform === 'darwin') {
    return [
      path.join(home, 'Library/Application Support/Google/Chrome'),
      path.join(home, 'Library/Application Support/Chromium'),
      path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser'),
      path.join(home, 'Library/Application Support/Microsoft Edge'),
      path.join(home, 'Library/Application Support/Arc/User Data'),
      path.join(home, 'Library/Application Support/Vivaldi'),
    ];
  }
  return [
    path.join(home, '.config/google-chrome'),
    path.join(home, '.config/chromium'),
    path.join(home, '.config/BraveSoftware/Brave-Browser'),
    path.join(home, '.config/microsoft-edge'),
  ];
}

function discoverInstalledIds() {
  const found = [];
  for (const root of browserRoots()) {
    if (!fs.existsSync(root)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      for (const fname of ['Secure Preferences', 'Preferences']) {
        const p = path.join(root, ent.name, fname);
        if (!fs.existsSync(p)) continue;
        try {
          const raw = fs.readFileSync(p, 'utf8');
          if (!/Open in AI Agent|openinaiagent\.com|open-in-ai-agent|gmail-to-agent/i.test(raw)) continue;
          const settings = JSON.parse(raw)?.extensions?.settings || {};
          for (const [eid, info] of Object.entries(settings)) {
            const m = info?.manifest || {};
            const label = `${info?.path || ''} ${m.name || ''} ${m.short_name || ''} ${m.homepage_url || ''}`;
            if (/Open in AI Agent|openinaiagent\.com|open-in-ai-agent|gmail-to-agent/i.test(label)) found.push(eid);
          }
        } catch {}
      }
    }
  }
  return found;
}

const ids = [...new Set([STORE_EXT_ID, ...discoverInstalledIds(), ...extraIds])].filter((id) => /^[a-p]{32}$/.test(id));

if (IS_WIN) {
  if (/[%"\r\n]/.test(process.execPath) || /[%"\r\n]/.test(HOST_SCRIPT)) {
    console.error('Install path must not contain quotes or % signs on Windows.');
    process.exit(1);
  }
  fs.writeFileSync(WRAPPER, `@echo off\r\n"${process.execPath}" "${HOST_SCRIPT}" %*\r\n`, 'utf8');
} else {
  fs.chmodSync(HOST_SCRIPT, 0o755);
  fs.writeFileSync(WRAPPER, `#!/bin/sh\nexec ${shQuote(process.execPath)} ${shQuote(HOST_SCRIPT)} "$@"\n`, { mode: 0o755 });
}

const manifest = {
  name: HOST_NAME,
  description: 'Open in AI Agent local companion launcher for Antigravity, Gemini CLI, Claude Code and Codex',
  path: WRAPPER,
  type: 'stdio',
  allowed_origins: ids.map((id) => `chrome-extension://${id}/`),
};

if (IS_WIN) {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const manifestDir = path.join(local, 'OpenInAIAgent');
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestFile = path.join(manifestDir, `${HOST_NAME}.json`);
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\r\n`, 'utf8');
  const regKeys = [
    `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
    `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`,
    `HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\${HOST_NAME}`,
    `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${HOST_NAME}`,
    `HKCU\\Software\\Vivaldi\\NativeMessagingHosts\\${HOST_NAME}`,
  ];
  let written = 0;
  for (const key of regKeys) {
    const r = spawnSync('reg.exe', ['add', key, '/ve', '/t', 'REG_SZ', '/d', manifestFile, '/f'], { encoding: 'utf8' });
    if (r.status === 0) {
      console.log(`Registered ${key}`);
      written++;
    }
  }
  console.log(written ? `Done (${written} Windows browser registry keys -> ${manifestFile}).` : 'Could not write Windows registry keys.');
  process.exit(written ? 0 : 1);
}

const home = os.homedir();
const dirs =
  process.platform === 'darwin'
    ? [
        path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),
        path.join(home, 'Library/Application Support/Chromium/NativeMessagingHosts'),
        path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts'),
        path.join(home, 'Library/Application Support/Microsoft Edge/NativeMessagingHosts'),
        path.join(home, 'Library/Application Support/Arc/User Data/NativeMessagingHosts'),
        path.join(home, 'Library/Application Support/Vivaldi/NativeMessagingHosts'),
      ]
    : [
        path.join(home, '.config/google-chrome/NativeMessagingHosts'),
        path.join(home, '.config/chromium/NativeMessagingHosts'),
        path.join(home, '.config/BraveSoftware/Brave-Browser/NativeMessagingHosts'),
        path.join(home, '.config/microsoft-edge/NativeMessagingHosts'),
      ];

let written = 0;
for (const dir of dirs) {
  const parent = path.dirname(dir);
  if (!fs.existsSync(parent)) continue;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${HOST_NAME}.json`);
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Registered ${file}`);
  written++;
}
console.log(written ? `Done (${written} browser profile folder${written === 1 ? '' : 's'}).` : 'No supported Chromium profile folder found yet.');
