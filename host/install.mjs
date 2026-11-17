#!/usr/bin/env node
// Registers com.openinaiagent.host for Chrome, Chromium, Brave, Edge, Arc and Vivaldi on macOS or Linux.
// Usage: node host/install.mjs [--extension-id <32-char-id>]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST_NAME = 'com.openinaiagent.host';
const STORE_EXT_ID = 'edkjbbalbddogimodiepllbkpglcihjk';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOST_SCRIPT = path.join(HERE, 'open-in-ai-agent-host.mjs');
const WRAPPER = path.join(HERE, 'run-host.sh');

const args = process.argv.slice(2);
const extraIds = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--extension-id' && args[i + 1]) extraIds.push(args[++i]);
}

function discoverUnpackedIds() {
  const found = [];
  const home = os.homedir();
  const roots =
    process.platform === 'darwin'
      ? [
          path.join(home, 'Library/Application Support/Google/Chrome'),
          path.join(home, 'Library/Application Support/Chromium'),
          path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser'),
          path.join(home, 'Library/Application Support/Microsoft Edge'),
          path.join(home, 'Library/Application Support/Arc/User Data'),
          path.join(home, 'Library/Application Support/Vivaldi'),
        ]
      : [
          path.join(home, '.config/google-chrome'),
          path.join(home, '.config/chromium'),
          path.join(home, '.config/BraveSoftware/Brave-Browser'),
          path.join(home, '.config/microsoft-edge'),
        ];
  for (const root of roots) {
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
          if (!raw.includes('Open in AI Agent') && !raw.includes('open-in-ai-agent') && !raw.includes('gmail-to-agent')) continue;
          const settings = JSON.parse(raw)?.extensions?.settings || {};
          for (const [eid, info] of Object.entries(settings)) {
            const label = `${info?.path || ''} ${info?.manifest?.name || ''}`;
            if (/Open in AI Agent|open-in-ai-agent|gmail-to-agent/i.test(label)) found.push(eid);
          }
        } catch {}
      }
    }
  }
  return found;
}

const ids = [...new Set([STORE_EXT_ID, ...discoverUnpackedIds(), ...extraIds])].filter((id) => /^[a-p]{32}$/.test(id));

fs.chmodSync(HOST_SCRIPT, 0o755);
fs.writeFileSync(WRAPPER, `#!/bin/sh\nexec "${process.execPath}" "${HOST_SCRIPT}" "$@"\n`, { mode: 0o755 });

const manifest = {
  name: HOST_NAME,
  description: 'Open in AI Agent local companion launcher for Antigravity, Gemini CLI, Claude Code and Codex',
  path: WRAPPER,
  type: 'stdio',
  allowed_origins: ids.map((id) => `chrome-extension://${id}/`),
};

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
