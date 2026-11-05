// Loads the Firefox package into headless Firefox next to a Gmail tab that is already open, and checks
// what only a real Firefox shows. Two runs, each with a new throwaway profile under tests/.out/package/tmp:
//
//   install  The Gmail tab is open first. Firefox accepts the package, background.js runs as a background
//            page and opens the settings page, which renders. Firefox adds the content script to the open
//            tab itself. Firefox's own right-click menu shows the chosen AIs and picking one reaches the
//            content script, Gmail's row menu shows the bulk items, background.js reads Gmail's session
//            key in the page's main world, and a bulk copy puts the expected text on the clipboard: the
//            test pastes it back with a real Cmd+V or Ctrl+V, after putting a marker on the clipboard
//            before each copy. Ask Claude copies and opens claude.ai in a new tab, and Open in Claude Code
//            hands its link to Firefox from Gmail's row menu and from Firefox's own menu, with the Gmail
//            tab left on Gmail.
//   update   The same files with a lower version number are installed first, then this package replaces
//            them, as the next update from addons.mozilla.org will. The open tab keeps working without a
//            reload and the menu shows the new items once.
//
// Firefox is driven over WebDriver BiDi (--remote-debugging-port): webExtension.install loads the unpacked
// folder as a temporary add-on, and network interception answers every https://mail.google.com/* request
// with the mock in mock-gmail.mjs and fails every other request, so nothing leaves the machine; a proxy
// that leads nowhere catches anything else. Scripts run in the extension's own settings page, and in
// Firefox's window to pick an item in its right-click menu and to ask the add-on manager for the active
// version; both need MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1 in Firefox's environment. The profile tells Firefox
// never to pass claude:// or codex:// links to an app, so no desktop app starts, whatever this computer
// has installed. Writes its report to tests/.out/package/firefox.json.
//
//   node tests/package/firefox.mjs        the Firefox files built from the repository (nothing written to dist/)
//   node tests/package/firefox.mjs DIR    an unpacked Firefox package, for example the unzipped release
//
// FIREFOX picks the Firefox binary (see tests/lib/firefox.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { REPO, OUT_ROOT } from '../lib/chrome.mjs';
import { findFirefox, startFirefox } from '../lib/firefox.mjs';
import { TITLE, IK, GMAIL_PAGE, printView, BULK, TARGETS_SET } from './mock-gmail.mjs';
import { packageFiles } from '../../scripts/package.mjs';

const OUT = path.join(OUT_ROOT, 'package');
const TMP = path.join(OUT, 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const tempDir = (name) => fs.mkdtempSync(path.join(TMP, `firefox-${name}-`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RUN_MS = 120000;

// ---- The package under test ----

const writeFiles = (dir, entries) => {
  for (const { name, data } of entries) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), data);
  }
};
const readTree = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? readTree(p, base) : [{ name: path.relative(base, p).split(path.sep).join('/'), data: fs.readFileSync(p) }];
  });

let SRC = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (SRC && !fs.existsSync(path.join(SRC, 'manifest.json'))) {
  console.error(`Usage: node tests/package/firefox.mjs [DIR], where DIR holds an unpacked Firefox package (got "${process.argv[2]}").`);
  process.exit(2);
}
if (!SRC) {
  SRC = tempDir('package');
  writeFiles(SRC, packageFiles('firefox').entries);
}
const ENTRIES = readTree(SRC);
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const GECKO_ID = manifest.browser_specific_settings?.gecko?.id;
if (!GECKO_ID || !manifest.background?.scripts) {
  console.error(`FAIL  ${SRC} is not a Firefox package (no browser_specific_settings.gecko.id or background.scripts). Build one with node scripts/package.mjs --target firefox.`);
  process.exit(1);
}
// A fixed internal UUID, so the settings page's moz-extension:// origin is known before the install.
const UUID = '6f1c2b0e-0a4d-4c55-9a51-3c1f0e7a9b21';
const BASE = `moz-extension://${UUID}/`;
const OPTIONS = BASE + (manifest.options_ui?.page || manifest.options_page);

