#!/usr/bin/env node
// Optional local Native Messaging companion host for Open in AI Agent (v1.6.4).
// Zero external dependencies. Receives one JSON message on stdin (32-bit LE length prefix),
// checks installed desktop/CLI agents or spawns requested agent sessions, and replies on stdout.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const VERSION = '1.6.4';
const HOME = os.homedir();

function nvmBinDirs() {
  try {
    const base = path.join(HOME, '.nvm', 'versions', 'node');
    if (!fs.existsSync(base)) return [];
    return fs
      .readdirSync(base)
      .sort()
      .reverse()
      .map((v) => path.join(base, v, 'bin'));
  } catch {
    return [];
  }
}

const EXTRA_PATHS = [
  path.join(HOME, '.local', 'bin'),
  path.join(HOME, '.claude', 'local'),
  path.join(HOME, '.npm-global', 'bin'),
  path.join(HOME, '.volta', 'bin'),
  path.join(HOME, '.asdf', 'shims'),
  path.join(HOME, '.local', 'share', 'fnm', 'aliases', 'default', 'bin'),
  ...nvmBinDirs(),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/Applications/Gemini.app/Contents/Helpers',
];

const shellCache = new Map();

function findBinary(names, allowShell = true) {
  const dirs = [...EXTRA_PATHS, ...(process.env.PATH || '').split(path.delimiter)].filter(Boolean);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const name of names) {
    if (path.isAbsolute(name) && fs.existsSync(name)) return name;
    for (const dir of dirs) {
      for (const ext of exts) {
        const candidate = path.join(dir, name + ext);
        try {
          if (fs.statSync(candidate).isFile()) return candidate;
        } catch {
          // Keep looking.
        }
      }
    }
    if (allowShell && process.platform !== 'win32' && /^[a-z0-9_-]+$/i.test(name)) {
      if (shellCache.has(name)) {
        const hit = shellCache.get(name);
        if (hit) return hit;
        continue;
      }
      const shell = process.env.SHELL && fs.existsSync(process.env.SHELL) ? process.env.SHELL : '/bin/sh';
      const r = spawnSync(shell, ['-lc', `command -v ${name}`], { encoding: 'utf8', timeout: 1500 });
      const resolved = (r.stdout || '').trim().split('\n').pop()?.trim();
      const valid = r.status === 0 && resolved && path.isAbsolute(resolved) && fs.existsSync(resolved) ? resolved : null;
      shellCache.set(name, valid);
      if (valid) return valid;
    }
  }
  return null;
}

function hasAgyCliSession() {
  try {
    const cliDir = path.join(HOME, '.gemini', 'antigravity-cli');
    if (fs.existsSync(path.join(cliDir, 'oauth_creds.json'))) return true;
    const convs = path.join(cliDir, 'conversations');
    return fs.existsSync(convs) && fs.readdirSync(convs).length > 0;
  } catch {
    return false;
  }
}

function detectAgents() {
  const agy = findBinary(['agy']);
  const geminiApp = process.platform === 'darwin' && fs.existsSync('/Applications/Gemini.app') ? '/Applications/Gemini.app' : null;
  return {
    antigravity: geminiApp && !hasAgyCliSession() ? geminiApp : agy || geminiApp,
    'gemini-cli': findBinary(['gemini']),
    'claude-code': findBinary(['claude']),
    codex: findBinary(['codex']),
  };
}

