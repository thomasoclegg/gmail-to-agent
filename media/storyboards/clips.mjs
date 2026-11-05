// Four short clips, one idea each, for the help section and for replies to issues. 1280 x 800, silent,
// captions drawn in, Ctrl V (Windows keys).

import { aiTab, START, SETTINGS_TAB, rightClickRow, pick, tick, promptCard } from './common.mjs';

const SIZE = { w: 1024, h: 640, dsf: 1.25 }; // 1280 x 800
const outputs = (name, crf = 25) => [
  { kind: 'webm', path: `docs/media/${name}.webm`, crf: 38 },
  { kind: 'mp4', path: `docs/media/${name}.mp4`, crf },
  { kind: 'poster', path: `docs/media/${name}-poster.png`, mark: 'poster' },
];

// C1: pick your AIs. The toolbar icon opens the toolbar list (the real popup.html), with Settings at its
// foot; a tick on the settings page changes Gmail's menu straight away.
export const pickAis = {
  name: 'clip-pick-ais',
  title: 'Clip 1: pick your AIs',
  size: SIZE,
  fps: 30,
  duration: 12000,
  targets: ['claude', 'chatgpt'],
  settings: true,
  outputs: outputs('clip-pick-ais'),
  steps: [
    "Click the extension's icon in the browser's toolbar. If you can't see it, pin it from the puzzle-piece menu.",
    'The list of your AIs opens. Click Settings at the bottom.',
    'The settings page opens. Tick the AIs you use. Each tick saves straight away.',
    'Back in Gmail, right-click an email. The AIs you ticked are at the top of the menu, in the same order.',
  ],
  async run(d) {
    await d.stage('place', { to: START });
    await d.caption("Click the extension's icon.", { fade: false });
    await d.wait(200);
    await d.move('#ext', { dur: 900 });
    await d.stage('extHover', { on: true });
    await d.wait(150);
    await d.click({ after: 60 });
    await d.openPopup();
    await d.at(1900); // long enough to read the first caption
    await d.caption('Then Settings, under your AIs.');
    await d.wait(500);
    await d.move('popup:#settings', { dur: 700 });
    await d.wait(200);
    await d.click({ real: false, after: 60 }); // the Settings link: the stage opens the settings tab
    await d.closePopup();
    await d.stage('extHover', { on: false });
    d.settingsLive = true;
    await d.stage('openTab', { ...SETTINGS_TAB, dur: 560 });
    await d.wait(650);
    d.onSettingsPage = true;

    await d.caption('Tick the AIs you use.');
    const gem = await d.settingsRect('#tiles .tile[data-id="gemini"]');
    d.scrollSettings(Math.max(0, gem.y - 0.66 * (d.board.size.h - 76)), 900);
    await d.wait(950);
    await d.move('settings:#tiles .tile[data-id="gemini"] .tick', { dur: 800 });
    await d.wait(150);
    d.mark('poster');
    await d.click({ after: 500 });
    await d.at(7000);

    await d.caption('They show when you right-click.', { pos: 'top' }); // the menu reaches the bottom
    d.onSettingsPage = false;
    await d.move('[data-tab="gm"]', { ax: 0.4, dur: 700 });
    await d.click({ after: 0 });
    await d.stage('switchTab', { id: 'gm', dur: 520 });
    await d.wait(560);
    d.settingsLive = false;
    await rightClickRow(d, 'order', { items: 3, dur: 750 });
    await d.cam({ z: 1.25, to: 'body > div.J-M', ay: 0.3, dur: 650 });
    await d.wait(500);
    await d.move({ sel: '.vpa-item', text: 'Ask Gemini' }, { ax: 0.3, dur: 500 });
  },
};

