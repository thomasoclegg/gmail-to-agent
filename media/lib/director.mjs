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

  // The real settings page, in a tab of its own the size of the drawn window's page area.
  async openSettingsTab() {
    const { size, platform = 'win' } = this.board;
    this.opt = await openTab(this.b, { width: size.w, height: size.h - FRAME_H, dsf: size.dsf, platform });
    await this.b.send('Page.navigate', { url: `chrome-extension://${this.ext.id}/options.html` }, this.opt.session);
    await this.waitReal('the settings page', () => this.b.eval(this.opt.session, `document.querySelectorAll('#tiles .tile').length > 0 && document.fonts.status === 'loaded'`).catch(() => false));
    this.settingsScroll = 0;
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
    await this.pointer(r.mx, r.my);
    if (this.settingsLive) await this.pushSettings();
    const { data } = await this.b.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }, this.page.session);
    fs.writeFileSync(path.join(this.frames, `f${String(this.n).padStart(5, '0')}.png`), Buffer.from(data, 'base64'));
    this.n++;
    this.t = (this.n * 1000) / this.fps;
  }

  // Moves the real mouse with the drawn one: into the settings tab while its page is in front.
  async pointer(x, y) {
    if (x === this.mouse.x && y === this.mouse.y) return;
    this.mouse = { x, y };
    const target = this.onSettings ? { s: this.opt.session, x, y: y - FRAME_H } : { s: this.page.session, x, y };
    await this.b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: target.x, y: target.y, button: 'none', buttons: 0 }, target.s);
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
        return s;
      }
      if (this.t >= end) throw new Error(`waited ${max} ms of video for ${what}; state: ${JSON.stringify(s)}`);
      await this.frame();
    }
  }

  // ---- Pointer, clicks, keys ----

  // to: a CSS selector in the stage, "settings:<selector>" in the settings tab, or { x, y }.
  async move(to, o = {}) {
    let dest = to;
    if (typeof to === 'string' && to.startsWith('settings:')) {
      const sel = to.slice('settings:'.length);
      const r = await this.b.eval(this.opt.session, `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
      dest = { x: r.x + r.w * (o.ax ?? 0.5) + (o.dx || 0), y: FRAME_H + r.y + r.h * (o.ay ?? 0.5) + (o.dy || 0) };
    }
    const { dur } = await this.stage('move', { to: dest, dur: o.dur, ax: o.ax, ay: o.ay, dx: o.dx, dy: o.dy });
    if (o.wait !== false) await this.wait(dur + (o.settle ?? 90));
    return dur;
  }

  async click({ button = 'left', hold = 70, after = 120, real = true } = {}) {
    const target = this.onSettings ? { s: this.opt.session, x: this.mouse.x, y: this.mouse.y - FRAME_H } : { s: this.page.session, x: this.mouse.x, y: this.mouse.y };
    const buttons = button === 'right' ? 2 : 1;
    await this.stage('press', { down: true });
    if (real) await this.b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button, buttons, clickCount: 1 }, target.s);
    await this.wait(hold);
    if (real) await this.b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button, buttons: 0, clickCount: 1 }, target.s);
    await this.stage('press', { down: false });
    await this.wait(after);
  }

  // pos: 'bottom' or 'top' (when something on screen sits where the caption would). fade: false for a
  // loop's first caption, which must already show on frame 0.
  caption(text, o = {}) {
    const open = this.captions.at(-1);
    if (open && open.end === undefined) open.end = this.t;
    if (text) this.captions.push({ text, start: this.t });
    return this.stage('caption', { text, ...o });
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
}
