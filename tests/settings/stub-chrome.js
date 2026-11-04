// Stub chrome.* for testing the REAL options.js outside an extension.
// In-memory storage.sync (seeded from window.__seed) with onChanged, and a tabs.create recorder.
(() => {
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const store = clone(window.__seed || {});
  const listeners = [];
  const log = { sets: [], gets: [], tabsCreate: [], lastErrorReads: 0 };
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
    },
    storage: { sync, onChanged: { addListener: (fn) => listeners.push(fn) } },
    tabs: {
      create(props, cb) {
        log.tabsCreate.push(clone(props));
        const p = Promise.resolve({ id: 1, ...props });
        if (typeof cb === 'function') return void p.then(cb);
        return p;
      },
    },
  };
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
