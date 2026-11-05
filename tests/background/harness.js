// Loads the REAL targets.js + background.js (and offscreen.js) from the repository
// root into Node vm contexts with a fully stubbed chrome.* API. Read-only.
//
// By default background.js runs as Chrome runs it: a service worker with importScripts
// and chrome.offscreen. createWorld({ page: true }) runs it as Firefox and Safari do:
// a background page with a DOM, targets.js loaded first by the manifest, no
// importScripts and no chrome.offscreen. page.clipboard picks what the Clipboard API
// does there ('ok', 'reject' or 'missing'); page.firefox adds runtime.getBrowserInfo,
// which only Firefox has.
'use strict';
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const jitter = () => Math.floor(Math.random() * 4); // 0-3 ms, to shake out ordering races

function makeEvent(name) {
  const listeners = [];
  return {
    name,
    listeners,
    addListener: (fn) => listeners.push(fn),
    removeListener: (fn) => listeners.splice(listeners.indexOf(fn), 1),
    hasListener: (fn) => listeners.includes(fn),
    // Fire every listener; resolve when all returned values (promises) settle.
    fire: (...args) => Promise.all(listeners.map((fn) => fn(...args))),
  };
}

// Mirrors chrome.runtime.onMessage semantics: first sendResponse wins; a listener
// that returns true keeps the channel open; otherwise resolves undefined.
function dispatch(listeners, msg, sender, log) {
  return new Promise((resolve) => {
    let done = false;
    let open = false;
    const respond = (r) => {
      if (!done) {
        done = true;
        resolve(clone(r));
      }
    };
    for (const fn of listeners) {
      let ret;
      try {
        ret = fn(clone(msg), sender, respond);
      } catch (e) {
        log && log.push({ ev: 'listener-threw', error: e.message });
      }
      if (ret === true) open = true;
    }
    if (!open && !done) {
      done = true;
      resolve(undefined);
    }
  });
}

// The DOM and Clipboard API of a background page, as far as background.js uses them.
function backgroundPage(world, { clipboard = 'ok' } = {}) {
  world.page = { writeTextCalls: [], execCalls: [], textareas: [], bodyChildren: [] };
  const log = world.log;
  const body = {
    append(el) {
      world.page.bodyChildren.push(el);
      el.parent = body;
    },
  };
  const document = {
    body,
    createElement(tag) {
      const el = {
        tag,
        value: '',
        selectedValue: null,
        parent: null,
        select() {
          this.selectedValue = this.value;
          log.push({ ev: 'textarea.select', length: this.value.length });
        },
        remove() {
          world.page.bodyChildren.splice(world.page.bodyChildren.indexOf(this), 1);
          this.parent = null;
          log.push({ ev: 'textarea.remove' });
        },
      };
      world.page.textareas.push(el);
      return el;
    },
    execCommand(cmd) {
      if (world.execThrows) throw new Error('execCommand exploded');
      const el = world.page.bodyChildren.find((c) => c.tag === 'textarea');
      world.page.execCalls.push({ cmd, value: el?.value, selected: !!el && el.selectedValue === el.value, inBody: !!el?.parent });
      log.push({ ev: 'execCommand', cmd, length: el?.value.length });
      if (world.execResult && el) world.clipboard = el.value;
      return world.execResult;
    },
  };
  const navigator = {};
  if (clipboard !== 'missing') {
    navigator.clipboard = {
      async writeText(text) {
        world.page.writeTextCalls.push(text);
        log.push({ ev: 'clipboard.writeText', length: String(text).length });
        await tick(jitter());
        if (clipboard === 'reject') throw new Error('Clipboard write was blocked due to lack of user activation.');
        world.clipboard = String(text);
      },
    };
  }
  return { document, navigator };
}

