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
// Gmail's menu.
export async function rightClickRow(d, key, { ax = 0.3, dur, items = 1 } = {}) {
  await d.move(`#row-${key} .bqe`, { ax, dur });
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
