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
  store: SUITE === 'main' || SUITE === 'toast' ? { targets: ['copy', 'codex', 'bogus', 'claude', 'claude-code'], folder: '' } : {},
  changeListeners: [],
  messageListeners: [],
  // How runtime.sendMessage answers: 'ok' | 'fail' | 'invalidated'
  sendMode: 'ok',
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
