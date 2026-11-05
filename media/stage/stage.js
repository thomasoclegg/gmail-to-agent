// The stage the recordings are made on. It is served at https://mail.google.com/mail/u/0/ inside a
// throwaway headless Chrome, so the real extension's content script runs in it. It draws:
//   - a browser window (tab strip, address bar, the extension's toolbar icon), schematic and neutral;
//   - a Gmail-like inbox and thread view built from the selectors content.js reads (tr.zA, span.bqe with
//     data-legacy-thread-id, Gmail's body > div.J-M menu, h2[data-legacy-thread-id], role=list messages
//     with span.gD, span.g3 and div.a3s, and the action toolbar [gh="mtb"] with its More button .nf), so
//     the extension's real menu items, toolbar button and note appear in it;
//   - the real settings page, as images captured from its own tab by record.mjs;
//   - a neutral AI page with no logo, for the paste;
//   - the real toolbar list (popup.html), as images captured from its own tab, in a bubble under the
//     extension's icon;
//   - for the install video: the project's website (the real docs/index.html, in a frame), and plain,
//     generic drawings of a download bubble, the browser's extensions page and Extensions menu, a file
//     window and a folder picker;
//   - a drawn pointer, click rings, key caps, captions and cards in front of a camera.
// Nothing here runs on its own clock: record.mjs calls __stage.frame(t) for every frame with the time in
// milliseconds, and every animation (the extension's own included) is set to that time. So a render is
// the same every time and does not depend on how fast the machine is.

