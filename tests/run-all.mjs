// Runs the three suites one after another and exits non-zero if any fails.
//
//   node tests/run-all.mjs                      all suites
//   node tests/run-all.mjs background settings  only the named ones
//
// Each suite's output is shown as it runs and saved to tests/.out/<suite>.log.
//
// A suite passes only when it exits 0, reports how many tests or scenarios it ran, ran at least its
// minimum, and every one passed, so a suite that quietly runs fewer checks fails. Raise a suite's
// minimum whenever you add tests or scenarios to it.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO, OUT_ROOT } from './lib/chrome.mjs';

const scenarioCount = (out) => {
  const m = out.match(/^(\d+)\/(\d+) scenarios passed/m);
  return m ? { passed: Number(m[1]), total: Number(m[2]) } : null;
};

const SUITES = [
  {
    name: 'background',
    what: 'background.js and offscreen.js in Node vm (node:test)',
    args: ['--test', '--test-reporter=spec', path.join('tests', 'background', 'background.test.js')],
    unit: 'tests',
    min: 63,
    count: (out) => {
      const pass = out.match(/^\S*\s*pass (\d+)\s*$/m);
      const tests = out.match(/^\S*\s*tests (\d+)\s*$/m);
      return pass && tests ? { passed: Number(pass[1]), total: Number(tests[1]) } : null;
    },
  },
  {
    name: 'content',
    what: 'content.js and targets.js on a mock Gmail page in headless Chrome',
    args: [path.join('tests', 'content', 'run.mjs')],
    unit: 'scenarios',
    min: 36,
    count: scenarioCount,
  },
  {
    name: 'settings',
    what: 'options.html in headless Chrome over the DevTools Protocol',
    args: [path.join('tests', 'settings', 'run.mjs')],
    unit: 'scenarios',
    min: 24,
    count: scenarioCount,
  },
];

const TIMEOUT_MS = Number(process.env.SUITE_TIMEOUT_MS) || 10 * 60 * 1000;

const wanted = process.argv.slice(2);
const unknown = wanted.filter((w) => !SUITES.some((s) => s.name === w));
if (unknown.length) {
  console.error(`Unknown suite: ${unknown.join(', ')}. Known: ${SUITES.map((s) => s.name).join(', ')}.`);
  process.exit(2);
}
const toRun = wanted.length ? SUITES.filter((s) => wanted.includes(s.name)) : SUITES;
fs.mkdirSync(OUT_ROOT, { recursive: true });

// Why a suite failed, or '' when it passed.
function verdict(suite, code, n) {
  if (code !== 0) return `exit ${code}`;
  if (!n) return `no ${suite.unit} count in its output`;
  if (n.total < suite.min) return `ran ${n.total} ${suite.unit}, expected at least ${suite.min}`;
  if (n.passed !== n.total) return `only ${n.passed} of ${n.total} ${suite.unit} passed`;
  return '';
}

// Each suite runs in a process group of its own (except on Windows), so a timeout or Ctrl+C can kill
// the suite together with the Chrome it started. A killed Chrome would otherwise keep running and
// hold its profile in tests/.out/ locked for the next run.
const ownGroup = process.platform !== 'win32';
let current = null;
function killSuite(child) {
  try {
    if (ownGroup) process.kill(-child.pid, 'SIGKILL');
    else child.kill('SIGKILL');
  } catch {
    // Already gone.
  }
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    if (current) killSuite(current);
    process.exit(128 + os.constants.signals[sig]);
  });
}

function runSuite(suite) {
  return new Promise((resolve) => {
    const started = Date.now();
    let out = '';
    const child = spawn(process.execPath, suite.args, { cwd: REPO, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: ownGroup });
    current = child;
    const timer = setTimeout(() => {
      out += `\nTimed out after ${TIMEOUT_MS / 1000} s.\n`;
      killSuite(child);
    }, TIMEOUT_MS);
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (d) => {
        out += d;
        (stream === child.stdout ? process.stdout : process.stderr).write(d);
      });
    }
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      current = null;
      if (ownGroup) killSuite(child); // anything the suite left running
      fs.writeFileSync(path.join(OUT_ROOT, `${suite.name}.log`), out);
      const n = suite.count(out);
      const why = verdict(suite, code ?? signal, n);
      resolve({ ...suite, ok: !why, why, seconds: (Date.now() - started) / 1000, counted: n ? `${n.passed}/${n.total} ${suite.unit}` : '' });
    });
  });
}

const results = [];
for (const suite of toRun) {
  console.log(`\n=== ${suite.name}: ${suite.what}\n`);
  results.push(await runSuite(suite));
}

console.log('\n=== Summary');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(10)} ${(r.counted || '-').padEnd(18)} ${r.seconds.toFixed(1).padStart(5)} s${r.why ? `  (${r.why})` : ''}`);
}
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} suites failed. Logs: ${path.relative(REPO, OUT_ROOT)}/` : `\nAll ${results.length} suites passed.`);
process.exitCode = failed.length ? 1 : 0;
