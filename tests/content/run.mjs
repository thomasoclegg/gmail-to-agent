// Functional suite for targets.js and content.js. Loads the real files into a
// mock Gmail page (mail/u/1/index.html) in headless Chrome with a throwaway
// profile, drives the scenarios in mail/u/1/driver.js and adds Node vm checks
// (targets.js in a worker-like global, and the desktop deep links compared
// with v1.0's buildUrl). Writes only to tests/.out/content/.
//
//   node tests/content/run.mjs            run everything
//   node tests/content/run.mjs --verbose  print every check, not only failures

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REPO, OUT_ROOT, findChrome, extraChromeFlags, PASTE_KEY, OS_LABEL } from '../lib/chrome.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(OUT_ROOT, 'content');
const CHROME = findChrome();
// The page sits under mail/u/1/ so content.js reads account 1 from the path, as on Gmail.
const PAGE = pathToFileURL(path.join(HERE, 'mail/u/1/index.html')).href;
const verbose = process.argv.includes('--verbose');
fs.mkdirSync(OUT, { recursive: true });

function chrome(args, label) {
  const res = spawnSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      `--user-data-dir=${path.join(OUT, 'profile')}`,
      ...extraChromeFlags(),
      ...args,
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 240000 },
  );
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res;
}

// The expected paste key and the OS name travel in the query string (URLSearchParams encodes the "+").
const pageUrl = (suite) => `${PAGE}?${new URLSearchParams({ suite, paste: PASTE_KEY, os: OS_LABEL })}`;

function runSuite(suite) {
  const res = chrome(['--virtual-time-budget=120000', '--window-size=1280,900', '--dump-dom', pageUrl(suite)], suite);
  fs.writeFileSync(path.join(OUT, `dom-${suite}.html`), res.stdout);
  const m = res.stdout.match(/<pre id="results"[^>]*data-done="1"[^>]*>([A-Za-z0-9+/=]+)<\/pre>/) || res.stdout.match(/<pre id="results"[^>]*>([A-Za-z0-9+/=]+)<\/pre>/);
  if (!m) {
    const tail = (res.stderr || '').split('\n').filter((l) => /error|exception/i.test(l)).slice(-10).join('\n');
    throw new Error(`Suite ${suite}: no results in the dumped DOM (see ${path.relative(REPO, path.join(OUT, `dom-${suite}.html`))})\n${tail}`);
  }
  return JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
}

// ---- Node checks ----

function nodeChecks() {
  const checks = [];
  const check = (what, ok, detail = '') => checks.push({ what, ok: !!ok, detail: String(detail).slice(0, 1500) });
  for (const f of ['targets.js', 'content.js']) {
    const r = spawnSync(process.execPath, ['--check', path.join(REPO, f)], { encoding: 'utf8' });
    check(`node --check ${f}`, r.status === 0, r.stderr.trim() || 'ok');
  }
  // targets.js as background.js loads it (importScripts in a worker: no DOM).
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(REPO, 'targets.js'), 'utf8'), ctx, { filename: 'targets.js' });
  const g = vm.runInContext(
    '({ ids: TARGETS.map((t) => t.id), d: DEFAULT_TARGETS, l: LEGACY_TARGETS, don: DONATION, has: hasDonation(), pick: pickTargets(["deepseek", "codex"]).map((t) => t.id), web: TARGETS.filter((t) => t.kind === "web").every((t) => /^https:\\/\\//.test(t.url)) })',
    ctx,
  );
  check(
    'targets.js runs in a bare worker-like global and defines TARGETS, DEFAULT_TARGETS, LEGACY_TARGETS, DONATION, helpers',
    g.ids.length === 11 && g.d.join() === 'claude,chatgpt' && g.l.join() === 'claude-code,codex' && g.has === true && g.pick.join() === 'codex,deepseek' && g.web,
    JSON.stringify(g),
  );
  const src = fs.readFileSync(path.join(REPO, 'targets.js'), 'utf8');
  check('donation names Friends of Larnaca Cats with its https donate page', g.don.charity === 'Friends of Larnaca Cats' && g.don.url === 'https://friends-of-larnaca-cats.weebly.com/donate.html?ref=ai-agent' && (src.match(/const DONATION\s*=/g) || []).length === 1, JSON.stringify(g.don));
  for (const f of ['targets.js', 'content.js']) {
    check(`${f} never uses innerHTML / insertAdjacentHTML / eval`, !/innerHTML|insertAdjacentHTML|\beval\(|new Function/.test(fs.readFileSync(path.join(REPO, f), 'utf8')));
  }
  return { id: 'N', name: 'Node: syntax, targets.js in a worker-like global, no HTML injection APIs', passed: checks.every((c) => c.ok), checks };
}

