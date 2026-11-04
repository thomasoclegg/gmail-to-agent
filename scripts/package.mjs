// Builds the extension zip with only the files Chrome loads at runtime.
//
//   node scripts/package.mjs              build dist/open-in-ai-agent.zip and dist/open-in-ai-agent-v<version>.zip
//   node scripts/package.mjs --check DIR  check an unpacked copy (for example the unzipped release) in DIR
//
// The file list comes from the manifest and from what the pages and scripts reference (script tags, icons,
// font URLs, importScripts, the offscreen document and runtime.getURL pages), plus LICENSE, fonts/OFL.txt
// for the bundled fonts and every icons/*.png. The build fails if a referenced file is missing or if
// anything outside the allow-list would be packed. The zip is written by the small deflate writer below
// (no dependencies), with manifest.json first, the other entries in code-point order (the same whatever
// the locale) and a fixed timestamp: SOURCE_DATE_EPOCH when set, otherwise 1980-01-01, so the same
// sources always give the same bytes.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(REPO, 'dist');
const NAME = 'open-in-ai-agent';

// ---------- what may ship ----------

// Runtime files only: the manifest, root scripts, the two extension pages, PNG icons,
// woff2 fonts (only those a page references), the font licence and the MIT licence.
const ALLOWED = [
  (f) => f === 'manifest.json',
  (f) => f === 'LICENSE',
  (f) => /^[^/]+\.js$/.test(f),
  (f) => f === 'options.html' || f === 'offscreen.html',
  (f) => /^icons\/[^/]+\.png$/.test(f),
  (f) => /^fonts\/[^/]+\.woff2$/.test(f),
  (f) => f === 'fonts/OFL.txt',
];
const allowed = (f) => ALLOWED.some((ok) => ok(f));

// ---------- references ----------

const isExternal = (ref) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);

function addRef(refs, from, raw) {
  if (!raw || isExternal(raw)) return;
  const clean = raw.split(/[?#]/)[0].trim();
  if (!clean) return;
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(from), clean.replace(/^\.\//, '')));
  refs.push({ from, ref: rel.replace(/^\/+/, '') });
}

function manifestRefs(m) {
  const refs = [];
  const add = (v) => addRef(refs, 'manifest.json', v);
  const addIcons = (v) => (typeof v === 'string' ? add(v) : Object.values(v || {}).forEach(add));
  add(m.background?.service_worker);
  (m.background?.scripts || []).forEach(add);
  add(m.background?.page);
  for (const cs of m.content_scripts || []) [...(cs.js || []), ...(cs.css || [])].forEach(add);
  add(m.options_page);
  add(m.options_ui?.page);
  add(m.devtools_page);
  add(m.side_panel?.default_path);
  Object.values(m.chrome_url_overrides || {}).forEach(add);
  for (const key of ['action', 'browser_action', 'page_action']) {
    add(m[key]?.default_popup);
    addIcons(m[key]?.default_icon);
  }
  addIcons(m.icons);
  for (const war of m.web_accessible_resources || []) {
    for (const r of war.resources || []) {
      if (/[*?]/.test(r)) throw new Error(`manifest.json: web_accessible_resources pattern "${r}" is not supported by this script; list the files.`);
      add(r);
    }
  }
  return refs;
}

function htmlRefs(file, text) {
  const refs = [];
  for (const m of text.matchAll(/<(?:script|img|link|source|iframe)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)) addRef(refs, file, m[1]);
  for (const m of text.matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi)) addRef(refs, file, m[1]);
  return refs;
}

function jsRefs(file, text) {
  const refs = [];
  for (const m of text.matchAll(/importScripts\(([^)]*)\)/g)) for (const s of m[1].matchAll(/['"]([^'"]+)['"]/g)) addRef(refs, file, s[1]);
  for (const m of text.matchAll(/getURL\(\s*['"]([^'"]+)['"]/g)) addRef(refs, file, m[1]);
  // chrome.offscreen.createDocument({ url: 'offscreen.html', ... }) and similar page URLs.
  for (const m of text.matchAll(/\burl\s*:\s*['"]([^'":]+\.html(?:[?#][^'"]*)?)['"]/g)) addRef(refs, file, m[1]);
  return refs;
}

// Follows references from the manifest through every page and script found.
function collect(root) {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  if (!fs.existsSync(path.join(root, 'manifest.json'))) return { manifest: null, files: new Set(), refs: [], missing: [{ from: '(root)', ref: 'manifest.json' }] };
  const manifest = JSON.parse(read('manifest.json'));
  const files = new Set(['manifest.json']);
  const refs = [];
  const missing = [];
  const queue = manifestRefs(manifest);
  while (queue.length) {
    const r = queue.shift();
    refs.push(r);
    if (files.has(r.ref)) continue;
    if (r.ref.startsWith('..') || !fs.existsSync(path.join(root, r.ref)) || !fs.statSync(path.join(root, r.ref)).isFile()) {
      missing.push(r);
      continue;
    }
    files.add(r.ref);
    if (r.ref.endsWith('.html')) queue.push(...htmlRefs(r.ref, read(r.ref)));
    if (r.ref.endsWith('.js')) queue.push(...jsRefs(r.ref, read(r.ref)));
  }
  // The MIT licence travels with every copy and the fonts' licence with the fonts; icons/*.png ship whole.
  const licences = [{ from: 'the MIT licence', ref: 'LICENSE' }];
  if ([...files].some((f) => f.startsWith('fonts/'))) licences.push({ from: 'the bundled fonts', ref: 'fonts/OFL.txt' });
  for (const l of licences) {
    refs.push(l);
    if (fs.existsSync(path.join(root, l.ref))) files.add(l.ref);
    else missing.push(l);
  }
  const iconDir = path.join(root, 'icons');
  if (fs.existsSync(iconDir)) for (const f of fs.readdirSync(iconDir)) if (f.endsWith('.png')) files.add(`icons/${f}`);
  return { manifest, files, refs, missing };
}

const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });

function problems({ manifest, files, missing }) {
  const out = [];
  for (const m of missing) out.push(`missing: ${m.ref} (referenced by ${m.from})`);
  for (const f of files) if (!allowed(f)) out.push(`outside the allow-list: ${f}`);
  if (manifest && !/^\d+(\.\d+){0,3}$/.test(String(manifest.version))) out.push(`manifest.json: version "${manifest.version}" is not a Chrome version string`);
  return out;
}

// ---------- zip ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  const d = epoch ? new Date(Number(epoch) * 1000) : new Date(Date.UTC(1980, 0, 1));
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1980) throw new Error(`SOURCE_DATE_EPOCH "${epoch}" is not a time from 1980 on`);
  const time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1);
  const date = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  return { time, date };
}