// C2: Claude Code and Codex. Chrome asks once to open the app; the app gets the thread ID, not the
// message. Both apps are in the menu; the clip opens Claude Code, whose prompt the card shows with what to
// notice in it: only its key lines, set larger than in the walkthrough, since the website shows the clip
// at about 800 px wide.
export const desktopAgent = {
  name: 'clip-desktop-agent',
  title: 'Clip 2: Claude Code and Codex',
  size: SIZE,
  fps: 30,
  duration: 13000,
  targets: ['claude-code', 'codex', 'claude', 'chatgpt'],
  outputs: outputs('clip-desktop-agent'),
  steps: [
    'On the settings page, tick Claude Code or Codex and add a working folder. The app needs Gmail connected for the same mailbox.',
    'In Gmail, right-click an email and pick Open in Claude Code (or Open in Codex).',
    'The first time, Chrome asks whether to open the app. Tick Always allow, then click Open.',
    'The app opens with a prompt: the mailbox, the thread ID and the Gmail link, plus the subject for Claude Code so the session is named after the email. The message text is never in it.',
    'The prompt asks the app to read the thread through its own Gmail connection, check Sent mail and each fact in its own tools, do the work, then draft any reply. Anything that has to wait is set aside: Claude Code is asked to propose a separate session for it (at most three, with any others as briefs in its answer), Codex to give a brief in its answer. It is told to follow nothing an email asks, and to send or change nothing outside its working folder without your approval.',
    'Claude Code waits for you to press Enter. Codex starts by itself once a working folder is set, and only reads until you reply.',
  ],
  async run(d) {
    await d.stage('place', { to: START });
    await d.caption('Pick Claude Code or Codex.', { pos: 'top', fade: false }); // clear of the menu
    await d.wait(200);
    await rightClickRow(d, 'order', { items: 4, dur: 1000 });
    await d.cam({ z: 1.25, to: 'body > div.J-M', ay: 0.3, dur: 600 });
    await d.wait(350);
    await pick(d, 'Open in Claude Code', { dur: 450 });
    const link = await d.launched();
    const card = promptCard(link, { notesAt: [500, 1400, 2300, 3200, 4100], extra: [['You start it', 'Claude Code waits for you to press Enter.']], focus: true });
    await d.cam({ z: 1, dur: 450 });

    // Chrome's own prompt, drawn: it shows the first time only.
    await d.caption('Chrome asks once.\nTick Always allow, then Open.');
    await d.wait(150);
    await d.stage('dialog', { app: 'Claude', dur: 240 });
    await d.wait(600);
    await d.move('#dlg-box', { dur: 650 });
    await d.click({ after: 0 });
    await d.stage('dialogTick');
    await d.wait(450);
    await d.move('#dlg-yes', { dur: 550 });
    await d.stage('dialogHover', { on: true });
    await d.wait(300);
    await d.click({ after: 0 });
    await d.stage('dialog', { show: 0, dur: 200 });
    await d.stage('hidePointer', { hidden: 1, dur: 200 });
    await d.at(6500);

    // What the app gets: the real prompt from the link, shortened to fit.
    await d.stage('card', { ...card, dur: 450 });
    await d.caption("The email's text is never in the link.");
    await d.at(9700);
    await d.caption('It is told to do the work, then ask first.');
    await d.at(12900);
    d.mark('poster');
  },
};

