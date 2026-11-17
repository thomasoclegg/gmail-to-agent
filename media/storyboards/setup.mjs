// OS-specific desktop companion setup clips (1280 x 800, 30 fps, silent with captions):
// - clip-setup-mac: shows enabling the companion helper on Settings, picking Open in Antigravity in Gmail,
//   toggling Google Chrome ON once in macOS System Settings > Privacy & Security > Accessibility, and landing
//   in a new Antigravity chat ready to press Enter.
// - clip-setup-win: shows running node host\install.mjs once in Windows PowerShell, clicking Enable companion
//   helper on Settings, picking Open in Antigravity in Gmail, and landing directly in the workspace session with
//   no extra Windows security toggle needed.

import { START, GMAIL_TAB, SETTINGS_TAB, rightClickRow } from './common.mjs';

const SIZE = { w: 1024, h: 640, dsf: 1.25 }; // 1280 x 800
const outputs = (name, crf = 24) => [
  { kind: 'webm', path: `docs/media/${name}.webm`, crf: 36 },
  { kind: 'mp4', path: `docs/media/${name}.mp4`, crf },
  { kind: 'poster', path: `docs/media/${name}-poster.png`, mark: 'poster' },
];

export const setupMac = {
  name: 'clip-setup-mac',
  title: 'Clip 5a: desktop setup on a Mac (Antigravity & Accessibility)',
  platform: 'mac',
  size: SIZE,
  fps: 30,
  duration: 17000,
  targets: ['antigravity', 'claude-code', 'claude', 'chatgpt'],
  settings: true,
  outputs: outputs('clip-setup-mac'),
  steps: [
    'In Terminal, run node host/install.mjs once inside the downloaded folder, then open Settings and click Enable companion helper.',
    'In Gmail, right-click an email (or click Triage unread) and pick Open in Antigravity.',
    'The first time on a Mac, System Settings opens to Privacy & Security > Accessibility. Switch Google Chrome ON once.',
    'From then on, Open in Antigravity opens a new Antigravity chat with the prompt already pasted, ready for you to press Enter.',
  ],
  async run(d) {
    await d.stage('tabs', { list: [GMAIL_TAB, SETTINGS_TAB], active: 'settings' });
    await d.stage('pages', { gm: -SIZE.w, settings: 0 });
    d.settingsLive = true;
    d.onSettingsPage = true;
    await d.stage('place', { to: START });

    // 0.0 to 4.2 s: Settings page -> scroll to Companion helper and click Enable companion helper.
    await d.caption('1. Click Enable companion helper\non Settings.', { fade: false });
    const btn = await d.settingsRect('#enable-helper');
    d.scrollSettings(Math.max(0, btn.y - 0.52 * (d.board.size.h - 76)), 700);
    await d.wait(800);
    await d.move('settings:#enable-helper', { ax: 0.45, dur: 850 });
    await d.wait(200);
    await d.click({ real: false, after: 150 });
    await d.b.eval(
      d.opt.session,
      `document.getElementById('helper-status').textContent = 'Connected (v1.6.7): found Antigravity, Claude Code.'; true`,
    );
    await d.at(4200);

    // 4.2 to 8.2 s: Switch to Gmail tab, right-click row, pick Open in Antigravity.
    await d.caption('2. Pick Open in Antigravity in Gmail.', { pos: 'top' });
    d.onSettingsPage = false;
    await d.move('[data-tab="gm"]', { ax: 0.4, dur: 600 });
    await d.click({ after: 0 });
    await d.stage('switchTab', { id: 'gm', dur: 480 });
    await d.wait(520);
    d.settingsLive = false;
    await rightClickRow(d, 'order', { items: 4, dur: 700 });
    await d.wait(250);
    await d.move({ sel: '.vpa-item', text: 'Open in Antigravity' }, { ax: 0.35, dur: 500 });
    await d.wait(150);
    await d.click({ real: false, after: 0 });
    await d.b.eval(d.page.session, `document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); true`);
    await d.at(8200);

    // 8.2 to 12.6 s: macOS System Settings > Privacy & Security > Accessibility -> toggle Google Chrome ON.
    await d.caption('3. On a Mac, toggle Google Chrome ON\nonce in Accessibility.');
    await d.stage('macAx', { show: 1, dur: 300 });
    await d.wait(550);
    await d.move('#mac-ax-sw', { ax: 0.5, dur: 850 });
    await d.wait(220);
    await d.click({ real: false, after: 100 });
    await d.stage('macAxToggle', { on: true });
    await d.wait(650);
    d.mark('poster');
    await d.at(12400);
    await d.stage('macAx', { show: 0, dur: 240 });
    await d.at(12600);

    // 12.6 to 17.0 s: Antigravity opens a new chat with the prompt pasted, ready for Enter.
    await d.caption('Antigravity opens a new chat,\nready for you to press Enter.');
    await d.stage('agyWin', {
      os: 'mac',
      folder: '/Users/you/Documents/Work',
      subject: 'Delivery date for order 1042',
      show: 1,
      dur: 320,
    });
    await d.wait(550);
    await d.move('#agy-enter', { ax: 0.5, dur: 850 });
  },
};