function zip(entries) {
  const { time, date } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by: Unix, 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// Reads a zip back (central directory, then each local entry) to prove what was written.
function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('zip check: no end of central directory');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip check: bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const skip = nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    if (crc32(data) !== crc) throw new Error(`zip check: CRC mismatch for ${name}`);
    out.push({ name, data });
    p += 46 + skip;
  }
  return out;
}

// ---------- main ----------

function fail(lines) {
  for (const l of lines) console.error(`ERROR  ${l}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  const dir = path.resolve(args[1] || '');
  if (!args[1] || !fs.existsSync(dir)) fail([`--check needs an unpacked extension folder (got "${args[1] || ''}")`]);
  const found = collect(dir);
  const errors = problems(found);
  const present = walk(dir);
  for (const f of present) if (!allowed(f)) errors.push(`outside the allow-list: ${f}`);
  for (const f of present) if (allowed(f) && !found.files.has(f)) errors.push(`not referenced by the manifest or pages: ${f}`);
  if (errors.length) fail(errors);
  console.log(`OK  ${dir}: manifest.json at the root, ${found.refs.length} references resolve, ${present.length} files, nothing outside the allow-list.`);
  process.exit(0);
}
if (args.length) fail([`unknown arguments: ${args.join(' ')}`]);

const found = collect(REPO);
const errors = problems(found);
if (errors.length) fail(errors);

// Root scripts nothing references are left out; say so, so a forgotten reference is noticed.
const rootJs = fs.readdirSync(REPO).filter((f) => f.endsWith('.js'));
for (const f of rootJs) if (!found.files.has(f)) console.warn(`NOTE  ${f} is not referenced by the manifest or pages, so it is not packed.`);

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const names = [...found.files].sort((a, b) => (a === 'manifest.json' ? -1 : b === 'manifest.json' ? 1 : byCodePoint(a, b)));
const entries = names.map((name) => ({ name, data: fs.readFileSync(path.join(REPO, name)) }));
const buf = zip(entries);

const back = unzip(buf);
if (back.map((e) => e.name).join('\n') !== names.join('\n')) fail(['zip check: entries read back differ from the file list']);
for (const [i, e] of back.entries()) if (!e.data.equals(entries[i].data)) fail([`zip check: ${e.name} differs from the source file`]);

const version = found.manifest.version;
fs.mkdirSync(DIST, { recursive: true });
const outputs = [path.join(DIST, `${NAME}.zip`), path.join(DIST, `${NAME}-v${version}.zip`)];
for (const out of outputs) fs.writeFileSync(out, buf);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`Packed ${found.manifest.name} ${version}: ${names.length} files, ${kb(buf.length)} zipped.`);
for (const e of entries) console.log(`  ${e.name.padEnd(46)} ${kb(e.data.length).padStart(9)}`);
for (const out of outputs) console.log(`Wrote ${path.relative(REPO, out)}`);