// v1.0's buildUrl, run with the same title, path and folder. oracle/v1.0-content.js is
// content.js exactly as released in v1.0.0 (commit 583e461), kept byte for byte.
function v10Url(link) {
  // Intended copy change since v1.0: the desktop prompt dropped "check the relevant source systems". Apply the
  // same edit to the v1.0 oracle so everything else in the link must still match byte for byte.
  const src = fs.readFileSync(path.join(HERE, 'oracle/v1.0-content.js'), 'utf8')
    .replace('what is being asked of me, check the relevant source systems, then recommend', 'what is being asked of me, then recommend');
  // Intended fix since v1.0: v1.0 took the mailbox from the subject in 7b. Replay v1.0 on the same title with
  // the subject's imitation removed, so the rest of the link must still match byte for byte.
  const title = link.scenario === '7b' ? link.title.replace(/^.* - (\S+@\S+) - /, 'Subject - $1 - ') : link.title;
  const ctx = vm.createContext({
    document: { title, addEventListener() {}, querySelectorAll: () => [] },
    location: { pathname: link.pathname },
    chrome: {
      storage: { sync: { get: (_d, cb) => cb({ folder: link.folder }) }, onChanged: { addListener() {} } },
      runtime: { onMessage: { addListener() {} } },
    },
  });
  vm.runInContext(src, ctx, { filename: 'v1.0-content.js' });
  ctx.__id = link.id;
  return vm.runInContext(`buildUrl(${JSON.stringify(link.agent === 'claude-code' ? 'claude' : 'codex')}, { id: __id })`, ctx);
}

function oracleScenario(links) {
  const checks = links.map((l) => {
    let want = null;
    let err = '';
    try {
      want = v10Url(l);
    } catch (e) {
      err = e.message;
    }
    const ok = !!l.url && l.url === want;
    return { what: `scenario ${l.scenario} ${l.agent} (folder ${l.folder ? 'set' : 'empty'}, title "${l.title.slice(0, 40)}...")`, ok, detail: ok ? 'byte-identical' : err || `got ${String(l.url).slice(0, 160)} | v1.0 ${String(want).slice(0, 160)}` };
  });
  return { id: '2v', name: 'Every desktop deep link captured is byte-identical to v1.0 buildUrl for the same page state', passed: checks.length > 0 && checks.every((c) => c.ok), checks };
}

// ---- Run ----

const started = Date.now();
const main = runSuite('main');
const defaults = runSuite('defaults');
const toastPng = path.join(OUT, 'toast.png');
const shot = chrome(['--virtual-time-budget=2500', '--window-size=1000,640', `--screenshot=${toastPng}`, pageUrl('toast')], 'toast');

const scenarios = [nodeChecks(), ...main.results, ...defaults.results, oracleScenario(main.desktopLinks)];
const report = {
  ranAt: new Date().toISOString(),
  chrome: CHROME,
  expectedPasteKey: PASTE_KEY,
  platform: main.platform,
  scenarios,
  observations: main.observations,
  screenshot: fs.existsSync(toastPng) ? path.relative(REPO, toastPng) : `missing (${shot.stderr.slice(-200)})`,
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT, 'raw-main.json'), JSON.stringify(main, null, 2));

let failed = 0;
for (const s of scenarios) {
  if (!s.passed) failed++;
  console.log(`${s.passed ? 'PASS' : 'FAIL'}  [${s.id}] ${s.name}`);
  for (const c of s.checks) {
    if (verbose || !c.ok) console.log(`      ${c.ok ? 'ok  ' : 'FAIL'} ${c.what}${c.detail ? `\n           ${c.detail}` : ''}`);
  }
}
for (const o of report.observations) console.log(`NOTE  ${o.text}`);
console.log(`\n${scenarios.length - failed}/${scenarios.length} scenarios passed in ${((Date.now() - started) / 1000).toFixed(1)} s. Report: ${path.relative(REPO, path.join(OUT, 'report.json'))}  Screenshot: ${report.screenshot}`);
process.exitCode = failed ? 1 : 0;
