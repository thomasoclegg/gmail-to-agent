// The stage the recordings are made on. It is served at https://mail.google.com/mail/u/0/ inside a
// throwaway headless Chrome, so the real extension's content script runs in it. It draws:
//   - a browser window (tab strip, address bar, the extension's toolbar icon), schematic and neutral;
//   - a Gmail-like inbox and thread view built from the selectors content.js reads (tr.zA, span.bqe with
//     data-legacy-thread-id, Gmail's body > div.J-M menu, h2[data-legacy-thread-id], role=list messages
//     with span.gD, span.g3 and div.a3s), so the extension's real menu items and note appear in it;
//   - the real settings page, as images captured from its own tab by record.mjs;
//   - a neutral AI page with no logo, for the paste;
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
    back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
    fwd: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
    x: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    tune: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
    up: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
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
    for (const a of document.getAnimations()) {
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

  let hud, capEl, keysEl, cursorEl, tabsEl, addrEl, badgeEl, viewEl, extEl;

  function buildWindow() {
    tabsEl = h('div', { id: 'tabs' });
    badgeEl = h('div', { id: 'badge', text: 'Illustration' });
    addrEl = h('div', { id: 'addr' });
    extEl = h('div', { id: 'ext', title: 'Open in AI Agent settings' }, h('img', { src: '/__stage/icon32.png', alt: '' }));
    const bar = h(
      'div',
      { id: 'bar' },
      icon('back', 'nav'),
      icon('fwd', 'nav off'),
      icon('refresh', 'nav'),
      addrEl,
      extEl,
      h('div', { class: 'me', text: 'S' }),
    );
    viewEl = h('div', { id: 'view' });
    document.body.append(tabsEl, badgeEl, bar, viewEl);
  }

  function tabEl(tab) {
    const fav = h('span', { class: 'fav' });
    fav.append(svgFrom(tab.fav === 'mark' ? MARK : tab.fav === 'dot' ? DOT : ENVELOPE));
    return h('div', { class: 'tab', 'data-tab': tab.id }, fav, h('span', { class: 't', text: tab.title }), icon('x', 'x'));
  }

  function renderTabs() {
    tabsEl.replaceChildren(
      ...S.tabs.map((tab) => {
        const el = tabEl(tab);
        if (tab.id === S.active) el.classList.add('on');
        if (tab.grow !== undefined && tab.grow < 1) Object.assign(el.style, { width: `${228 * tab.grow}px`, opacity: String(tab.grow) });
        return el;
      }),
      h('div', { class: 'plus' }, icon('plus')),
    );
    const tab = S.tabs.find((x) => x.id === S.active);
    const m = tab?.addr ? ['', ...tab.addr] : tab?.url.match(/^(?:https?:\/\/)?([^/]+)(.*)$/) || ['', '', ''];
    addrEl.replaceChildren(icon('tune', 'tune'), h('span', { text: m[1] }), h('span', { class: 'rest', text: m[2] }));
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
      h('div', { class: 'gm-tools' }, selectAll(), icon('refresh'), icon('more'), h('span', { class: 'count', text: D.INBOX_COUNT })),
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
      h('div', { class: 'gm-tools' }, back, icon('archive'), icon('trash'), icon('unread'), icon('more')),
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

  function aiReset() {
    S.ai = { text: '', scroll: 0, sent: 0, sentText: '', composeTop: 0.24 };
    ai.text.textContent = '';
  }

  function renderAi() {
    const a = S.ai;
    const viewH = S.H - 76;
    const maxText = Math.round(viewH * 0.44);
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

  function buildHud() {
    hud = h('div', { id: 'hud' });
    capEl = h('div', { class: 'cap' });
    keysEl = h('div', { class: 'keys' });
    hud.append(keysEl, capEl);
    document.documentElement.append(hud);
    cursorEl = svgFrom(`<div id="cursor">${CURSOR}</div>`);
    document.body.append(cursorEl);
  }

  // Captions change in place; one that starts or ends with nothing beside it fades.
  function renderCaption() {
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
          o.line ? h('p', { class: 'line', text: o.line }) : null,
          o.small ? h('p', { class: 'small', text: o.small }) : null,
        ),
      );
    } else if (kind === 'prompt') {
      const lines = o.prompt.split('\n').map((line) => {
        const hl = /^(Mailbox|Thread ID|Gmail link|Email subject):/.test(line);
        const cut = /^Gmail link:/.test(line);
        return h('span', { class: `l${hl ? ' hl' : ''}${cut ? ' cut' : ''}`, text: line || ' ' });
      });
      el = h(
        'div',
        { class: 'card prompt' },
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
      const k = (S.t - r.t0) / 480;
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
    }
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
    return { mx: Math.round(v.x * 100) / 100, my: Math.round(v.y * 100) / 100 };
  }

  // ---- Commands from record.mjs ----

  // A selector, { sel, text } for the element under sel whose text is text, or a point.
  function resolve(target, o = {}) {
    let el;
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
    press({ down }) {
      tween(S.cursor, 'press', down ? 1 : 0, 90, 'out');
      if (down) {
        const ring = h('div', { class: 'ring' });
        document.body.append(ring);
        S.rings.push({ x: S.cursor.x, y: S.cursor.y, t0: S.t, el: ring });
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
    caption({ text, pos = 'bottom', fade = true }) {
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
    aiReset() {
      aiReset();
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
    state() {
      const toast = document.getElementById('vpa-toast');
      return {
        menu: menuOpen(),
        items: menuOpen() ? [...menuEl.querySelectorAll('.vpa-item')].map((i) => i.textContent) : [],
        toast: toast && getComputedStyle(toast).opacity !== '0' ? toast.textContent : '',
        thread: S.thread || null,
        title: document.title,
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
  buildHud();
  S.tabs = [{ id: 'gm', title: `Inbox - ${D.ME.email} - Gmail`, url: 'mail.google.com/mail/u/0/#inbox', fav: 'mail', page: 'gm' }];
  renderTabs();
  aiReset();
})();
