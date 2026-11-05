// ffmpeg encodes for the recorder. Needs an ffmpeg with libx264, libvpx-vp9 and the gif encoder:
// FFMPEG=/path/to/ffmpeg, or ffmpeg on PATH. See media/README.md for where to get one.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function findFfmpeg() {
  const candidates = [process.env.FFMPEG, 'ffmpeg'].filter(Boolean);
  for (const bin of candidates) {
    const r = spawnSync(bin, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
    if (r.status !== 0) continue;
    const missing = ['libx264', 'libvpx-vp9', ' gif '].filter((e) => !r.stdout.includes(e));
    if (missing.length) throw new Error(`${bin} lacks ${missing.map((m) => m.trim()).join(', ')}. Use a full ffmpeg build (see media/README.md).`);
    const version = spawnSync(bin, ['-hide_banner', '-version'], { encoding: 'utf8' }).stdout.split('\n')[0];
    return { bin, version };
  }
  throw new Error('ffmpeg not found. Set FFMPEG to an ffmpeg with libx264 and libvpx-vp9, or put one on PATH (see media/README.md).');
}

function run(ff, args, what) {
  const r = spawnSync(ff.bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg (${what}) failed:\n${r.stderr.trim().slice(-2000)}`);
}

const input = (frames, fps) => ['-framerate', String(fps), '-i', path.join(frames, 'f%05d.png')];
// The frames are sRGB PNGs; tag the video as BT.709 so browsers and YouTube show the same colours.
// ffmpeg takes the tags from the filtered frames, so setparams sets them there; the output options
// alone leave primaries and transfer "unknown".
const BT709 = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'];
const toYuv = (scale) =>
  `${scale ? `scale=${scale}:flags=lanczos,` : ''}scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,` +
  'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';

export function mp4(ff, frames, out, { fps, crf = 23, preset = 'slow', scale, maxrate } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  run(
    ff,
    [
      ...input(frames, fps), '-vf', toYuv(scale), '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-profile:v', 'high',
      '-g', String(fps * 2), ...(maxrate ? ['-maxrate', maxrate, '-bufsize', maxrate] : []), ...BT709, '-movflags', '+faststart', '-an', out,
    ],
    `mp4 ${path.basename(out)}`,
  );
}

export function webm(ff, frames, out, { fps, crf = 36, scale } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  run(
    ff,
    [
      ...input(frames, fps), '-vf', toYuv(scale), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-deadline', 'good', '-cpu-used', '1',
      '-row-mt', '1', '-tile-columns', '1', '-auto-alt-ref', '1', '-lag-in-frames', '25', '-g', String(fps * 4), ...BT709, '-an', out,
    ],
    `webm ${path.basename(out)}`,
  );
}

// A GIF for the README: fewer frames and a smaller size, one palette for the whole loop.
export function gif(ff, frames, out, { fps, gifFps = 15, width = 800, colors = 160 } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const filter =
    `fps=${gifFps},scale=${width}:-1:flags=lanczos,split[a][b];` +
    `[a]palettegen=max_colors=${colors}:stats_mode=diff:reserve_transparent=0[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  run(ff, [...input(frames, fps), '-filter_complex', filter, '-loop', '0', out], `gif ${path.basename(out)}`);
}

// One frame as a PNG, scaled if asked.
export function still(ff, framePng, out, { scale } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  run(ff, ['-i', framePng, ...(scale ? ['-vf', `scale=${scale}:flags=lanczos`] : []), '-compression_level', '9', out], `poster ${path.basename(out)}`);
}

export function duration(ff, file) {
  const r = spawnSync(ff.bin, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = r.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

const stamp = (ms) => {
  const t = Math.max(0, Math.round(ms));
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(t / 3600000))}:${p(Math.floor(t / 60000) % 60)}:${p(Math.floor(t / 1000) % 60)},${p(t % 1000, 3)}`;
};

// The captions drawn into the video, as an SRT file for a video site's subtitle track.
export function srt(captions, out) {
  const text = captions.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
}

// Caption rules: at most 2 lines of 42 characters, at most 15 characters a second.
export function checkCaptions(captions) {
  const problems = [];
  for (const c of captions) {
    const lines = c.text.split('\n');
    const chars = c.text.replace(/\n/g, ' ').length;
    const secs = (c.end - c.start) / 1000;
    if (lines.length > 2) problems.push(`"${c.text}": ${lines.length} lines`);
    for (const l of lines) if (l.length > 42) problems.push(`"${l}": ${l.length} characters on one line`);
    if (secs > 0 && chars / secs > 15) problems.push(`"${c.text}": ${(chars / secs).toFixed(1)} characters a second over ${secs.toFixed(2)} s`);
  }
  return problems;
}
