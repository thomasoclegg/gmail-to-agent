// Runs one storyboard: sets up Chrome, the extension and the stage, then steps time one frame at a
// time. Each frame: the content script's clock moves to t, the stage draws t, the real mouse follows the
// drawn pointer (so hover and clicks are real events), and the tab is captured as a PNG. Nothing waits
// on the wall clock, so a render is the same on a slow or a fast machine.

import fs from 'node:fs';
import path from 'node:path';
import { copyExtension, stageData, startChrome, loadExtension, openTab, serveStage, CONTENT_CLOCK } from './browser.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME_H = 76; // the drawn tab strip and toolbar

export class Director {
  constructor(board, { work, log }) {
    this.board = board;
    this.work = work;
    this.log = log;
    this.fps = board.fps || 30;
    this.dt = 1000 / this.fps;
    this.t = 0;
    this.n = 0;
    this.captions = [];
    this.frames = path.join(work, 'frames');
    this.mouse = { x: -1, y: -1 };
    this.settingsLive = false;
    this.settingsScroll = 0;
    this.popupLive = false; // the toolbar list is open: capture it every frame
    this.onPopup = false;
    this.popBox = null;
    this.scrollTween = null;
    this.marks = {};
  }

  // ---- Setting up ----

  async start() {
    const { size, platform = 'win', targets } = this.board;
    fs.mkdirSync(this.frames, { recursive: true });
    this.data = stageData();
    this.b = await startChrome({ profile: path.join(this.work, 'profile'), log: this.log });
    this.manifest = copyExtension(path.join(this.work, 'extension'));
    this.ext = await loadExtension(this.b, path.join(this.work, 'extension'), { targets, log: this.log });

    this.page = await openTab(this.b, { width: size.w, height: size.h, dsf: size.dsf, platform });
    await serveStage(this.b, this.page, this.data);
    await this.b.send('Page.navigate', { url: 'https://mail.google.com/mail/u/0/#inbox' }, this.page.session);
    // The content script arrives at document_idle and creates its (empty) note straight away.
    const iso = await this.waitReal('the content script in the stage tab', async () => {
      const ctx = this.page.contexts.find((c) => c.auxData?.type === 'isolated' && c.origin === `chrome-extension://${this.ext.id}`);
      if (!ctx) return null;
      const ready = await this.b.eval(this.page.session, `!!document.getElementById('vpa-toast') && !!window.__stage`).catch(() => false);
      return ready ? ctx : null;
    });
    this.iso = iso.id;
    await this.b.eval(this.page.session, 'document.fonts.ready.then(() => true)');
    this.log(`content clock: ${await this.b.eval(this.page.session, CONTENT_CLOCK, this.iso)}`);
    await this.stage('setup', { W: size.w, H: size.h, items: this.board.targets.length });
    if (this.board.settings) await this.openSettingsTab();
    this.log(`stage ready: ${size.w}x${size.h} at ${size.dsf}x, ${platform === 'mac' ? 'Mac' : 'Windows'} keys, ${this.manifest.name} ${this.manifest.version}`);
  }

  // Chrome on a Mac reports its own shortcut form ("⌃⇧O") whatever the tab's user agent says. With
  // Windows keys, an extension page (the settings page, the toolbar list) gets the manifest's default keys
  // ("Alt+Shift+O"), as Chrome on Windows reports them, so the video shows one platform's keys throughout.
  async windowsKeys(session) {
    const { platform = 'win' } = this.board;
    const keys = Object.fromEntries(Object.entries(this.manifest.commands || {}).map(([n, c]) => [n, c.suggested_key?.default]).filter(([, k]) => k));
    if (platform === 'mac' || process.platform !== 'darwin' || !Object.keys(keys).length) return;
    const source = `(() => { try {
      const keys = ${JSON.stringify(keys)};
      const all = chrome.commands.getAll.bind(chrome.commands);
      chrome.commands.getAll = async () => (await all()).map((c) => (c.shortcut && keys[c.name] ? { ...c, shortcut: keys[c.name] } : c));
    } catch {} })();`;
    await this.b.send('Page.addScriptToEvaluateOnNewDocument', { source }, session);
  }

