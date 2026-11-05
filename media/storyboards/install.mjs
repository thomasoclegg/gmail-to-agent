// The install video at 1920 x 1080 for YouTube, in the walkthrough's style: from the website's download
// to the first right-click in Gmail, in Chrome. Silent, captions drawn in, Windows keys (Ctrl V), and the
// Windows way of unzipping (Extract All), with the Mac way in the caption.
//
// The website is the real docs/index.html, in a frame, and the settings page is the real options.html,
// captured from its own tab. The download bubble, the extensions page, the Extensions menu, the file
// window, its right-click menu and the folder picker are plain, generic drawings, like the AI page: no
// browser's or operating system's own look. The "Illustration" label shows throughout, as in the
// walkthrough.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { aiTab, GMAIL_TAB, SETTINGS_TAB, rightClickRow, pick } from './common.mjs';

const W = 1280;
const H = 720;
const ZIP = 'open-in-ai-agent.zip';
const FOLDER = 'open-in-ai-agent';
const SITE = 'thomasoclegg.github.io/gmail-to-agent';
// A new install starts with these two ticked (DEFAULT_TARGETS in targets.js).
const NEW_INSTALL = ['claude', 'chatgpt'];
const SMALL = 'Illustration. The inbox, the AI page and the browser screens are made up.';

// About what the release zip weighs: each runtime file deflated, plus the zip's headers, as
// scripts/package.mjs writes it. Fonts count only when a page or script names them, as there.
function zipKB(dir) {
  const files = [];
  const walk = (p, rel) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(p, e.name), r);
      else files.push(r);
    }
  };
  walk(dir, '');
  const code = files.filter((f) => /\.(js|html)$/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  let total = 22;
  for (const f of files) {
    if (f.startsWith('fonts/') && f.endsWith('.woff2') && !code.includes(path.basename(f))) continue;
    const data = fs.readFileSync(path.join(dir, f));
    total += Math.min(zlib.deflateRawSync(data, { level: 9 }).length, data.length) + 30 + 46 + 2 * Buffer.byteLength(f);
  }
  return Math.max(1, Math.round(total / 1024));
}

// The made-up computer: a Downloads folder with the mailbox's attachments in it, and Documents.
const downloads = (kb) => [
  { key: 'zip', name: ZIP, kind: 'zip', size: `${kb} KB`, type: 'Zip archive' },
  { key: 'lease', name: 'Lease renewal flat 4B.pdf', kind: 'doc', size: '214 KB', type: 'PDF document' },
  { key: 'order', name: 'Order 1042 delivery note.pdf', kind: 'doc', size: '96 KB', type: 'PDF document' },
  { key: 'consent', name: 'School trip consent form.pdf', kind: 'doc', size: '131 KB', type: 'PDF document' },
  { key: 'rota', name: 'Allotment rota.pdf', kind: 'doc', size: '58 KB', type: 'PDF document' },
];
const FOLDER_ROW = { key: 'ext', name: FOLDER, kind: 'folder', type: 'Folder' };
const DOCUMENTS = [
  { key: 'flat', name: 'Flat 4B', kind: 'folder', type: 'Folder' },
  FOLDER_ROW,
  { key: 'recipes', name: 'Recipes', kind: 'folder', type: 'Folder' },
  { key: 'tax', name: 'Tax 2026', kind: 'folder', type: 'Folder' },
];
const EXT_PAGE = { title: 'Extensions', url: 'chrome://extensions', addr: ['chrome://extensions', ''], fav: 'puzzle', page: 'extp' };
const card = (d) => ({ name: d.manifest.name, version: d.manifest.version, description: d.manifest.description, id: d.ext.id, from: `Documents/${FOLDER}` });
// Where the pointer waits while the settings page opens: grey space on the extensions page, and the
// settings page's right margin once it slides in.
const PARK = { x: 1250, y: 600 };
// The copied note must arrive by then (it takes real time; see media/README.md), and the end card
// starts at END_AT whatever the copy took.
const COPIED_BY = 40300;
const END_AT = 48600;

