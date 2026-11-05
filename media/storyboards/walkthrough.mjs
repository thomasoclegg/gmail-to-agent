// The 89.5 s walkthrough at 1920 x 1080 for YouTube, which both stores link to as their promo video.
// Silent, captions drawn in, Windows keys (Ctrl V). The chapters in store/video/README.md start at 0:00,
// 0:12, 0:24, 0:34, 0:49, 1:01 and 1:12, each a chapter's first caption rounded down; those beats are on
// d.at, so keep them there, and keep every chapter 10 s or longer (YouTube's minimum).

import { aiTab, END_SMALL, GMAIL_TAB, SETTINGS_TAB, rightClickRow, pick, tick, promptCard } from './common.mjs';

const W = 1280;
const H = 720;

export const walkthrough = {
  name: 'walkthrough',
  title: 'Walkthrough (YouTube)',
  size: { w: W, h: H, dsf: 1.5 }, // 1920 x 1080
  fps: 30,
  duration: 89500,
  targets: ['claude-code', 'codex', 'claude', 'chatgpt', 'copy'],
  settings: true,
  settingsZoom: 1.3, // the camera zooms in on Your own instructions (about 1.2)
  outputs: [
    { kind: 'mp4', path: 'store/video/walkthrough-1920x1080.mp4', crf: 18 },
    { kind: 'srt', path: 'store/video/walkthrough-1920x1080.srt' },
  ],
  steps: [
    "Install the extension. The settings page opens; to open it again, click the extension's icon in the browser's toolbar, then Settings.",
    'Tick the AIs you use. Each tick saves straight away.',
    'In Gmail, right-click an email and pick an AI, for example Ask Gemini. The extension opens the email and copies the whole thread.',
    'The AI opens in a new tab next to Gmail. Press Ctrl+V (Cmd+V on a Mac) to paste the thread and read it through. Nothing is sent until you press Enter.',
    'To work on several emails at once, tick them, right-click one of them and pick an AI. Each thread is read without opening it, and the AI is asked to sort them into tasks.',
    'Copy thread for any AI copies the thread but opens no AI, so you can paste it wherever you like.',
    'Claude Code and Codex open on your desktop with a prompt: the mailbox, the thread ID and the Gmail link, plus the subject for Claude Code. The message text is never in it. The prompt asks them to read the thread through their own Gmail connection, check Sent mail and each fact in their own tools, do the work, then draft any reply. Anything that has to wait is set aside: Claude Code is asked to propose a separate session for it (at most three, with any others as briefs in its answer), Codex to give a brief in its answer. They are told to follow nothing an email asks, and to send or change nothing outside their working folder without your approval.',
    "With nothing ticked and no email open, the extension's button in Gmail's toolbar reads Triage unread. Click it and pick an AI, for example Ask ChatGPT about 4 emails. The unread emails on this page of the list, up to 25, are read without opening them, so they stay unread, and the AI is asked to sort them into Action, Consolidate, Disregard and Draft.",
    "The extension's icon in the browser's toolbar (pin it from the puzzle-piece menu if you can't see it) lists your AIs, with a line saying what they will act on: the email you have open, or the ones you ticked. At the bottom are Settings and the shortcut that sends to the AI you used last: Alt+Shift+L, or Control+Shift+L on a Mac.",
    'On the settings page, Your own instructions takes text of your own in place of the built-in instructions: one box for Claude Code and Codex, one for the web AIs and Copy. Triage unread and selected text keep the built-in instructions.',
    'It runs on your computer: no server, no account, no tracking.',
  ],
  async run(d) {
    // 0 to 6 s: title.
    await d.stage('tabs', { list: [GMAIL_TAB, SETTINGS_TAB], active: 'settings' });
    await d.stage('pages', { gm: -W, settings: 0 });
    d.settingsLive = true;
    d.onSettingsPage = true;
    const title = await d.stage('card', { kind: 'title', dur: 0 });
    await d.stage('place', { to: { x: 1150, y: 640 } });
    await d.caption('Send a Gmail thread to your AI.', { fade: false });
    await d.at(2600);
    await d.caption('Free, open source, runs on your computer.');
    await d.at(5500);
    await d.stage('card', { id: title.id, show: 0, dur: 500 });
    await d.at(6000);

    // 6 to 12 s: the real settings page; tick Gemini.
    await d.caption('Tick the AIs you use.');
    const gem = await d.settingsRect('#tiles .tile[data-id="gemini"]');
    d.scrollSettings(Math.max(0, gem.y - 0.62 * (H - 76)), 1000);
    await d.wait(1100);
    await d.move('settings:#tiles .tile[data-id="gemini"] .tick', { dur: 900 });
    await d.wait(200);
    await d.click({ after: 300 });
    await d.at(8800);
    await d.caption('Changes save straight away.');
    await d.at(10600);
    d.onSettingsPage = false;
    await d.move('[data-tab="gm"]', { ax: 0.4, dur: 800 });
    await d.click({ after: 0 });
    await d.stage('switchTab', { id: 'gm', dur: 560 });
    await d.at(12000);
    d.settingsLive = false;

    // 12 to 24 s: right-click, Ask Gemini, the thread is copied. The menu reaches nearly to the bottom
    // of the page, so the caption sits at the top.
    await d.caption('Right-click an email. Pick an AI.', { pos: 'top' });
    await rightClickRow(d, 'order', { items: 6, dur: 1000 });
    await d.cam({ z: 1.2, to: 'body > div.J-M', ay: 0.32, dur: 650 });
    await d.wait(450);
    await pick(d, 'Ask Gemini', { dur: 650 });
    await d.cam({ z: 1, dur: 450 });
    // The note shows for 6 s; the camera is back out before it fades.
    await d.until('the copied note', (s) => /^Copied/.test(s.toast), 2000);
    await d.caption('It opens the email and copies the thread.', { pos: 'top' });
    await d.cam({ z: 1.5, to: '#vpa-toast', dur: 700 });
    await d.stage('hidePointer', { hidden: 1, dur: 250 });
    await d.wait(4400);
    await d.cam({ z: 1, dur: 600 });
    await d.at(22900);

    // 24 to 34 s: the Gemini tab, drawn plainly. Paste, read it through, Enter.
    const gemini = await d.opened();
    const prompt = await d.copied();
    await d.stage('aiReset');
    await d.caption(null);
    await d.stage('openTab', { ...aiTab(gemini), dur: 600 });
    await d.at(24000);
    await d.caption('Paste and read it.');
    await d.keys(['Ctrl', 'V'], { pos: 'top', dur: 1350 });
    await d.wait(520);
    await d.stage('aiPaste', { text: prompt });
    await d.wait(900);
    await d.stage('aiScroll', { to: 'end', dur: 3000 });
    await d.at(28800);
    await d.caption('Nothing is sent until you press Enter.');
    await d.at(31200);
    await d.keys(['Enter'], { pos: 'top', dur: 950 });
    await d.wait(260);
    await d.stage('aiSend', { dur: 560 });
    await d.at(33600);

    // 34 to 45 s: several emails at once, read without opening them, then the Claude tab they go to.
    await d.stage('place', { to: { x: 760, y: 70 } });
    await d.stage('hidePointer', { hidden: 0, dur: 200 });
    await d.move('[data-tab="gm"]', { ax: 0.4, dur: 550 });
    await d.click({ after: 0 });
    await d.stage('backToInbox'); // back in the inbox, as if after Gmail's back arrow
    await d.stage('switchTab', { id: 'gm', dur: 520 });
    await d.caption('Or tick several emails at once.');
    await d.wait(540);
    await tick(d, 'lease', { dur: 650 });
    await tick(d, 'order', { dur: 360 });
    await tick(d, 'boiler', { dur: 480 });
    await rightClickRow(d, 'order', { items: 6, dur: 550 });
    await d.caption('It reads each email without opening it.', { pos: 'top' });
    await pick(d, 'Ask Claude about 3 emails', { dur: 500 });
    await d.stage('hidePointer', { hidden: 1, dur: 250 });
    // Only a gentle push-in on the note: at 16:9 the top caption then sits over the address bar and Gmail's
    // search bar, with the toolbar and all three ticked rows whole below it. Any deeper and it covers or cuts
    // the toolbar or the first ticked row.
    await d.cam({ z: 1.056, to: '#vpa-toast', dur: 650 });
    await d.until('the copied note', (s) => /^Copied 3 emails/.test(s.toast), 2500);
    await d.at(41000);
    await d.cam({ z: 1, dur: 550 });
    await d.wait(300);
    // A tab of its own beside Gemini's, on the same drawn AI page.
    const claude = await d.opened(3000, { count: 2 });
    const tasks = await d.copied();
    await d.stage('aiReset');
    await d.stage('openTab', { ...aiTab(claude), id: 'ai-bulk', dur: 600 });
    await d.caption('It asks the AI to sort them into tasks.');
    await d.wait(600);
    await d.keys(['Ctrl', 'V'], { pos: 'top', dur: 1300 });
    await d.wait(520);
    await d.stage('aiPaste', { text: tasks });
    await d.at(45000);

    // 45 to 49.5 s: back in Gmail, copy for any AI. First clear the ticks with Gmail's select-all box,
    // so the single-email menu that follows makes sense.
    await d.stage('place', { to: { x: 760, y: 70 } });
    await d.stage('hidePointer', { hidden: 0, dur: 200 });
    await d.caption('Or copy it for any AI.');
    await d.move('[data-tab="gm"]', { ax: 0.4, dur: 500 });
    await d.click({ after: 0 });
    await d.stage('switchTab', { id: 'gm', dur: 520 });
    await d.wait(540);
    await d.move('#gm-all', { dur: 500 });
    await d.click({ after: 90 });
    await rightClickRow(d, 'boat', { items: 6, dur: 520 });
    await pick(d, 'Copy thread for any AI', { dur: 520 });
    await d.until('the copied note', (s) => /^Copied\. Paste/.test(s.toast), 2000);
    await d.at(49500);

    // 49.5 to 61 s: the desktop agents, and what they get: the real prompt from the link, shortened to
    // fit, held long enough to take in, with the notes on it one after the other.
    await d.caption('Claude Code and Codex read it themselves.');
    await d.move('#gm-back', { dur: 600 });
    await d.click({ after: 120 });
    await rightClickRow(d, 'school', { items: 6, dur: 600 });
    await pick(d, 'Open in Claude Code', { dur: 500 });
    const link = await d.launched();
    await d.stage('hidePointer', { hidden: 1, dur: 200 });
    const agent = await d.stage('card', { ...promptCard(link, { notesAt: [600, 1900, 3200, 4500] }), dur: 450 });
    await d.at(52900);
    await d.caption("The email's text is never in the link.");
    await d.at(56500);
    await d.caption('It is told to do the work, then ask first.');
    await d.at(60400);
    await d.stage('card', { id: agent.id, show: 0, dur: 500 });
    await d.at(61000);

    // 61 to 72.5 s: Triage unread, from the extension's own button in Gmail's toolbar. Nothing is ticked,
    // so it hands over the unread emails in the list, read without opening them.
    await d.caption('Nothing ticked? Triage your unread emails.');
    await d.until("Triage unread in Gmail's toolbar", (s) => s.tb === 'Triage unread', 600);
    await d.stage('place', { to: { x: 640, y: 430 } });
    await d.stage('hidePointer', { hidden: 0, dur: 200 });
    await d.wait(200);
    await d.move('.vpa-tb', { dur: 900 });
    await d.wait(250);
    await d.click({ after: 60 });
    await d.until("the toolbar button's menu", (s) => s.tbItems.length >= 6, 600);
    // No deeper: the tab strip's + button stays clear of the Illustration label's corner.
    await d.cam({ z: 1.25, to: '.vpa-tb-menu', ay: 0.3, dur: 600 });
    await d.wait(250);
    await d.move({ sel: '.vpa-tb-item', text: 'Ask ChatGPT about 4 emails' }, { ax: 0.3, dur: 550 });
    await d.wait(200);
    // The menu closes with the click, and the pointer goes with it, so nothing seems to click the row that was
    // under the menu: a short ring, the pointer fades at once, and (hidden) it leaves the rows, so the row
    // under it loses its hover.
    await d.click({ after: 0, ring: 220 });
    await d.stage('hidePointer', { hidden: 1, dur: 90 });
    await d.cam({ z: 1, dur: 450 });
    await d.wait(90);
    await d.stage('place', { to: { x: 760, y: 159 } });
    // The caption changes in the very frame the note grows to "Copied 4 emails…", and at the top, so every row
    // shows: the four stay bold, unread. A gentle push-in on the note keeps the caption over Gmail's search bar,
    // clear of the button just clicked; any deeper and it covers the button.
    await d.caption('It copies them, and they stay unread.', { pos: 'top', toast: '^Copied 4 emails' });
    await d.until('the copied note', (s) => /^Copied 4 emails/.test(s.toast), 3000, { late: 65500 });
    await d.cam({ z: 1.056, to: '#vpa-toast', dur: 600 });
    await d.at(67000);
    // The camera is back out before the ChatGPT tab slides in, and the next caption waits for the tab.
    await d.cam({ z: 1, dur: 500 });
    await d.at(67550);
    const gpt = await d.opened(3000, { count: 3 });
    const triage = await d.copied();
    // The pasted prompt fills a shorter box than in the earlier tabs, clear of the two-line caption.
    await d.stage('aiReset', { textMax: 0.38 });
    await d.stage('openTab', { ...aiTab(gpt), id: 'ai-triage', dur: 560 });
    await d.at(68200);
    await d.caption('The AI sorts them: Action, Consolidate,\nDisregard and Draft.');
    await d.wait(300);
    await d.keys(['Ctrl', 'V'], { pos: 'top', dur: 1300 });
    await d.wait(520);
    await d.stage('aiPaste', { text: triage });
    await d.at(72500);

    // 72.5 to 84 s: the toolbar list, for two ticked emails, then its Settings link to the settings page and
    // the box for your own instructions.
    await d.stage('place', { to: { x: 760, y: 70 } });
    await d.stage('hidePointer', { hidden: 0, dur: 200 });
    await d.caption("Or tick some, then click the icon\nin the browser's toolbar.");
    await d.move('[data-tab="gm"]', { ax: 0.4, dur: 550 });
    await d.click({ after: 0 });
    await d.stage('switchTab', { id: 'gm', dur: 520 });
    await d.wait(500);
    await tick(d, 'lease', { dur: 650 });
    await tick(d, 'boat', { dur: 380 });
    await d.move('#ext', { dur: 850 });
    await d.stage('extHover', { on: true });
    await d.wait(150);
    await d.click({ after: 60 });
    const list = await d.openPopup();
    if (!/2 emails you ticked/.test(list.context)) throw new Error(`the toolbar list says: ${list.context}`);
    await d.caption('It lists your AIs for what you ticked.');
    await d.cam({ z: 1.2, to: '#popup', ay: 0.45, dur: 600 });
    await d.wait(2300);
    await d.move('popup:#settings', { dur: 700 });
    await d.wait(200);
    await d.click({ real: false, after: 60 }); // the Settings link: the stage switches to the settings tab
    await d.closePopup();
    await d.stage('extHover', { on: false });
    // One move at a time: the camera comes out, then the settings tab slides in, already scrolled to Your own
    // instructions (its top edge in the gap above the heading, clear of the section before), then the camera
    // goes in on it. The section is in the page's right-hand column, so the caption, on two lines, sits on the
    // blank paper to its left and covers none of it.
    await d.cam({ z: 1, dur: 450 });
    await d.wait(470);
    const before = await d.settingsRect('section:has(+ #own)');
    const heading = await d.settingsRect('#own-title');
    const hint = await d.settingsLines('#own-desktop-hint');
    // Between two lines of the hint, or just after its last line.
    const gaps = [...hint.slice(0, -1).map((l, i) => (l.bottom + hint[i + 1].top) / 2), hint.at(-1).bottom + 4];
    // Where the page's top edge goes: in the gap above the heading, and (if it can) where the bottom edge of the
    // page area falls between two lines of the hint.
    const lo = before.y + before.h + 6;
    const hi = heading.y - 12;
    const top = gaps.map((g) => g - (H - 76)).find((t) => t >= lo && t <= hi) ?? lo;
    d.settingsScroll = top;
    d.settingsLive = true;
    await d.stage('switchTab', { id: 'settings', dur: 560 });
    await d.wait(280); // halfway in, the tab strip shows the settings tab: the caption changes with it
    await d.caption('In Settings, write\nyour own instructions.');
    await d.wait(280);
    d.onSettingsPage = true;
    await d.wait(200);
    // About 1.2, so the column leaves room for the caption; the frame's bottom edge falls between two lines of
    // the hint under the box, and its top edge stays at the page's top, in the gap above the heading.
    const bottom = gaps.filter((g) => g <= top + H / 1.2).at(-1) ?? top + H / 1.2;
    const z = H / (bottom - top);
    await d.cam({ z, to: { x: W, y: H / (2 * z) + 76 }, dur: 900 });
    await d.wait(1000);
    await d.move('settings:#own-desktop', { ax: 0.35, ay: 0.45, dur: 800 });
    await d.at(84000);
    d.onSettingsPage = false;

    // 84 to 89.5 s: end card; the camera comes back out under it.
    await d.stage('card', { kind: 'end', url: 'thomasoclegg.github.io/gmail-to-agent', small: END_SMALL, dur: 500 });
    await d.caption('No server, no account, no tracking.');
    await d.wait(320);
    await d.cam({ z: 1, dur: 0 });
    await d.at(87000);
    d.settingsLive = false;
    await d.caption('Free and open source.');
  },
};

