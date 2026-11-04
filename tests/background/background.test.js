// Part A: background.js + offscreen.js under Node vm with a stubbed chrome.*.
// Run: node --test --test-reporter=spec tests/background/background.test.js
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createWorld, dispatch, clone, tick, read } = require('./harness.js');

const eq = (actual, expected, msg) => assert.deepStrictEqual(clone(actual), expected, msg);
const GMAIL_TAB = { id: 7, index: 2, windowId: 3, url: 'https://mail.google.com/mail/u/0/#inbox/FMfcgzQ' };
const GMAIL_SENDER = { id: 'test-ext', tab: GMAIL_TAB, frameId: 0, url: 'https://mail.google.com/mail/u/0/#inbox/FMfcgzQ' };
// Chrome always sends pageUrl and frameId for page clicks; the guard needs pageUrl.
const click = (menuItemId) => ({ menuItemId, pageUrl: GMAIL_TAB.url, frameId: 0 });
// Web AIs open OPEN_DELAY (1200 ms) after the copy reply, so wait past it.
const afterOpenDelay = () => tick(1300);
const PROMPT = 'Help me with this email thread.\n\n<<<EMAIL THREAD\nSubject: Hi\nEMAIL THREAD>>>\néè \u{1F600} "quotes" <tags>';

const SPEC_TITLES = {
  'claude-code': 'Open thread in Claude Code',
  codex: 'Open thread in Codex',
  claude: 'Ask Claude about this thread',
  chatgpt: 'Ask ChatGPT about this thread',
  gemini: 'Ask Gemini about this thread',
  copilot: 'Ask Microsoft Copilot about this thread',
  perplexity: 'Ask Perplexity about this thread',
  grok: 'Ask Grok about this thread',
  mistral: 'Ask Le Chat (Mistral) about this thread',
  deepseek: 'Ask DeepSeek about this thread',
  copy: 'Copy thread for any AI',
};
const ALL_IDS = Object.keys(SPEC_TITLES);
const WEB_URLS = {
  claude: 'https://claude.ai/new',
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/app',
  copilot: 'https://copilot.microsoft.com/',
  perplexity: 'https://www.perplexity.ai/',
  grok: 'https://grok.com/',
  mistral: 'https://chat.mistral.ai/chat',
  deepseek: 'https://chat.deepseek.com/',
};

const unhandled = [];
process.on('unhandledRejection', (e) => unhandled.push(String(e?.message || e)));

const expectMenus = (w, ids) => {
  eq(w.menuList().map((m) => m.id), ids, 'menu ids');
  eq(w.menuTitles(), ids.map((id) => SPEC_TITLES[id]), 'menu titles');
  for (const m of w.menuList()) {
    // Page contexts only, so the items stay off the toolbar icon's menu.
    eq(m.contexts, ['page', 'frame', 'selection', 'link', 'editable', 'image'], `contexts for ${m.id}`);
    eq(m.documentUrlPatterns, ['https://mail.google.com/*'], `documentUrlPatterns for ${m.id}`);
  }
};