export const install = {
  name: 'install',
  title: 'Install video (YouTube)',
  size: { w: W, h: H, dsf: 1.5 }, // 1920 x 1080
  fps: 30,
  duration: END_AT + 5400,
  targets: NEW_INSTALL,
  settings: true,
  outputs: [
    { kind: 'mp4', path: 'store/video/install-1920x1080.mp4', crf: 18 },
    { kind: 'srt', path: 'store/video/install-1920x1080.srt' },
  ],
  steps: [
    'On the website, click the Download button (it names your browser) to get open-in-ai-agent.zip. Edge and the other Chromium browsers load the same zip.',
    'Unzip it. On Windows, right-click the zip and pick Extract All: a double-click only shows what is inside. On a Mac, double-click it. Windows may hide the .zip ending, so the zip and the folder can share a name: use the one with the plain folder icon.',
    'Move the open-in-ai-agent folder somewhere it can stay, such as Documents, as long as OneDrive or iCloud does not keep that folder online-only. The browser runs the extension from that folder, so leave it there.',
    'Open chrome://extensions (edge://extensions in Edge) and switch on Developer mode, at the top right. In Edge it is in the left-hand panel.',
    'Click Load unpacked and pick the open-in-ai-agent folder itself: manifest.json is directly inside it, and it is not the zip. Then click Select (Select Folder on Windows).',
    "The extension's card appears and its settings page opens by itself. Tick the AIs you use. Each tick saves straight away.",
    "Open the puzzle-piece Extensions menu in the toolbar and pin Open in AI Agent for Gmail, so its icon stays in view. In Edge, click Show in toolbar.",
    'In Gmail, right-click an email and pick an AI. Gmail tabs that were already open need no reload. Press Ctrl+V (Cmd+V on a Mac) in the AI to paste the thread, read it through, then press Enter.',
  ],
  async run(d) {
    const kb = zipKB(path.join(d.work, 'extension'));

    // 0 to 3.2 s: title. Behind it, the website in its tab, with Gmail open in another.
    const site = await d.stage('site');
    const SITE_TAB = { id: 'web', title: site.title, url: `${SITE}/`, fav: 'mark', page: 'site' };
    await d.stage('tabs', { list: [GMAIL_TAB, SITE_TAB], active: 'web' });
    await d.stage('pages', { gm: -W, site: 0 });
    await d.stage('toolbar', { ext: false, puz: true });
    await d.stage('menuRoom', { items: NEW_INSTALL.length + 1 }); // Gemini is ticked on the way
    const title = await d.stage('card', { kind: 'title', line: 'How to install it in Chrome.', dur: 0 });
    await d.stage('place', { to: { x: 1150, y: 640 } });
    await d.caption('Install in about two minutes.', { fade: false });
    await d.at(3000);
    await d.stage('card', { id: title.id, show: 0, dur: 500 }); // the words go by 3.2 s, the paper by 3.5 s
    await d.at(3200);

    // 3.2 to 7.6 s: the website. Download for Chrome; the zip lands in the download bubble.
    await d.caption('Download the zip from the website.');
    await d.at(3500);
    await d.cam({ z: 1.22, to: 'site:#download', ay: 0.9, dur: 1100 });
    await d.move('site:#download', { ax: 0.42, dur: 1000 });
    await d.wait(250);
    await d.click({ real: false, after: 150 }); // drawn only: the page never leaves for the real download
    await d.cam({ z: 1, dur: 500 });
    await d.stage('toolbar', { dl: true, dur: 260 });
    await d.wait(320);
    await d.stage('downloads', { name: ZIP, size: `${kb} KB`, dur: 260 });
    await d.wait(600);
    await d.move('#dlb-folder', { dur: 650 });
    await d.wait(120);
    await d.click({ after: 80 });
    await d.stage('downloads', { show: 0, dur: 180 });
    await d.stage('win', { id: 'files', title: 'Downloads', place: 'Downloads', rows: downloads(kb), dur: 340 });
    await d.at(7600);

    // 7.6 to 11.8 s: unzip it as on Windows, where a double-click only opens the zip: right-click,
    // Extract All. The caption gives the Mac way.
    await d.caption('Unzip it: right-click, Extract All.\nOn a Mac, double-click it.');
    await d.move('[data-win="files"] [data-row="zip"]', { ax: 0.16, dur: 700 });
    await d.wait(120);
    await d.click({ button: 'right', real: false, hold: 60, after: 0 });
    await d.stage('winSelect', { id: 'files', row: 'zip' });
    await d.stage('winMenu', { id: 'files', items: ['Open', 'Extract All...', '-', 'Cut', 'Copy', 'Rename', 'Delete'] });
    await d.wait(350);
    await d.move('[data-menu="files"] [data-item="Extract All..."]', { ax: 0.32, dur: 500 });
    await d.wait(200);
    await d.click({ real: false, after: 60 });
    await d.stage('winMenu', { id: 'files', show: 0, dur: 120 });
    await d.wait(380);
    await d.stage('winAdd', { id: 'files', row: FOLDER_ROW, at: 0 });
    await d.at(11800);

    // 11.8 to 16 s: move the folder to Documents, then look at it there.
    await d.caption('Move the folder somewhere it can stay.');
    await d.move('[data-win="files"] [data-row="ext"]', { ax: 0.16, dur: 420 });
    await d.stage('press', { down: true });
    await d.stage('winDrag', { id: 'files', row: 'ext' });
    await d.wait(120);
    await d.move('[data-win="files"] [data-place="Documents"]', { ax: 0.45, dur: 850 });
    await d.stage('winOver', { id: 'files', place: 'Documents' });
    await d.wait(220);
    await d.stage('press', { down: false });
    await d.stage('winDrop', { id: 'files' }); // the row folds away and the list closes up
    await d.wait(620);
    await d.click({ after: 120 });
    await d.stage('winPlace', { id: 'files', place: 'Documents', rows: DOCUMENTS, select: 'ext' });
    await d.wait(1200);
    await d.stage('win', { id: 'files', show: 0, dur: 400 });
    await d.at(16000);

    // 16 to 19 s: the extensions page, typed into the address bar. It loads with a cut, as a page does.
    await d.caption('Open chrome://extensions.');
    await d.stage('extPage');
    await d.move('#addr', { ax: 0.22, dur: 750 });
    await d.click({ after: 60 });
    await d.stage('addrFocus');
    await d.wait(280);
    const typed = await d.stage('addrType', { text: 'chrome://extensions', dur: 850 });
    await d.wait(typed.dur + 120);
    await d.keys(['Enter'], { pos: 'top', dur: 800 });
    await d.wait(300);
    await d.stage('navTab', { id: 'web', ...EXT_PAGE, dur: 0 });
    await d.at(19000);

    // 19 to 23 s: Developer mode, then Load unpacked, closer in on the top of the page, where they are.
    await d.caption('Switch on Developer mode.');
    await d.cam({ z: 1.3, to: '#xp-dev', dur: 900 });
    await d.move('#xp-dev', { dur: 900 });
    await d.wait(150);
    await d.click({ after: 0 });
    await d.stage('extDev', { on: true });
    await d.at(21000);
    await d.caption('Click Load unpacked.');
    await d.cam({ z: 1.3, to: '#xp-load', dur: 900 });
    await d.move('#xp-load', { dur: 900 });
    await d.wait(180);
    await d.click({ after: 60 });
    await d.cam({ z: 1, dur: 500 });
    await d.stage('win', { id: 'picker', title: 'Choose a folder', place: 'Documents', rows: DOCUMENTS, picker: true, hgt: 430, dur: 320 });
    await d.at(23000);

    // 23 to 25.8 s: the folder picker.
    await d.caption('Pick the unzipped folder, then Select.');
    await d.move('[data-win="picker"] [data-row="ext"]', { ax: 0.18, dur: 700 });
    await d.wait(100);
    await d.click({ after: 60 });
    await d.stage('winSelect', { id: 'picker', row: 'ext', field: FOLDER });
    await d.wait(330);
    await d.move('#picker-select', { dur: 600 });
    await d.wait(150);
    await d.click({ after: 60 });
    await d.stage('win', { id: 'picker', show: 0, dur: 240 });
    await d.wait(260);
    await d.stage('extCard', card(d));
    await d.at(25800);

    // 25.8 to 29 s: the card, then the settings page opens by itself, as on a real install. The pointer
    // moves out of the way first, to a margin that is empty on both pages, and the settings page
    // scrolls to the AIs as soon as it is in, so the caption covers none of them.
    await d.caption('Installed. The settings page\nopens by itself.');
    d.settingsLive = true;
    await d.move(PARK, { dur: 700 });
    await d.wait(350);
    await d.stage('openTab', { ...SETTINGS_TAB, dur: 560 });
    await d.wait(520);
    d.onSettingsPage = true;
    const gem = await d.settingsRect('#tiles .tile[data-id="gemini"]');
    d.scrollSettings(Math.max(0, gem.y - 0.62 * (H - 76)), 900);
    await d.at(29000);

    // 29 to 31 s: tick Gemini on the real settings page.
    await d.caption('Tick the AIs you use.');
    await d.move('settings:#tiles .tile[data-id="gemini"] .tick', { dur: 850 });
    await d.wait(150);
    await d.click({ after: 300 });
    await d.at(31000);

    // 31 to 35.4 s: pin it from the puzzle-piece menu, closer in on the menu.
    d.onSettingsPage = false;
    await d.caption('Pin it from the puzzle-piece menu.');
    await d.stage('xmenu', { name: d.manifest.name, show: 0, dur: 0 });
    await d.move('#puz', { dur: 850 });
    await d.wait(100);
    await d.click({ after: 60 });
    await d.stage('xmenu', { show: 1, dur: 200 });
    await d.cam({ z: 1.4, to: '#puz', dy: 90, dur: 650 }); // the menu opens under it (and is still hidden here)
    await d.wait(350);
    // Along the extension's row, clear of the menu's close button, then to the pin's lower left corner,
    // so the pointer does not cover the pin.
    await d.move('#xmenu .row .n', { ax: 0.4, dur: 550 });
    await d.move('#xm-pin', { ax: 0.14, ay: 0.86, dur: 420 });
    await d.wait(300);
    await d.click({ after: 60 });
    await d.stage('xmenu', { pinned: true });
    await d.stage('toolbar', { ext: true, dur: 320 });
    await d.wait(650);
    await d.stage('xmenu', { show: 0, dur: 180 });
    await d.cam({ z: 1, dur: 550 });
    await d.at(35400);

    // 35.4 s on: in Gmail, right-click, Ask Gemini, then paste in the AI's tab.
    await d.caption('In Gmail, right-click an email.\nPick an AI.', { pos: 'top' }); // the menu reaches the bottom
    await d.move('[data-tab="gm"]', { ax: 0.4, dur: 750 });
    await d.click({ after: 0 });
    await d.stage('switchTab', { id: 'gm', dur: 560 });
    await d.wait(600);
    d.settingsLive = false;
    await rightClickRow(d, 'order', { items: 3, dur: 900 });
    // Closer in on the menu, with the page's left edge kept in view: the extension's note shows there.
    await d.cam({ z: 1.2, to: 'body > div.J-M', ax: 0, dx: -400, ay: 0.32, dur: 600 });
    await d.wait(400);
    await pick(d, 'Ask Gemini', { dur: 600 });
    await d.cam({ z: 1, dur: 450 });
    await d.until('the copied note', (s) => /^Copied/.test(s.toast), 2500, { late: COPIED_BY });
    // Close on the note. The caption at the top must not cut a line of the thread in half: at 1.66 the
    // first sender's lines are above the frame and the caption covers the whole "Hi Priya," line. (At
    // 1.5, as in the walkthrough, it cut through the sender's name.)
    await d.caption('It copies the thread and opens your AI.', { pos: 'top' });
    await d.cam({ z: 1.66, to: '#vpa-toast', dur: 650 });
    await d.stage('hidePointer', { hidden: 1, dur: 250 });
    await d.wait(2300);
    await d.cam({ z: 1, dur: 550 });
    await d.wait(650);
    const url = await d.opened();
    const prompt = await d.copied();
    await d.stage('aiReset');
    await d.caption(null);
    await d.stage('openTab', { ...aiTab(url), dur: 560 });
    await d.wait(500);
    // Paste, read the thread through to its end, then Enter, as in the walkthrough.
    await d.caption('Paste it, check it, then press Enter.');
    await d.keys(['Ctrl', 'V'], { pos: 'top', dur: 1300 });
    await d.wait(520);
    await d.stage('aiPaste', { text: prompt });
    await d.wait(700);
    await d.stage('aiScroll', { to: 'end', dur: 2200 });
    await d.wait(2400);
    await d.keys(['Enter'], { pos: 'top', dur: 900 });
    await d.wait(260);
    await d.stage('aiSend', { dur: 560 });
    await d.at(END_AT, 'the end card');

    // The end card. The caption changes once the paper covers the page.
    await d.stage('card', { kind: 'end', url: SITE, small: SMALL, dur: 500 });
    await d.wait(300);
    await d.caption('Free and open source.');
    await d.at(END_AT + 2600);
    await d.caption('Coming soon to the Chrome Web Store.');
  },
};

