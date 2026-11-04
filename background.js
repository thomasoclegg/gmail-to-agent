// Chrome's own right-click menu. Gmail replaces it on inbox rows (content.js
// handles those), but it shows inside an open thread.
const ITEMS = [
  ['claude', 'Open thread in Claude Code'],
  ['codex', 'Open thread in Codex (GPT)'],
];

chrome.runtime.onInstalled.addListener(() => {
  // Ask for the working folder until one is set.
  chrome.storage.sync.get({ folder: '' }, (s) => s.folder || chrome.runtime.openOptionsPage());
  chrome.contextMenus.removeAll(() => {
    for (const [id, title] of ITEMS) {
      chrome.contextMenus.create({
        id,
        title,
        contexts: ['all'],
        documentUrlPatterns: ['https://mail.google.com/*'],
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = await chrome.tabs.sendMessage(tab.id, { agent: info.menuItemId }, { frameId: 0 });
  if (url) chrome.tabs.update(tab.id, { url });
});
