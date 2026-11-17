#!/usr/bin/env node
// Optional local Native Messaging companion host for Open in AI Agent (v1.6.0).
// Zero external dependencies. Receives one JSON message on stdin (32-bit LE length prefix),
// checks installed desktop/CLI agents or spawns requested agent sessions, and replies on stdout.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const VERSION = '1.6.3';
const HOME = os.homedir();
const EXTRA_PATHS = [
  path.join(HOME, '.local', 'bin'),
  path.join(HOME, '.npm-global', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/Applications/Gemini.app/Contents/Helpers',
];

function findBinary(names) {
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
const safeFolder = (f) => (typeof f === 'string' && f.trim() && fs.existsSync(f.trim()) ? f.trim() : HOME);

// Writes prompt to a mode-0600 temp file so terminal commands never hit shell argv length limits or quote injection.
function writePromptFile(prompt, index) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-ai-agent-'));
  const file = path.join(dir, `prompt-${index + 1}.txt`);
  fs.writeFileSync(file, String(prompt ?? ''), { encoding: 'utf8', mode: 0o600 });
  return file;
}

function buildShellCommand(agent, bin, folder, session, index) {
  const promptFile = writePromptFile(session.prompt, index);
  const title = String(session.subject || agent).replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 80);
  const setTitle = `printf '\\033]0;%s\\007' ${shQuote(title)}`;
  const cd = `cd ${shQuote(folder)}`;
  const cleanup = `rm -rf ${shQuote(path.dirname(promptFile))}`;
  if (agent === 'antigravity') {
    if (bin.endsWith('.app')) {
      spawn('open', ['-a', bin], { detached: true, stdio: 'ignore' }).unref();
      return null;
    }
    return `${setTitle}; ${cd} && PROMPT="$(cat ${shQuote(promptFile)})"; ${cleanup}; exec ${shQuote(bin)} --add-dir ${shQuote(folder)} -i "$PROMPT"`;
  }
  if (agent === 'gemini-cli') {
    return `${setTitle}; ${cd} && PROMPT="$(cat ${shQuote(promptFile)})"; ${cleanup}; exec ${shQuote(bin)} -i "$PROMPT"`;
  }
  if (agent === 'claude-code') {
    const nameArg = title ? ` -n ${shQuote(title)}` : '';
    return `${setTitle}; ${cd} && PROMPT="$(cat ${shQuote(promptFile)})"; ${cleanup}; exec ${shQuote(bin)}${nameArg} "$PROMPT"`;
  }
  if (agent === 'codex') {
    return `${setTitle}; ${cd} && PROMPT="$(cat ${shQuote(promptFile)})"; ${cleanup}; exec ${shQuote(bin)} "$PROMPT"`;
  }
  return null;
}

const asQuote = (s) => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function openInTerminal(command) {
  if (!command) return true;
  if (process.platform === 'darwin') {
    // Runs directly in Terminal via AppleEvents (no .command file on disk, so Chrome file quarantine never triggers Gatekeeper).
    const script = `tell application "Terminal"\n  activate\n  do script ${asQuote(command)}\nend tell`;
    const r = spawnSync('/usr/bin/osascript', ['-e', script], { stdio: 'ignore', timeout: 8000 });
    return r.status === 0;
  }
  if (process.platform === 'linux') {
    for (const [term, args] of [
      ['x-terminal-emulator', ['-e', 'bash', '-lc', command]],
      ['gnome-terminal', ['--', 'bash', '-lc', command]],
      ['konsole', ['-e', 'bash', '-lc', command]],
      ['xterm', ['-e', 'bash', '-lc', command]],
    ]) {
      if (findBinary([term])) {
        spawn(term, args, { detached: true, stdio: 'ignore' }).unref();
        return true;
      }
    }
    return false;
  }
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', command], { detached: true, stdio: 'ignore' }).unref();
    return true;
  }
  return false;
}

function handleMessage(msg) {
  const agents = detectAgents();
  if (msg?.action === 'ping') {
    return { ok: true, version: VERSION, platform: process.platform, agents };
  }
  if (msg?.action === 'launch') {
    const agent = String(msg.agent || '');
    const bin = agents[agent];
    if (!bin) return { ok: false, error: `${agent} was not found on this computer.` };
    const folder = safeFolder(msg.folder);
    const sessions = Array.isArray(msg.sessions) ? msg.sessions.slice(0, 25) : [];
    if (!sessions.length) return { ok: false, error: 'No session prompt received.' };
    if (agent === 'antigravity' && bin.endsWith('.app')) {
      const folderLine = typeof msg.folder === 'string' && msg.folder.trim() ? `Working folder: ${msg.folder.trim()}\n\n` : '';
      const combined = sessions.map((s) => `${folderLine}${String(s?.prompt || '')}`).join('\n\n---\n\n');
      spawnSync('/usr/bin/pbcopy', [], { input: Buffer.from(combined, 'utf8'), timeout: 4000 });
      const opened = spawnSync('/usr/bin/open', ['googlegemini://newchat'], { stdio: 'ignore', timeout: 4000 });
      if (opened.status !== 0) spawnSync('/usr/bin/open', ['-a', bin], { stdio: 'ignore', timeout: 4000 });
      return { ok: true, mode: 'paste', launched: 1, binary: bin };
    }
    let launched = 0;
    for (const [i, s] of sessions.entries()) {
      const cmd = buildShellCommand(agent, bin, folder, s, i);
      if (cmd === null || openInTerminal(cmd)) launched++;
    }
    return launched ? { ok: true, launched, binary: bin } : { ok: false, error: 'Could not launch a terminal window.' };
  }
  return { ok: false, error: 'Unknown action.' };
}

function sendReply(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}

let input = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  input = Buffer.concat([input, chunk]);
  if (input.length < 4) return;
  const len = input.readUInt32LE(0);
  if (len > 2 * 1024 * 1024) {
    sendReply({ ok: false, error: 'Message too large.' });
    process.exit(0);
  }
  if (input.length < 4 + len) return;
  const raw = input.subarray(4, 4 + len).toString('utf8');
  try {
    sendReply(handleMessage(JSON.parse(raw)));
  } catch (e) {
    sendReply({ ok: false, error: e?.message || 'Invalid JSON.' });
  }
  process.exit(0);
});
