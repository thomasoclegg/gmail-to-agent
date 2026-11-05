// Stub chrome.* for testing the REAL options.js and popup.js outside an extension.
// In-memory storage.sync (seeded from window.__seed) with onChanged, and a tabs.create recorder. window.__env
// (optional) sets the rest: activeTab (tabs.query for the active tab), gmailTabs (tabs.query by url),
// answers ({ tabId: { action: reply or 'reject' } } for tabs.sendMessage), runReply (runtime.sendMessage) and
// runReplies ({ action: reply }, which wins for that action, such as the toolbar list's 'selection'),
// answerDelay (ms before a tab answers), local (storage.local), version (runtime.getManifest), commands (commands.getAll; none means no commands
// API, as in a page outside an extension) and openShortcutSettings (Firefox's commands method).
(() => {
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const store = clone(window.__seed || {});
  const env = clone(window.__env || {});
  const listeners = [];
  const log = { sets: [], gets: [], tabsCreate: [], lastErrorReads: 0, tabsQuery: [], tabsMessages: [], runtimeMessages: [], optionsOpened: 0, closed: 0, shortcutSettings: 0 };
  const later = (fn) => setTimeout(fn, 2);
  let failing;
  const getFrom = (keys) => {
    if (keys == null) return clone(store);
    if (typeof keys === 'string') return keys in store ? { [keys]: clone(store[keys]) } : {};
    if (Array.isArray(keys)) return Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, clone(store[k])]));
    return Object.fromEntries(Object.entries(keys).map(([k, d]) => [k, k in store ? clone(store[k]) : clone(d)]));
  };
  const fireChanged = (changes) => listeners.forEach((fn) => fn(clone(changes), 'sync'));
  const sync = {
    get(keys, cb) {
      log.gets.push(clone(keys));
      const p = new Promise((r) => later(() => r(getFrom(keys))));
      if (typeof cb === 'function') return void p.then(cb);
      return p;
    },
    set(items, cb) {
      if (window.__failNextSet) {
        // Simulate a failed write (e.g. MAX_WRITE_OPERATIONS_PER_MINUTE): nothing stored, lastError set during the callback.
        const message = window.__failNextSet;
        window.__failNextSet = null;
        log.failedSets = (log.failedSets || 0) + 1;
        if (typeof cb === 'function') return void later(() => { failing = { message }; try { cb(); } finally { failing = undefined; } });
        return Promise.reject(new Error(message));
      }
      // storage.sync's 8,192 bytes an item, counted as Chromium does: the key, then the value as JSON in UTF-8, with
      // "<" and the line and paragraph separators written as six-character escapes. Nothing is stored past it.
      const tooBig = Object.entries(items).some(([k, v]) => new TextEncoder().encode(k + JSON.stringify(v).replace(/[<\u2028\u2029]/g, '\\u003C')).length > 8192);
      if (tooBig) {
        log.failedSets = (log.failedSets || 0) + 1;
        const message = 'Resource::kQuotaBytesPerItem quota exceeded';
        if (typeof cb === 'function') return void later(() => { failing = { message }; try { cb(); } finally { failing = undefined; } });
        return Promise.reject(new Error(message));
      }
      const changes = {};
      for (const [k, v] of Object.entries(clone(items))) {
        changes[k] = { oldValue: clone(store[k]), newValue: v };
        store[k] = v;
      }
      log.sets.push({ t: Math.round(performance.now()), items: clone(items) });
      const p = new Promise((r) => later(() => (fireChanged(changes), r())));
      if (typeof cb === 'function') return void p.then(() => cb());
      return p;
    },
  };
  const stub = {
    runtime: {
      id: 'test-ext',
      getURL: (p) => p,
      get lastError() {
        log.lastErrorReads++;
        return failing;
      },
      getManifest: () => ({ version: env.version || '1.4.0' }),
      sendMessage(msg) {
        log.runtimeMessages.push(clone(msg));
        return new Promise((r) => later(() => r(clone(env.runReplies?.[msg?.action] ?? env.runReply ?? { ok: true }))));
      },
      openOptionsPage() {
        log.optionsOpened++;
        return Promise.resolve();
      },
    },
    storage: {
      sync,
      local: { get: (keys) => Promise.resolve({ ...clone(keys || {}), ...clone(env.local || {}) }) },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
    tabs: {
      create(props, cb) {
        log.tabsCreate.push(clone(props));
        const p = Promise.resolve({ id: 1, ...props });
        if (typeof cb === 'function') return void p.then(cb);
        return p;
      },
      query(q) {
        log.tabsQuery.push(clone(q));
        if (q?.active) return Promise.resolve(env.activeTab ? [clone(env.activeTab)] : []);
        return Promise.resolve(clone(env.gmailTabs || []));
      },
      sendMessage(tabId, msg, options) {
        log.tabsMessages.push({ tabId, msg: clone(msg), options: clone(options) });
        const reply = env.answers?.[tabId]?.[msg?.action];
        if (reply === undefined || reply === 'reject') return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
        // answerDelay: how long the tab takes to answer, in ms (a slow tab, to see the page while it waits).
        return new Promise((r) => setTimeout(() => r(clone(reply)), env.answerDelay ?? 2));
      },
    },
  };
  if (env.commands) {
    stub.commands = { getAll: () => Promise.resolve(clone(env.commands)) };
    if (env.openShortcutSettings) stub.commands.openShortcutSettings = () => (log.shortcutSettings++, Promise.resolve());
  }
  // The toolbar list closes itself after a pick; a page opened by navigation cannot, so count instead.
  window.close = () => void log.closed++;
  Object.defineProperty(window, 'chrome', { value: stub, configurable: true, writable: true });
  // Test hooks: simulate a change made in another tab or synced from another device.
  window.__external = (items) => {
    const changes = {};
    for (const [k, v] of Object.entries(items)) {
      changes[k] = { oldValue: clone(store[k]), newValue: clone(v) };
      store[k] = clone(v);
    }
    fireChanged(changes);
  };
  window.__store = store;
  window.__log = log;
  window.__stubActive = true;
})();