describe('static: manifest, targets, offscreen.html', () => {
  test('paste key follows the platform at load time', () => {
    const vm = require('node:vm');
    const keyFor = (navigator) => {
      const ctx = vm.createContext({ navigator });
      vm.runInContext(read('targets.js') + ';globalThis.__k = [PASTE_KEYS, TARGETS.find((t) => t.id === "grok").note];', ctx);
      return ctx.__k;
    };
    // A web AI's note is its address; the paste keys are given once for the group on the settings page.
    eq(keyFor({ platform: 'MacIntel' }), ['Cmd+V', 'grok.com']);
    eq(keyFor({ userAgentData: { platform: 'Windows' }, platform: 'Win32' })[0], 'Ctrl+V');
    eq(keyFor({ platform: 'Linux x86_64' })[0], 'Ctrl+V');
    eq(keyFor({ platform: '' })[0], 'Cmd+V (Ctrl+V)');
  });

  test('manifest matches the v1.1.1 spec', () => {
    const m = JSON.parse(read('manifest.json'));
    assert.equal(m.manifest_version, 3);
    assert.equal(m.version, '1.1.1');
    assert.equal(m.name, 'Open in AI Agent for Gmail');
    assert.equal(m.short_name, 'Open in AI Agent');
    assert.equal(
      m.description,
      'Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or another AI. Runs on your computer.',
    );
    assert.ok(m.description.length <= 132, `description ${m.description.length} chars`);
    eq(m.permissions, ['contextMenus', 'storage', 'offscreen', 'clipboardWrite']);
    assert.equal(m.host_permissions, undefined, 'no host permissions');
    eq(m.background, { service_worker: 'background.js' });
    assert.equal(m.options_page, 'options.html');
    assert.equal(m.options_ui, undefined, 'options_ui replaced');
    assert.ok(m.action && m.action.default_title && m.action.default_icon, 'action with title and icons');
    assert.equal(m.action.default_popup, undefined, 'no popup, so action.onClicked fires');
    eq(m.content_scripts[0].js, ['targets.js', 'content.js']);
    eq(m.content_scripts[0].matches, ['https://mail.google.com/*']);
    assert.equal(m.homepage_url, 'https://github.com/thomasoclegg/gmail-to-agent');
    assert.ok(m.icons['16'] && m.icons['48'] && m.icons['128']);
  });

  test('targets.js globals and labels follow the spec', () => {
    const ctx = vm.createContext({});
    vm.runInContext(read('targets.js'), ctx);
    const T = clone(vm.runInContext('TARGETS', ctx));
    eq(T.map((t) => t.id), ALL_IDS);
    eq(clone(vm.runInContext('DEFAULT_TARGETS', ctx)), ['claude', 'chatgpt']);
    eq(clone(vm.runInContext('LEGACY_TARGETS', ctx)), ['claude-code', 'codex']);
    // The donation is live.
    eq(clone(vm.runInContext('DONATION', ctx)), {
      charity: 'Friends of Larnaca Cats',
      about: 'a volunteer group that neuters, feeds and treats street cats in Larnaca, Cyprus',
      url: 'https://friends-of-larnaca-cats.weebly.com/donate.html?ref=ai-agent',
    });
    assert.equal(vm.runInContext('hasDonation()', ctx), true);
    for (const t of T) {
      assert.equal(t.chromeMenu, SPEC_TITLES[t.id], `chromeMenu ${t.id}`);
      if (t.kind === 'web') {
        assert.equal(t.url, WEB_URLS[t.id]);
        assert.equal(t.menu, `Ask ${t.name}`);
        assert.equal(t.note, new URL(t.url).hostname.replace(/^www\./, ''), `note is the address for ${t.id}`);
      }
    }
    assert.equal(T.find((t) => t.id === 'copy').note, 'Copies the whole thread so you can paste it into any AI.');
    assert.equal(T.find((t) => t.id === 'copy').menu, 'Copy thread for any AI');
    assert.equal(T.find((t) => t.id === 'claude-code').menu, 'Open in Claude Code');
    assert.equal(T.find((t) => t.id === 'codex').menu, 'Open in Codex');
    // pickTargets keeps TARGETS order and drops unknown ids / non-arrays
    eq(clone(vm.runInContext("pickTargets(['copy','nope','claude-code']).map(t=>t.id)", ctx)), ['claude-code', 'copy']);
    eq(clone(vm.runInContext("pickTargets('claude').map(t=>t.id)", ctx)), []);
  });

  test('offscreen.html has the textarea#clip and loads offscreen.js', () => {
    const html = read('offscreen.html');
    assert.match(html, /<textarea[^>]*id="clip"/);
    assert.match(html, /<script src="offscreen\.js"><\/script>/);
  });
});

describe('background: load', () => {
  test('importScripts loads targets.js and every listener registers at top level', () => {
    const w = createWorld();
    eq(w.log.filter((e) => e.ev === 'importScripts').map((e) => e.file), ['targets.js']);
    const c = w.chrome;
    assert.equal(c.runtime.onInstalled.listeners.length, 1);
    assert.equal(c.runtime.onStartup.listeners.length, 1);
    assert.equal(c.storage.onChanged.listeners.length, 1);
    assert.equal(c.action.onClicked.listeners.length, 1);
    assert.equal(c.contextMenus.onClicked.listeners.length, 1);
    assert.equal(c.runtime.onMessage.listeners.length, 1);
    assert.equal(typeof w.evalIn('menuQueue').then, 'function', 'menuQueue reachable for settle()');
  });
});