function createWorld(opts = {}) {
  const log = []; // ordered event log across everything
  const world = {
    log,
    storage: clone(opts.storage || {}),
    menus: new Map(),
    menuOps: { removeAll: 0, create: 0 },
    dupErrors: [],
    warnings: [],
    tabsCreated: [],
    tabsUpdated: [],
    tabsMessages: [],
    badges: [], // chrome.action.setBadgeText / setTitle calls
    optionsOpened: 0,
    offscreen: null, // { ctx, chrome, textarea, execCalls }
    createDocCalls: [],
    getContextsCalls: [],
    execResult: true,
    execThrows: false,
    contentReply: () => ({}),
    createDocFailOnce: null, // error message to throw on next createDocument
    hasDocumentLiesOnce: false,
    // Open tabs for tabs.query, chrome.scripting calls, tabs whose injection fails,
    // and the page's own globals that a MAIN-world func sees (per tab).
    openTabs: [],
    queryCalls: [],
    queryThrows: null,
    scriptCalls: [],
    scriptFails: new Set(),
    pageGlobals: {}, // tabId -> object exposed as window in the MAIN world
  };

  // ---- chrome.storage ----
  const onChanged = makeEvent('storage.onChanged');
  const getFrom = (keys) => {
    const s = world.storage;
    if (keys == null) return clone(s);
    if (typeof keys === 'string') return keys in s ? { [keys]: clone(s[keys]) } : {};
    if (Array.isArray(keys)) {
      const out = {};
      for (const k of keys) if (k in s) out[k] = clone(s[k]);
      return out;
    }
    const out = {};
    for (const [k, d] of Object.entries(keys)) out[k] = k in s ? clone(s[k]) : clone(d);
    return out;
  };
  const maybeCb = (p, cb) => {
    if (typeof cb === 'function') {
      p.then((v) => cb(v));
      return undefined;
    }
    return p;
  };
  const sync = {
    get: (keys, cb) => maybeCb(tick(jitter()).then(() => getFrom(keys)), cb),
    set: (items, cb) => {
      const changes = {};
      for (const [k, v] of Object.entries(clone(items))) {
        changes[k] = { oldValue: clone(world.storage[k]), newValue: clone(v) };
        world.storage[k] = v;
      }
      log.push({ ev: 'storage.set', items: clone(items) });
      const p = tick(jitter()).then(() => {
        setTimeout(() => onChanged.fire(clone(changes), 'sync'), jitter());
      });
      return maybeCb(p, cb);
    },
  };

  // ---- chrome.contextMenus: ops run strictly in call order (like Chrome's IPC), async ----
  let lastError;
  let menuChain = Promise.resolve();
  const enqueue = (op) => {
    menuChain = menuChain.then(() => tick(jitter())).then(op);
    return menuChain;
  };
  const contextMenus = {
    onClicked: makeEvent('contextMenus.onClicked'),
    create(props, cb) {
      const p = clone(props);
      enqueue(() => {
        world.menuOps.create++;
        if (world.menus.has(p.id)) {
          const message = `Cannot create item with duplicate id ${p.id}`;
          world.dupErrors.push(message);
          lastError = { message };
        } else {
          world.menus.set(p.id, p);
        }
        try {
          if (cb) cb();
          else if (lastError) world.warnings.push(`Unchecked runtime.lastError: ${lastError.message}`);
        } finally {
          lastError = undefined;
        }
      });
      return p.id;
    },
    removeAll(cb) {
      const p = enqueue(() => {
        world.menuOps.removeAll++;
        world.menus.clear();
        if (cb) cb();
      });
      return cb ? undefined : p;
    },
  };

  // ---- offscreen document (loads the REAL offscreen.js) ----
  function loadOffscreen() {
    const execCalls = [];
    const textarea = {
      id: 'clip',
      value: '',
      selectedValue: null,
      select() {
        this.selectedValue = this.value;
        log.push({ ev: 'textarea.select', length: this.value.length });
      },
    };
    const document = {
      getElementById: (id) => (id === 'clip' ? textarea : null),
      execCommand(cmd) {
        if (world.execThrows) throw new Error('execCommand exploded');
        const call = { cmd, value: textarea.value, selected: textarea.selectedValue === textarea.value };
        execCalls.push(call);
        log.push({ ev: 'execCommand', cmd, length: textarea.value.length });
        if (world.execResult) world.clipboard = textarea.value;
        return world.execResult;
      },
    };
    const ochrome = { runtime: { id: 'test-ext', onMessage: makeEvent('offscreen.runtime.onMessage') } };
    const ctx = vm.createContext({ chrome: ochrome, document, console });
    vm.runInContext(read('offscreen.js'), ctx, { filename: 'offscreen.js' });
    return { ctx, chrome: ochrome, textarea, execCalls };
  }

  const offscreen = {
    async createDocument(params) {
      world.createDocCalls.push(clone(params));
      log.push({ ev: 'offscreen.createDocument' });
      await tick(2 + jitter());
      if (world.createDocFailOnce) {
        const m = world.createDocFailOnce;
        world.createDocFailOnce = null;
        throw new Error(m);
      }
      if (world.offscreen) throw new Error('Only a single offscreen document may be created.');
      world.offscreen = loadOffscreen();
    },
    async closeDocument() {
      if (!world.offscreen) throw new Error('No current offscreen document.');
      world.offscreen = null;
    },
    async hasDocument() {
      await tick(0);
      if (world.hasDocumentLiesOnce) {
        world.hasDocumentLiesOnce = false;
        return false;
      }
      return !!world.offscreen;
    },
  };

  // ---- chrome.runtime ----
  const runtime = {
    id: 'test-ext',
    get lastError() {
      return lastError;
    },
    onInstalled: makeEvent('runtime.onInstalled'),
    onStartup: makeEvent('runtime.onStartup'),
    onMessage: makeEvent('runtime.onMessage'),
    getURL: (p) => `chrome-extension://test-ext/${p}`,
    async openOptionsPage() {
      world.optionsOpened++;
      log.push({ ev: 'openOptionsPage' });
    },
    async getContexts(filter) {
      world.getContextsCalls.push(clone(filter));
      const want = filter?.contextTypes || [];
      return world.offscreen && want.includes('OFFSCREEN_DOCUMENT')
        ? [{ contextType: 'OFFSCREEN_DOCUMENT', documentUrl: 'chrome-extension://test-ext/offscreen.html' }]
        : [];
    },
    // From the service worker: reaches other extension contexts (the offscreen doc), never itself.
    async sendMessage(msg) {
      log.push({ ev: 'runtime.sendMessage', target: msg?.target, action: msg?.action });
      if (!world.offscreen) throw new Error('Could not establish connection. Receiving end does not exist.');
      const sender = { id: 'test-ext', url: 'chrome-extension://test-ext/background.js' };
      return dispatch(world.offscreen.chrome.runtime.onMessage.listeners, msg, sender, log);
    },
  };

  // ---- chrome.tabs ----
  let nextTabId = 100;
  const tabs = {
    async sendMessage(tabId, msg, options) {
      world.tabsMessages.push({ tabId, msg: clone(msg), options: clone(options) });
      log.push({ ev: 'tabs.sendMessage', platform: msg?.platform });
      await tick(jitter());
      const r = world.contentReply(clone(msg), tabId);
      if (r instanceof Error) throw r;
      return clone(r);
    },
    async update(tabId, props) {
      world.tabsUpdated.push({ tabId, props: clone(props) });
      log.push({ ev: 'tabs.update' });
      return { id: tabId, ...clone(props) };
    },
    async create(props) {
      world.tabsCreated.push(clone(props));
      log.push({ ev: 'tabs.create', url: props?.url });
      return { id: nextTabId++, ...clone(props) };
    },
    // url filter as a match pattern ("*" = anything), like Chrome with host permission.
    async query(q) {
      world.queryCalls.push(clone(q));
      log.push({ ev: 'tabs.query' });
      await tick(jitter());
      if (world.queryThrows) throw new Error(world.queryThrows);
      const patterns = q?.url == null ? null : [].concat(q.url);
      const re = (p) => new RegExp(`^${p.split('*').map((x) => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('.*')}$`);
      return clone(world.openTabs.filter((t) => !patterns || patterns.some((p) => re(p).test(t.url || ''))));
    },
  };

  // ---- chrome.scripting ----
  // A func is serialised and run in a fresh context whose window is the page's
  // globals for that tab, as Chrome does for world: 'MAIN'.
  const scripting = {
    async executeScript(injection) {
      const call = {
        target: clone(injection?.target),
        world: injection?.world,
        files: clone(injection?.files),
        func: injection?.func ? String(injection.func) : undefined,
      };
      world.scriptCalls.push(call);
      log.push({ ev: 'scripting.executeScript', tabId: call.target?.tabId, files: call.files, world: call.world });
      await tick(jitter());
      const tabId = call.target?.tabId;
      if (world.scriptFails.has(tabId)) throw new Error('Cannot access contents of the page. Extension manifest must request permission to access the respective host.');
      if (call.func) {
        const page = vm.createContext({ window: clone(world.pageGlobals[tabId] || {}) });
        return [{ frameId: 0, documentId: 'doc', result: clone(vm.runInContext(`(${call.func})()`, page)) }];
      }
      return [{ frameId: 0, documentId: 'doc', result: undefined }];
    },
  };

  const chrome = {
    contextMenus,
    storage: { sync, onChanged },
    runtime,
    tabs,
    scripting,
    offscreen,
    action: {
      onClicked: makeEvent('action.onClicked'),
      // chrome.action.setBadgeText and setTitle exist in every MV3 build, so the stub has them too.
      async setBadgeText(d) {
        world.badges.push({ badge: clone(d) });
        log.push({ ev: 'action.setBadgeText' });
      },
      async setTitle(d) {
        world.badges.push({ title: clone(d) });
        log.push({ ev: 'action.setTitle' });
      },
    },
  };
  if (opts.noHasDocument) delete chrome.offscreen.hasDocument;

  const sandboxConsole = {
    log: () => {},
    info: () => {},
    error: (...a) => world.warnings.push(a.map(String).join(' ')),
    warn: (...a) => world.warnings.push(a.map(String).join(' ')),
  };
  const globals = { chrome, console: sandboxConsole, setTimeout, clearTimeout, queueMicrotask };
  if (opts.page) Object.assign(globals, backgroundPage(world, opts.page));
  if (opts.page) delete chrome.offscreen;
  if (opts.page?.firefox) chrome.runtime.getBrowserInfo = async () => ({ name: 'Firefox', vendor: 'Mozilla', version: '140.0' });
  const ctx = vm.createContext(globals);
  if (opts.page) {
    // The manifest's background.scripts: targets.js, then background.js, in one page.
    vm.runInContext(read('targets.js'), ctx, { filename: 'targets.js' });
  } else {
    ctx.importScripts = (...files) => {
      for (const f of files) {
        world.log.push({ ev: 'importScripts', file: f });
        vm.runInContext(read(f), ctx, { filename: f });
      }
    };
  }
  vm.runInContext(read('background.js'), ctx, { filename: 'background.js' });

  world.ctx = ctx;
  world.chrome = chrome;
  world.evalIn = (code) => vm.runInContext(code, ctx);
  world.menuList = () => [...world.menus.values()];
  world.menuTitles = () => world.menuList().map((m) => m.title);
  // Waits until menu rebuilds, storage events and menu ops have stopped.
  world.settle = async () => {
    for (let i = 0; i < 50; i++) {
      const q = world.evalIn('menuQueue');
      await q;
      await menuChain;
      await tick(15);
      if (q === world.evalIn('menuQueue')) return;
    }
    throw new Error('Did not settle');
  };
  // Simulates content.js calling chrome.runtime.sendMessage: Chrome delivers it to
  // every extension context (background AND the offscreen document if it exists).
  world.fromContent = (msg, sender) => {
    const ls = [...chrome.runtime.onMessage.listeners];
    if (world.offscreen) ls.push(...world.offscreen.chrome.runtime.onMessage.listeners);
    return dispatch(ls, msg, sender, log);
  };
  world.toBackgroundOnly = (msg, sender) => {
    const calls = [];
    const ret = chrome.runtime.onMessage.listeners.map((fn) => fn(clone(msg), sender, (r) => calls.push(clone(r))));
    return { ret, calls };
  };
  world.raw = { contextMenus, enqueue, menuChainP: () => menuChain };
  return world;
}

module.exports = { createWorld, dispatch, clone, tick, read, REPO };
