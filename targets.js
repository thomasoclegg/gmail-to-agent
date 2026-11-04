// Platforms a thread can be handed to. Plain script shared by content.js,
// background.js (importScripts) and options.js.

// Cmd+V on a Mac, Ctrl+V elsewhere; both when the platform is unknown.
const PASTE_KEYS = (() => {
  const p = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || '';
  if (!p) return 'Cmd+V (Ctrl+V)';
  return /mac/i.test(p) ? 'Cmd+V' : 'Ctrl+V';
})();
const PASTE_HINT = `Press ${PASTE_KEYS}, then Enter.`;

const webTarget = (id, name, url) => ({
  id,
  name,
  kind: 'web',
  url,
  menu: `Ask ${name}`,
  chromeMenu: `Ask ${name} about this thread`,
  note: `Opens ${name} with the email copied. ${PASTE_HINT}`,
});

const TARGETS = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    kind: 'app',
    menu: 'Open in Claude Code',
    chromeMenu: 'Open thread in Claude Code',
    note: 'Claude desktop app. Reads the thread itself; you press Enter.',
  },
  {
    id: 'codex',
    name: 'Codex',
    kind: 'app',
    menu: 'Open in Codex (GPT)',
    chromeMenu: 'Open thread in Codex (GPT)',
    note: 'ChatGPT desktop app. Reads the thread itself and starts straight away.',
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
    name: 'Copy for any AI',
    kind: 'copy',
    menu: 'Copy thread for any AI',
    chromeMenu: 'Copy thread for any AI',
    note: 'Copies the email so you can paste it into any AI.',
  },
];

const DEFAULT_TARGETS = ['claude', 'chatgpt']; // new installs
const LEGACY_TARGETS = ['claude-code', 'codex']; // upgrades from 1.0.x with no targets setting

// Fill in both to show the donation link; it stays hidden while either is empty.
const DONATION = { charity: '', url: '' };

const targetById = (id) => TARGETS.find((t) => t.id === id);

// Known targets for the given ids, in TARGETS order.
const pickTargets = (ids) => TARGETS.filter((t) => Array.isArray(ids) && ids.includes(t.id));

const hasDonation = () => !!(DONATION.charity && DONATION.url);
