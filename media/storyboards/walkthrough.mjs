// The 63 s walkthrough at 1920 x 1080 for YouTube, which both stores link to as their promo video.
// Silent, captions drawn in, Windows keys (Ctrl V). The toolbar icon opens the settings page: there is
// no popup in this version. The chapters in store/video/README.md start at 0:00, 0:12, 0:24, 0:34 and
// 0:49; those beats are on d.at, so keep them there.

import { aiTab, END_SMALL, GMAIL_TAB, SETTINGS_TAB, rightClickRow, pick, tick } from './common.mjs';

const W = 1280;
const H = 720;

export const walkthrough = {
  name: 'walkthrough',
  title: 'Walkthrough (YouTube)',
  size: { w: W, h: H, dsf: 1.5 }, // 1920 x 1080
  fps: 30,
  duration: 63000,
  targets: ['claude-code', 'codex', 'claude', 'chatgpt', 'copy'],
  settings: true,
  outputs: [
    { kind: 'mp4', path: 'store/video/walkthrough-1920x1080.mp4', crf: 18 },
    { kind: 'srt', path: 'store/video/walkthrough-1920x1080.srt' },
  ],
  steps: [
    "Install the extension. The settings page opens; you can open it again from the extension's icon in Chrome's toolbar.",
    'Tick the AIs you use. Each tick saves straight away.',
    'In Gmail, right-click an email and pick an AI, for example Ask Gemini. The extension opens the email and copies the whole thread.',
    'The AI opens in a new tab next to Gmail. Press Ctrl+V (Cmd+V on a Mac) to paste the thread and read it through. Nothing is sent until you press Enter.',
    'To work on several emails at once, tick them, right-click one of them and pick an AI. Each thread is read without opening it, and the AI is asked to sort them into tasks.',
    'Copy thread for any AI copies the thread but opens no AI, so you can paste it wherever you like.',
    'Claude Code and Codex open on your desktop with a short prompt: the mailbox, the thread ID and the Gmail link, plus the subject for Claude Code. The message text is never in it. They read the thread through their own Gmail connection.',
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
    await d.caption('It reads each one without opening it.', { pos: 'top' });
    await pick(d, 'Ask Claude about 3 emails', { dur: 500 });
    await d.stage('hidePointer', { hidden: 1, dur: 250 });
    await d.cam({ z: 1.5, to: '#vpa-toast', dur: 650 });
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

    // 49.5 to 56.7 s: the desktop agents, and what they get: the prompt in the link, held long enough
    // to read, with the notes on it one after the other.
    await d.caption('Claude Code and Codex read it themselves.');
    await d.move('#gm-back', { dur: 600 });
    await d.click({ after: 120 });
    await rightClickRow(d, 'school', { items: 6, dur: 600 });
    await pick(d, 'Open in Claude Code', { dur: 500 });
    const link = await d.launched();
    if (!/^claude:\/\/code\/new\?q=/.test(link || '')) throw new Error(`no Claude Code link: ${link}`);
    await d.stage('hidePointer', { hidden: 1, dur: 200 });
    await d.stage('card', {
      kind: 'prompt',
      dur: 450,
      title: 'What Claude Code gets',
      sub: 'The prompt in the link that opens the Claude desktop app.',
      prompt: new URL(link).searchParams.get('q'),
      notes: [
        ['Thread ID and Gmail link', 'It reads the email through its own Gmail connection.'],
        ['No message text', 'The body of the email is never put in the link.'],
      ],
      notesAt: [400, 1400],
    });
    await d.at(52900);
    await d.caption('It gets the thread ID, not the message.');
    await d.at(56700);

    // 56.7 to 63 s: end card.
    await d.stage('card', { kind: 'end', url: 'thomasoclegg.github.io/gmail-to-agent', small: END_SMALL, dur: 500 });
    await d.caption('No server, no account, no tracking.');
    await d.at(59800);
    await d.caption('Change your AIs from the toolbar icon.');
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
    await rightClickRow(d, 'order', { items: 5, dur: 500 });
    await d.move({ sel: '.vpa-item', text: 'Ask Gemini' }, { ax: 0.58, dy: 4, dur: 420 });
    await d.cam({ z: 1.55, to: 'body > div.J-M', ax: 0, dx: -34, ay: 0.38, dur: 0 });
    await d.stage('card', { kind: 'thumb', line: 'Right-click an email. Open the thread in your AI.', small: 'Illustration with a made-up inbox.', dur: 0 });
    await d.wait(200);
    d.mark('poster');
  },
};