(() => {
  const D = window.STAGE_DATA;
  const SVG = 'http://www.w3.org/2000/svg';

  // ---- Small DOM helpers ----

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    el.append(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
    return el;
  }

  // Gmail-style icons (Material Icons, Apache 2.0), and a few plain strokes for the browser frame.
  const PATHS = {
    burger: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    pencil: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    inbox: 'M19 3H5a2 2 0 0 0-2 2v14c0 1.1.89 2 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H5V5h14v10z',
    star: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
    clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    send: 'M2.01 21 23 12 2.01 3 2 10l15 2-15 2z',
    file: 'M6 2a2 2 0 0 0-1.99 2L4 20c0 1.1.89 2 1.99 2H18a2 2 0 0 0 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z',
    refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    more: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
    replyall: 'M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
    forward: 'M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z',
    attach: 'M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z',
    archive: 'M20.54 5.23l-1.39-1.68A1.45 1.45 0 0 0 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23A1.97 1.97 0 0 0 3 6.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5 6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z',
    trash: 'M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    unread: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z',
    // Gmail's selection actions: Report spam, Mark as read and Labels.
    spam: 'M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27L15.73 3zM19 14.9L14.9 19H9.1L5 14.9V9.1L9.1 5h5.8L19 9.1v5.8zM11 7h2v6h-2zm0 8h2v2h-2z',
    read: 'M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zm-2 0v.01L12 13 4 8l8-4.68L19.99 8zM4 18v-7.66l8 5.02 7.99-4.99L20 18H4z',
    label: 'M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z',
    back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
    fwd: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
    x: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    tune: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
    up: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
    // For the install video: the browser's puzzle piece, downloads and pin, and the file windows.
    puzzle: 'M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z',
    download: 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z',
    pin: 'M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z',
    pinOff: 'M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z',
    folder: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
    gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z',
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    desktop: 'M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z',
    minimise: 'M6 13h12v-2H6z',
    maximise: 'M5 5v14h14V5H5zm12 12H7V7h10v10z',
  };
  function icon(name, cls = '') {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', `ico ${cls}`.trim());
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', PATHS[name]);
    s.append(p);
    return s;
  }
  function svgFrom(markup) {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstChild;
  }
  // The extension's icon, as docs/icon.svg draws it.
  const MARK = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" rx="3.25" fill="#15171a"/><rect x="1" y="4" width="10" height="7" rx="0.5" fill="#fafaf8"/><path d="M1.9 4.9 6 8.5l4.1-3.6" fill="none" stroke="#15171a" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/><rect x="12" y="4" width="3" height="2" rx="0.35" fill="#fb3e36"/><rect x="12" y="7" width="3" height="2" rx="0.35" fill="#fafaf8"/><rect x="12" y="10" width="3" height="2" rx="0.35" fill="#fafaf8"/></svg>`;
  // A plain grey favicon for the AI page: no product's logo.
  const DOT = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#9aa0a6"/><circle cx="8" cy="8" r="3" fill="#ffffff"/></svg>`;
  const ENVELOPE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#5f6368" d="${PATHS.unread}"/></svg>`;
  const CURSOR = `<svg viewBox="0 0 16 22" width="17" height="24" aria-hidden="true"><path d="M1 1v17.5l4.4-4.2 2.9 6.6 2.9-1.3-2.8-6.4H14L1 1z" fill="#000" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  const PUZZLE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#5f6368" d="${PATHS.puzzle}"/></svg>`;
  // Plain file icons for the drawn file windows: a zip, a document and a folder, in neutral greys.
  const FILE_ICONS = {
    zip: `<svg class="fi" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 2H14l5.5 5.5V20a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#8a929b"/><path d="M14 2v5.5h5.5z" fill="#c4c9cf"/><path d="M9 3.5h2v1.5H9zm2 1.5h2v1.5h-2zM9 6.5h2V8H9zm2 1.5h2v1.5h-2zM9 9.5h2V11H9z" fill="#ffffff"/><rect x="9" y="12" width="4" height="4.5" rx="0.8" fill="#ffffff"/><rect x="10.2" y="14" width="1.6" height="1.4" fill="#8a929b"/></svg>`,
    doc: `<svg class="fi" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 2H14l5.5 5.5V20a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#b5bcc4"/><path d="M14 2v5.5h5.5z" fill="#dde1e5"/><path d="M8 12h8v1.4H8zm0 3h8v1.4H8zm0 3h5v1.4H8z" fill="#ffffff"/></svg>`,
    folder: `<svg class="fi" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="#7d93a8"/><path d="M2 9h20v9c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2z" fill="#93a8bc"/></svg>`,
  };

  // ---- Time, easing and tweens ----

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const EASE = {
    linear: (p) => p,
    in: (p) => p * p * p,
    out: (p) => 1 - (1 - p) ** 3,
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
    smooth: (p) => p * p * p * (p * (p * 6 - 15) + 10),
  };

  const S = {
    t: 0,
    W: 1024,
    H: 640,
    tweens: [],
    timers: [],
    cam: { z: 1, x: 512, y: 320 },
    camT: { tx: 0, ty: 0, z: 1 },
    cursor: { x: 700, y: 520, press: 0, hidden: 0 },
    path: null,
    rings: [],
    caps: [],
    lift: { y: 0, to: 0 }, // how far a bottom caption has risen above the extension's note
    toastBox: null, // the note's visible box on screen, when it shows
    keys: null,
    cards: [],
    pages: {},
    tabs: [],
    active: 'gm',
    ai: { text: '', scroll: 0, sent: 0, sentText: '', composeTop: 0.28 },
    dialog: null,
    anims: new WeakMap(),
    // The install video's extras. bar: how far each toolbar icon has grown in (1 shown, 0 hidden).
    bar: { ext: 1, puz: 0, dl: 0 },
    addr: null, // the address bar while it has focus: { mode: 'select' | 'type', text, t0, dur }
    z: 0, // the last page z-index handed out, so the tab in front is always on top
    site: { scroll: 0, applied: -1 },
    dlb: { show: 0 },
    xm: { show: 0 },
    xp: { dev: 0, tools: 0 },
    wins: {},
    drag: null,
    pop: { show: 0 }, // the toolbar list's bubble
  };

  function tween(obj, key, to, dur = 400, ease = 'inOut') {
    S.tweens = S.tweens.filter((tw) => !(tw.obj === obj && tw.key === key));
    if (dur <= 0) return void (obj[key] = to);
    S.tweens.push({ obj, key, from: obj[key], to, t0: S.t, dur, ease: EASE[ease] || EASE.inOut });
  }
  function after(ms, fn) {
    S.timers.push({ at: S.t + ms, fn });
  }
  function runTimers() {
    for (;;) {
      const due = S.timers.filter((x) => x.at <= S.t).sort((a, b) => a.at - b.at)[0];
      if (!due) return;
      S.timers.splice(S.timers.indexOf(due), 1);
      due.fn();
    }
  }
  function runTweens() {
    S.tweens = S.tweens.filter((tw) => {
      const p = clamp((S.t - tw.t0) / tw.dur, 0, 1);
      tw.obj[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(p);
      return p < 1;
    });
  }

  // The extension's note animates with CSS transitions and the Web Animations API on the page's own
  // clock. Every animation in the document is paused and set to the stage time instead, counted from
  // the frame it first appeared in.
  function driveAnimations() {
    const docs = [document];
    try {
      if (siteFrame?.contentDocument) docs.push(siteFrame.contentDocument); // the website's own hover transitions
    } catch {}
    for (const a of docs.flatMap((doc) => doc.getAnimations())) {
      if (!S.anims.has(a)) S.anims.set(a, S.t);
      try {
        a.pause();
        a.currentTime = Math.max(0, S.t - S.anims.get(a));
      } catch {}
    }
  }

  // ---- Camera ----
  // The body is the camera: everything in it (window, Gmail, the menu, the note, the pointer) zooms
  // together. Captions and key caps sit outside the body, so they never zoom.

  function camTransform() {
    const { W, H } = S;
    const z = S.cam.z;
    const tx = clamp(W / 2 - S.cam.x * z, W - W * z, 0);
    const ty = clamp(H / 2 - S.cam.y * z, H - H * z, 0);
    S.camT = { tx, ty, z };
    return S.camT;
  }
  const toView = (x, y) => ({ x: S.camT.tx + x * S.camT.z, y: S.camT.ty + y * S.camT.z });
  const toPage = (x, y) => ({ x: (x - S.camT.tx) / S.camT.z, y: (y - S.camT.ty) / S.camT.z });

  // An element's box in page coordinates (before the camera).
  function boxOf(el) {
    const r = el.getBoundingClientRect();
    const a = toPage(r.left, r.top);
    const b = toPage(r.right, r.bottom);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  // ---- Building the window ----

  let hud, capEl, keysEl, cursorEl, tabsEl, addrEl, badgeEl, viewEl, extEl, puzEl, dlEl;

  function buildWindow() {
    tabsEl = h('div', { id: 'tabs' });
    badgeEl = h('div', { id: 'badge', text: 'Illustration' });
    addrEl = h('div', { id: 'addr' });
    extEl = h('div', { id: 'ext', title: 'Open in AI Agent settings' }, h('img', { src: '/__stage/icon32.png', alt: '' }));
    // The puzzle-piece Extensions menu and the downloads icon: hidden unless a storyboard shows them.
    puzEl = h('div', { id: 'puz', hidden: true }, icon('puzzle'));
    dlEl = h('div', { id: 'dl', hidden: true }, icon('download'));
    const bar = h(
      'div',
      { id: 'bar' },
      icon('back', 'nav'),
      icon('fwd', 'nav off'),
      icon('refresh', 'nav'),
      addrEl,
      extEl,
      puzEl,
      dlEl,
      h('div', { class: 'me', text: 'S' }),
    );
    viewEl = h('div', { id: 'view' });
    document.body.append(tabsEl, bar, viewEl);
  }

  function tabEl(tab) {
    const fav = h('span', { class: 'fav' });
    fav.append(svgFrom(tab.fav === 'mark' ? MARK : tab.fav === 'dot' ? DOT : tab.fav === 'puzzle' ? PUZZLE : ENVELOPE));
    return h('div', { class: 'tab', 'data-tab': tab.id }, fav, h('span', { class: 't', text: tab.title }), icon('x', 'x'));
  }

  // Tabs are 228 px wide until they no longer fit beside the "Illustration" label; then they share the room,
  // as a browser narrows its tabs.
  const tabWidth = () => Math.min(228, Math.floor((S.W - 190) / Math.max(1, S.tabs.length)) - 2);

  function renderTabs() {
    const w = tabWidth();
    tabsEl.replaceChildren(
      ...S.tabs.map((tab) => {
        const el = tabEl(tab);
        if (tab.id === S.active) el.classList.add('on');
        if (w < 228) el.style.width = `${w}px`;
        if (tab.grow !== undefined && tab.grow < 1) Object.assign(el.style, { width: `${w * tab.grow}px`, opacity: String(tab.grow) });
        return el;
      }),
      h('div', { class: 'plus' }, icon('plus')),
    );
    const tab = S.tabs.find((x) => x.id === S.active);
    const m = tab?.addr ? ['', ...tab.addr] : tab?.url.match(/^(?:https?:\/\/)?([^/]+)(.*)$/) || ['', '', ''];
    addrEl.replaceChildren(icon('tune', 'tune'), h('span', { text: m[1] }), h('span', { class: 'rest', text: m[2] }));
    if (S.addr) renderAddr(true);
  }

  // The address bar while it has focus: the address selected, or being typed, with a caret.
  function renderAddr(force) {
    const a = S.addr;
    if (!a) return;
    const n = a.mode === 'type' && a.dur > 0 ? Math.round(clamp((S.t - a.t0) / a.dur, 0, 1) * a.text.length) : a.text.length;
    const typing = a.mode === 'type' && n < a.text.length;
    const caret = typing || Math.floor((S.t - a.t0) / 530) % 2 === 0;
    const key = `${a.mode}|${n}|${caret}`;
    if (!force && addrEl.dataset.key === key) return;
    addrEl.dataset.key = key;
    addrEl.classList.add('focus');
    const text = a.mode === 'select' ? h('span', { class: 'sel', text: a.text }) : h('span', { text: a.text.slice(0, n) });
    addrEl.replaceChildren(icon('tune', 'tune'), h('span', {}, text, caret && a.mode === 'type' ? h('i', { class: 'caret' }) : null));
  }

  // ---- Gmail ----

  const AVATAR = { Priya: '#0b8043', Marta: '#8e24aa', Sam: '#6f7d8c', Andreas: '#e8710a', Chris: '#1a73e8' };
  let gm, inboxEl, threadEl, menuEl, tbody;

  function buildGmail() {
    gm = h('div', { class: 'page', id: 'gm' });
    const nav = h(
      'div',
      { class: 'gm-nav' },
      h('div', { class: 'gm-compose' }, icon('pencil'), 'Compose'),
      h('div', { class: 'gm-ni on' }, icon('inbox'), 'Inbox', h('b', { id: 'gm-unread' })),
      h('div', { class: 'gm-ni' }, icon('star'), 'Starred'),
      h('div', { class: 'gm-ni' }, icon('clock'), 'Snoozed'),
      h('div', { class: 'gm-ni' }, icon('send'), 'Sent'),
      h('div', { class: 'gm-ni' }, icon('file'), 'Drafts'),
    );
    tbody = h('tbody');
    for (const th of D.THREADS) tbody.append(rowEl(th));
    inboxEl = h(
      'div',
      { id: 'gm-inbox' },
      h('div', { class: 'gm-tools', gh: 'mtb' }, selectAll(), icon('refresh', 'gm-refresh'), selActions(), moreButton(), h('span', { class: 'count', text: D.INBOX_COUNT })),
      h('div', { class: 'gm-tabs' }, h('span', { class: 'on', text: 'Primary' }), h('span', { text: 'Promotions' }), h('span', { text: 'Updates' })),
      h('table', { class: 'gm-list' }, tbody),
    );
    threadEl = h('div', { class: 'gm-thread', id: 'gm-thread', hidden: true });
    gm.append(
      h('div', { class: 'gm-top' }, icon('burger', 'gm-burger'), h('div', { class: 'gm-search' }, icon('search'), 'Search mail'), h('div', { class: 'gm-acct', text: 'S' })),
      nav,
      h('div', { class: 'gm-main' }, inboxEl, threadEl),
    );
    viewEl.append(gm);
    S.pages.gm = { el: gm, x: 0 };
    countUnread();

    // Gmail's own row menu: one element, directly in the body, shown and hidden.
    menuEl = h('div', { class: 'J-M', role: 'menu' });
    const items = [['reply', 'Reply'], ['replyall', 'Reply all'], ['forward', 'Forward'], '-', ['archive', 'Archive'], ['trash', 'Delete'], ['unread', 'Mark as unread']];
    for (const it of items) {
      if (it === '-') menuEl.append(h('div', { class: 'J-Kh', role: 'separator' }));
      else menuEl.append(h('div', { class: 'J-N', role: 'menuitem' }, icon(it[0]), h('div', { class: 'J-N-Jz', text: it[1] })));
    }
    // Gmail's items act on a left-button release; the right button that opened the menu does nothing.
    menuEl.addEventListener('mouseup', (e) => {
      if (e.button === 0 && e.target.closest('.J-N:not(.vpa-item)')) closeMenu();
    });
    document.body.append(menuEl);

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousedown', (e) => {
      if (menuOpen() && !e.target.closest('div.J-M')) closeMenu();
    });
    document.body.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  // Gmail's action toolbar is [gh="mtb"], above the list and above an open email, and its More button has
  // class nf. content.js puts its own button just before the visible More button.
  const moreButton = () => h('div', { class: 'nf', role: 'button', 'aria-label': 'More email options' }, icon('more'));

  // With any row ticked, Gmail's toolbar shows the selection actions in place of refresh; the More button stays
  // last, so the extension's button stays just before it.
  const selActions = () => h('span', { class: 'gm-sel', hidden: true }, ...['archive', 'spam', 'trash', 'read', 'clock', 'folder', 'label'].map((n) => icon(n)));
  function syncToolbar() {
    const any = !!tbody.querySelector('tr.zA.x7');
    inboxEl.querySelector('.gm-sel').hidden = !any;
    inboxEl.querySelector('.gm-refresh').style.display = any ? 'none' : '';
  }

  // Gmail's select-all box: with rows ticked, a click clears them all; with none, it ticks every row.
  function selectAll() {
    const box = h('span', { class: 'gm-box', id: 'gm-all', role: 'checkbox', 'aria-checked': 'false', 'aria-label': 'Select all' });
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const rows = [...tbody.querySelectorAll('tr.zA')];
      const on = !rows.some((r) => r.classList.contains('x7'));
      for (const r of rows) {
        r.classList.toggle('x7', on);
        r.querySelector('[role="checkbox"]').setAttribute('aria-checked', String(on));
      }
      syncToolbar();
    });
    return box;
  }

  function rowEl(th) {
    const box = h('div', { class: 'gm-box', role: 'checkbox', 'aria-checked': 'false', 'aria-label': 'Select' });
    const n = th.messages.length;
    const row = h(
      'tr',
      { class: `zA${th.unread ? ' zE' : ''}`, id: `row-${th.key}` },
      h('td', { class: 'cb' }, box),
      h('td', { class: 'st' }, icon('star')),
      h('td', { class: 'fr' }, h('span', { class: 'yP', text: th.from }), n > 1 ? h('i', { text: String(n) }) : null),
      h(
        'td',
        { class: 'sb' },
        h('span', { class: 'bog' }, h('span', { class: 'bqe', 'data-legacy-thread-id': th.id, text: th.subject })),
        h('span', { class: 'y2' }, h('span', { text: ' - ' }), th.snippet),
      ),
      h('td', { class: 'wh', text: th.when }),
    );
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = box.getAttribute('aria-checked') !== 'true';
      box.setAttribute('aria-checked', String(on));
      row.classList.toggle('x7', on);
      syncToolbar();
    });
    row.addEventListener('click', () => after(260, () => openThread(th)));
    return row;
  }

  function countUnread() {
    const n = D.THREADS.filter((t) => document.getElementById(`row-${t.key}`)?.classList.contains('zE')).length;
    document.getElementById('gm-unread').textContent = n ? String(n) : '';
    if (inboxEl && !inboxEl.hidden) document.title = `Inbox${n ? ` (${n})` : ''} - ${D.ME.email} - Gmail`;
  }

  const menuOpen = () => menuEl.style.display === 'block';
  function closeMenu() {
    menuEl.style.display = 'none';
    document.querySelectorAll('tr.zA.ctx').forEach((r) => r.classList.remove('ctx'));
  }

  // Gmail opens its own menu on inbox rows; elsewhere Chrome's own menu would show.
  function onContextMenu(e) {
    const row = e.target.closest?.('tr.zA');
    if (!row || inboxEl.hidden) return;
    e.preventDefault();
    closeMenu();
    // Gmail draws its menu afresh; the extension adds its items again a moment later.
    menuEl.querySelectorAll('.vpa-item, .vpa-sep').forEach((el) => el.remove());
    row.classList.add('ctx');
    menuEl.style.display = 'block';
    const p = toPage(e.clientX, e.clientY);
    const mh = menuEl.offsetHeight + S.extItems * 32 + 17; // room for the extension's items, added a moment later
    const top = clamp(p.y, 80, S.H - mh - 8);
    const left = clamp(p.x, 8, S.W - menuEl.offsetWidth - 8);
    Object.assign(menuEl.style, { left: `${left}px`, top: `${top}px` });
  }

  // "priya.shah@example.com" -> "Priya", from the people in the made-up mailbox.
  function firstName(email) {
    for (const th of D.THREADS) for (const m of th.messages) if (m.email === email) return m.name.split(' ')[0];
    return email;
  }

  function avatar(name) {
    const first = name.split(' ')[0];
    return h('div', { class: 'gm-av', style: { background: AVATAR[first] || '#5f6368' }, text: first[0] });
  }

  function openThread(th) {
    const row = document.getElementById(`row-${th.key}`);
    row?.classList.remove('zE');
    countUnread();
    const msgs = h('div', { class: 'gm-msgs', role: 'list' });
    for (const m of th.messages) {
      const short = m.date.split(', ').slice(1).join(', ');
      msgs.append(
        h(
          'div',
          { class: 'gm-msg', role: 'listitem' },
          avatar(m.name),
          h('div', { class: 'gm-who' }, h('span', { class: 'gD', name: m.name, email: m.email, text: m.name }), h('span', { class: 'go', text: `<${m.email}>` })),
          h('span', { class: 'g3', title: m.date, text: short }),
          h('div', { class: 'gm-to', text: m.to === D.ME.email ? 'to me' : `to ${firstName(m.to)}` }),
          h('div', { class: 'a3s', text: m.body }),
        ),
      );
    }
    const back = h('span', { id: 'gm-back' }, icon('back'));
    back.addEventListener('click', backToInbox);
    threadEl.replaceChildren(
      h('div', { class: 'gm-tools', gh: 'mtb' }, back, icon('archive'), icon('trash'), icon('unread'), moreButton()),
      h('div', { class: 'gm-head' }, h('h2', { class: 'hP', 'data-legacy-thread-id': th.id, text: th.subject }), h('span', { class: 'gm-chip', text: 'Inbox' })),
      msgs,
      h('div', { class: 'gm-acts' }, h('span', {}, icon('reply'), 'Reply'), h('span', {}, icon('forward'), 'Forward')),
    );
    inboxEl.hidden = true;
    threadEl.hidden = false;
    document.title = `${th.subject} - ${D.ME.email} - Gmail`;
    S.thread = th.key;
  }

  function backToInbox() {
    closeMenu();
    threadEl.hidden = true;
    inboxEl.hidden = false;
    S.thread = null;
    countUnread();
  }

  // ---- Settings (images of the real page) and the AI page ----

  let settingsImg, ai;

  function buildSettings() {
    settingsImg = h('img', { alt: '' });
    const el = h('div', { class: 'page', id: 'settings' }, settingsImg);
    viewEl.append(el);
    S.pages.settings = { el, x: S.W };
  }

  function buildAi() {
    ai = {};
    ai.text = h('div', { class: 'ai-text-in' });
    ai.ph = h('span', { class: 'ai-ph', text: 'Message' });
    ai.textBox = h('div', { class: 'ai-text' }, ai.ph, ai.text);
    ai.send = h('div', { class: 'ai-btn send' }, icon('up'));
    ai.box = h('div', { class: 'ai-box' }, ai.textBox, h('div', { class: 'ai-tools' }, h('div', { class: 'ai-btn add' }, icon('plus')), ai.send));
    ai.compose = h('div', { class: 'ai-compose' }, ai.box);
    ai.bubble = h('div', { class: 'ai-bubble' });
    ai.skel = h('div', { class: 'ai-skel' }, ...[96, 90, 62].map((w) => h('i', { style: { width: `${w}%` } })));
    ai.sentEl = h('div', { class: 'ai-sent', hidden: true }, ai.bubble, ai.skel);
    ai.col = h('div', { class: 'ai-col' }, ai.sentEl, ai.compose);
    ai.top = h('div', { class: 'ai-top', text: 'New chat' });
    const el = h('div', { class: 'page', id: 'ai' }, ai.top, ai.col);
    viewEl.append(el);
    S.pages.ai = { el, x: S.W };
  }

  function aiReset(textMax = 0.44) {
    S.ai = { text: '', scroll: 0, sent: 0, sentText: '', composeTop: 0.24, textMax };
    ai.text.textContent = '';
  }

  function renderAi() {
    const a = S.ai;
    const viewH = S.H - 76;
    const maxText = Math.round(viewH * a.textMax);
    ai.ph.hidden = !!a.text;
    ai.text.textContent = a.text;
    ai.textBox.style.maxHeight = `${maxText}px`;
    ai.text.style.transform = `translateY(${-a.scroll}px)`;
    // Fade the edge where the box cuts the text off.
    const hidden = ai.text.scrollHeight - ai.textBox.clientHeight - a.scroll;
    const top = a.scroll > 2 ? 'transparent, #000 28px' : '#000, #000';
    const bottom = hidden > 2 ? '#000 calc(100% - 34px), transparent' : '#000, #000';
    const mask = `linear-gradient(to bottom, ${top}, ${bottom})`;
    ai.textBox.style.webkitMaskImage = mask;
    ai.textBox.style.maskImage = mask;
    ai.send.classList.toggle('on', !!a.text);
    ai.sentEl.hidden = !a.sentText;
    ai.sentEl.style.top = `${Math.round(viewH * 0.2)}px`;
    ai.bubble.textContent = a.sentText;
    ai.sentEl.style.opacity = String(a.sent);
    ai.sentEl.style.transform = `translateY(${(1 - a.sent) * 40}px)`;
    // The answer is never shown: grey lines stand in for it.
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(S.t / 260));
    ai.skel.style.opacity = String(a.sent * pulse);
    const boxH = ai.compose.offsetHeight;
    const topEmpty = viewH * a.composeTop;
    const topSent = viewH - boxH - Math.round(96 * (S.W / 1024)); // clear of the captions
    ai.compose.style.top = `${topEmpty + (topSent - topEmpty) * a.sent}px`;
  }

  // ---- Installing it: the website, the download, the extensions page and the file windows ----
  // The website is the real docs/index.html, served by record.mjs under /__docs/ and shown in a frame, so
  // the real mouse hovers its button. Everything else here is a plain, generic drawing of what a browser
  // and a computer show while you install an extension, with no product's own look.

  let siteFrame, dlb, xmenu, extp, ghost, dimEl;

  function buildSite(src) {
    siteFrame = h('iframe', { src, title: 'The website' });
    const el = h('div', { class: 'page', id: 'site' }, siteFrame);
    viewEl.append(el);
    S.pages.site = { el, x: S.W };
    return new Promise((resolve) => {
      siteFrame.addEventListener('load', async () => {
        const doc = siteFrame.contentDocument;
        // A drawn click never leaves the page: links do nothing, and the videos keep their posters.
        doc.addEventListener('click', (e) => e.target.closest?.('a') && e.preventDefault(), true);
        for (const v of doc.querySelectorAll('video')) {
          v.pause();
          v.preload = 'none';
          v.play = () => Promise.resolve();
        }
        doc.documentElement.style.scrollBehavior = 'auto';
        await doc.fonts.ready;
        resolve({ title: doc.title, height: doc.documentElement.scrollHeight });
      });
    });
  }

  function buildDownloads({ name, size }) {
    dlb?.remove();
    dlb = h(
      'div',
      { id: 'dlb' },
      h('p', { class: 'h', text: 'Recent downloads' }),
      h(
        'div',
        { class: 'row' },
        svgFrom(FILE_ICONS.zip),
        h('div', { class: 't' }, h('b', { text: name }), h('span', { class: 's', text: size ? `${size} • Done` : 'Done' })),
        h('span', { class: 'btn', id: 'dlb-folder', title: 'Show in folder' }, icon('folder')),
      ),
    );
    document.body.append(dlb);
  }

  function buildXmenu({ name }) {
    xmenu?.remove();
    xmenu = h(
      'div',
      { id: 'xmenu' },
      h('div', { class: 'h' }, h('span', { text: 'Extensions' }), icon('x')),
      h('div', { class: 'row' }, svgFrom(MARK), h('span', { class: 'n', text: name }), h('span', { class: 'pin', id: 'xm-pin' }, icon('pinOff'))),
      h('div', { class: 'sep' }),
      h('div', { class: 'row' }, icon('gear'), h('span', { class: 'n', text: 'Manage extensions' })),
    );
    document.body.append(xmenu);
  }

  function buildExtPage() {
    extp = {};
    extp.sw = h('span', { class: 'xp-switch', id: 'xp-dev' }, h('i'));
    extp.tools = h(
      'div',
      { class: 'tools' },
      h('span', { class: 'xp-btn', id: 'xp-load', text: 'Load unpacked' }),
      h('span', { class: 'xp-btn', text: 'Pack extension' }),
      h('span', { class: 'xp-btn', text: 'Update' }),
    );
    extp.grid = h('div', { class: 'grid' });
    extp.inner = h(
      'div',
      { class: 'xp-in' },
      h(
        'div',
        { class: 'top' },
        icon('burger'),
        h('span', { class: 'title', text: 'Extensions' }),
        h('div', { class: 'search' }, icon('search'), 'Search extensions'),
        h('div', { class: 'dev' }, h('span', { text: 'Developer mode' }), extp.sw),
      ),
      extp.tools,
      extp.grid,
    );
    const el = h('div', { class: 'page', id: 'extp' }, extp.inner);
    viewEl.append(el);
    S.pages.extp = { el, x: S.W };
  }

  function extCard({ name, version, description, id, from }) {
    const mark = svgFrom(MARK);
    const sw = h('span', { class: 'xp-switch on' }, h('i'));
    return h(
      'div',
      { class: 'xp-card', id: 'xp-card' },
      h(
        'div',
        { class: 'c-top' },
        mark,
        h(
          'div',
          {},
          h('p', { class: 'c-name' }, name, h('span', { class: 'c-ver', text: version })),
          h('p', { class: 'c-desc', text: description }),
          id ? h('p', { class: 'c-id', text: `ID: ${id}` }) : null,
          from ? h('p', { class: 'c-id', text: `Loaded from: ${from}` }) : null,
        ),
      ),
      h('div', { class: 'c-foot' }, h('span', { class: 'xp-btn', text: 'Details' }), h('span', { class: 'xp-btn', text: 'Remove' }), h('span', { class: 'sp' }), icon('refresh'), sw),
    );
  }

  // A file window (the computer's Downloads folder) or a folder picker: a title bar, places on the left
  // and the folder's contents. rows: [{ key, name, kind: 'zip' | 'doc' | 'folder', size, type }].
  const PLACES = [['home', 'Home'], ['desktop', 'Desktop'], ['file', 'Documents'], ['download', 'Downloads']];
  function fileRow(r) {
    return h(
      'div',
      { class: 'row', 'data-row': r.key },
      h('span', { class: 'n' }, svgFrom(FILE_ICONS[r.kind]), h('span', { text: r.name })),
      h('span', { class: 's', text: r.size || '' }),
      h('span', { class: 'k', text: r.type || '' }),
    );
  }
  function buildWin(id, { title, place, rows, picker, x, y, w = 720, hgt = 400 }) {
    S.wins[id]?.el.remove();
    const win = { show: 0, rows: [] };
    win.title = h('span', { class: 't', text: title });
    win.side = h('div', { class: 'side' }, ...PLACES.map(([ic, name]) => h('div', { 'data-place': name, class: name === place ? 'on' : null }, icon(ic), name)));
    win.list = h('div', { class: 'rows' });
    win.field = h('b', { text: '' });
    win.el = h(
      'div',
      { class: `fw${picker ? ' foot' : ''}`, 'data-win': id, style: { width: `${w}px`, height: `${hgt}px` } },
      h(
        'div',
        { class: 'bar' },
        icon('folder'),
        win.title,
        h('span', { class: 'wb' }, icon('minimise'), icon('maximise'), icon('x')),
      ),
      h('div', { class: 'body' }, win.side, h('div', { class: 'main' }, h('div', { class: 'head' }, h('span', { text: 'Name' }), h('span', { text: 'Size' }), h('span', { text: 'Kind' })), win.list)),
      picker
        ? h(
            'div',
            { class: 'foot-row' },
            h('div', { class: 'field' }, h('span', { text: 'Folder:' }), win.field),
            h('span', { class: 'fb', text: 'Cancel' }),
            h('span', { class: 'fb go off', id: `${id}-select`, text: 'Select' }),
          )
        : null,
    );
    win.list.replaceChildren(...rows.map(fileRow));
    win.x = x ?? (S.W - w) / 2;
    win.y = y ?? 76 + 40;
    Object.assign(win.el.style, { left: `${win.x}px`, top: `${win.y}px` });
    document.body.append(win.el);
    S.wins[id] = win;
    return win;
  }

  // A row grows in or folds away, on the video's clock (driveAnimations sets every animation's time).
  // A grown row keeps no fill, so its classes (selected, dragged) style it once it is in.
  const growRow = (el) => el.animate([{ height: '0px', opacity: 0 }, { height: '36px', opacity: 1 }], { duration: 320, easing: 'ease-out' });
  // A moved row folds away slowly enough to see the rows below close up.
  const FOLD = 460;
  const foldRow = (el) => el.animate([{ height: '36px', opacity: 0.4 }, { height: '36px', opacity: 0, offset: 0.3 }, { height: '0px', opacity: 0 }], { duration: FOLD, easing: 'ease-in-out', fill: 'forwards' });

  function renderInstall() {
    // Toolbar icons growing in or out.
    for (const [k, el] of [['ext', extEl], ['puz', puzEl], ['dl', dlEl]]) {
      const g = S.bar[k];
      el.hidden = g <= 0.001;
      const mid = g < 0.999;
      Object.assign(el.style, { width: mid ? `${28 * g}px` : '', opacity: mid ? String(g) : '', marginLeft: mid ? `${-12 * (1 - g)}px` : '', overflow: mid ? 'hidden' : '' });
    }
    renderAddr(false);
    if (siteFrame && S.site.applied !== S.site.scroll) {
      try {
        siteFrame.contentWindow.scrollTo({ top: S.site.scroll, behavior: 'instant' });
        S.site.applied = S.site.scroll;
      } catch {}
    }
    const pop = (el, s, dy = -6) => {
      if (!el) return;
      el.hidden = s <= 0.001;
      el.style.opacity = String(s);
      el.style.transform = `translateY(${(1 - s) * dy}px) scale(${0.98 + 0.02 * s})`;
    };
    pop(dlb, S.dlb.show);
    pop(xmenu, S.xm.show);
    let dim = 0;
    for (const win of Object.values(S.wins)) {
      pop(win.el, win.show, 14);
      pop(win.menu, win.menuShow ?? 0, -4);
      dim = Math.max(dim, win.show);
    }
    if (dimEl) {
      dimEl.style.opacity = String(0.16 * dim);
      dimEl.hidden = dim <= 0.001;
    }
    if (extp) {
      const d = S.xp.dev;
      extp.sw.classList.toggle('on', d > 0.5);
      extp.sw.firstChild.style.left = `${3 + 16 * d}px`;
      extp.tools.style.height = `${56 * S.xp.tools}px`;
      extp.tools.style.opacity = String(clamp(S.xp.tools * 1.4 - 0.4, 0, 1));
      extp.tools.style.borderBottomWidth = S.xp.tools > 0.01 ? '1px' : '0';
    }
    if (S.drag && ghost) {
      const c = S.cursor;
      Object.assign(ghost.style, { left: `${c.x + 10}px`, top: `${c.y + 8}px` });
    }
  }

  // ---- The toolbar list: the real popup.html, as images captured from its own tab ----
  // It opens in a bubble under the extension's icon, as the browser shows an extension's popup.

  let popEl, popImg;
  function buildPopup() {
    popImg = h('img', { alt: '' });
    popEl = h('div', { id: 'popup', hidden: true }, popImg);
    document.body.append(popEl);
  }

  function renderPopup() {
    const s = S.pop.show;
    popEl.hidden = s <= 0.001;
    popEl.style.opacity = String(s);
    popEl.style.transform = `translateY(${(1 - s) * -6}px)`;
  }

  // ---- Chrome's prompt to open a desktop app, drawn ----

  let dlg;
  function buildDialog(app) {
    dlg?.remove();
    dlg = h(
      'div',
      { id: 'dlg' },
      h('h3', { text: `Open ${app}?` }),
      h('p', { text: 'https://mail.google.com wants to open this application.' }),
      h('div', { class: 'chk' }, h('span', { class: 'gm-box', id: 'dlg-box' }), h('span', { text: `Always allow mail.google.com to open links of this type in the associated app` })),
      h('div', { class: 'btns' }, h('span', { class: 'no', text: 'Cancel' }), h('span', { class: 'yes', id: 'dlg-yes', text: `Open ${app}` })),
    );
    document.body.append(dlg);
    S.dialog = { show: 0 };
    return dlg;
  }

  // ---- Overlay: captions, key caps, cards ----

  // The "Illustration" label sits over the tab strip's right end, but in the overlay, so it stays in
  // the corner when the camera zooms in. Cards, added after it, cover it.
  function buildHud() {
    hud = h('div', { id: 'hud' });
    capEl = h('div', { class: 'cap' });
    keysEl = h('div', { class: 'keys' });
    hud.append(badgeEl, keysEl, capEl);
    document.documentElement.append(hud);
    cursorEl = svgFrom(`<div id="cursor">${CURSOR}</div>`);
    document.body.append(cursorEl);
  }

  // A caption armed with toast starts the moment the extension's note reads what it matches, in that very
  // frame: the note changes when the service worker answers, which takes real time and can fall between a
  // frame's render and its screenshot (see setup), so a caption set a frame later would leave the old one
  // there for a frame, lifted clear of the grown note.
  function commitArmed() {
    const a = S.capArm;
    if (!a || !a.re.test(document.getElementById('vpa-toast')?.textContent || '')) return;
    S.capArm = null;
    COMMANDS.caption({ text: a.text, pos: a.pos, fade: a.fade });
    S.armedStart = S.t;
  }

  // Captions change in place; one that starts or ends with nothing beside it fades.
  function renderCaption() {
    commitArmed();
    const c = S.caps.filter((x) => x.start <= S.t && (x.end === undefined || S.t < x.end)).at(-1);
    if (!c) {
      liftCaption(null, null, true);
      return void capEl.replaceChildren();
    }
    const prev = S.caps[S.caps.indexOf(c) - 1];
    const fadeIn = !c.fade || (prev && prev.end !== undefined && prev.end >= c.start - 1) ? 1 : clamp((S.t - c.start) / 160, 0, 1);
    const next = S.caps[S.caps.indexOf(c) + 1];
    const fadeOut = c.end === undefined || (next && next.start <= c.end + 1) ? 1 : clamp((c.end - S.t) / 160, 0, 1);
    let span = capEl.firstChild;
    const fresh = !span || span.dataset.text !== c.text;
    if (fresh) {
      span = h('span', { 'data-text': c.text, text: c.text });
      capEl.replaceChildren(span);
    }
    capEl.style.opacity = String(Math.min(fadeIn, fadeOut));
    capEl.classList.toggle('top', c.pos === 'top');
    liftCaption(c, span, fresh);
  }

  // A bottom caption never covers the extension's note: while the note shows beneath it, the caption
  // rises just above it, and settles back once the note fades or a card covers the page. A new caption
  // takes its place straight away. Rising is never animated, so the caption is clear of the note in the
  // very frame the note appears or grows; settling back down moves smoothly.
  function liftCaption(c, span, snap) {
    let to = 0;
    const t = S.toastBox;
    if (c && span && t && c.pos !== 'top') {
      const r = span.getBoundingClientRect();
      const base = { left: r.left, right: r.right, top: r.top + S.lift.y, bottom: r.bottom + S.lift.y };
      const gap = 10 * (S.W / 1024);
      if (t.right + gap > base.left && t.left - gap < base.right && t.top - gap < base.bottom && t.bottom > base.top) to = Math.ceil(base.bottom - t.top + gap);
    }
    if (!c || c.pos === 'top' || to > S.lift.y) snap = true;
    if (to !== S.lift.to || (snap && S.lift.y !== to)) {
      S.lift.to = to;
      if (snap) {
        S.tweens = S.tweens.filter((tw) => tw.obj !== S.lift);
        S.lift.y = to;
      } else tween(S.lift, 'y', to, 260, 'inOut');
    }
    capEl.style.transform = S.lift.y > 0.01 ? `translateY(${-S.lift.y}px)` : '';
  }

  function renderKeys() {
    const k = S.keys;
    if (!k || S.t < k.t0 || S.t > k.t0 + k.dur) return void keysEl.replaceChildren();
    if (keysEl.childElementCount !== k.list.length) keysEl.replaceChildren(...k.list.map((name) => h('div', { class: 'key', text: name })));
    const el = (S.t - k.t0) / 140;
    const out = (k.t0 + k.dur - S.t) / 160;
    const show = clamp(Math.min(el, out), 0, 1);
    keysEl.style.opacity = String(show);
    keysEl.style.transform = `translateY(${(1 - EASE.out(show)) * 14}px)`;
    [...keysEl.children].forEach((key, i) => {
      const down = k.t0 + 260 + i * 130;
      const up = k.t0 + 260 + k.list.length * 130 + (k.hold ?? 300);
      key.classList.toggle('down', S.t >= down && S.t < up);
    });
  }

  // show is the card's paper, words its contents (see COMMANDS.card).
  function renderCards() {
    for (const c of S.cards) {
      c.el.style.opacity = String(c.show);
      c.el.hidden = c.show <= 0.001;
      for (const kid of c.el.children) kid.style.opacity = String(c.words);
      for (const p of c.el.querySelectorAll('[data-at]')) {
        const k = clamp((S.t - c.t0 - Number(p.dataset.at)) / 300, 0, 1);
        p.style.opacity = String(k);
        p.style.transform = `translateY(${(1 - EASE.out(k)) * 8}px)`;
      }
      for (const p of c.el.querySelectorAll('[data-mark-at]')) {
        const k = clamp((S.t - c.t0 - Number(p.dataset.markAt)) / 300, 0, 1);
        p.style.boxShadow = k > 0 ? `inset ${(3 * k * S.W) / 1024}px 0 0 var(--rubric)` : '';
      }
    }
  }

  // Cuts each fitted row at a word, with " …", so it fits on one line; a row with no space to cut at keeps
  // the CSS ellipsis. Run while the card is laid out, before it is first hidden.
  function fitRows(root) {
    const fits = (el) => el.scrollWidth <= el.clientWidth + 0.5;
    for (const el of root.querySelectorAll('.l.fit')) {
      if (fits(el) || el.classList.contains('cut')) continue; // the Gmail link keeps its start, with the CSS ellipsis
      const words = el.textContent.split(' ');
      const at = (n) => `${words.slice(0, n).join(' ')} …`;
      let lo = 1;
      let hi = words.length - 1;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        el.textContent = at(mid);
        if (fits(el)) {
          best = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      el.textContent = best ? at(best) : words.join(' ');
    }
  }

  function card(kind, o = {}) {
    let el;
    if (kind === 'title' || kind === 'end') {
      el = h(
        'div',
        { class: `card ${kind}` },
        svgFrom(MARK.replace('<svg ', '<svg class="mark" ')),
        h('p', { class: 'name', text: 'Open in AI Agent for Gmail' }),
        o.line ? h('p', { class: 'line', text: o.line }) : null,
        o.url ? h('p', { class: 'url', text: o.url }) : null,
        o.small ? h('p', { class: 'small', text: o.small }) : null,
      );
    } else if (kind === 'thumb') {
      // A video site's thumbnail: the name on a panel at the left, the live inbox beside it.
      el = h(
        'div',
        { class: 'card thumb' },
        h(
          'div',
          { class: 'panel' },
          svgFrom(MARK.replace('<svg ', '<svg class="mark" ')),
          h('p', { class: 'name', text: 'Open in AI Agent for Gmail' }),
          o.head ? h('p', { class: 'head', text: o.head }) : null,
          o.line ? h('p', { class: 'line', text: o.line }) : null,
          o.small ? h('p', { class: 'small', text: o.small }) : null,
        ),
      );
    } else if (kind === 'prompt') {
      // fit: every row is one line, cut at a word to fit (fitRows). marks: [pattern, note] pairs; a row that
      // matches a pattern gets a red rule on its left when that note appears.
      const marks = (o.marks || []).map(([src, i]) => [new RegExp(src), o.notesAt?.[i] ?? 0]);
      const lines = o.prompt.split('\n').map((line) => {
        const hl = /^(Mailbox|Thread ID|Gmail link|Email subject):/.test(line);
        const cut = /^Gmail link:/.test(line);
        const mark = marks.find(([re]) => re.test(line));
        const cls = `l${hl ? ' hl' : ''}${cut ? ' cut' : ''}${o.fit ? ' fit' : ''}${o.fit && !line.trim() ? ' blank' : ''}`;
        return h('span', { class: cls, 'data-mark-at': mark ? String(mark[1]) : null, text: line || ' ' });
      });
      el = h(
        'div',
        { class: `card prompt${o.big ? ' big' : ''}` },
        h('h3', { text: o.title }),
        h('p', { class: 'sub', text: o.sub }),
        h(
          'div',
          { class: 'grid' },
          h('div', { class: 'lines' }, lines),
          h('div', { class: 'notes' }, ...(o.notes || []).map(([b, t], i) => h('p', { 'data-at': String(o.notesAt?.[i] ?? 0) }, h('b', { text: b }), t))),
        ),
      );
    }
    hud.insertBefore(el, keysEl);
    if (o.fit) fitRows(el);
    const c = { el, show: 0, words: 0, kind, t0: S.t };
    S.cards.push(c);
    return c;
  }

  // ---- Pointer ----

  function cursorAt(t) {
    const p = S.path;
    if (!p) return S.cursor;
    const k = clamp((t - p.t0) / p.dur, 0, 1);
    const e = EASE.inOut(k);
    const x = (1 - e) * (1 - e) * p.a.x + 2 * (1 - e) * e * p.c.x + e * e * p.b.x;
    const y = (1 - e) * (1 - e) * p.a.y + 2 * (1 - e) * e * p.c.y + e * e * p.b.y;
    if (k >= 1) S.path = null;
    return Object.assign(S.cursor, { x, y });
  }

  function moveTo(x, y, dur) {
    const a = { x: S.cursor.x, y: S.cursor.y };
    const b = { x, y };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dur === undefined) dur = clamp(380 + dist * 0.75, 420, 1100);
    // A slight curve, as a hand moves a mouse.
    const bend = Math.min(60, dist * 0.12);
    const c = { x: (a.x + b.x) / 2 + (-dy / (dist || 1)) * bend, y: (a.y + b.y) / 2 + (dx / (dist || 1)) * bend };
    S.path = { a, b, c, t0: S.t, dur };
    return dur;
  }

  function renderPointer() {
    const c = cursorAt(S.t);
    const scale = 1 - 0.12 * c.press;
    cursorEl.style.transform = `translate(${c.x - 1}px, ${c.y - 1}px) scale(${scale})`;
    cursorEl.style.opacity = String(1 - c.hidden);
    S.rings = S.rings.filter((r) => {
      const k = (S.t - r.t0) / (r.life || 480);
      if (k >= 1) return void r.el.remove();
      const e = EASE.out(clamp(k, 0, 1));
      const size = 10 + 34 * e;
      Object.assign(r.el.style, { left: `${r.x - size / 2}px`, top: `${r.y - size / 2}px`, width: `${size}px`, height: `${size}px`, opacity: String(1 - k) });
      return true;
    });
  }

  // ---- Frame ----

  // The extension's note lives in the Gmail tab: a page sliding over Gmail covers it too. Records
  // where the note shows on screen, for the captions to keep clear of. A card in front hides it.
  function measureToast() {
    const front = Math.min(S.W, ...Object.entries(S.pages).filter(([n, p]) => n !== 'gm' && p.x > -1).map(([, p]) => p.x));
    const toast = document.getElementById('vpa-toast');
    S.toastBox = null;
    if (!toast) return;
    const b = boxOf(toast);
    const cut = clamp(b.x + b.w - front, 0, b.w);
    toast.style.clipPath = cut > 0 ? `inset(0 ${cut}px 0 0)` : '';
    const covered = S.cards.some((c) => c.kind !== 'thumb' && c.show > 0.5);
    const shown = toast.textContent.trim() && toast.style.visibility !== 'hidden' && Number(getComputedStyle(toast).opacity) > 0.05;
    if (shown && !covered && cut < b.w - 1) {
      const r = toast.getBoundingClientRect();
      S.toastBox = { left: r.left, top: r.top, right: r.right - cut * S.camT.z, bottom: r.bottom };
    }
  }

  function render() {
    const { tx, ty, z } = camTransform();
    document.body.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
    for (const [name, p] of Object.entries(S.pages)) {
      p.el.style.transform = `translateX(${p.x}px)`;
      p.el.style.visibility = p.x >= S.W - 0.5 || p.x <= -S.W + 0.5 ? 'hidden' : 'visible';
      if (name !== 'gm') p.el.style.boxShadow = p.x > 0.5 && p.x < S.W - 0.5 ? '-12px 0 32px rgba(0, 0, 0, 0.12)' : 'none';
      if (p.o !== undefined) p.el.style.opacity = String(p.o); // a page fading in after a typed address
    }
    renderInstall();
    document.body.style.setProperty('--gm-x', `${S.pages.gm.x}px`);
    measureToast();
    for (const tab of S.tabs) if (tab.grow !== undefined && tab.grow < 1) renderTabs();
    renderAi();
    if (S.dialog && dlg) {
      const s = S.dialog.show;
      dlg.style.opacity = String(s);
      dlg.style.transform = `translateX(-50%) translateY(${(1 - s) * -8}px) scale(${0.97 + 0.03 * s})`;
      dlg.hidden = s <= 0.001;
    }
    renderPopup();
    renderPointer();
    renderCaption();
    renderKeys();
    renderCards();
  }

  function frame(t) {
    S.t = t;
    runTimers();
    runTweens();
    driveAnimations();
    render();
    const v = toView(S.cursor.x, S.cursor.y);
    // mx, my: where the pointer is on screen (after the camera); px, py: on the page.
    return { mx: Math.round(v.x * 100) / 100, my: Math.round(v.y * 100) / 100, px: S.cursor.x, py: S.cursor.y };
  }

  // ---- Commands from record.mjs ----

  // A selector, { sel, text } for the element under sel whose text is text, or a point.
  function resolve(target, o = {}) {
    let el;
    // "site:<selector>": an element in the website's frame.
    if (typeof target === 'string' && target.startsWith('site:')) {
      const inner = siteFrame?.contentDocument?.querySelector(target.slice(5));
      if (!inner) throw new Error(`stage: nothing in the website matches ${target.slice(5)}`);
      const r = inner.getBoundingClientRect();
      const f = boxOf(siteFrame);
      const k = f.w / siteFrame.clientWidth;
      return { x: f.x + (r.left + r.width * (o.ax ?? 0.5)) * k + (o.dx || 0), y: f.y + (r.top + r.height * (o.ay ?? 0.5)) * k + (o.dy || 0) };
    }
    if (typeof target === 'object' && target && target.sel) {
      el = [...document.querySelectorAll(target.sel)].find((x) => x.textContent.trim() === target.text);
      if (!el) throw new Error(`stage: no ${target.sel} reads "${target.text}"`);
    } else if (typeof target === 'object' && target) return { x: target.x, y: target.y };
    else el = document.querySelector(target);
    if (!el) throw new Error(`stage: nothing matches ${target}`);
    const b = boxOf(el);
    return { x: b.x + b.w * (o.ax ?? 0.5) + (o.dx || 0), y: b.y + b.h * (o.ay ?? 0.5) + (o.dy || 0) };
  }

  const COMMANDS = {
    setup({ W, H, items = 2 }) {
      Object.assign(S, { W, H, extItems: items });
      document.body.append(cursorEl); // in front of the extension's note, which arrived after it
      S.cam = { z: 1, x: W / 2, y: H / 2 };
      document.documentElement.style.setProperty('--u', String(W / 1024));
      for (const p of Object.values(S.pages)) if (p !== S.pages.gm) p.x = W;
      S.cursor = { x: W * 0.68, y: H * 0.8, press: 0, hidden: 0 };
      // The note's text changes when the extension hears back from its service worker, which takes
      // real time and can fall between a frame's render and its screenshot. Measure the note again
      // then, so a bottom caption is clear of it in that very frame.
      const toast = document.getElementById('vpa-toast');
      if (toast) {
        new MutationObserver(() => {
          measureToast();
          renderCaption();
        }).observe(toast, { childList: true, subtree: true, characterData: true });
      }
      return { ok: true };
    },
    // The pointer: to a selector (with ax/ay anchors and dx/dy offsets) or a point, in page coordinates.
    move({ to, dur, ...o }) {
      const p = resolve(to, o);
      return { dur: moveTo(p.x, p.y, dur), x: p.x, y: p.y };
    },
    place({ to, ...o }) {
      const p = resolve(to, o);
      S.path = null;
      Object.assign(S.cursor, p);
      return p;
    },
    // ring: how long the click's ring lasts, in ms (shorter where what was clicked goes away at once).
    press({ down, ring: life = 480 }) {
      tween(S.cursor, 'press', down ? 1 : 0, 90, 'out');
      if (down) {
        const ring = h('div', { class: 'ring' });
        document.body.append(ring);
        S.rings.push({ x: S.cursor.x, y: S.cursor.y, t0: S.t, el: ring, life });
      }
      return {};
    },
    hidePointer({ hidden = 1, dur = 200 }) {
      tween(S.cursor, 'hidden', hidden, dur, 'inOut');
      return {};
    },
    cam({ z = 1, to, dur = 700, ease = 'inOut', ...o }) {
      const p = to ? resolve(to, o) : { x: S.W / 2, y: S.H / 2 };
      tween(S.cam, 'z', z, dur, ease);
      tween(S.cam, 'x', p.x, dur, ease);
      tween(S.cam, 'y', p.y, dur, ease);
      return {};
    },
    // toast: a pattern; the caption waits until the extension's note matches it (commitArmed).
    caption({ text, pos = 'bottom', fade = true, toast }) {
      if (toast) {
        S.capArm = { text, pos, fade, re: new RegExp(toast) };
        S.armedStart = null;
        commitArmed();
        return {};
      }
      const open = S.caps.at(-1);
      if (open && open.end === undefined) open.end = S.t;
      if (text) S.caps.push({ text, start: S.t, pos, fade });
      return {};
    },
    keys({ list, dur = 1300, hold, pos = 'bottom' }) {
      S.keys = { list, t0: S.t, dur, hold };
      keysEl.classList.toggle('top', pos === 'top');
      return {};
    },
    // Tabs: the Gmail tab, the settings page or an AI page. A new tab grows in the strip and its page
    // slides in from the right.
    tabs({ list, active }) {
      S.tabs = list;
      S.active = active;
      renderTabs();
      return {};
    },
    openTab({ id, title, url, addr, fav, page, dur = 520 }) {
      S.tabs = S.tabs.filter((x) => x.id !== id);
      const tab = { id, title, url, addr, fav, page, grow: 0 };
      S.tabs.push(tab);
      tween(tab, 'grow', 1, 220, 'out');
      return COMMANDS.switchTab({ id, dur });
    },
    switchTab({ id, dur = 520 }) {
      const tab = S.tabs.find((x) => x.id === id);
      const from = S.tabs.find((x) => x.id === S.active);
      const fromPage = S.pages[from?.page || 'gm'];
      const toPage = S.pages[tab.page];
      const forward = S.tabs.indexOf(tab) > S.tabs.indexOf(from);
      if (toPage !== fromPage) {
        // Only the two pages in the slide show, and the one coming in from the right (or going out to
        // it) is on top, whatever order the pages were built in.
        for (const p of Object.values(S.pages)) {
          if (p === toPage || p === fromPage || Math.abs(p.x) >= S.W - 0.5) continue;
          S.tweens = S.tweens.filter((tw) => tw.obj !== p);
          p.x = -S.W;
        }
        (forward ? toPage : fromPage).el.style.zIndex = String(++S.z);
        toPage.x = forward ? S.W : -S.W * 0.3;
        tween(toPage, 'x', 0, dur, 'inOut');
        tween(fromPage, 'x', forward ? -S.W * 0.3 : S.W, dur, 'inOut');
      }
      after(dur / 2, () => {
        S.active = id;
        renderTabs();
      });
      return { dur };
    },
    pages(xs) {
      for (const [name, x] of Object.entries(xs)) if (S.pages[name]) S.pages[name].x = x;
      return {};
    },
    settingsImage({ src }) {
      settingsImg.src = src;
      return settingsImg.decode().then(() => ({}));
    },
    // textMax: how much of the page the pasted text may fill, as a share of it. A full box reaches nearly to a
    // one-line caption; a two-line caption needs it a little shorter (the key caps above it leave no room to
    // move it up).
    aiReset({ textMax } = {}) {
      aiReset(textMax);
      return {};
    },
    aiPaste({ text }) {
      S.ai.text = text;
      ai.text.textContent = text;
      ai.ph.hidden = true;
      return {};
    },
    // Scrolls the pasted text inside the box so the end of the thread shows.
    aiScroll({ to = 'end', dur = 2600 }) {
      const max = Math.max(0, ai.text.scrollHeight - ai.textBox.clientHeight);
      tween(S.ai, 'scroll', to === 'end' ? max : Math.min(max, to), dur, 'inOut');
      return { max };
    },
    aiSend({ dur = 520 }) {
      S.ai.sentText = S.ai.text;
      S.ai.text = '';
      S.ai.scroll = 0;
      tween(S.ai, 'sent', 1, dur, 'out');
      return {};
    },
    dialog({ app, show = 1, dur = 220 }) {
      if (app) buildDialog(app);
      tween(S.dialog, 'show', show, dur, 'out');
      return {};
    },
    dialogTick() {
      document.getElementById('dlg-box')?.classList.add('on');
      return {};
    },
    dialogHover({ on = true }) {
      document.getElementById('dlg-yes')?.classList.toggle('hover', on);
      return {};
    },
    extHover({ on = true }) {
      extEl.classList.toggle('hover', on);
      return {};
    },
    // The toolbar list's bubble: src, a capture of the real popup.html, w x h in CSS pixels. Its top right sits
    // under the extension's icon. Returns the bubble's box on the page, for the recorder to map the pointer.
    popup({ src, w, h: ph, show = 1, dur = 160 }) {
      if (src) {
        popImg.src = src;
        Object.assign(popImg.style, { width: `${w}px`, height: `${ph}px` });
        const b = boxOf(extEl);
        const left = clamp(b.x + b.w + 8 - w, 8, S.W - w - 8);
        Object.assign(popEl.style, { left: `${left}px`, top: '74px' });
        S.popBox = { x: left, y: 74, w, h: ph };
      }
      // Laid out at once (still transparent), so the camera can aim at it straight away.
      if (show > 0) popEl.hidden = false;
      tween(S.pop, 'show', show, dur, 'out');
      return popImg.decode().then(() => S.popBox);
    },
    popupImage({ src }) {
      popImg.src = src;
      return popImg.decode().then(() => ({}));
    },
    // A card fades through paper: coming in, its paper covers the page before its words appear; going
    // out, the words go before the paper. So a card's words never sit over the inbox behind it. The
    // thumbnail's panel is the card itself and fades as one.
    card({ kind, show = 1, dur = 450, ...o }) {
      const c = o.id !== undefined ? S.cards[o.id] : card(kind, o);
      const paper = dur * 0.6;
      const words = dur - paper;
      if (c.kind === 'thumb' || dur <= 0) {
        tween(c, 'show', show, dur, 'inOut');
        tween(c, 'words', show, dur, 'inOut');
      } else if (show > c.show) {
        tween(c, 'show', show, paper, 'inOut');
        after(paper, () => tween(c, 'words', show, words, 'out'));
      } else {
        tween(c, 'words', show, words, 'in');
        after(words, () => tween(c, 'show', show, paper, 'inOut'));
      }
      return { id: S.cards.indexOf(c) };
    },
    backToInbox() {
      backToInbox();
      return {};
    },
    // Puts the inbox back as it was at the start (for a loop's last frames).
    resetInbox() {
      backToInbox();
      for (const th of D.THREADS) {
        const row = document.getElementById(`row-${th.key}`);
        row.classList.toggle('zE', th.unread);
        row.classList.remove('x7', 'ctx');
        row.querySelector('[role="checkbox"]').setAttribute('aria-checked', 'false');
      }
      syncToolbar();
      countUnread();
      const toast = document.getElementById('vpa-toast');
      if (toast) toast.style.visibility = 'hidden';
      return {};
    },
    showToast() {
      const toast = document.getElementById('vpa-toast');
      if (toast) toast.style.visibility = '';
      return {};
    },
    // ---- The install video ----
    // Which toolbar icons show: ext (the extension's own, once pinned), puz (the Extensions menu) and dl
    // (downloads). true or false, or how far grown in (0 to 1); dur animates the change.
    toolbar({ dur = 0, ...icons }) {
      for (const [k, v] of Object.entries(icons)) if (k in S.bar) tween(S.bar, k, v === true ? 1 : v === false ? 0 : Number(v), dur, 'out');
      return {};
    },
    // Room kept below a right-click for the extension's items, when a tick adds one after setup.
    menuRoom({ items }) {
      S.extItems = items;
      return {};
    },
    // The website, in a page of its own; resolves once it has loaded, with its title.
    site({ src = '/__docs/index.html' }) {
      return siteFrame ? { title: siteFrame.contentDocument.title } : buildSite(src);
    },
    siteScroll({ to = 0, dur = 800 }) {
      tween(S.site, 'scroll', to, dur, 'inOut');
      return {};
    },
    // A click in the address bar selects the address; typing replaces it.
    addrFocus() {
      const tab = S.tabs.find((x) => x.id === S.active);
      S.addr = { mode: 'select', text: tab.addr ? tab.addr.join('').trim() : tab.url, t0: S.t, dur: 0 };
      renderAddr(true);
      return {};
    },
    addrType({ text, dur = 900 }) {
      S.addr = { mode: 'type', text, t0: S.t, dur };
      renderAddr(true);
      return { dur };
    },
    // The tab goes to another address: its title, address and favicon change and the new page fades in.
    navTab({ id, dur = 280, ...props }) {
      const tab = S.tabs.find((x) => x.id === id);
      const from = S.pages[tab.page];
      Object.assign(tab, props);
      const to = S.pages[tab.page];
      if (to !== from) {
        to.el.style.zIndex = String(++S.z);
        S.tweens = S.tweens.filter((tw) => tw.obj !== to);
        to.x = 0;
        to.o = 0;
        tween(to, 'o', 1, dur, 'out');
        after(dur, () => {
          from.x = -S.W;
        });
      }
      S.addr = null;
      addrEl.classList.remove('focus');
      delete addrEl.dataset.key;
      renderTabs();
      return {};
    },
    // The download bubble under the toolbar, right-aligned to the downloads icon.
    downloads({ show = 1, dur = 240, name, size }) {
      if (name) {
        buildDownloads({ name, size });
        const me = boxOf(document.querySelector('#bar .me'));
        dlb.style.left = `${me.x - 12 + 8 - 340}px`;
      }
      tween(S.dlb, 'show', show, dur, 'out');
      return {};
    },
    // The puzzle-piece Extensions menu. pinned: the extension's pin, filled once it is pinned.
    xmenu({ show, dur = 200, name, pinned }) {
      if (name) {
        buildXmenu({ name });
        const b = boxOf(puzEl);
        xmenu.style.left = `${b.x + b.w + 8 - 330}px`;
      }
      if (pinned !== undefined) {
        const pin = document.getElementById('xm-pin');
        pin.classList.toggle('on', pinned);
        pin.replaceChildren(icon(pinned ? 'pin' : 'pinOff'));
      }
      if (show !== undefined) tween(S.xm, 'show', show, dur, 'out');
      return {};
    },
    extPage() {
      if (!extp) buildExtPage();
      return {};
    },
    // Developer mode: the switch slides on and the row with Load unpacked opens below the header.
    extDev({ on = true, dur = 220 }) {
      tween(S.xp, 'dev', on ? 1 : 0, dur, 'inOut');
      after(dur * 0.4, () => tween(S.xp, 'tools', on ? 1 : 0, 340, 'out'));
      return {};
    },
    // The extension's card: { name, version, description, id, from }.
    extCard(o) {
      const card = extCard(o);
      extp.grid.replaceChildren(card);
      card.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, easing: 'ease-out', fill: 'forwards' });
      return {};
    },
    // A file window or folder picker: with title it is built afresh ({ title, place, rows, picker, x, y,
    // w, hgt }); show and dur bring it in or take it away.
    win({ id, show = 1, dur = 320, ...o }) {
      if (o.title) buildWin(id, o);
      if (!dimEl) {
        dimEl = h('div', { id: 'dim', hidden: true });
        document.body.append(dimEl);
      }
      tween(S.wins[id], 'show', show, dur, 'out');
      return {};
    },
    // Selects a row. In a picker, field is the name shown in the Folder box, and Select works once there
    // is one (or when ready says so).
    winSelect({ id, row, field, ready }) {
      const win = S.wins[id];
      for (const r of win.list.children) r.classList.toggle('on', r.dataset.row === row);
      if (field !== undefined) win.field.textContent = field;
      if (field !== undefined || ready !== undefined) document.getElementById(`${id}-select`)?.classList.toggle('off', !(ready ?? field));
      return {};
    },
    // A new row (an unzipped folder) grows in at position at.
    winAdd({ id, row, at = 0, select = true }) {
      const win = S.wins[id];
      const el = fileRow(row);
      win.list.insertBefore(el, win.list.children[at] || null);
      growRow(el);
      if (select) COMMANDS.winSelect({ id, row: row.key });
      return {};
    },
    // Dragging a row: it dims, and a copy of it follows the pointer until winDrop.
    winDrag({ id, row }) {
      const el = S.wins[id].list.querySelector(`[data-row="${row}"]`);
      el.classList.add('drag');
      ghost = h('div', { class: 'fw-ghost' }, el.querySelector('svg').cloneNode(true), h('span', { text: el.querySelector('.n span').textContent }));
      document.body.append(ghost);
      S.drag = { id, row };
      renderInstall();
      return {};
    },
    // A file's right-click menu, opening at the pointer: items are labels, '-' a rule. The real mouse
    // hovers its items. show and dur bring it in or take it away.
    winMenu({ id, items, show = 1, dur = 140 }) {
      const win = S.wins[id];
      if (items) {
        win.menu?.remove();
        win.menu = h('div', { class: 'fw-menu', 'data-menu': id }, ...items.map((it) => (it === '-' ? h('hr') : h('div', { 'data-item': it, text: it }))));
        Object.assign(win.menu.style, { left: `${S.cursor.x + 2}px`, top: `${S.cursor.y + 2}px` });
        document.body.append(win.menu);
        win.menuShow = 0;
      }
      tween(win, 'menuShow', show, dur, 'out');
      return {};
    },
    winOver({ id, place }) {
      for (const p of S.wins[id].side.children) p.classList.toggle('drop', p.dataset.place === place);
      return {};
    },
    winDrop({ id }) {
      const el = S.wins[id].list.querySelector(`[data-row="${S.drag.row}"]`);
      foldRow(el);
      after(FOLD + 40, () => el.remove());
      ghost?.remove();
      ghost = null;
      S.drag = null;
      return {};
    },
    // Another place in a file window: its name in the title, the place lit on the left, and its rows.
    winPlace({ id, place, rows, select }) {
      const win = S.wins[id];
      win.title.textContent = place;
      for (const p of win.side.children) {
        p.classList.toggle('on', p.dataset.place === place);
        p.classList.remove('drop');
      }
      win.list.replaceChildren(...rows.map(fileRow));
      if (select) COMMANDS.winSelect({ id, row: select });
      return {};
    },
    // When an armed caption started (null while it waits). now: commit it at this time if it still waits.
    armed({ now } = {}) {
      if (S.capArm && now !== undefined) {
        const a = S.capArm;
        S.capArm = null;
        COMMANDS.caption({ text: a.text, pos: a.pos, fade: a.fade });
        S.caps.at(-1).start = now;
        S.caps.at(-2) && (S.caps.at(-2).end = now);
        S.armedStart = now;
      }
      return { start: S.armedStart ?? null, waiting: !!S.capArm };
    },
    state() {
      const toast = document.getElementById('vpa-toast');
      return {
        menu: menuOpen(),
        items: menuOpen() ? [...menuEl.querySelectorAll('.vpa-item')].map((i) => i.textContent) : [],
        toast: toast && getComputedStyle(toast).opacity !== '0' ? toast.textContent : '',
        thread: S.thread || null,
        title: document.title,
        // The extension's button in Gmail's toolbar, and its menu's items while it is open.
        tb: document.querySelector('.vpa-tb')?.textContent.trim() || '',
        tbItems: [...document.querySelectorAll('.vpa-tb-menu .vpa-tb-item')].map((i) => i.textContent.trim()),
      };
    },
  };

  window.__stage = {
    frame,
    cmd(name, args = {}) {
      if (!Object.hasOwn(COMMANDS, name)) throw new Error(`stage: no command ${name}`);
      return COMMANDS[name](args);
    },
  };

  buildWindow();
  buildGmail();
  buildSettings();
  buildAi();
  buildPopup();
  buildHud();
  S.tabs = [{ id: 'gm', title: `Inbox - ${D.ME.email} - Gmail`, url: 'mail.google.com/mail/u/0/#inbox', fav: 'mail', page: 'gm' }];
  renderTabs();
  aiReset();
})();
