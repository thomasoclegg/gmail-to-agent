// Chrome's own right-click menu (Gmail replaces it on inbox rows, where
// content.js adds the items, but it shows inside an open thread), the toolbar
// icon, first-run settings, the content script for Gmail tabs that were already
// open, Gmail's session key for bulk reads, and the clipboard hand-off for web
// and copy targets.
importScripts('targets.js');

const GMAIL = 'https://mail.google.com/';
// Page contexts only: 'all' would also add the items to the toolbar icon's menu.
const CONTEXTS = ['page', 'frame', 'selection', 'link', 'editable', 'image'];
// Web AIs open after this pause, so the paste hint shows in Gmail first.
const OPEN_DELAY = 1200;
// Gmail's session key (ik) is a short token; anything else is ignored.
const IK_PATTERN = /^[\w-]{4,32}$/;

// Next to the Gmail tab when Chrome allows it (an app window may not).
const openNextTo = (tab, url) =>
  chrome.tabs
    .create({ url, index: tab.index + 1, openerTabId: tab.id, windowId: tab.windowId })
    .catch(() => chrome.tabs.create({ url }));

// ---- Install, update and settings ----

async function firstRun({ reason, previousVersion }) {
  const s = await chrome.storage.sync.get(['targets', 'folder']);
  if (reason === 'install') {
    if (!Array.isArray(s.targets)) await chrome.storage.sync.set({ targets: DEFAULT_TARGETS });
    return chrome.runtime.openOptionsPage();
  }
  if (reason !== 'update' || s.targets !== undefined) return;
  // 0.x and 1.0.x only had the two desktop targets; keep them for upgraders.
  const legacy = /^(0|1\.0)\./.test(previousVersion || '');
  await chrome.storage.sync.set({ targets: legacy ? LEGACY_TARGETS : DEFAULT_TARGETS });
  if (legacy) chrome.tabs.create({ url: chrome.runtime.getURL('options.html#new') });
}

// Gmail tabs that were open before an install or update get the content script
// now, so they need no reload. content.js runs once per tab; a tab that cannot
// take it keeps the reload fallback (needsReload). A tab still loading gets the
// manifest's copy as well: the second targets.js then logs a harmless "already
// declared" error in that tab's console. Skipping loading tabs would avoid it, but
// would also skip a Gmail tab whose status reads loading for another reason.
async function injectIntoGmailTabs() {
  const tabs = await chrome.tabs.query({ url: `${GMAIL}*` });
  const inject = (tab) =>
    chrome.scripting
      .executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ['targets.js', 'content.js'] })
      .catch(() => {});
  await Promise.all(tabs.map(inject));
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await firstRun(details).catch((e) => console.warn('First run:', e));
  rebuildMenus();
  if (details.reason === 'install' || details.reason === 'update') {
    await injectIntoGmailTabs().catch((e) => console.warn('Gmail tabs:', e));
  }
});

chrome.runtime.onStartup.addListener(() => rebuildMenus());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.targets) rebuildMenus();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// ---- Chrome's context menu ----

const removeAllMenus = () => new Promise((resolve) => chrome.contextMenus.removeAll(resolve));
const createMenu = (props) =>
  new Promise((resolve) => chrome.contextMenus.create(props, () => resolve(chrome.runtime.lastError)));

async function buildMenus() {
  const { targets } = await chrome.storage.sync.get({ targets: DEFAULT_TARGETS });
  await removeAllMenus();
  for (const t of pickTargets(targets)) {
    await createMenu({ id: t.id, title: t.chromeMenu, contexts: CONTEXTS, documentUrlPatterns: [`${GMAIL}*`] });
  }
}

// Rebuilds run one after another so overlapping calls never clash on ids.
let menuQueue = Promise.resolve();
function rebuildMenus() {
  menuQueue = menuQueue.then(buildMenus).catch((e) => console.warn('Menus:', e));
  return menuQueue;
}

// Gmail tabs opened before an install or update have no content script until
// they reload: say so on the icon and in a settings tab.
function needsReload(tab) {
  const quiet = () => {};
  chrome.action.setBadgeText({ tabId: tab.id, text: '!' }).catch(quiet);
  chrome.action.setTitle({ tabId: tab.id, title: 'Reload this Gmail tab to use Open in AI Agent' }).catch(quiet);
  return openNextTo(tab, chrome.runtime.getURL('options.html#reload'));
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // pageUrl is missing for clicks outside a page, such as the toolbar icon's menu.
  if (!tab?.id || !info.pageUrl?.startsWith(GMAIL)) return;
  const msg = { target: 'content', action: 'run', platform: info.menuItemId };
  if (info.frameId) msg.fromFrame = true;
  let reply;
  try {
    reply = await chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 });
  } catch {
    return needsReload(tab);
  }
  if (/^(claude|codex):\/\//.test(reply?.url || '')) chrome.tabs.update(tab.id, { url: reply.url });
});

// ---- Clipboard hand-off (web and copy targets) ----

let creatingOffscreen = null;

async function hasOffscreen() {
  if (chrome.offscreen.hasDocument) return chrome.offscreen.hasDocument();
  const found = await chrome.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return !!found?.length;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  creatingOffscreen ??= chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Copy the email thread you picked to the clipboard.',
    })
    .catch((e) => {
      if (!/single offscreen/i.test(e?.message || '')) throw e;
    })
    .finally(() => (creatingOffscreen = null));
  await creatingOffscreen;
}

async function copyText(text) {
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', action: 'copy', text });
  if (!res?.ok) throw new Error(res?.error || 'Copy failed');
}

async function handOff({ platform, prompt }, tab) {
  const target = targetById(platform);
  if (!tab || !target || target.kind === 'app' || typeof prompt !== 'string') throw new Error('Bad hand-off request');
  await copyText(prompt);
  if (target.kind === 'web') setTimeout(() => openNextTo(tab, target.url), OPEN_DELAY);
  return { ok: true };
}

// ---- Gmail's session key (bulk reads) ----

// content.js reads several threads from Gmail's print view, which needs the
// page's ik. It lives in the page's own scripts (window.GLOBALS), out of the
// content script's reach, so it is read in the page's world of the top frame.
async function gmailKey(tab) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [0] },
    world: 'MAIN',
    func: () => window.GLOBALS && window.GLOBALS[9],
  });
  const ik = res?.result;
  return { ok: true, ik: typeof ik === 'string' && IK_PATTERN.test(ik) ? ik : null };
}

const ACTIONS = { handoff: handOff, ik: (_msg, tab) => gmailKey(tab) };

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.target !== 'background' || !Object.hasOwn(ACTIONS, msg.action)) return;
  if (!sender.tab || !sender.url?.startsWith(GMAIL)) return reply({ ok: false, error: 'Not from Gmail' });
  ACTIONS[msg.action](msg, sender.tab).then(reply, (e) => reply({ ok: false, error: e?.message || String(e) }));
  return true;
});