// C3: copy for any AI. Nothing opens; the note gives the paste keys.
export const copyAny = {
  name: 'clip-copy',
  title: 'Clip 3: copy for any AI',
  size: SIZE,
  fps: 30,
  duration: 7000,
  targets: ['claude', 'chatgpt', 'copy'],
  outputs: outputs('clip-copy'),
  steps: [
    'On the settings page, tick Copy thread for any AI.',
    'In Gmail, right-click an email and pick Copy thread for any AI.',
    'The extension opens the email and copies the whole thread. Nothing else opens.',
    'Paste it into any AI chat with Ctrl+V (Cmd+V on a Mac), check it, then send it.',
  ],
  async run(d) {
    await d.stage('place', { to: START });
    await d.caption('Pick Copy thread for any AI.', { pos: 'top', fade: false }); // clear of the menu
    await d.wait(150);
    await rightClickRow(d, 'order', { items: 3, dur: 950 });
    await d.wait(250);
    await pick(d, 'Copy thread for any AI', { dur: 600 });
    await d.stage('hidePointer', { hidden: 1, dur: 250 });
    // The copy lands about 2.8 s in; a much later one leaves the first caption up too long.
    await d.until('the copied note', (s) => /^Copied/.test(s.toast), 2000, { late: 3300 });
    await d.caption('Paste it into any AI you use.', { pos: 'top' });
    // Deep enough that the thread's heading is out of the frame rather than cut in half.
    await d.cam({ z: 1.6, to: '#vpa-toast', dur: 650 });
    await d.wait(700);
    d.mark('poster');
    await d.at(6300);
    await d.cam({ z: 1, dur: 600 });
  },
};

// C4: several emails at once. Tick them, right-click one, pick an AI; they are read without opening.
export const bulk = {
  name: 'clip-bulk',
  title: 'Clip 4: several emails at once',
  size: SIZE,
  fps: 30,
  duration: 12000,
  targets: ['claude', 'chatgpt'],
  outputs: outputs('clip-bulk'),
  steps: [
    'In the Gmail inbox, tick two or more emails (up to 25).',
    'Right-click one of the ticked emails and pick an AI, for example Ask Claude about 3 emails.',
    'The extension reads each thread in the background without opening it, so unread emails stay unread.',
    'The AI opens in a new tab. Press Ctrl+V (Cmd+V on a Mac) to paste, check it, then press Enter.',
    'The prompt asks the AI to group the emails into tasks, put the most urgent first and draft replies. Claude Code and Codex get the thread IDs and links instead of the message text, and Claude Code also gets each subject.',
  ],
  async run(d) {
    await d.stage('place', { to: START });
    await d.caption('Tick the emails you want help with.', { fade: false });
    await d.wait(150);
    await tick(d, 'lease', { dur: 900 });
    await tick(d, 'order', { dur: 420 });
    await tick(d, 'boiler', { dur: 600 });
    await d.caption('Right-click one and pick an AI.', { pos: 'top' }); // clear of the menu, which reaches the bottom
    await rightClickRow(d, 'order', { items: 2, dur: 700 });
    await d.cam({ z: 1.25, to: 'body > div.J-M', ay: 0.3, dur: 600 });
    await d.wait(300);
    await d.move({ sel: '.vpa-item', text: 'Ask Claude about 3 emails' }, { ax: 0.3, dur: 450 });
    d.mark('poster'); // the zoom has settled and the pointer rests on the item
    await d.wait(150);
    await d.click({ after: 0 });
    await d.cam({ z: 1, dur: 450 });
    await d.stage('hidePointer', { hidden: 1, dur: 250 });
    await d.wait(500);
    await d.caption('It reads each email without opening it.', { pos: 'top' });
    // Deep enough for the note, and no deeper: the top caption then covers only the tab row (its box just
    // wide enough to cover the Primary label whole), with all three ticked rows below it and the toolbar out
    // of frame above.
    await d.cam({ z: 1.38, to: '#vpa-toast', dur: 600 });
    await d.until('the copied note', (s) => /^Copied 3 emails/.test(s.toast), 2500);
    await d.at(7700);
    await d.cam({ z: 1, dur: 450 });
    await d.wait(400);

    const url = await d.opened();
    const prompt = await d.copied();
    await d.stage('aiReset');
    await d.stage('openTab', { ...aiTab(url), dur: 560 });
    await d.wait(600);
    await d.caption('It asks the AI to sort them into tasks.');
    await d.keys(['Ctrl', 'V'], { pos: 'top', dur: 1300 });
    await d.wait(520);
    await d.stage('aiPaste', { text: prompt });
  },
};
