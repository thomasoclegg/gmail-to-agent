// The AIs a thread can be opened in. Plain script shared by content.js,
// background.js (importScripts) and options.js.

// Cmd+V on a Mac, Ctrl+V elsewhere; both when the platform is unknown.
const PASTE_KEYS = (() => {
  const p = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || '';
  if (!p) return 'Cmd+V (Ctrl+V)';
  return /mac/i.test(p) ? 'Cmd+V' : 'Ctrl+V';
})();

// "https://www.perplexity.ai/" -> "perplexity.ai"
const hostOf = (url) => url.replace(/^https:\/\/(?:www\.)?([^/]+).*$/, '$1');

// A web AI's note is its address. The settings page gives the paste keys once for the group.
// bulkMenu is the Gmail menu label when several emails are selected; {n} is their number.
const webTarget = (id, name, url) => ({
  id,
  name,
  kind: 'web',
  url,
  menu: `Ask ${name}`,
  bulkMenu: `Ask ${name} about {n} emails`,
  chromeMenu: `Ask ${name} about this thread`,
  note: hostOf(url),
});

const TARGETS = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    kind: 'app',
    menu: 'Open in Claude Code',
    bulkMenu: 'Open {n} in Claude Code',
    chromeMenu: 'Open thread in Claude Code',
    note: 'Claude desktop app. Reads the thread itself; you press Enter.',
  },
  {
    id: 'codex',
    name: 'Codex',
    kind: 'app',
    menu: 'Open in Codex',
    bulkMenu: 'Open {n} in Codex (GPT)',
    chromeMenu: 'Open thread in Codex',
    note: 'ChatGPT desktop app. Reads the thread itself and starts straight away once a working folder is set.',
  },
  webTarget('claude', 'Claude', 'https://claude.ai/new'),
  webTarget('chatgpt', 'ChatGPT', 'https://chatgpt.com/'),
  webTarget('gemini', 'Gemini', 'https://gemini.google.com/app'),
  webTarget('copilot', 'Microsoft Copilot', 'https://copilot.microsoft.com/'),
  webTarget('perplexity', 'Perplexity', 'https://www.perplexity.ai/'),
  webTarget('grok', 'Grok', 'https://grok.com/'),
  webTarget('mistral', 'Le Chat (Mistral)', 'https://chat.mistral.ai/chat'),
  webTarget('deepseek', 'DeepSeek', 'https://chat.deepseek.com/'),
  {
    id: 'copy',
    name: 'Copy thread for any AI',
    kind: 'copy',
    menu: 'Copy thread for any AI',
    bulkMenu: 'Copy {n} emails for any AI',
    chromeMenu: 'Copy thread for any AI',
    note: 'Copies the whole thread so you can paste it into any AI.',
  },
];

const DEFAULT_TARGETS = ['claude', 'chatgpt']; // new installs
const LEGACY_TARGETS = ['claude-code', 'codex']; // upgrades from 1.0.x with no targets setting

// Shown on the settings page; empty charity or url hides it. "about" finishes the sentence after the name.
const DONATION = {
  charity: 'Friends of Larnaca Cats',
  about: 'a volunteer group that neuters, feeds and treats street cats in Larnaca, Cyprus',
  url: 'https://www.friendsoflarnacacats.org/donate?ref=ai-agent',
};

const targetById = (id) => TARGETS.find((t) => t.id === id);

// Known targets for the given ids, in TARGETS order.
const pickTargets = (ids) => TARGETS.filter((t) => Array.isArray(ids) && ids.includes(t.id));

const hasDonation = () => !!(DONATION.charity && DONATION.url);
