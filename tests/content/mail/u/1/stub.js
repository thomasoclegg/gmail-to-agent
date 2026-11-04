// Stubbed extension APIs for the content script, recording every call. Loaded
// before targets.js and content.js.

const PARAMS = new URLSearchParams(location.search);
const SUITE = PARAMS.get('suite') || 'main';
// run.mjs passes the paste key targets.js should pick on this OS (Cmd+V on macOS, Ctrl+V elsewhere).
const EXPECT_PASTE = PARAMS.get('paste');
const EXPECT_OS = PARAMS.get('os') || 'this OS';

const mock = {
  t0: Date.now(),
  calls: [], // { api, args, t }
  launches: [], // deep links caught at anchor click
  opens: [], // window.open calls
  store: ['main', 'toast', 'guard', 'orphan', 'orphan111'].includes(SUITE) ? { targets: ['copy', 'codex', 'bogus', 'claude', 'claude-code'], folder: '' } : {},
  changeListeners: [],
  messageListeners: [],
  // How runtime.sendMessage answers: 'ok' | 'fail' | 'invalidated'
  sendMode: 'ok',
  // What background.js answers to {action:'ik'} (Gmail's GLOBALS[9]); 'error' for {ok:false};
  // 'reject' makes the request itself fail (the message port closed, as when the service worker restarts).
  ik: 'a1b2c3d4e5',
  // Print view per hex thread id: { html, status, delay, never }; missing ids answer 404.
  printViews: {},
  fetches: [], // { url, credentials, redirect, t, aborted }
  inFlight: 0,
  maxInFlight: 0,
  errors: [], // uncaught page errors
  captureListeners: [], // document.addEventListener(type, fn, true) calls
};
window.__mock = mock;

const now = () => Date.now() - mock.t0;
const record = (api, ...args) => mock.calls.push({ api, args: JSON.parse(JSON.stringify(args)), t: now() });

function pick(keys) {
  if (keys == null) return { ...mock.store };
  if (typeof keys === 'string') keys = [keys];
  if (Array.isArray(keys)) return Object.fromEntries(keys.filter((k) => k in mock.store).map((k) => [k, mock.store[k]]));
  return Object.fromEntries(Object.keys(keys).map((k) => [k, k in mock.store ? mock.store[k] : keys[k]]));
}

window.chrome = {
  storage: {
    sync: {
      get(keys, cb) {
        record('storage.sync.get', keys);
        const res = JSON.parse(JSON.stringify(pick(keys)));
        if (cb) return void setTimeout(() => cb(res), 0);
        return Promise.resolve(res);
      },
      set(items, cb) {
        record('storage.sync.set', items);
        const changes = {};
        for (const [k, v] of Object.entries(items)) {
          changes[k] = { oldValue: mock.store[k], newValue: v };
          mock.store[k] = v;
        }
        setTimeout(() => mock.changeListeners.forEach((f) => f(changes, 'sync')), 0);
        cb?.();
        return Promise.resolve();
      },
    },
    onChanged: { addListener: (f) => (record('storage.onChanged.addListener'), mock.changeListeners.push(f)) },
  },
  runtime: {
    id: 'mockextensionid',
    lastError: undefined,
    getURL: (p) => `chrome-extension://mockextensionid/${p}`,
    sendMessage(msg) {
      record('runtime.sendMessage', msg);
      if (mock.sendMode === 'invalidated') throw new Error('Extension context invalidated.');
      if (msg?.action === 'ik') {
        if (mock.ik === 'reject') return Promise.reject(new Error('The message port closed before a response was received.'));
        const reply = mock.ik === 'error' ? { ok: false, error: 'Cannot access contents of the page' } : { ok: true, ik: mock.ik };
        return new Promise((resolve) => setTimeout(() => resolve(reply), 10));
      }
      return new Promise((resolve) =>
        setTimeout(() => resolve(mock.sendMode === 'fail' ? { ok: false, error: 'Copy was blocked' } : { ok: true }), 20),
      );
    },
    onMessage: { addListener: (f) => (record('runtime.onMessage.addListener'), mock.messageListeners.push(f)) },
  },
};

// Deep links: catch anchor clicks to custom schemes (detached anchors never
// reach a document listener, so patch click itself).
const realClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
  if (/^(claude|codex):/i.test(this.href)) {
    mock.launches.push({ href: this.href, connected: this.isConnected, t: now() });
    return;
  }
  return realClick.call(this);
};
document.addEventListener(
  'click',
  (e) => {
    const a = e.target.closest?.('a[href]');
    if (a && /^(claude|codex):/i.test(a.href)) {
      e.preventDefault();
      mock.launches.push({ href: a.href, connected: true, t: now(), viaDocument: true });
    }
  },
  true,
);
window.open = (...args) => (mock.opens.push(args), null);

// Gmail's print view (same origin, the user's session). Answers from mock.printViews by th=,
// honours the abort signal, and records every request and the number in flight.
window.fetch = (input, init = {}) => {
  const url = String(input);
  const entry = { url, credentials: init.credentials, redirect: init.redirect, t: now(), aborted: false };
  mock.fetches.push(entry);
  const th = new URL(url, location.href).searchParams.get('th');
  const view = mock.printViews[th] || { status: 404, html: 'Not found' };
  mock.inFlight++;
  mock.maxInFlight = Math.max(mock.maxInFlight, mock.inFlight);
  return new Promise((resolve, reject) => {
    let timer = 0;
    const settle = () => {
      mock.inFlight--;
      init.signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      clearTimeout(timer);
      entry.aborted = true;
      entry.abortedAt = now();
      settle();
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    init.signal?.addEventListener('abort', onAbort);
    if (view.never) return;
    timer = setTimeout(() => {
      settle();
      resolve(new Response(view.html, { status: view.status ?? 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } }));
    }, view.delay ?? 30);
  });
};

window.addEventListener('error', (e) => mock.errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => mock.errors.push(`unhandled: ${e.reason?.message || e.reason}`));
const realAdd = Document.prototype.addEventListener;
Document.prototype.addEventListener = function (type, fn, opts) {
  if (opts === true || opts?.capture) mock.captureListeners.push(type);
  return realAdd.call(this, type, fn, opts);
};
