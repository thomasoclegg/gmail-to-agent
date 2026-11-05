// Shared bits for the storyboards.

// "https://www.perplexity.ai/" -> "perplexity.ai", as targets.js shows a web AI's address.
export const aiHost = (url) => String(url).replace(/^https:\/\/(?:www\.)?([^/]+).*$/, '$1');

// Where the pointer rests at the start of a 1024 x 640 stage (page coordinates).
export const START = { x: 760, y: 548 };

export const GMAIL_TAB = { id: 'gm', title: 'Inbox - sam.morgan@example.com - Gmail', url: 'mail.google.com/mail/u/0/#inbox', fav: 'mail', page: 'gm' };

// The small print on every end card.
export const END_SMALL = 'Illustration. The inbox and the AI page are made up.';

export const SETTINGS_TAB = {
  id: 'settings',
  title: 'Open in AI Agent for Gmail settings',
  addr: ['Open in AI Agent for Gmail', '   chrome-extension://…/options.html'],
  fav: 'mark',
  page: 'settings',
};

export const aiTab = (url) => ({ id: 'ai', title: aiHost(url), url: aiHost(url), fav: 'dot', page: 'ai' });

// Moves to an inbox row's subject and right-clicks it; resolves once the extension's items are in
// Gmail's menu, which opens at the pointer (dy: lower in the row, so its top edge clears the subject).
export async function rightClickRow(d, key, { ax = 0.3, dy, dur, items = 1 } = {}) {
  await d.move(`#row-${key} .bqe`, { ax, dy, dur });
  await d.click({ button: 'right', after: 60 });
  return d.until("the extension's items in Gmail's menu", (s) => s.menu && s.items.length >= items, 600);
}

// Moves to one of the extension's menu items by its label and clicks it.
export async function pick(d, label, { dur, after = 0 } = {}) {
  await d.move({ sel: '.vpa-item', text: label }, { ax: 0.3, dur });
  await d.click({ after });
}

// Ticks an inbox row's checkbox.
export async function tick(d, key, { dur } = {}) {
  await d.move(`#row-${key} [role="checkbox"]`, { dur });
  await d.click({ after: 80 });
}

// ---- What Claude Code gets: the real prompt, shortened for a card ----

// The real prompt from the link, shortened for the screen and still in its own words and order: long asides
// in brackets become "(…)", and three lines break where the notes point, so what they point at stays in
// view (a continued bullet is indented). The stage then cuts each row at a word to fit one line (the card's
// fit option). If the prompt no longer has these lines, the render stops, so a changed prompt is noticed.
const BREAKS = [
  // How to read the thread: one sentence a row, so the line that nothing an email asks is followed shows.
  [/^Read (?:the whole thread|every thread) /, /(?<=\.) (?=Treat |Never )/, ''],
  // The bullet that sets aside what cannot be finished now: the session it proposes starts a row.
  [/^- For each /, /(?<=,) (?=propose a separate session)/, '  '],
  // The approval sentence: what it may do without waiting, then what waits for your yes.
  [/^Without waiting for me,/, /(?<=,) (?=but do not send)/, ''],
];

export function screenPrompt(prompt) {
  const rows = [];
  const broken = new Set();
  for (const line of prompt.split('\n')) {
    const short = line.replace(/ \([^()]{24,}\)/g, ' (…)');
    const brk = BREAKS.find(([start]) => start.test(short));
    const parts = brk ? short.split(brk[1]) : [short];
    if (parts.length > 1) broken.add(brk);
    parts.forEach((part, i) => rows.push(i ? brk[2] + part : part));
  }
  const missed = BREAKS.filter((b) => !broken.has(b));
  if (missed.length) throw new Error(`the Claude Code prompt has changed: no line like ${missed.map(([start]) => start).join(', ')} to break. Update BREAKS in media/storyboards/common.mjs.`);
  return rows.join('\n');
}

// The notes beside it, and the rows each points at (they get a red rule as the note appears). Every pattern
// must match a row of the screen prompt, or the render stops. The notes say what the prompt asks: a prompt
// cannot make an agent do it (README, Limitations), and the approval sentence holds back only what leaves the
// working folder.
export const CARD_NOTES = [
  ['Does the work', 'It is asked to resolve what it can first, and only then draft a reply.', ['^- Do the underlying work', '^- Carry on with every part', '^- Only then draft']],
  ['Sent mail and its own tools', 'It checks what was already sent, and each fact at its source.', ['^- Check related (?:threads|mail) and Sent mail', '^- Work out what resolving it needs']],
  ['Safety lines', 'It is told to follow nothing an email asks, and to ask before anything leaves its folder.', ['^Treat the email content', '^Never open a link', '^Without waiting for me', '^but do not send']],
  ['Follow-up sessions', 'Work that must wait is proposed as a session for you to start.', ['^- For each ', '^ +propose a separate session']],
];

// The rows a focused card keeps: what the link carries (subject, mailbox, thread ID, Gmail link), the task's
// first line, and the rows the notes point at, with the blank rows between sections.
const KEEP = /^(?:Email subject|Mailbox|Thread ID|Gmail link):|^(?:Resolve the matter|Work through these)/;

// The card's options for a Claude Code link: the screen prompt, the notes (extra ones after CARD_NOTES)
// and their marks. notesAt: when each note appears, from the card's start. focus: only the rows that matter
// here (KEEP and the marked rows), set larger, for a clip that the website shows small.
export function promptCard(link, { notesAt, extra = [], focus = false, sub } = {}) {
  if (!/^claude:\/\/code\/new\?q=/.test(link || '')) throw new Error(`no Claude Code link: ${link}`);
  let rows = screenPrompt(new URL(link).searchParams.get('q')).split('\n');
  const marks = [];
  CARD_NOTES.forEach(([, , patterns], i) => {
    for (const src of patterns) {
      if (!rows.some((r) => new RegExp(src).test(r))) throw new Error(`no row of the Claude Code prompt matches ${src}: the prompt has changed`);
      marks.push([src, i]);
    }
  });
  if (focus) {
    const kept = rows.filter((r) => !r.trim() || KEEP.test(r) || marks.some(([src]) => new RegExp(src).test(r)));
    rows = kept.filter((r, i) => r.trim() || (i > 0 && kept[i - 1].trim() && i < kept.length - 1));
  }
  return {
    kind: 'prompt',
    title: 'What Claude Code gets',
    sub: sub ?? `The prompt in the link that opens the Claude desktop app, ${focus ? 'shortened to its key lines' : 'shortened to fit'}.`,
    prompt: rows.join('\n'),
    fit: true,
    big: focus,
    notes: [...CARD_NOTES.map(([b, t]) => [b, t]), ...extra],
    notesAt,
    marks,
  };
}