  // The real settings page, in a tab of its own the size of the drawn window's page area. settingsZoom: how
  // far the storyboard zooms in on it, so it is captured sharp enough for that.
  async openSettingsTab() {
    const { size, platform = 'win', settingsZoom = 1 } = this.board;
    this.opt = await openTab(this.b, { width: size.w, height: size.h - FRAME_H, dsf: size.dsf * settingsZoom, platform });
    await this.windowsKeys(this.opt.session);
    await this.b.send('Page.navigate', { url: `chrome-extension://${this.ext.id}/options.html` }, this.opt.session);
    await this.waitReal('the settings page', () => this.b.eval(this.opt.session, `document.querySelectorAll('#tiles .tile').length > 0 && document.fonts.status === 'loaded'`).catch(() => false));
    this.settingsScroll = 0;
  }

  // ---- The toolbar list ----

  // Opens the real toolbar list (popup.html) in a tab of its own, 320 px wide like the browser's popup, and
  // shows it in the stage's bubble under the extension's icon. The list asks for the tab in front, which in
  // this headless browser is not the stage, so it is pointed at the stage's Gmail tab; it then asks the
  // content script there what is open or ticked, as it does in the browser. Each open loads it afresh, so it
  // shows what Gmail has now. While it is open the pointer moves (and hovers) in its tab.
  async openPopup() {
    const { size, platform = 'win' } = this.board;
    if (!this.pop) {
      this.pop = await openTab(this.b, { width: 320, height: 600, dsf: size.dsf, platform });
      await this.windowsKeys(this.pop.session);
      const source = `(() => { try {
        const query = chrome.tabs.query.bind(chrome.tabs);
        chrome.tabs.query = (info = {}) => (info.active ? query({ url: 'https://mail.google.com/*' }) : query(info));
      } catch {} })();`;
      await this.b.send('Page.addScriptToEvaluateOnNewDocument', { source }, this.pop.session);
    }
    await this.b.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 600, deviceScaleFactor: size.dsf, mobile: false }, this.pop.session);
    await this.b.send('Page.navigate', { url: `chrome-extension://${this.ext.id}/popup.html` }, this.pop.session);
    await this.waitReal('the toolbar list', () =>
      this.b.eval(this.pop.session, `document.readyState === 'complete' && document.fonts.status === 'loaded' && !!document.getElementById('context')?.textContent && document.querySelectorAll('#list .ai').length > 0`).catch(() => false),
    );
    // The shortcut line at its foot comes a moment after the list.
    await this.waitReal('the shortcut line in the toolbar list', () => this.b.eval(this.pop.session, `!document.getElementById('last').hidden`).catch(() => false), 3000).catch(() => {});
    await sleep(150);
    const h = await this.b.eval(this.pop.session, 'Math.ceil(document.body.getBoundingClientRect().height)');
    await this.b.send('Emulation.setDeviceMetricsOverride', { width: 320, height: h, deviceScaleFactor: size.dsf, mobile: false }, this.pop.session);
    await sleep(100);
    this.popupText = await this.b.eval(this.pop.session, `({ context: document.getElementById('context').textContent, items: [...document.querySelectorAll('#list .ai')].map((b) => b.textContent), last: document.getElementById('last').textContent })`);
    this.popBox = await this.stage('popup', { src: await this.popupShot(), w: 320, h, show: 1, dur: 160 });
    this.popupLive = true;
    this.onPopup = true;
    this.mouse = { x: -1, y: -1 };
    return this.popupText;
  }

  async popupShot() {
    const { data } = await this.b.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }, this.pop.session);
    return `data:image/png;base64,${data}`;
  }

  async closePopup(dur = 120) {
    this.popupLive = false;
    this.onPopup = false;
    this.mouse = { x: -1, y: -1 };
    await this.stage('popup', { show: 0, dur });
  }

  async waitReal(what, probe, ms = 15000) {
    for (const end = Date.now() + ms; ; await sleep(100)) {
      const v = await probe();
      if (v) return v;
      if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    }
  }

  async finish() {
    const sw = this.ext?.sw;
    const result = {
      frames: this.n,
      duration: this.n / this.fps,
      blocked: this.b?.blocked || [],
      exceptions: this.page?.exceptions || [],
      copies: sw ? await this.b.eval(sw, '__copies.length').catch(() => null) : null,
      opened: sw ? await this.b.eval(sw, '__opened').catch(() => null) : null,
      printViews: this.page?.printViews || 0,
      version: this.manifest?.version,
      chrome: this.b?.version,
    };
    // The last caption runs to the end.
    const last = this.captions.at(-1);
    if (last && last.end === undefined) last.end = this.t;
    await this.b?.close();
    return result;
  }

  // ---- The stage ----

  stage(name, args = {}) {
    return this.b.eval(this.page.session, `Promise.resolve(window.__stage.cmd(${JSON.stringify(name)}, ${JSON.stringify(args)}))`);
  }

  // ---- Frames ----

  // Print views (several selected emails) arrive a little apart, as from a real mailbox.
  async release() {
    for (const h of this.page.held) {
      h.at ??= this.t + (this.board.latency || [380, 640, 860, 1000])[(h.n - 1) % 4];
      if (this.t >= h.at && !h.done) {
        h.done = true;
        await h.fulfil();
      }
    }
    this.page.held = this.page.held.filter((h) => !h.done);
  }

  async frame() {
    await this.release();
    await this.b.eval(this.page.session, `__clock.to(${this.t})`, this.iso);
    const r = await this.b.eval(this.page.session, `window.__stage.frame(${this.t})`);
    await this.pointer(r.mx, r.my, r.px, r.py);
    if (this.settingsLive) await this.pushSettings();
    if (this.popupLive) await this.stage('popupImage', { src: await this.popupShot() });
    const { data } = await this.b.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }, this.page.session);
    fs.writeFileSync(path.join(this.frames, `f${String(this.n).padStart(5, '0')}.png`), Buffer.from(data, 'base64'));
    this.n++;
    this.t = (this.n * 1000) / this.fps;
  }

  // Moves the real mouse with the drawn one: into the settings tab while its page is in front, and into
  // the toolbar list's tab while the list is open (px, py: the pointer on the page, before the camera).
  async pointer(x, y, px = x, py = y) {
    if (x === this.mouse.x && y === this.mouse.y) return;
    this.mouse = { x, y, px, py };
    const target = this.mouseTarget();
    await this.b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: target.x, y: target.y, button: 'none', buttons: 0 }, target.s);
  }

  mouseTarget() {
    const { x, y, px = x, py = y } = this.mouse;
    if (this.onPopup && this.popBox) return { s: this.pop.session, x: px - this.popBox.x, y: py - this.popBox.y };
    // The settings page is drawn at page coordinates, so the pointer's page position is where it is in
    // that tab, wherever the camera is.
    return this.onSettings ? { s: this.opt.session, x: px, y: py - FRAME_H } : { s: this.page.session, x, y };
  }

  async pushSettings() {
    const tw = this.scrollTween;
    if (tw) {
      const p = Math.min(1, (this.t - tw.t0) / tw.dur);
      const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      this.settingsScroll = tw.from + (tw.to - tw.from) * e;
      if (p >= 1) this.scrollTween = null;
    }
    await this.b.eval(this.opt.session, `window.scrollTo(0, ${Math.round(this.settingsScroll)})`);
    const { data } = await this.b.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }, this.opt.session);
    await this.stage('settingsImage', { src: `data:image/png;base64,${data}` });
  }

  // Renders frames for ms.
  async wait(ms) {
    const end = this.t + ms - 0.001;
    while (this.t < end) await this.frame();
  }

  // Renders frames until the storyboard's clock reads ms.
  async at(ms, label) {
    if (this.t > ms + this.dt) this.log(`  note: ${label || 'a step'} wanted ${ms} ms but the clock is at ${Math.round(this.t)} ms`);
    await this.wait(ms - this.t);
  }

  // Renders frames until the stage state passes check, at most max ms of video. late: the latest
  // storyboard time the state may arrive at. A later arrival (a slow take on a busy machine) stops the
  // render, so a badly paced take is never encoded; render it again.
  async until(what, check, max = 4000, { late } = {}) {
    const end = this.t + max;
    for (;;) {
      const s = await this.stage('state');
      if (check(s)) {
        if (late !== undefined && this.t > late) throw new Error(`${what} arrived at ${Math.round(this.t)} ms, after the ${late} ms this storyboard allows. A slow take: render it again.`);
        await this.settleArmed();
        return s;
      }
      if (this.t >= end) throw new Error(`waited ${max} ms of video for ${what}; state: ${JSON.stringify(s)}`);
      await this.frame();
    }
  }

  // ---- Pointer, clicks, keys ----

  // to: a CSS selector in the stage, "settings:<selector>" in the settings tab, "popup:<selector>" in the
  // open toolbar list, or { x, y }.
  async move(to, o = {}) {
    let dest = to;
    if (typeof to === 'string' && to.startsWith('popup:')) {
      const sel = to.slice('popup:'.length);
      const r = await this.b.eval(this.pop.session, `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
      dest = { x: this.popBox.x + r.x + r.w * (o.ax ?? 0.5) + (o.dx || 0), y: this.popBox.y + r.y + r.h * (o.ay ?? 0.5) + (o.dy || 0) };
    }
    if (typeof to === 'string' && to.startsWith('settings:')) {
      const sel = to.slice('settings:'.length);
      const r = await this.b.eval(this.opt.session, `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
      dest = { x: r.x + r.w * (o.ax ?? 0.5) + (o.dx || 0), y: FRAME_H + r.y + r.h * (o.ay ?? 0.5) + (o.dy || 0) };
    }
    const { dur } = await this.stage('move', { to: dest, dur: o.dur, ax: o.ax, ay: o.ay, dx: o.dx, dy: o.dy });
    if (o.wait !== false) await this.wait(dur + (o.settle ?? 90));
    return dur;
  }

  // real: false draws the click but sends no event (for a link whose real effect the stage draws instead).
  // ring: how long its ring lasts (ms).
  async click({ button = 'left', hold = 70, after = 120, real = true, ring } = {}) {
    const target = this.mouseTarget();
    const buttons = button === 'right' ? 2 : 1;
    await this.stage('press', { down: true, ring });
    if (real) await this.b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button, buttons, clickCount: 1 }, target.s);
    await this.wait(hold);
    if (real) await this.b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button, buttons: 0, clickCount: 1 }, target.s);
    await this.stage('press', { down: false });
    await this.wait(after);
  }

  // pos: 'bottom' or 'top' (when something on screen sits where the caption would). fade: false for a
  // loop's first caption, which must already show on frame 0. toast: a pattern (a string); the caption
  // waits for the extension's note to match it and starts in that very frame (follow it with d.until on
  // the same note, which records when it started).
  caption(text, o = {}) {
    if (o.toast) {
      this.armed = { text };
      return this.stage('caption', { text, ...o });
    }
    const open = this.captions.at(-1);
    if (open && open.end === undefined) open.end = this.t;
    if (text) this.captions.push({ text, start: this.t });
    return this.stage('caption', { text, ...o });
  }

  // An armed caption (see caption): when it started, for the SRT; it starts now if the note has not
  // matched yet.
  async settleArmed() {
    if (!this.armed) return;
    const { start } = await this.stage('armed', { now: this.t });
    const open = this.captions.at(-1);
    if (open && open.end === undefined) open.end = start;
    this.captions.push({ text: this.armed.text, start });
    this.armed = null;
  }

  mark(name) {
    this.marks[name] = this.n;
  }

  keys(list, o = {}) {
    return this.stage('keys', { list, ...o });
  }

  cam(o) {
    return this.stage('cam', o);
  }

  // ---- What the extension did ----

  async copied() {
    return this.b.eval(this.ext.sw, '__copies.at(-1) ?? null');
  }

  async waitCopied(count, max = 3000) {
    const end = this.t + max;
    for (;;) {
      const n = await this.b.eval(this.ext.sw, '__copies.length');
      if (n >= count) return this.copied();
      if (this.t >= end) throw new Error(`no copy from the extension within ${max} ms of video`);
      await this.frame();
    }
  }

  // The address of the AI tab the extension opened; count: wait for that many opens in all.
  async opened(max = 3000, { count = 1 } = {}) {
    const end = this.t + max;
    for (;;) {
      const list = await this.b.eval(this.ext.sw, '__opened');
      if (list.length >= count) return list.at(-1);
      if (this.t >= end) throw new Error(`the extension opened no tab within ${max} ms of video`);
      await this.frame();
    }
  }

  async launched() {
    return this.b.eval(this.page.session, '__launched.at(-1) ?? null', this.iso);
  }

  // ---- Settings tab ----

  // While the settings page is in front, the real mouse moves and clicks in its tab.
  set onSettingsPage(v) {
    this.onSettings = v;
    this.mouse = { x: -1, y: -1 };
  }

  // Scrolls the settings page (eased, on the video's clock).
  scrollSettings(to, dur = 800) {
    this.scrollTween = { from: this.settingsScroll, to, t0: this.t, dur };
  }

  async settingsRect(sel) {
    return this.b.eval(this.opt.session, `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; })()`);
  }

  // The lines of an element's text on the settings page: [{ top, bottom }] in page coordinates, so a frame's
  // edge can fall between two lines rather than through one.
  async settingsLines(sel) {
    return this.b.eval(
      this.opt.session,
      `(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector(${JSON.stringify(sel)})); const out = [];
        for (const b of r.getClientRects()) { const top = b.top + scrollY, bottom = b.bottom + scrollY, l = out.at(-1);
          if (l && top < l.bottom - 1) l.bottom = Math.max(l.bottom, bottom); else out.push({ top, bottom }); }
        return out; })()`,
    );
  }
}