const shQuote = (s) => `'${String(s ?? '').replace(/'/g, `'\\''`)}'`;

// Expands ~/ and verifies an explicit folder is an existing directory; otherwise creates an isolated empty workspace
// in os.tmpdir() rather than exposing $HOME to --add-dir or cwd.
function resolveWorkingFolder(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return { ok: true, folder: fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-ai-agent-work-')), explicit: false };
  }
  const expanded = trimmed === '~' ? HOME : trimmed.startsWith('~/') ? path.join(HOME, trimmed.slice(2)) : trimmed;
  if (!path.isAbsolute(expanded)) {
    return { ok: false, error: 'Working folder in Settings must be an absolute path (for example ~/Projects/app).' };
  }
  try {
    if (fs.statSync(expanded).isDirectory()) return { ok: true, folder: expanded, explicit: true };
  } catch {}
  return { ok: false, error: `Working folder not found: ${expanded}` };
}

// Writes prompt to a mode-0600 temp file so terminal commands never hit shell argv length limits or quote injection.
function writePromptFile(prompt, index) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-ai-agent-'));
  const file = path.join(dir, `prompt-${index + 1}.txt`);
  const safeText = String(prompt ?? '').startsWith('-') ? `\n${prompt}` : String(prompt ?? '');
  fs.writeFileSync(file, safeText, { encoding: 'utf8', mode: 0o600 });
  return { dir, file };
}

function buildShellCommand(agent, bin, folder, session, index) {
  const { dir, file } = writePromptFile(session.prompt, index);
  const title = String(session.subject || agent).replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 80);
  const setTitle = `printf '\\033]0;%s\\007' ${shQuote(title)}`;
  const cd = `cd ${shQuote(folder)}`;
  const cleanup = `rm -rf ${shQuote(dir)}`;
  if (agent === 'antigravity') {
    return {
      dir,
      cmd: `${setTitle}; ${cd} && PROMPT="$(cat ${shQuote(file)})"; ${cleanup}; exec ${shQuote(bin)} --add-dir ${shQuote(folder)} -i "$PROMPT"`,
    };
  }
  if (agent === 'gemini-cli') {
    return {
      dir,
      cmd: `${setTitle}; ${cd} && PROMPT="$(cat ${shQuote(file)})"; ${cleanup}; exec ${shQuote(bin)} -i "$PROMPT"`,
    };
  }
  if (agent === 'claude-code') {
    const nameArg = title ? ` -n ${shQuote(title)}` : '';
    return {
      dir,
      cmd: `${setTitle}; ${cd} && PROMPT="$(cat ${shQuote(file)})"; ${cleanup}; exec ${shQuote(bin)}${nameArg} -- "$PROMPT"`,
    };
  }
  if (agent === 'codex') {
    return {
      dir,
      cmd: `${setTitle}; ${cd} && PROMPT="$(cat ${shQuote(file)})"; ${cleanup}; exec ${shQuote(bin)} -- "$PROMPT"`,
    };
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return null;
}

const asQuote = (s) => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function openInTerminal(posixCommand) {
  if (!posixCommand) return false;
  // Wrap in /bin/sh -c so login shells such as fish or tcsh still execute strict POSIX syntax cleanly.
  const wrapped = `/bin/sh -c ${shQuote(posixCommand)}`;
  if (process.platform === 'darwin') {
    const script = `tell application "Terminal"\n  activate\n  do script ${asQuote(wrapped)}\nend tell`;
    // 30 s timeout allows macOS's first-run "Chrome wants access to control Terminal" Automation dialog.
    const r = spawnSync('/usr/bin/osascript', ['-e', script], { stdio: 'ignore', timeout: 30000 });
    return r.status === 0;
  }
  if (process.platform === 'linux') {
    for (const [term, args] of [
      ['x-terminal-emulator', ['-e', '/bin/sh', '-c', posixCommand]],
      ['gnome-terminal', ['--', '/bin/sh', '-c', posixCommand]],
      ['konsole', ['-e', '/bin/sh', '-c', posixCommand]],
      ['xterm', ['-e', '/bin/sh', '-c', posixCommand]],
    ]) {
      if (findBinary([term], false)) {
        spawn(term, args, { detached: true, stdio: 'ignore' }).unref();
        return true;
      }
    }
    return false;
  }
  return false;
}

function handleMessage(msg) {
  if (process.platform === 'win32') {
    return { ok: false, error: 'The companion helper currently supports macOS and Linux only.' };
  }
  const agents = detectAgents();
  if (msg?.action === 'ping') {
    return { ok: true, version: VERSION, platform: process.platform, agents };
  }
  if (msg?.action === 'launch') {
    const agent = String(msg.agent || '');
    const bin = agents[agent];
    if (!bin) return { ok: false, error: `${agent} was not found on this computer.` };
    const sessions = Array.isArray(msg.sessions) ? msg.sessions.slice(0, 25) : [];
    if (!sessions.length) return { ok: false, error: 'No session prompt received.' };
    if (agent === 'antigravity' && bin.endsWith('.app')) {
      const cleanFolder = typeof msg.folder === 'string' ? msg.folder.replace(/[\x00-\x1f\x7f]/g, ' ').trim() : '';
      const folderLine = cleanFolder ? `Working folder: ${cleanFolder}\n\n` : '';
      const combined = sessions.map((s) => `${folderLine}${String(s?.prompt || '')}`).join('\n\n---\n\n');
      spawnSync('/usr/bin/pbcopy', [], { input: Buffer.from(combined, 'utf8'), timeout: 4000 });
      const opened = spawnSync('/usr/bin/open', ['googlegemini://newchat'], { stdio: 'ignore', timeout: 4000 });
      if (opened.status !== 0) spawnSync('/usr/bin/open', ['-a', bin], { stdio: 'ignore', timeout: 4000 });
      return { ok: true, mode: 'paste', launched: 1, binary: bin };
    }
    const resolved = resolveWorkingFolder(msg.folder);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    let launched = 0;
    for (const [i, s] of sessions.entries()) {
      const built = buildShellCommand(agent, bin, resolved.folder, s, i);
      if (!built) continue;
      if (openInTerminal(built.cmd)) {
        launched++;
      } else {
        fs.rmSync(built.dir, { recursive: true, force: true });
      }
    }
    if (!launched && !resolved.explicit) {
      fs.rmSync(resolved.folder, { recursive: true, force: true });
    }
    return launched ? { ok: true, launched, binary: bin } : { ok: false, error: 'Could not launch a terminal window.' };
  }
  return { ok: false, error: 'Unknown action.' };
}

function sendReplyAndExit(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]), () => process.exit(0));
}

let handled = false;
let input = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  if (handled) return;
  input = Buffer.concat([input, chunk]);
  if (input.length < 4) return;
  const len = input.readUInt32LE(0);
  if (len > 2 * 1024 * 1024) {
    handled = true;
    sendReplyAndExit({ ok: false, error: 'Message too large.' });
    return;
  }
  if (input.length < 4 + len) return;
  handled = true;
  const raw = input.subarray(4, 4 + len).toString('utf8');
  try {
    sendReplyAndExit(handleMessage(JSON.parse(raw)));
  } catch (e) {
    sendReplyAndExit({ ok: false, error: e?.message || 'Invalid JSON.' });
  }
});