describe('background: install and update', () => {
  test('fresh install: writes DEFAULT_TARGETS, opens settings once, menus = Claude + ChatGPT', async () => {
    const w = createWorld();
    await w.chrome.runtime.onInstalled.fire({ reason: 'install' });
    await w.settle();
    eq(w.storage, { targets: ['claude', 'chatgpt'] });
    assert.equal(w.optionsOpened, 1);
    expectMenus(w, ['claude', 'chatgpt']);
    eq(w.dupErrors, []);
    eq(w.warnings, []);
  });

  test('fresh install with synced targets already present: keeps them, still opens settings', async () => {
    const w = createWorld({ storage: { targets: ['gemini', 'copy'] } });
    await w.chrome.runtime.onInstalled.fire({ reason: 'install' });
    await w.settle();
    eq(w.storage.targets, ['gemini', 'copy']);
    assert.equal(w.optionsOpened, 1);
    expectMenus(w, ['gemini', 'copy']);
  });

  test('update 1.0.0 -> 1.1.0, no targets, no folder: LEGACY_TARGETS and opens the what\'s-new page', async () => {
    const w = createWorld();
    // v1.0 menus that may still be registered
    w.menus.set('claude', { id: 'claude', title: 'Open thread in Claude Code' });
    w.menus.set('codex', { id: 'codex', title: 'Open thread in Codex (GPT)' });
    await w.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '1.0.0' });
    await w.settle();
    eq(w.storage.targets, ['claude-code', 'codex']);
    assert.equal(w.optionsOpened, 0);
    assert.equal(w.tabsCreated.filter((t) => /options\.html#new$/.test(t.url)).length, 1, 'what\'s-new tab opened once');
    expectMenus(w, ['claude-code', 'codex']);
    assert.ok(!w.menus.has('claude'), 'v1.0 "claude" item (Claude Code) removed');
    eq(w.dupErrors, []);
  });

  test('update 1.0.3 -> 1.1.0 with a folder set: LEGACY_TARGETS, what\'s-new page opened, folder kept', async () => {
    const w = createWorld({ storage: { folder: '/Users/me/Work' } });
    await w.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '1.0.3' });
    await w.settle();
    eq(w.storage, { folder: '/Users/me/Work', targets: ['claude-code', 'codex'] });
    assert.equal(w.optionsOpened, 0);
    assert.equal(w.tabsCreated.filter((t) => /options\.html#new$/.test(t.url)).length, 1, 'what\'s-new tab opened once');
    expectMenus(w, ['claude-code', 'codex']);
  });

  test('update 0.1.0 (first unpacked build) -> 1.1.0: treated as legacy, what\'s-new page opened', async () => {
    const w = createWorld();
    await w.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '0.1.0' });
    await w.settle();
    eq(w.storage.targets, ['claude-code', 'codex']);
    assert.equal(w.tabsCreated.filter((t) => /options\.html#new$/.test(t.url)).length, 1);
    expectMenus(w, ['claude-code', 'codex']);
  });

  test('update from 1.0.x when targets already synced: untouched, settings not opened', async () => {
    const w = createWorld({ storage: { targets: ['chatgpt'] } });
    await w.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '1.0.0' });
    await w.settle();
    eq(w.storage, { targets: ['chatgpt'] });
    assert.equal(w.optionsOpened, 0);
    assert.equal(w.log.filter((e) => e.ev === 'storage.set').length, 0);
    expectMenus(w, ['chatgpt']);
  });

  test('update from 1.1.x with no targets: DEFAULT_TARGETS, settings not opened', async () => {
    const w = createWorld();
    await w.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '1.1.0' });
    await w.settle();
    eq(w.storage.targets, ['claude', 'chatgpt']);
    assert.equal(w.optionsOpened, 0);
  });

  test('update keeps an explicitly empty selection ([]) and builds no menus', async () => {
    const w = createWorld({ storage: { targets: [] } });
    await w.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '1.1.0' });
    await w.settle();
    eq(w.storage.targets, []);
    eq(w.menuList(), []);
    assert.ok(w.menuOps.removeAll >= 1);
  });

  test('chrome_update / shared_module_update: no storage writes, no settings page, menus rebuilt', async () => {
    for (const reason of ['chrome_update', 'shared_module_update']) {
      const w = createWorld();
      await w.chrome.runtime.onInstalled.fire({ reason });
      await w.settle();
      eq(w.storage, {}, reason);
      assert.equal(w.optionsOpened, 0, reason);
      expectMenus(w, ['claude', 'chatgpt']); // falls back to DEFAULT_TARGETS when unset
    }
  });
});

