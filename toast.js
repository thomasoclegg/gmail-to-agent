// The extension's note at the bottom left of the page (the toast) and its mark. Plain script: the manifest
// loads it before content.js in Gmail tabs, and background.js puts it into the tab where text was selected
// and picked from the browser's menu, to say what happened there.
//
// Notes that confirm something close by themselves and wait while the pointer or keyboard focus is on them,
// or while the tab is hidden (a web AI opens in front of Gmail a second after the copy, and the note must
// still be there when the user comes back). Errors stay until the close button or Escape. Screen readers
// hear notes through a role=status region and errors through a role=alert one. Both sit apart from the
// visible note, rendered but visually hidden, so they are in the accessibility tree, empty, before anything
// is said (screen readers skip live regions that arrive already filled, or that are hidden); the visible
// text is hidden from screen readers so it is not read twice. With reduced motion asked for, the note
// appears and goes without moving.
//
// It can arrive twice in one tab (the manifest and background.js), so the whole script sits in one block
// that a second copy skips, as content.js does.
if (globalThis.vpaToastLoaded !== true) {
  globalThis.vpaToastLoaded = true;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  // Marks this copy's note. A copy that an update orphaned (1.3.0 and earlier had a note of another shape)
  // may have made the one in the page; this copy then puts its own in its place.
  const COPY = Math.random().toString(36).slice(2, 10);
  // The one red: the toolbar icon, the website and the settings page use it too.
  // 3:1 or more on Gmail's light and dark menus (hover rows included) and on the toast.
  const MARK_RED = '#fb3e36';
  const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function svgNode(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    return node;
  }

  // An envelope and a three-item menu with its top item in red, as in the toolbar icon.
  // The envelope and the other two items take the text colour.
  function markIcon(size, envelopeOpacity = 1) {
    const icon = svgNode('svg', { viewBox: '0 0 20 20', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' });
    const ink = { fill: 'none', stroke: 'currentColor', 'stroke-opacity': envelopeOpacity, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const item = (y, fill, opacity = 1) =>
      svgNode('rect', { x: 15.5, y, width: 3.5, height: 2.2, rx: 0.5, fill, 'fill-opacity': opacity });
    icon.append(
      svgNode('rect', { x: 1.75, y: 5.25, width: 11.5, height: 8.5, rx: 1.25, ...ink, 'stroke-width': 1.5 }),
      svgNode('path', { d: 'M2.9 6.4 7.5 10l4.6-3.6', ...ink, 'stroke-width': 1.3 }),
      item(4.5, MARK_RED),
      item(8.4, 'currentColor', envelopeOpacity),
      item(12.3, 'currentColor', envelopeOpacity),
    );
    icon.style.flex = 'none';
    return icon;
  }

  function keycap(text) {
    const key = document.createElement('kbd');
    key.textContent = text;
    Object.assign(key.style, {
      display: 'inline-block',
      margin: '0 1px',
      padding: '0 6px 1px',
      font: 'inherit',
      fontSize: '12.5px',
      fontWeight: '600',
      lineHeight: '17px',
      color: '#ffffff',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.34)',
      borderBottomWidth: '2px',
      borderRadius: '4px',
    });
    return key;
  }

  // "Cmd+V" shows as two keycaps; the "+" stays in the text for screen readers.
  function keys(text) {
    if (text === 'Enter') return keycap(text);
    const [mod, key] = text.split('+');
    const plus = document.createElement('span');
    plus.textContent = '+';
    Object.assign(plus.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' });
    const combo = document.createElement('kbd');
    Object.assign(combo.style, { font: 'inherit', whiteSpace: 'nowrap' });
    combo.append(keycap(mod), plus, keycap(key));
    return combo;
  }

  // A keycap stays on one line with the word before it and the punctuation after it.
  function keyGroup(part) {
    const [, before, key, after] = part.match(/^(.*?)\b((?:Cmd|Ctrl)\+V|Enter)\b(.*)$/);
    const group = document.createElement('span');
    group.style.whiteSpace = 'nowrap';
    group.append(before, keys(key), after);
    return group;
  }

  // The message as text, with key names as keycaps. Never parsed as HTML.
  function messageNodes(text) {
    return text
      .split(/((?:\S+ )?\b(?:(?:Cmd|Ctrl)\+V|Enter)\b\S*)/)
      .map((part, i) => (i % 2 ? keyGroup(part) : document.createTextNode(part)))
      .filter((node) => node.textContent);
  }

  // A 2 px line along the bottom of the note.
  function bottomLine(el, colour) {
    const bar = document.createElement('span');
    bar.className = 'vpa-line';
    Object.assign(bar.style, {
      position: 'absolute',
      left: '0',
      right: '0',
      bottom: '0',
      height: '2px',
      background: colour,
      transformOrigin: 'left',
    });
    el.append(bar);
    return bar;
  }

  // The two live regions, in a box that is always rendered but takes no room and shows nothing: present
  // and empty from the start, filled when there is something to say. Ours sits directly in body, as the
  // note does, and is replaced if another copy of this script made it.
  function liveBox() {
    const old = document.querySelector('body > div#vpa-live');
    if (old?.dataset.vpaCopy === COPY) return old;
    const box = document.createElement('div');
    box.id = 'vpa-live';
    box.dataset.vpaCopy = COPY;
    Object.assign(box.style, {
      position: 'fixed',
      left: '0',
      bottom: '0',
      display: 'block',
      width: '1px',
      height: '1px',
      margin: '-1px',
      padding: '0',
      border: '0',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
    });
    for (const role of ['status', 'alert']) {
      const region = document.createElement('span');
      region.className = `vpa-${role}`;
      region.setAttribute('role', role);
      region.style.display = 'block';
      box.append(region);
    }
    box.dataset.since = String(Date.now());
    if (old) old.replaceWith(box);
    else document.body.append(box);
    return box;
  }

  // Says text in the matching region: emptied first, then filled a moment later, so the same text twice is
  // still heard. A region made just now gets longer, so screen readers have seen it empty first.
  let sayTimer = 0;
  function say(text, isError) {
    const box = liveBox();
    clearTimeout(sayTimer);
    for (const region of box.children) region.textContent = '';
    if (!text) return;
    const fresh = Date.now() - Number(box.dataset.since) < 1000;
    sayTimer = setTimeout(() => (box.querySelector(isError ? '[role="alert"]' : '[role="status"]').textContent = text), fresh ? 250 : 50);
  }

  // An X drawn in SVG, so the note's text stays only the message.
  function closeButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vpa-close';
    button.setAttribute('aria-label', 'Close');
    button.title = 'Close';
    Object.assign(button.style, {
      flex: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      margin: '-4px -8px -4px 2px',
      padding: '0',
      border: '0',
      borderRadius: '50%',
      background: 'transparent',
      color: '#f1f1f1',
      cursor: 'pointer',
      outlineOffset: '1px',
    });
    const x = svgNode('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true', focusable: 'false' });
    x.append(svgNode('path', { d: 'M3.5 3.5l9 9m0-9l-9 9', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
    button.append(x);
    button.addEventListener('mouseenter', () => (button.style.background = 'rgba(255, 255, 255, 0.12)'));
    button.addEventListener('mouseleave', () => (button.style.background = 'transparent'));
    // A ring only for keyboard focus, in the mark's red.
    button.addEventListener('focus', () => {
      if (button.matches(':focus-visible')) button.style.outline = `2px solid ${MARK_RED}`;
    });
    button.addEventListener('blur', () => (button.style.outline = 'none'));
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      hideToast();
    });
    for (const type of ['mousedown', 'mouseup']) button.addEventListener(type, (e) => e.stopPropagation());
    return button;
  }

  // The note's timer: it runs only while the note is shown and nothing rests on it.
  const clock = { timer: 0, left: 0, endsAt: 0, held: new Set(), animation: null, clearTimer: 0 };

  function stopClock() {
    clearTimeout(clock.timer);
    clock.timer = 0;
  }

  function runClock() {
    stopClock();
    if (!clock.left || clock.held.size) return;
    clock.endsAt = Date.now() + clock.left;
    clock.timer = setTimeout(hideToast, clock.left);
    clock.animation?.play();
  }

  function hold(reason) {
    if (clock.held.has(reason)) return;
    clock.held.add(reason);
    if (clock.timer) clock.left = Math.max(0, clock.endsAt - Date.now());
    stopClock();
    clock.animation?.pause();
  }

  function release(reason) {
    if (!clock.held.delete(reason)) return;
    runClock();
  }

  // Ours sits directly in body, where email content never does (an email could carry the same id).
  function toastElement() {
    const old = document.querySelector('body > div#vpa-toast');
    if (old?.dataset.vpaCopy === COPY) return old;
    const el = document.createElement('div');
    el.id = 'vpa-toast';
    el.dataset.vpaCopy = COPY;
    // Gmail's own snackbar shape, with the extension's mark in place of a coloured stripe.
    Object.assign(el.style, {
      position: 'fixed',
      left: '24px',
      bottom: '24px',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxSizing: 'border-box',
      maxWidth: 'min(440px, calc(100vw - 48px))',
      padding: '11px 16px 11px 12px',
      borderRadius: '8px',
      overflow: 'hidden',
      background: '#202124',
      color: '#f1f1f1',
      font: '14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      textAlign: 'left',
      boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.14), 0 4px 16px rgba(0, 0, 0, 0.3)',
      opacity: '0',
      visibility: 'hidden',
      transition: 'opacity 150ms ease, visibility 0s linear 150ms',
      pointerEvents: 'none',
    });
    el.append(markIcon(22), closeButton());
    el.addEventListener('mouseenter', () => hold('pointer'));
    el.addEventListener('mouseleave', () => release('pointer'));
    el.addEventListener('focusin', () => hold('focus'));
    el.addEventListener('focusout', (e) => {
      if (!el.contains(e.relatedTarget)) release('focus');
    });
    if (old) old.replaceWith(el);
    else document.body.append(el);
    return el;
  }

  const isShown = (el) => el?.style.opacity === '1';

  // Keeps the mark and the close button; drops the message and the line.
  function clearToast(el) {
    el.querySelectorAll('.vpa-msg, .vpa-line').forEach((node) => node.remove());
    clock.animation = null;
  }

  const tabHidden = () => document.visibilityState === 'hidden';

  function hideToast() {
    const el = document.querySelector('body > div#vpa-toast');
    stopClock();
    clock.left = 0;
    clock.held.clear();
    if (tabHidden()) clock.held.add('hidden');
    clearTimeout(clock.clearTimer);
    if (!el) return;
    // Focus on the close button would go with the note; give it back to the page.
    if (el.contains(document.activeElement)) document.activeElement.blur();
    const quick = reducedMotion();
    el.style.transition = quick ? 'none' : 'opacity 150ms ease, visibility 0s linear 150ms';
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
    clock.clearTimer = setTimeout(() => clearToast(el), quick ? 0 : 200);
    say('');
  }

  // A note shown in a tab the user has left waits for them to come back.
  if (tabHidden()) clock.held.add('hidden');
  document.addEventListener('visibilitychange', () => (tabHidden() ? hold('hidden') : release('hidden')));

  // Escape closes the note wherever focus is, and leaves the key to the page as well.
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && isShown(document.querySelector('body > div#vpa-toast'))) hideToast();
    },
    true,
  );

  // On success the line is neutral and runs out with the note.
  function countdown(el, ms) {
    if (reducedMotion()) return;
    const bar = bottomLine(el, 'rgba(255, 255, 255, 0.45)');
    clock.animation = bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
  }

  // Created empty up front: screen readers skip live regions that arrive already filled.
  if (document.body) {
    toastElement();
    liveBox();
  }

  // An error stays until it is closed; any other note closes after ms, unless the pointer or focus rests on
  // it or the tab is hidden. quiet: shown but not said (a step in a longer read).
  function toast(text, isError = false, ms = isError ? 0 : 4000, withCountdown = false, quiet = false) {
    const el = toastElement();
    clearTimeout(clock.clearTimer);
    stopClock();
    clock.animation?.cancel();
    clearToast(el);
    const message = document.createElement('span');
    message.className = 'vpa-msg';
    // Screen readers hear the live region instead.
    message.setAttribute('aria-hidden', 'true');
    message.append(...messageNodes(text));
    // Errors keep the mark and get a red line that stays; the text says what went wrong.
    el.dataset.tone = isError ? 'error' : 'note';
    el.querySelector('.vpa-close').before(message);
    if (!quiet) say(text, isError);
    if (isError) bottomLine(el, MARK_RED);
    else if (withCountdown) countdown(el, ms);
    el.style.transition = reducedMotion() ? 'none' : 'opacity 150ms ease';
    el.style.visibility = 'visible';
    el.style.pointerEvents = 'auto';
    el.style.opacity = '1';
    clock.left = isError ? 0 : ms;
    // A note that replaces one under the pointer waits too.
    if (clock.held.size) clock.animation?.pause();
    runClock();
    return message;
  }

  // Shown but not said: screen readers hear the first note and the result, not every step.
  function quietToast(text, ms) {
    toast(text, false, ms, false, true);
  }

  // The script's last value is what scripting.executeScript hands back to background.js. Firefox refuses a
  // value it cannot copy, such as the note's element, and the note would then not show, so it is nothing.
  void 0;
}