// YouTube's custom thumbnail for the install video, 1280 x 720, in the walkthrough thumbnail's style:
// the name and "How to install it" on a panel at the left, and the folder picker over the extensions
// page, with Developer mode on, beside it. One still, no video.
export const installThumbnail = {
  name: 'install-thumbnail',
  title: 'Install video thumbnail',
  size: { w: 1280, h: 720, dsf: 1 },
  fps: 30,
  duration: 2000,
  targets: NEW_INSTALL,
  outputs: [{ kind: 'poster', path: 'store/video/install-thumbnail-1280x720.png', mark: 'poster' }],
  steps: [], // a still: no step list
  async run(d) {
    await d.stage('extPage');
    await d.stage('tabs', { list: [GMAIL_TAB, { id: 'web', ...EXT_PAGE }], active: 'web' });
    await d.stage('pages', { gm: -W, extp: 0 });
    await d.stage('toolbar', { ext: false, puz: true });
    await d.stage('extDev', { on: true, dur: 0 });
    await d.stage('win', { id: 'picker', title: 'Choose a folder', place: 'Documents', rows: DOCUMENTS, picker: true, x: 586, y: 150, w: 680, hgt: 400, dur: 0 });
    await d.stage('winSelect', { id: 'picker', row: 'ext', field: FOLDER }); // the Folder box lines up with the list, clear of the panel
    await d.stage('place', { to: '#picker-select', ax: 0.6, ay: 0.7 });
    // Closer in, so the folder and Select read at thumbnail size, with Developer mode still in view. The
    // panel's edge falls where the picker's places end, so no word is cut in half.
    await d.cam({ z: 1.3, to: { x: 790, y: 350 }, dur: 0 });
    await d.stage('card', { kind: 'thumb', head: 'How to install it', line: 'Two minutes, in Chrome.', small: 'Illustration with made-up data.', dur: 0 });
    await d.wait(600);
    d.mark('poster');
  },
};