describe('background: Chrome context menu rebuilds', () => {
  test('all 11 targets selected: spec titles, TARGETS order, Gmail-only pattern', async () => {
    const w = createWorld({ storage: { targets: [...ALL_IDS].reverse() } });
    await w.chrome.runtime.onStartup.fire();
    await w.settle();
    expectMenus(w, ALL_IDS);
  });

  test('unknown ids ignored, order follows TARGETS', async () => {
    const w = createWorld({ storage: { targets: ['copy', 'bogus', 'claude-code', 'grok'] } });
    await w.chrome.runtime.onStartup.fire();
    await w.settle();
    expectMenus(w, ['claude-code', 'grok', 'copy']);
  });

  test('non-array targets value does not crash, builds no menus', async () => {
    const w = createWorld({ storage: { targets: 'claude' } });
    await w.chrome.runtime.onStartup.fire();
    await w.settle();
    eq(w.menuList(), []);
    eq(w.warnings, []);
  });

  test('settings change rebuilds; folder-only or local-area changes do not', async () => {
    const w = createWorld({ storage: { targets: ['claude'] } });
    await w.chrome.runtime.onStartup.fire();
    await w.settle();
    const before = w.menuOps.removeAll;
    await w.chrome.storage.sync.set({ folder: '/x' });
    await w.settle();
    assert.equal(w.menuOps.removeAll, before, 'folder change: no rebuild');
    await w.chrome.storage.onChanged.fire({ targets: { newValue: ['copy'] } }, 'local');
    await w.settle();
    assert.equal(w.menuOps.removeAll, before, 'local area: no rebuild');
    await w.chrome.storage.sync.set({ targets: ['perplexity', 'claude-code'] });
    await w.settle();
    assert.equal(w.menuOps.removeAll, before + 1);
    expectMenus(w, ['claude-code', 'perplexity']);
  });

  test('rapid settings changes + startup + update events: no duplicate-id errors, final menus match final settings', async () => {
    for (let round = 0; round < 15; round++) {
      const w = createWorld({ storage: { targets: ['claude'] } });
      let last;
      const pending = [];
      for (let i = 0; i < 25; i++) {
        last = ALL_IDS.filter(() => Math.random() < 0.5);
        pending.push(w.chrome.storage.sync.set({ targets: last }));
        if (i % 6 === 0) pending.push(w.chrome.runtime.onStartup.fire());
        if (i % 9 === 0) pending.push(w.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '1.1.0' }));
        if (i % 4 === 0) await tick(Math.floor(Math.random() * 3));
      }
      await Promise.all(pending);
      await w.settle();
      eq(w.dupErrors, [], `round ${round}`);
      eq(w.warnings, [], `round ${round}`);
      expectMenus(w, last);
    }
  });

  test('control: the stub DOES report duplicates for an unqueued overlapping rebuild', async () => {
    // Same steps as buildMenus but two runs overlapping with no queue.
    const w = createWorld();
    const cm = w.raw.contextMenus;
    const naive = async (ids) => {
      await new Promise((r) => cm.removeAll(r));
      for (const id of ids) await new Promise((r) => cm.create({ id, title: id }, r));
    };
    await Promise.all([naive(['a', 'b', 'c']), naive(['a', 'b', 'c'])]);
    await w.raw.menuChainP();
    assert.ok(w.dupErrors.length > 0, 'stub detects the race it is meant to catch');
  });
});

