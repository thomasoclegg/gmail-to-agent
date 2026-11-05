// The 13 s hero loop for the website and the README: right-click, pick an AI, the thread is copied,
// paste, check, Enter. Two versions: Ctrl V (Windows, the default) and Cmd V (Mac).

import { aiHost, START, END_SMALL, GMAIL_TAB } from './common.mjs';

export const hero = (platform = 'win') => {
  const mac = platform === 'mac';
  const name = mac ? 'hero-mac' : 'hero';
  const paste = mac ? ['Cmd', 'V'] : ['Ctrl', 'V'];
  return {
    name,
    title: mac ? 'Hero loop, Mac keys' : 'Hero loop',
    size: { w: 1024, h: 640, dsf: 1.25 }, // 1280 x 800
    fps: 30,
    duration: 13000,
    loop: true,
    platform,
    targets: ['claude', 'chatgpt'], // what a new install starts with
    outputs: [
      { kind: 'webm', path: `docs/media/${name}.webm`, crf: 38 },
      { kind: 'mp4', path: `docs/media/${name}.mp4`, crf: 25 },
      { kind: 'poster', path: `docs/media/${name}-poster.png`, mark: 'poster' },
      ...(mac ? [] : [{ kind: 'gif', path: 'docs/media/hero.gif', width: 800, gifFps: 15, colors: 128 }]),
    ],
    steps: [
      'In Gmail, right-click an email.',
      'Pick an AI from the top of the menu, for example Ask ChatGPT.',
      'The extension opens the email and copies the whole thread. The note at the bottom left says so.',
      `A moment later the AI opens in a new tab. Press ${paste.join('+')} to paste the thread.`,
      'Check what you pasted, then press Enter. Nothing is sent until you do.',
    ],
    async run(d) {
      await d.stage('place', { to: START });
      await d.caption('Right-click an email.', { fade: false });
      await d.wait(250);
      await d.move('#row-order .bqe', { ax: 0.3, dur: 1450 });
      await d.at(2000);

      // Gmail's menu, with the extension's items at the top.
      await d.click({ button: 'right', after: 60 });
      await d.until("the extension's items in Gmail's menu", (s) => s.items.length >= 2, 600);
      // The menu reaches nearly to the bottom of the page, so the caption goes to the top while it is
      // open rather than over its last items.
      await d.caption('Pick your AI.', { pos: 'top' });
      await d.cam({ z: 1.25, to: 'body > div.J-M', ay: 0.3, dur: 700 });
      await d.wait(380);
      await d.move({ sel: '.vpa-item', text: 'Ask ChatGPT' }, { ax: 0.3, dur: 520 });
      d.mark('poster'); // the zoom has settled and the pointer rests on Ask ChatGPT
      await d.at(3400);
      await d.click({ after: 0 });

      // The real hand-off: Gmail opens the thread, the extension reads and copies it. The copy lands
      // about 0.5 s after the click, give or take a few frames, so the hold on the note is counted from
      // the copy, not the clock. A copy after 4.5 s would squeeze the paste: render that take again.
      await d.cam({ z: 1, dur: 450 });
      await d.until('the copied note', (s) => /^Copied/.test(s.toast), 2000, { late: 4500 });
      await d.caption('The whole thread is copied.', { pos: 'top' });
      await d.cam({ z: 1.5, to: '#vpa-toast', dur: 650 });
      await d.stage('hidePointer', { hidden: 1, dur: 250 });
      await d.wait(650 + 1100);
      await d.cam({ z: 1, dur: 550 });
      await d.wait(550);

      // The AI's tab, drawn: its address, a plain chat box and no logo.
      const url = await d.opened();
      const prompt = await d.copied();
      await d.stage('aiReset');
      await d.stage('openTab', { id: 'ai', title: aiHost(url), url: aiHost(url), fav: 'dot', page: 'ai', dur: 560 });
      await d.caption(null);
      await d.at(6800);
      await d.caption('Paste.');
      await d.keys(paste, { pos: 'top', dur: 1350 });
      await d.wait(520);
      await d.stage('aiPaste', { text: prompt });
      await d.at(7900);
      await d.caption('Check it, then press Enter.');
      await d.at(8350);
      await d.keys(['Enter'], { pos: 'top', dur: 950 });
      await d.wait(260);
      await d.stage('aiSend', { dur: 560 });
      await d.at(10150);

      // End card, then back to the first frame so the loop has no seam. The card's words go first,
      // then its paper, so they never sit over the inbox.
      await d.stage('card', { kind: 'end', small: END_SMALL, dur: 420 });
      await d.caption('Free. Runs on your computer.');
      await d.at(12400);
      await d.stage('tabs', { list: [GMAIL_TAB], active: 'gm' });
      await d.stage('pages', { gm: 0, ai: 1024, settings: 1024 });
      await d.stage('resetInbox');
      await d.stage('aiReset');
      await d.stage('place', { to: START });
      await d.stage('hidePointer', { hidden: 0, dur: 0 });
      await d.caption('Right-click an email.');
      await d.stage('card', { id: 0, show: 0, dur: 600 });
    },
  };
};
