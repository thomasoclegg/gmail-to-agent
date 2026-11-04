// Mock Gmail: inbox rows (tr.zA), Gmail's own row menu (body > div.J-M), and
// a thread view with expanded (h7) and collapsed (kv) messages, hidden older
// messages (span.adx) and an "Expand all" control. Old thread views stay in the
// DOM hidden, as Gmail keeps them.
(() => {
  const g = {
    menuDelay: 20,
    openDelay: 300,
    expandDelay: 250,
    log: [], // { ev, ...detail, t }
    menuActivations: [],
  };
  window.__gmail = g;
  const t = () => Date.now() - window.__mock.t0;
  const log = (ev, detail = {}) => g.log.push({ ev, ...detail, t: t() });
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    n.append(...kids);
    return n;
  };

  const main = document.getElementById('main');
  const inbox = document.getElementById('inbox');
  const tbody = document.querySelector('#inbox tbody');
  document.title = INBOX_TITLE;

  // ---- Inbox rows ----
  // As in Gmail, the subject is span.bqe (the node with the thread id), the snippet span.y2
  // ("&nbsp;-&nbsp;" then the text), and the checkbox carries aria-checked.
  for (const [id, th] of Object.entries(THREADS)) {
    const count = th.messages.length > 1 ? el('span', { class: 'bx0', text: String(th.messages.length) }) : '';
    const snippetText = th.rowSnippet ?? th.messages.at(-1)?.snippet ?? '';
    const snippet = el('span', { class: 'y2' }, el('span', { class: 'Zt', text: '\u00a0-\u00a0' }), snippetText);
    const row = el(
      'tr',
      { class: `zA${th.unread ? ' zE' : ''}`, id: `row-${th.key}` },
      el('td', { class: 'oZ-x3' }, el('div', { role: 'checkbox', 'aria-checked': 'false' })),
      el('td', { class: 'yX' }, el('span', { class: 'yP', email: `${th.key.toLowerCase()}@x.test`, name: th.from, text: th.from }), count),
      el(
        'td',
        { class: 'xY' },
        el('span', { class: 'bog' }, el('span', { class: 'bqe', 'data-thread-id': `#thread-f:${BigInt('0x' + id)}`, 'data-legacy-thread-id': id, text: th.subject })),
        snippetText ? snippet : '',
      ),
    );
    row.addEventListener('click', () => {
      log('row-click', { key: th.key });
      if (th.neverOpens) return;
      setTimeout(() => openThread(id), g.openDelay);
    });
    tbody.append(row);
  }

  // ---- Gmail's own row menu (one element, shown and hidden) ----
  const menu = el('div', { class: 'J-M agd jQjAxd', role: 'menu', style: 'display:none' });
  for (const label of ['Reply', 'Forward', '-', 'Archive', 'Delete', 'Mark as read']) {
    if (label === '-') menu.append(el('div', { class: 'J-Kh', role: 'separator' }));
    else menu.append(el('div', { class: 'J-N', role: 'menuitem' }, el('div', { class: 'J-N-Jz', text: label })));
  }
  // Gmail's items act on mouseup.
  menu.addEventListener('mouseup', (e) => {
    const item = e.target.closest('.J-N');
    if (!item) return;
    g.menuActivations.push(item.textContent);
    log('gmail-menu-item', { label: item.textContent });
    hideMenu();
  });
  // A second, hidden Gmail menu that must be left alone.
  const otherMenu = el('div', { class: 'J-M', role: 'menu', id: 'other-menu', style: 'display:none' }, el('div', { class: 'J-N', role: 'menuitem' }, el('div', { class: 'J-N-Jz', text: 'Other menu item' })));
  document.body.append(menu, otherMenu);
  g.menu = menu;

  function hideMenu() {
    menu.style.display = 'none';
  }
  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest?.('tr.zA');
    if (!row || inbox.style.display === 'none') return; // Chrome's own menu shows
    e.preventDefault();
    log('gmail-menu-requested', { row: row.id });
    setTimeout(() => {
      Object.assign(menu.style, { display: 'block', left: `${e.clientX}px`, top: `${e.clientY}px` });
      log('gmail-menu-open');
    }, g.menuDelay);
  });
  document.body.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      log('escape');
      hideMenu();
    }
  });

  // ---- Thread view ----
  function messageEl(th, m, state) {
    const msg = th.messages[m];
    const head = [
      el('span', { class: 'gD', email: msg.email, name: msg.name, text: msg.name }),
      el('span', { class: 'g3', title: msg.date, text: msg.date.split(', ').pop() }),
    ];
    if (state === 'collapsed') {
      return el('div', { role: 'listitem', class: 'kv', 'data-m': m }, ...head, el('span', { class: 'iA g6', text: msg.snippet }));
    }
    if (state === 'loading') {
      return el('div', { role: 'listitem', class: 'h7', 'data-m': m }, ...head, el('div', { class: 'loading', text: 'Loading...' }));
    }
    const body = el('div', { class: 'a3s aiL' });
    if (msg.html != null) body.innerHTML = msg.html; // trusted test markup
    else {
      body.style.whiteSpace = 'pre-wrap';
      body.textContent = msg.text;
    }
    return el('div', { role: 'listitem', class: 'h7', 'data-m': m }, ...head, body);
  }

  // loading: expanded messages that were not open before show no body yet.
  function renderList(th, list, expandAllNow, loading = false) {
    list.replaceChildren();
    const opened = (s) => (loading && s !== 'expanded' ? 'loading' : 'expanded');
    for (const part of th.layout) {
      if (part.older && !expandAllNow) {
        list.append(el('div', { class: 'kQ bg adv' }, el('span', { class: 'adx', 'aria-label': `${part.older.length} older messages`, text: String(part.older.length) })));
      } else if (part.older) {
        for (const m of part.older) list.append(messageEl(th, m, opened('hidden')));
      } else {
        list.append(messageEl(th, part.m, expandAllNow ? opened(part.s) : part.s));
      }
    }
  }

  function openThread(id) {
    const th = THREADS[id];
    // Replace an earlier view of the same thread; hide every other view.
    main.querySelectorAll(`.thread-view[data-id="${id}"]`).forEach((v) => v.remove());
    main.querySelectorAll('.thread-view').forEach((v) => (v.style.display = 'none'));
    inbox.style.display = 'none';
    document.getElementById(`row-${th.key}`)?.classList.remove('zE');

    const list = el('div', { role: 'list' });
    const expandBtn = el('div', { role: 'button', tabindex: '0', 'aria-label': 'Expand all', class: 'bjz', text: 'Expand all' });
    const view = el(
      'div',
      { class: 'thread-view nH', 'data-id': id },
      el('div', { class: 'ha' }, el('h2', { class: 'hP', 'data-legacy-thread-id': id, text: th.subject }), th.messages.length > 1 ? expandBtn : ''),
    );
    main.append(view);
    const addList = () => {
      renderList(th, list, false);
      view.append(list);
      log('thread-rendered', { key: th.key });
    };
    if (th.listDelay) setTimeout(addList, th.listDelay);
    else addList();
    document.title = `${th.subject} - ${MAILBOX} - ${ACCOUNT} Mail`;
    log('thread-open', { key: th.key });

    const expand = () =>
      setTimeout(() => {
        renderList(th, list, true, !!th.bodyDelay);
        expandBtn.setAttribute('aria-label', 'Collapse all');
        expandBtn.textContent = 'Collapse all';
        log('expanded', { key: th.key });
        if (th.bodyDelay) {
          setTimeout(() => {
            renderList(th, list, true);
            log('bodies-loaded', { key: th.key });
          }, th.bodyDelay);
        }
      }, g.expandDelay);
    let down = false;
    expandBtn.addEventListener('click', () => {
      log('expand-click', { key: th.key });
      if (th.expand === 'click' && expandBtn.getAttribute('aria-label') === 'Expand all') expand();
    });
    expandBtn.addEventListener('mousedown', () => {
      log('expand-mousedown', { key: th.key });
      down = true;
    });
    expandBtn.addEventListener('mouseup', () => {
      log('expand-mouseup', { key: th.key });
      if (down && th.expand === 'press' && expandBtn.getAttribute('aria-label') === 'Expand all') expand();
      down = false;
    });
  }

  g.openThread = openThread;
  // Tick rows as Gmail does. mode 'aria' sets the checkbox's aria-checked; 'x7' drops
  // aria-checked and adds class x7 to the row (the fallback); 'both-false' keeps aria-checked="false" with x7.
  g.select = (keys, mode = 'aria') => {
    for (const key of keys) {
      const r = document.getElementById(`row-${key}`);
      const box = r.querySelector('[role="checkbox"]');
      if (mode === 'aria') box.setAttribute('aria-checked', 'true');
      if (mode === 'x7') {
        box.removeAttribute('aria-checked');
        r.classList.add('x7');
      }
      if (mode === 'both-false') {
        box.setAttribute('aria-checked', 'false');
        r.classList.add('x7');
      }
    }
    log('select', { keys, mode });
  };
  g.clearSelection = () => {
    document.querySelectorAll('tr.zA').forEach((r) => {
      r.classList.remove('x7');
      r.querySelector('[role="checkbox"]').setAttribute('aria-checked', 'false');
    });
  };
  g.backToInbox = () => {
    hideMenu();
    main.querySelectorAll('.thread-view').forEach((v) => (v.style.display = 'none'));
    inbox.style.display = '';
    document.title = INBOX_TITLE;
    log('back-to-inbox');
  };
})();