describe('background: Chrome-menu clicks', () => {
  test('desktop target (Claude Code): asks content for the link, then tabs.update with it', async () => {
    const w = createWorld({ storage: { targets: ['claude-code', 'codex'] } });
    const url = 'claude://code/new?q=Work%20through%20this%20Gmail%20thread%20with%20me.';
    w.contentReply = () => ({ url });
    await w.chrome.contextMenus.onClicked.fire(click('claude-code'), GMAIL_TAB);
    eq(w.tabsMessages, [{ tabId: 7, msg: { target: 'content', action: 'run', platform: 'claude-code' }, options: { frameId: 0 } }]);
    eq(w.tabsUpdated, [{ tabId: 7, props: { url } }]);
    eq(w.tabsCreated, []);
    eq(w.createDocCalls, [], 'no clipboard work for desktop targets');
  });

  test('desktop target (Codex): codex:// link opened with tabs.update', async () => {
    const w = createWorld();
    const url = 'codex://threads/new?prompt=x&path=%2FUsers%2Fme';
    w.contentReply = () => ({ url });
    await w.chrome.contextMenus.onClicked.fire(click('codex'), GMAIL_TAB);
    eq(w.tabsUpdated, [{ tabId: 7, props: { url } }]);
  });

  test('reply with a non-deep-link URL, empty reply, or no content script: no deep link opened, no unhandled errors', async () => {
    const w = createWorld();
    for (const r of [{ url: 'https://evil.example/' }, { url: 'javascript:alert(1)' }, {}, undefined, null]) {
      w.contentReply = () => r;
      await w.chrome.contextMenus.onClicked.fire(click('claude-code'), GMAIL_TAB);
    }
    eq(w.tabsCreated, [], 'bad or empty replies open nothing');
    w.contentReply = () => new Error('Could not establish connection. Receiving end does not exist.');
    await w.chrome.contextMenus.onClicked.fire(click('claude-code'), GMAIL_TAB);
    await w.chrome.contextMenus.onClicked.fire(click('claude-code'), undefined);
    await tick(10);
    eq(w.tabsUpdated, []);
    // With no content script in the tab, the user gets a reload notice and a badge instead of silence.
    eq(w.tabsCreated, [{ url: 'chrome-extension://test-ext/options.html#reload', index: 3, openerTabId: 7, windowId: 3 }], 'reload notice next to Gmail');
    eq(w.badges, [{ badge: { tabId: 7, text: '!' } }, { title: { tabId: 7, title: 'Reload this Gmail tab to use Open in AI Agent' } }]);
    eq(unhandled, []);
  });

  test('web target end to end: run -> content replies {} -> handoff -> offscreen copy -> tabs.create next to Gmail', async () => {
    const w = createWorld();
    const replies = [];
    w.contentReply = (msg) => {
      // what content.js does for web/copy targets: reply {} and start the hand-off itself
      setTimeout(async () => {
        replies.push(await w.fromContent({ target: 'background', action: 'handoff', platform: msg.platform, prompt: PROMPT }, GMAIL_SENDER));
      }, 0);
      return {};
    };
    await w.chrome.contextMenus.onClicked.fire(click('claude'), GMAIL_TAB);
    for (let i = 0; i < 50 && !replies.length; i++) await tick(5);
    eq(replies, [{ ok: true }]);
    eq(w.tabsCreated, [], 'reply comes before the tab opens, so the paste hint shows in Gmail first');
    await afterOpenDelay();
    eq(w.tabsUpdated, [], 'web target never uses tabs.update');
    assert.equal(w.createDocCalls.length, 1);
    eq(w.createDocCalls[0].reasons, ['CLIPBOARD']);
    assert.equal(w.createDocCalls[0].url, 'offscreen.html');
    assert.ok(w.createDocCalls[0].justification.length > 10);
    const exec = w.offscreen.execCalls;
    assert.equal(exec.length, 1);
    assert.equal(exec[0].cmd, 'copy');
    assert.equal(exec[0].value, PROMPT, 'textarea held the exact prompt at copy time');
    assert.ok(exec[0].selected, 'select() happened before execCommand');
    assert.equal(w.clipboard, PROMPT);
    assert.equal(w.offscreen.textarea.value, '', 'textarea cleared after copy');
    eq(w.tabsCreated, [{ url: 'https://claude.ai/new', index: 3, openerTabId: 7, windowId: 3 }]);
    const order = w.log.map((e) => e.ev);
    assert.ok(order.indexOf('execCommand') < order.indexOf('tabs.create'), 'copy happens before the tab opens');
    // copy message shape
    const sm = w.log.find((e) => e.ev === 'runtime.sendMessage');
    eq({ target: sm.target, action: sm.action }, { target: 'offscreen', action: 'copy' });
  });

  test('every web target opens its own TARGETS url; offscreen doc created once and reused', async () => {
    const w = createWorld();
    for (const id of Object.keys(WEB_URLS)) {
      const r = await w.fromContent({ target: 'background', action: 'handoff', platform: id, prompt: `p-${id}`, url: 'https://evil.example/' }, GMAIL_SENDER);
      eq(r, { ok: true }, id);
    }
    await afterOpenDelay();
    assert.equal(w.createDocCalls.length, 1, 'created once');
    eq(w.tabsCreated.map((t) => t.url), Object.values(WEB_URLS), 'urls from TARGETS, never from the message');
    eq(w.offscreen.execCalls.map((c) => c.value), Object.keys(WEB_URLS).map((id) => `p-${id}`));
  });

  test('copy target: copies, opens nothing', async () => {
    const w = createWorld();
    const r = await w.fromContent({ target: 'background', action: 'handoff', platform: 'copy', prompt: PROMPT }, GMAIL_SENDER);
    eq(r, { ok: true });
    assert.equal(w.clipboard, PROMPT);
    eq(w.tabsCreated, []);
    eq(w.tabsUpdated, []);
  });

  test('copy target via Chrome menu: nothing opened, clipboard set', async () => {
    const w = createWorld();
    const replies = [];
    w.contentReply = (msg) => {
      setTimeout(async () => replies.push(await w.fromContent({ target: 'background', action: 'handoff', platform: msg.platform, prompt: 'x' }, GMAIL_SENDER)));
      return {};
    };
    await w.chrome.contextMenus.onClicked.fire(click('copy'), GMAIL_TAB);
    for (let i = 0; i < 50 && !replies.length; i++) await tick(5);
    eq(replies, [{ ok: true }]);
    eq(w.tabsCreated, []);
    eq(w.tabsUpdated, []);
    assert.equal(w.clipboard, 'x');
  });
});