// YouTube's custom thumbnail for the walkthrough, 1280 x 720: the name on a panel at the left and the
// real menu, with the extension's items, beside it. One still, no video.
export const thumbnail = {
  name: 'walkthrough-thumbnail',
  title: 'Walkthrough thumbnail',
  size: { w: 1280, h: 720, dsf: 1 },
  fps: 30,
  duration: 2000,
  targets: ['claude-code', 'claude', 'chatgpt', 'gemini', 'copy'],
  outputs: [{ kind: 'poster', path: 'store/video/walkthrough-thumbnail-1280x720.png', mark: 'poster' }],
  steps: [], // a still: no step list
  async run(d) {
    await d.stage('place', { to: { x: 900, y: 560 } });
    await rightClickRow(d, 'order', { items: 5, dy: 12, dur: 500 });
    await d.move({ sel: '.vpa-item', text: 'Ask Gemini' }, { ax: 0.58, dy: 4, dur: 420 });
    await d.cam({ z: 1.55, to: 'body > div.J-M', ax: 0, dx: -34, ay: 0.38, dur: 0 });
    await d.stage('card', { kind: 'thumb', line: 'Right-click an email. Open the thread in your AI.', small: 'Illustration with a made-up inbox.', dur: 0 });
    await d.wait(200);
    d.mark('poster');
  },
};