export const setupWin = {
  name: 'clip-setup-win',
  title: 'Clip 5b: desktop setup on Windows (PowerShell & helper)',
  platform: 'win',
  size: SIZE,
  fps: 30,
  duration: 16000,
  targets: ['antigravity', 'claude-code', 'claude', 'chatgpt'],
  settings: true,
  outputs: outputs('clip-setup-win'),
  steps: [
    'Open PowerShell in the unzipped open-in-ai-agent folder and run node host\\install.mjs once to register Chrome and Edge.',
    'On the extension Settings page, click Enable companion helper.',
    'In Gmail, right-click any email and pick Open in Antigravity (or Claude Code, Codex or Gemini CLI).',
    'Windows needs no extra Accessibility toggle: your desktop agent opens in your working folder, ready to review and press Enter.',
  ],
  async run(d) {
    await d.stage('tabs', { list: [GMAIL_TAB, SETTINGS_TAB], active: 'settings' });
    await d.stage('pages', { gm: -SIZE.w, settings: 0 });
    d.settingsLive = true;
    await d.stage('place', { to: START });

    // 0.0 to 4.4 s: Windows PowerShell running node host\install.mjs.
    await d.caption('1. On Windows, run node host\\install.mjs\nonce in PowerShell.', { fade: false });
    await d.stage('termWin', {
      os: 'win',
      cmd: 'node host\\install.mjs',
      lines: [
        { text: 'Registered HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.openinaiagent.host', cls: 't-ok' },
        { text: 'Registered HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.openinaiagent.host', cls: 't-ok' },
        { text: 'Done (Windows browser registry keys configured).', cls: 't-dim' },
      ],
      show: 1,
      dur: 260,
    });
    await d.at(4100);
    await d.stage('termWin', { show: 0, dur: 240 });
    await d.at(4400);

    // 4.4 to 8.2 s: Settings page -> click Enable companion helper.
    d.onSettingsPage = true;
    await d.caption('2. Click Enable companion helper.');
    const btn = await d.settingsRect('#enable-helper');
    d.scrollSettings(Math.max(0, btn.y - 0.52 * (d.board.size.h - 76)), 650);
    await d.wait(750);
    await d.move('settings:#enable-helper', { ax: 0.45, dur: 800 });
    await d.wait(200);
    await d.click({ real: false, after: 150 });
    await d.b.eval(
      d.opt.session,
      `document.getElementById('helper-status').textContent = 'Connected (v1.6.7): found Antigravity, Claude Code.'; true`,
    );
    await d.at(8200);

    // 8.2 to 11.8 s: Switch to Gmail tab, right-click row, pick Open in Antigravity.
    await d.caption('3. Right-click an email and pick your AI.', { pos: 'top' });
    d.onSettingsPage = false;
    await d.move('[data-tab="gm"]', { ax: 0.4, dur: 580 });
    await d.click({ after: 0 });
    await d.stage('switchTab', { id: 'gm', dur: 460 });
    await d.wait(500);
    d.settingsLive = false;
    await rightClickRow(d, 'order', { items: 4, dur: 680 });
    await d.wait(220);
    await d.move({ sel: '.vpa-item', text: 'Open in Antigravity' }, { ax: 0.35, dur: 480 });
    await d.wait(150);
    await d.click({ real: false, after: 0 });
    await d.b.eval(d.page.session, `document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); true`);
    await d.at(11800);

    // 11.8 to 16.0 s: Opens directly in working folder on Windows, no extra OS toggle needed.
    await d.caption('No extra Windows toggle needed:\nreview it and press Enter.');
    await d.stage('agyWin', {
      os: 'win',
      folder: 'C:\\Users\\you\\Documents\\Work',
      subject: 'Delivery date for order 1042',
      show: 1,
      dur: 320,
    });
    await d.wait(550);
    await d.move('#agy-enter', { ax: 0.5, dur: 800 });
    await d.wait(400);
    d.mark('poster');
  },
};