describe('background: offscreen document lifecycle', () => {
  test('concurrent first hand-offs create the document only once', async () => {
    const w = createWorld();
    const rs = await Promise.all(
      ['claude', 'chatgpt', 'copy', 'gemini'].map((p) => w.fromContent({ target: 'background', action: 'handoff', platform: p, prompt: p }, GMAIL_SENDER)),
    );
    eq(rs, [{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
    assert.equal(w.createDocCalls.length, 1);
    assert.equal(w.offscreen.execCalls.length, 4);
  });

  test('"Only a single offscreen document" error is tolerated (stale hasDocument)', async () => {
    const w = createWorld();
    await w.fromContent({ target: 'background', action: 'handoff', platform: 'copy', prompt: 'one' }, GMAIL_SENDER);
    w.hasDocumentLiesOnce = true;
    const r = await w.fromContent({ target: 'background', action: 'handoff', platform: 'copy', prompt: 'two' }, GMAIL_SENDER);
    eq(r, { ok: true });
    assert.equal(w.createDocCalls.length, 2, 'second create attempted and rejected by Chrome');
    assert.equal(w.clipboard, 'two');
  });

  test('other createDocument errors: hand-off fails cleanly, next attempt retries', async () => {
    const w = createWorld();
    w.createDocFailOnce = 'Invalid reason';
    const r1 = await w.fromContent({ target: 'background', action: 'handoff', platform: 'claude', prompt: 'a' }, GMAIL_SENDER);
    eq(r1, { ok: false, error: 'Invalid reason' });
    await afterOpenDelay();
    eq(w.tabsCreated, [], 'no tab opened when the copy failed');
    const r2 = await w.fromContent({ target: 'background', action: 'handoff', platform: 'claude', prompt: 'b' }, GMAIL_SENDER);
    eq(r2, { ok: true });
    await afterOpenDelay();
    assert.equal(w.createDocCalls.length, 2);
    assert.equal(w.tabsCreated.length, 1);
  });

  test('document closed between hand-offs is recreated', async () => {
    const w = createWorld();
    await w.fromContent({ target: 'background', action: 'handoff', platform: 'copy', prompt: 'a' }, GMAIL_SENDER);
    await w.chrome.offscreen.closeDocument();
    const r = await w.fromContent({ target: 'background', action: 'handoff', platform: 'copy', prompt: 'b' }, GMAIL_SENDER);
    eq(r, { ok: true });
    assert.equal(w.createDocCalls.length, 2);
    assert.equal(w.clipboard, 'b');
  });

  test('fallback to runtime.getContexts when offscreen.hasDocument is missing', async () => {
    const w = createWorld({ noHasDocument: true });
    await w.fromContent({ target: 'background', action: 'handoff', platform: 'copy', prompt: 'a' }, GMAIL_SENDER);
    await w.fromContent({ target: 'background', action: 'handoff', platform: 'copy', prompt: 'b' }, GMAIL_SENDER);
    assert.ok(w.getContextsCalls.length >= 2);
    eq(w.getContextsCalls[0], { contextTypes: ['OFFSCREEN_DOCUMENT'] });
    assert.equal(w.createDocCalls.length, 1, 'reused via getContexts');
    assert.equal(w.clipboard, 'b');
  });

  test('copy blocked in offscreen (execCommand false): error returned, no tab opened', async () => {
    const w = createWorld();
    w.execResult = false;
    const r = await w.fromContent({ target: 'background', action: 'handoff', platform: 'gemini', prompt: 'a' }, GMAIL_SENDER);
    eq(r, { ok: false, error: 'Copy was blocked' });
    await afterOpenDelay();
    eq(w.tabsCreated, []);
  });

  test('offscreen listener throws: background reports failure, no tab opened', async () => {
    const w = createWorld();
    w.execThrows = true;
    const r = await w.fromContent({ target: 'background', action: 'handoff', platform: 'gemini', prompt: 'a' }, GMAIL_SENDER);
    assert.equal(r.ok, false);
    await afterOpenDelay();
    eq(w.tabsCreated, []);
  });
});

describe('background: message routing and refusals', () => {
  const refuse = async (msg, sender, expectedError) => {
    const w = createWorld();
    const r = await w.fromContent(msg, sender);
    assert.equal(r?.ok, false, JSON.stringify(msg));
    if (expectedError) assert.equal(r.error, expectedError);
    eq(w.createDocCalls, [], 'nothing copied');
    eq(w.tabsCreated, [], 'nothing opened');
  };
  test('app targets are refused on the hand-off route', () => refuse({ target: 'background', action: 'handoff', platform: 'claude-code', prompt: 'x' }, GMAIL_SENDER, 'Bad hand-off request'));
  test('unknown platform refused', () => refuse({ target: 'background', action: 'handoff', platform: 'evil', prompt: 'x' }, GMAIL_SENDER, 'Bad hand-off request'));
  test('non-string prompt refused', () => refuse({ target: 'background', action: 'handoff', platform: 'claude', prompt: { a: 1 } }, GMAIL_SENDER, 'Bad hand-off request'));
  test('sender not on Gmail refused', () =>
    refuse({ target: 'background', action: 'handoff', platform: 'claude', prompt: 'x' }, { tab: GMAIL_TAB, url: 'https://evil.example/' }, 'Not from Gmail'));
  test('look-alike host refused (mail.google.com.evil.com)', () =>
    refuse({ target: 'background', action: 'handoff', platform: 'claude', prompt: 'x' }, { tab: GMAIL_TAB, url: 'https://mail.google.com.evil.com/x' }, 'Not from Gmail'));
  test('sender without a tab (extension page) refused', () =>
    refuse({ target: 'background', action: 'handoff', platform: 'claude', prompt: 'x' }, { id: 'test-ext', url: 'https://mail.google.com/' }, 'Not from Gmail'));

  test('background ignores messages addressed to the offscreen document or content', () => {
    const w = createWorld();
    for (const msg of [
      { target: 'offscreen', action: 'copy', text: 'x' },
      { target: 'content', action: 'run', platform: 'claude' },
      { target: 'background', action: 'something-else' },
      { action: 'handoff', platform: 'claude', prompt: 'x' },
      null,
      'string',
    ]) {
      const { ret, calls } = w.toBackgroundOnly(msg, GMAIL_SENDER);
      assert.deepStrictEqual(ret, [undefined], `listener returns undefined for ${JSON.stringify(msg)}`);
      eq(calls, [], `no reply for ${JSON.stringify(msg)}`);
    }
    eq(w.createDocCalls, []);
  });

  test('handoff listener keeps the channel open (returns true)', () => {
    const w = createWorld();
    const { ret } = w.toBackgroundOnly({ target: 'background', action: 'handoff', platform: 'copy', prompt: 'x' }, GMAIL_SENDER);
    assert.deepStrictEqual(ret, [true]);
  });
});

describe('background: toolbar icon', () => {
  test('action click opens the settings page', async () => {
    const w = createWorld();
    await w.chrome.action.onClicked.fire({ id: 1, url: 'https://example.com/' });
    assert.equal(w.optionsOpened, 1);
  });
});

describe('offscreen.js on its own', () => {
  const load = (execResult = true) => {
    const calls = [];
    const textarea = { value: '', select() { this.sel = this.value; } };
    const ev = { listeners: [], addListener(fn) { this.listeners.push(fn); } };
    const ctx = vm.createContext({
      chrome: { runtime: { onMessage: ev } },
      document: {
        getElementById: (id) => (id === 'clip' ? textarea : null),
        execCommand: (cmd) => (calls.push({ cmd, value: textarea.value, sel: textarea.sel }), execResult),
      },
    });
    vm.runInContext(read('offscreen.js'), ctx, { filename: 'offscreen.js' });
    return { calls, textarea, listeners: ev.listeners };
  };

  test('copies the text, replies {ok:true} synchronously, clears the textarea', async () => {
    const o = load();
    assert.equal(o.listeners.length, 1);
    const r = await dispatch(o.listeners, { target: 'offscreen', action: 'copy', text: PROMPT }, {});
    eq(r, { ok: true });
    eq(o.calls, [{ cmd: 'copy', value: PROMPT, sel: PROMPT }]);
    assert.equal(o.textarea.value, '');
  });

  test('replies {ok:false} when the copy is blocked', async () => {
    const o = load(false);
    eq(await dispatch(o.listeners, { target: 'offscreen', action: 'copy', text: 'x' }, {}), { ok: false, error: 'Copy was blocked' });
  });

  test('non-string text is coerced; missing text copies an empty string', async () => {
    const o = load();
    await dispatch(o.listeners, { target: 'offscreen', action: 'copy', text: 42 }, {});
    await dispatch(o.listeners, { target: 'offscreen', action: 'copy' }, {});
    eq(o.calls.map((c) => c.value), ['42', '']);
  });

  test('ignores messages for background/content and unknown actions (no reply, no copy)', () => {
    const o = load();
    for (const msg of [
      { target: 'background', action: 'handoff', platform: 'claude', prompt: 'x' },
      { target: 'content', action: 'run' },
      { target: 'offscreen', action: 'paste' },
      undefined,
    ]) {
      const replies = [];
      const ret = o.listeners[0](msg, {}, (r) => replies.push(r));
      assert.equal(ret, undefined);
      eq(replies, []);
    }
    eq(o.calls, []);
  });
});

test('no unhandled promise rejections across the run', async () => {
  await tick(50);
  eq(unhandled, []);
});