const FIREFOX = findFirefox();
const PREFS = {
  'extensions.webextensions.uuids': JSON.stringify({ [GECKO_ID]: UUID }),
  // Requests the interception does not answer go to a proxy that does not exist.
  'network.proxy.type': 1,
  'network.proxy.http': '127.0.0.1',
  'network.proxy.http_port': 9,
  'network.proxy.ssl': '127.0.0.1',
  'network.proxy.ssl_port': 9,
  'network.proxy.no_proxies_on': '',
  'network.proxy.allow_hijacking_localhost': true,
  // Firefox stops claude:// and codex:// links here, after the tab has taken them and before any app could
  // start. Whether an app is registered for the scheme still decides what Firefox does with the tab.
  'network.protocol-handler.external.claude': false,
  'network.protocol-handler.external.codex': false,
};

const report = { source: path.relative(REPO, SRC) || '.', version: manifest.version, firefox: FIREFOX, firefoxVersion: null, steps: [], printViewRequests: [], otherRequests: [], logErrors: [], firefoxErrors: [], copyRoute: {} };
function step(what, ok, detail) {
  report.steps.push({ what, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${!ok && detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 600)}` : ''}`);
}

// Firefox writes errors from extension scripts to its own output; these lines name the extension's files.
const extensionErrors = (out) => out.split('\n').filter((l) => /^JavaScript error: moz-extension:\/\//.test(l));

// "140.0" <= "159.0.1"
const versionAtLeast = (have, want) => {
  const a = String(have).split('.').map((n) => parseInt(n, 10) || 0);
  const b = String(want).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return true;
};

// ---- Firefox over WebDriver BiDi ----

async function withFirefox(label, run) {
  let ff;
  const s = { label, gmail: null, events: [] };
  const watchdog = new Promise((_, reject) => setTimeout(() => reject(new Error(`no result within ${RUN_MS / 1000} s`)), RUN_MS).unref());
  try {
    ff = await startFirefox({ binary: FIREFOX, profile: tempDir('profile'), prefs: PREFS, env: { MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' } });
    report.firefoxVersion = ff.version;
    s.send = ff.send;
    ff.on((m) => {
      if (m.method === 'network.beforeRequestSent' && m.params.isBlocked) {
        const { request } = m.params.request;
        const url = new URL(m.params.request.url);
        if (url.hostname !== 'mail.google.com') {
          report.otherRequests.push({ phase: label, url: url.href });
          return ff.send('network.failRequest', { request }).catch(() => {});
        }
        let body = GMAIL_PAGE;
        if (url.searchParams.get('view') === 'pt') {
          report.printViewRequests.push({ phase: label, url: url.href, method: m.params.request.method });
          body = printView(url.searchParams.get('th'));
        }
        const headers = [{ name: 'Content-Type', value: { type: 'string', value: 'text/html; charset=utf-8' } }];
        return ff.send('network.provideResponse', { request, statusCode: 200, reasonPhrase: 'OK', headers, body: { type: 'string', value: body } }).catch(() => {});
      }
      if (m.method === 'log.entryAdded' && m.params.level === 'error') report.logErrors.push({ phase: label, text: m.params.text?.slice(0, 300), source: m.params.source?.context });
      if (m.method?.startsWith('browsingContext.')) s.events.push({ ev: m.method, context: m.params.context, url: m.params.url });
    });
    await ff.send('session.subscribe', { events: ['network.beforeRequestSent', 'log.entryAdded', 'browsingContext'] });
    await ff.send('network.addIntercept', { phases: ['beforeRequestSent'], urlPatterns: [{ type: 'pattern', protocol: 'https' }, { type: 'pattern', protocol: 'http' }] });

    s.tabs = async () => (await ff.send('browsingContext.getTree', { maxDepth: 0 })).contexts;
    s.evalIn = async (context, expression) => {
      const r = await ff.send('script.evaluate', { expression, target: { context }, awaitPromise: true, resultOwnership: 'none' });
      if (r.type === 'exception') throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };
    // The settings page, once the extension has opened it.
    s.settings = async () => {
      for (let i = 0; i < 100; i++) {
        const tab = (await s.tabs()).find((c) => c.url === OPTIONS);
        if (tab) return tab.context;
        await sleep(100);
      }
      return null;
    };
    // Firefox's own window, to ask the add-on manager which version is active.
    s.browserWindow = async () => (await ff.send('browsingContext.getTree', { maxDepth: 0, 'moz:scope': 'chrome' })).contexts[0].context;
    s.install = async (dir) => (await ff.send('webExtension.install', { extensionData: { type: 'path', path: dir } })).extension;
    s.openGmail = async () => {
      s.gmail = (await s.tabs())[0].context;
      await ff.send('browsingContext.navigate', { context: s.gmail, url: 'https://mail.google.com/mail/u/0/#inbox', wait: 'complete' });
    };
    s.front = () => ff.send('browsingContext.activate', { context: s.gmail });
    // Right-clicks the first ticked row (Gmail's own menu, as content.js sees it) and clicks our item with the label.
    s.rowMenu = async (label) => {
      await s.evalIn(s.gmail, `(() => { const t = document.querySelector('#r1 .bqe'); const r = t.getBoundingClientRect();
        t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + 2, clientY: r.top + 2 })); })()`);
      await sleep(500);
      const labels = JSON.parse(await s.evalIn(s.gmail, `JSON.stringify([...document.querySelectorAll('.vpa-item')].map((i) => i.textContent))`));
      if (!label) {
        await s.evalIn(s.gmail, `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        return { labels };
      }
      await s.evalIn(s.gmail, `(() => { const item = [...document.querySelectorAll('.vpa-item')].find((i) => i.textContent === ${JSON.stringify(label)});
        const inner = item?.querySelector('.J-N-Jz');
        for (const t of ['mousedown', 'mouseup', 'click']) inner?.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true })); })()`);
      let toast = '';
      for (let i = 0; i < 60 && !/^(Copied|Could not|The extension)/.test(toast); i++) {
        await sleep(100);
        toast = await s.evalIn(s.gmail, `document.getElementById('vpa-toast')?.textContent || ''`);
      }
      return { labels, toast };
    };
    // Puts MARK on the clipboard from an extension page, so that a paste after a copy that wrote nothing
    // shows the marker instead of what an earlier copy left there.
    s.mark = (page) => s.evalIn(page, `navigator.clipboard.writeText(${JSON.stringify(MARK)}).then(() => true, (e) => 'refused: ' + e.message)`);
    // A real right-click on the page, away from the rows (where the mock opens Gmail's own menu), opens
    // Firefox's own menu.
    s.openFirefoxMenu = async () => {
      await s.front();
      await ff.send('input.performActions', { context: s.gmail, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', x: 400, y: 400 }, { type: 'pointerDown', button: 2 }, { type: 'pointerUp', button: 2 }] }] });
      await ff.send('input.releaseActions', { context: s.gmail });
      await sleep(800);
    };
    // Picks our item with the label in Firefox's open menu, from Firefox's window. The click goes to
    // background.js (contextMenus.onClicked), which asks the content script in the tab to run it.
    s.pickFirefoxMenu = async (label) =>
      s.evalIn(await s.browserWindow(), `(() => {
        const menu = document.getElementById('contentAreaContextMenu');
        const item = [...menu.querySelectorAll('menuitem')].find((m) => m.label === ${JSON.stringify(label)});
        if (!item) return 'no item; menu is ' + menu.state;
        // Several items from one extension sit in a submenu named after it, so the item is picked by its command.
        const group = item.closest('menu')?.label ?? '';
        item.doCommand();
        menu.hidePopup();
        return 'picked from ' + (group || 'the top level');
      })()`);
    s.escape = async () => {
      await ff.send('input.performActions', { context: s.gmail, actions: [{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: '\uE00C' }, { type: 'keyUp', value: '\uE00C' }] }] });
      await ff.send('input.releaseActions', { context: s.gmail });
    };
    // Pastes the clipboard into a textarea in the Gmail tab with a real key press, as a user would.
    s.paste = async () => {
      await s.front();
      await s.evalIn(s.gmail, `(() => { let t = document.getElementById('paste-here'); if (!t) { t = document.createElement('textarea'); t.id = 'paste-here';
        t.style.cssText = 'position:fixed; bottom:0; right:0; width:200px; height:60px'; document.body.append(t); } t.value = ''; t.focus(); })()`);
      const mod = process.platform === 'darwin' ? '\uE03D' : '\uE009'; // Meta (Cmd) or Control
      await ff.send('input.performActions', { context: s.gmail, actions: [{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: mod }, { type: 'keyDown', value: 'v' }, { type: 'keyUp', value: 'v' }, { type: 'keyUp', value: mod }] }] });
      await ff.send('input.releaseActions', { context: s.gmail });
      await sleep(300);
      return s.evalIn(s.gmail, `document.getElementById('paste-here').value`);
    };

    await Promise.race([run(s), watchdog]);
  } catch (e) {
    step(`${label}: ran to the end`, false, e.message);
  } finally {
    if (ff) {
      report.firefoxErrors.push(...extensionErrors(ff.stderr()).map((text) => ({ phase: label, text: text.slice(0, 300) })));
      await ff.close();
    }
  }
}

// What a bulk copy of the two ticked rows must put on the clipboard.
const bulkTextOk = (text) =>
  typeof text === 'string' &&
  text.startsWith('Here are 2 email threads from my inbox.') &&
  ['Mailbox: tester@example.com', 'Pallet order for Fernhill', 'Invoice 4471', 'Thread 19a0b1c2d3e4f501: Hello & welcome.', 'Thread 19a0b1c2d3e4f502: Hello & welcome.'].every((part) => text.includes(part));

const MARK = 'Clipboard marker: nothing has been copied since.';

// Watches the background page's execCommand fallback, to report which route Firefox allowed. Only the
// fallback is wrapped: a wrapper is a function of the settings page, and Firefox could judge a clipboard
// call made through it by that page instead of the background page. The wrapper only counts. Firefox can
// unload an idle background page and start a new one, which would count from 0 again, so the page also
// gets a token: a count is evidence only while the token is the one the watch began with.
const WATCH_FALLBACK = `(async () => {
  const bg = await chrome.runtime.getBackgroundPage();
  if (bg.__fallbackCalls === undefined) {
    bg.__fallbackCalls = 0;
    bg.__fallbackToken = Math.random().toString(36).slice(2);
    const exec = bg.document.execCommand.bind(bg.document);
    bg.document.execCommand = (...a) => (bg.__fallbackCalls++, exec(...a));
  }
  return JSON.stringify({ calls: bg.__fallbackCalls, token: bg.__fallbackToken });
})()`;

// Records the background page's tabs.update calls (the scheme of each URL only), with a token as above.
// Gmail opened with tabs.update to a claude:// link that no app handles shows Firefox's error page.
const WATCH_TAB_UPDATES = `(async () => {
  const bg = await chrome.runtime.getBackgroundPage();
  if (bg.__tabUpdates === undefined) {
    bg.__tabUpdates = [];
    bg.__tabUpdatesToken = Math.random().toString(36).slice(2);
    const update = bg.chrome.tabs.update.bind(bg.chrome.tabs);
    bg.__tabUpdateWrapper = (...a) => (bg.__tabUpdates.push(String(a[1]?.url ?? a[0]?.url).split(':')[0]), update(...a));
    bg.chrome.tabs.update = bg.__tabUpdateWrapper;
  }
  return JSON.stringify({ calls: bg.__tabUpdates, token: bg.__tabUpdatesToken, wrapped: bg.chrome.tabs.update === bg.__tabUpdateWrapper });
})()`;

// ---- install: the Gmail tab is open first ----

await withFirefox('install', async (s) => {
  step(`install: Firefox ${report.firefoxVersion} meets the package's strict_min_version ${manifest.browser_specific_settings.gecko.strict_min_version}`, versionAtLeast(report.firefoxVersion, manifest.browser_specific_settings.gecko.strict_min_version), report.firefoxVersion);
  await s.openGmail();
  step('install: mock Gmail tab open before the install (served locally)', (await s.evalIn(s.gmail, 'document.title')) === TITLE);
  step('install: no content script in it yet', (await s.evalIn(s.gmail, `!document.getElementById('vpa-toast')`)) === true);

  const id = await s.install(SRC);
  step(`install: Firefox accepts ${manifest.name} ${manifest.version} as ${GECKO_ID} (webExtension.install)`, id === GECKO_ID, id);
  const settings = await s.settings();
  step('install: background.js runs as a background page and opens the settings page on install', !!settings, (await s.tabs()).map((c) => c.url));
  if (!settings) return;
  const page = JSON.parse(
    await s.evalIn(settings, `document.fonts.ready.then(() => JSON.stringify({ tiles: document.querySelectorAll('#tiles .tile').length, version: chrome.runtime.getManifest().version,
      loaded: [...document.fonts].filter((f) => f.status === 'loaded').length, failed: [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family + ' ' + f.weight) }))`),
  );
  step('install: the settings page renders its tiles with its fonts', page.tiles > 0 && page.loaded > 0 && !page.failed.length && page.version === manifest.version, page);

  let toasts = 0;
  for (let i = 0; i < 50 && !toasts; i++, await sleep(100)) toasts = await s.evalIn(s.gmail, `document.querySelectorAll('#vpa-toast').length`);
  await sleep(500); // time for a second copy to show up, if there were one
  toasts = await s.evalIn(s.gmail, `document.querySelectorAll('#vpa-toast').length`);
  step('install: Firefox adds the content script to the open Gmail tab without a reload (one toast element)', toasts === 1, toasts);

  await s.evalIn(settings, `chrome.storage.sync.set({ targets: ${JSON.stringify(TARGETS_SET)} }).then(() => 1)`);
  await sleep(800);
  // contextMenus.update fails for an id that does not exist, so it shows which items background.js made.
  const probe = JSON.parse(
    await s.evalIn(settings, `Promise.all(${JSON.stringify([...TARGETS_SET, 'chatgpt', 'gemini'])}.map((id) => chrome.contextMenus.update(id, {}).then(() => true, () => false))).then((a) => JSON.stringify(a))`),
  );
  step('install: background.js rebuilt the menu items for the chosen AIs only (storage.sync change)', JSON.stringify(probe) === JSON.stringify([true, true, true, true, false, false]), probe);

  const marked = await s.mark(settings);
  const control = marked === true ? await s.paste() : null;
  step('install: a marker written to the clipboard from the settings page pastes back, so each copy below starts from it', marked === true && control === MARK, { marked, control });

  const watch = JSON.parse(await s.evalIn(settings, WATCH_FALLBACK));
  await s.mark(settings);
  // The install opened the settings page in front; work in the Gmail tab, as a user would.
  await s.front();
  const copy = await s.rowMenu('Copy 2 emails for any AI');
  step("install: two ticked rows give the bulk items in Gmail's row menu", JSON.stringify(copy.labels) === JSON.stringify(BULK), copy.labels);
  const views = report.printViewRequests.filter((r) => r.phase === 'install');
  step("install: background.js reads Gmail's session key in the page's main world, and the bulk read uses it for both print views", views.length === 2 && views.every((r) => r.method === 'GET' && new RegExp(`^https://mail\\.google\\.com/mail/u/0/\\?ik=${IK}&view=pt&search=all&th=19a0b1c2d3e4f50[12]$`).test(r.url)), views);
  step('install: bulk copy ends with the copied toast', /^Copied 2 emails\. Paste them into any AI with (Cmd|Ctrl)\+V\.$/.test(copy.toast), copy.toast);
  const pasted = await s.paste();
  report.pasted = pasted;
  step('install: the clipboard holds both threads (pasted back with a real key press)', bulkTextOk(pasted), pasted.slice(0, 300));
  const watched = JSON.parse(await s.evalIn(settings, WATCH_FALLBACK));
  const sameBg = watched.token === watch.token;
  const fallbackCalls = watched.calls;
  report.copyRoute = { route: !sameBg ? 'an unknown route (the background page was restarted, so the count was lost)' : fallbackCalls ? 'execCommand' : 'navigator.clipboard.writeText', fallbackCalls, sameBackgroundPage: sameBg };
  step(`install: background.js copied with ${report.copyRoute.route} (the execCommand fallback ran ${fallbackCalls} times), with no offscreen document`, bulkTextOk(pasted) && sameBg && fallbackCalls <= 1, report.copyRoute);

  const tabsBefore = new Set((await s.tabs()).map((c) => c.context));
  await s.mark(settings);
  await s.front();
  const ask = await s.rowMenu('Ask Claude about 2 emails');
  step('install: Ask Claude copies and says it is opening Claude', /^Copied 2 emails\. Opening Claude: press (Cmd|Ctrl)\+V, then Enter\.$/.test(ask.toast), ask.toast);
  await sleep(2500);
  const opened = (await s.tabs()).filter((c) => !tabsBefore.has(c.context));
  const claudeTab = s.events.find((e) => e.ev === 'browsingContext.navigationStarted' && e.url === 'https://claude.ai/new');
  step('install: claude.ai/new opens in one new tab (the request is stopped locally)', opened.length === 1 && !!claudeTab && claudeTab.context === opened[0].context, { opened: opened.map((c) => c.url), claudeTab });
  step('install: the clipboard holds both threads for Claude', bulkTextOk(await s.paste()));

  await s.front();
  const desktop = await s.rowMenu('Open 2 in Claude Code');
  await sleep(1000);
  const link = s.events.find((e) => e.ev === 'browsingContext.navigationStarted' && e.url?.startsWith('claude://code/new?q='));
  step('install: Open 2 in Claude Code hands a claude://code/new link to Firefox, from the Gmail tab', !!link && link.context === s.gmail && /19a0b1c2d3e4f501/.test(decodeURIComponent(link.url)), link?.url?.slice(0, 200) ?? desktop);
  step('install: the Gmail tab stays on Gmail afterwards', (await s.tabs()).find((c) => c.context === s.gmail)?.url.startsWith('https://mail.google.com/'));

  // Firefox's own menu comes last: picking an item in it is user input, which could let a later copy pass
  // even without the clipboardWrite permission, so the copies above run before any of it.
  await s.evalIn(settings, `(window.__shown = [], chrome.contextMenus.onShown.addListener((info) => window.__shown.push({ ids: info.menuIds, contexts: info.contexts, pageUrl: info.pageUrl })), 1)`);
  await s.openFirefoxMenu();
  const shown = JSON.parse(await s.evalIn(settings, 'JSON.stringify(window.__shown)'));
  step("install: Firefox's own right-click menu in the Gmail tab shows the chosen AIs, in order", shown.length === 1 && JSON.stringify(shown[0].ids) === JSON.stringify(TARGETS_SET) && /^https:\/\/mail\.google\.com\//.test(shown[0].pageUrl), shown);
  // The right-click was not on an email, so the content script answers with its "open the email first" note.
  const picked = await s.pickFirefoxMenu('Copy thread for any AI');
  const NO_THREAD = 'Open the email first, then right-click inside it.';
  let note = '';
  for (let i = 0; i < 30 && note !== NO_THREAD; i++) {
    await sleep(100);
    note = await s.evalIn(s.gmail, `document.getElementById('vpa-toast')?.textContent || ''`);
  }
  step(`install: picking an item in Firefox's menu (${picked}) reaches background.js and the content script in the tab`, picked.startsWith('picked') && note === NO_THREAD, { picked, note });
  await s.escape();

  // Open thread in Claude Code from Firefox's menu, inside an open email (a heading as Gmail marks an open
  // thread). In Firefox the content script clicks the link, as from the row menu, and background.js leaves
  // the tab alone: tabs.update with a claude:// link that no app handles puts Firefox's error page in place
  // of Gmail. Where an app is registered, the profile's prefs stop Firefox before it starts the app.
  const registered = await s.evalIn(await s.browserWindow(), `Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService).externalProtocolHandlerExists('claude')`);
  await s.evalIn(s.gmail, `(() => { const h = document.createElement('h2'); h.dataset.legacyThreadId = '19a0b1c2d3e4f501'; h.textContent = 'Re: Pallet order for Fernhill'; document.body.prepend(h); return 1; })()`);
  const updates = JSON.parse(await s.evalIn(settings, WATCH_TAB_UPDATES));
  const from = s.events.length;
  await s.openFirefoxMenu();
  const pickedApp = await s.pickFirefoxMenu('Open thread in Claude Code');
  let menuLink;
  for (let i = 0; i < 30 && !menuLink; i++) {
    await sleep(100);
    menuLink = s.events.slice(from).find((e) => e.ev === 'browsingContext.navigationStarted' && e.url?.startsWith('claude://code/new?q='));
  }
  await sleep(1500); // time for an error page to replace Gmail, if one were coming
  const updated = JSON.parse(await s.evalIn(settings, WATCH_TAB_UPDATES));
  const route = { picked: pickedApp, wrapped: updates.wrapped, sameBackgroundPage: updated.token === updates.token, tabsUpdate: updated.calls };
  step(
    `install: Open thread in Claude Code from Firefox's menu (${pickedApp}): the content script hands a claude://code/new link for the open email to Firefox from the Gmail tab, and background.js calls no tabs.update`,
    pickedApp.startsWith('picked') && !!menuLink && menuLink.context === s.gmail && /19a0b1c2d3e4f501/.test(decodeURIComponent(menuLink.url)) && updates.wrapped && route.sameBackgroundPage && !updated.calls.length,
    { ...route, link: menuLink?.url?.slice(0, 120) },
  );
  const gmailUrl = (await s.tabs()).find((c) => c.context === s.gmail)?.url || '';
  const gmailTitle = gmailUrl.startsWith('https://mail.google.com/') ? await s.evalIn(s.gmail, 'document.title') : '';
  step(
    `install: the Gmail tab stays on Gmail afterwards (claude:// ${registered ? 'has an app on this computer, so this step would pass even with tabs.update; the one above checks the route' : 'has no app on this computer, where tabs.update would show an error page'})`,
    gmailTitle === TITLE && !s.events.slice(from).some((e) => e.context === s.gmail && /^about:neterror/.test(e.url || '')),
    { gmailUrl, events: s.events.slice(from).filter((e) => e.context === s.gmail).map((e) => `${e.ev} ${String(e.url).slice(0, 60)}`) },
  );
});

// ---- update: a lower version first, then this package ----

await withFirefox('update', async (s) => {
  const older = tempDir('older');
  writeFiles(older, ENTRIES.map((e) => (e.name === 'manifest.json' ? { name: e.name, data: Buffer.from(JSON.stringify({ ...manifest, version: '1.2.99' }, null, 2)) } : e)));
  await s.openGmail();
  await s.install(older);
  const settings = await s.settings();
  step('update: version 1.2.99 of the same files installed and running', !!settings && (await s.evalIn(settings, 'chrome.runtime.getManifest().version')) === '1.2.99');
  await s.evalIn(settings, `chrome.storage.sync.set({ targets: ${JSON.stringify(TARGETS_SET)} }).then(() => 1)`);
  await sleep(800);
  await s.front();
  const before = await s.rowMenu();
  step("update: 1.2.99's items are in Gmail's row menu", JSON.stringify(before.labels) === JSON.stringify(BULK), before.labels);

  // The marker goes on with 1.2.99's settings page, which the update closes.
  await s.mark(settings);
  const errorsBefore = report.logErrors.length;
  const id = await s.install(SRC);
  step('update: the package installs over it with the same add-on id', id === GECKO_ID, id);
  await sleep(2000);
  // Firefox closes the old version's pages. An install would open the settings page again; an update does not.
  const tabs = await s.tabs();
  const addon = JSON.parse(await s.evalIn(await s.browserWindow(), `ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs').AddonManager
    .getAddonByID(${JSON.stringify(GECKO_ID)}).then((a) => JSON.stringify({ version: a?.version, active: a?.isActive }))`));
  step(`update: ${manifest.version} is the active version, and no settings page opened (an update, not an install)`, addon.version === manifest.version && addon.active && !tabs.some((c) => c.url.startsWith(BASE)), { addon, tabs: tabs.map((c) => c.url) });
  step('update: one toast element in the Gmail tab', (await s.evalIn(s.gmail, `document.querySelectorAll('#vpa-toast').length`)) === 1);
  await s.front();
  const copy = await s.rowMenu('Copy 2 emails for any AI');
  step("update: Gmail's row menu shows the bulk items once (the old copy's items are not added)", JSON.stringify(copy.labels) === JSON.stringify(BULK), copy.labels);
  step('update: bulk copy works in the open tab with no reload', /^Copied 2 emails\. Paste them into any AI with (Cmd|Ctrl)\+V\.$/.test(copy.toast), copy.toast);
  step('update: the clipboard holds both threads', bulkTextOk(await s.paste()));
  step('update: no script errors in the BiDi log since the update', report.logErrors.length === errorsBefore, report.logErrors);
});

step('no script errors from the extension in Firefox output or the BiDi log', !report.firefoxErrors.length && !report.logErrors.length, { firefox: report.firefoxErrors, log: report.logErrors });
// Every request from a tab to a host other than mail.google.com is failed before it is sent; the only one
// expected is the Claude tab that Ask Claude opens.
step('the only request to another host was claude.ai/new from Ask Claude, stopped before it was sent', report.otherRequests.length === 1 && report.otherRequests[0].url === 'https://claude.ai/new', report.otherRequests);

fs.writeFileSync(path.join(OUT, 'firefox.json'), JSON.stringify(report, null, 2));
const failed = report.steps.filter((x) => !x.ok).length;
console.log(`\n${report.steps.length - failed}/${report.steps.length} steps passed for ${manifest.name} ${manifest.version} in Firefox ${report.firefoxVersion} from ${SRC}. Report: ${path.relative(REPO, path.join(OUT, 'firefox.json'))}`);
process.exitCode = failed ? 1 : 0;
