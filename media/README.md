# Training videos

Scripts that record the extension's training videos: a 13 s hero loop, four short clips, a 90 s walkthrough and a 54 s install video for YouTube. Every video is recorded from the real extension in a throwaway headless Chrome, so a new release can be recorded again with one command. Nothing here ships in the extension: `scripts/package.mjs` packs only the runtime files.

## What it makes

| File | Size | Length | Where it goes |
| --- | --- | --- | --- |
| `docs/media/hero.webm`, `hero.mp4`, `hero-poster.png` | 1280 x 800 | 13 s loop | The website's opening figure: muted autoplay, WebM first |
| `docs/media/hero-mac.webm`, `hero-mac.mp4`, `hero-mac-poster.png` | 1280 x 800 | 13 s loop | The same with Cmd V, for Mac visitors |
| `docs/media/hero.gif` | 800 x 500 | 13 s loop | The README |
| `docs/media/clip-pick-ais.*` | 1280 x 800 | 12 s | Help: pick your AIs |
| `docs/media/clip-desktop-agent.*` | 1280 x 800 | 13 s | Help: Claude Code and Codex |
| `docs/media/clip-copy.*` | 1280 x 800 | 7 s | Help: copy for any AI |
| `docs/media/clip-bulk.*` | 1280 x 800 | 12 s | Help: several emails at once |
| `store/video/walkthrough-1920x1080.mp4` and `.srt` | 1920 x 1080 | 90 s | YouTube, linked from the store listings. The MP4 is not kept in git: render it before an upload |
| `store/video/walkthrough-thumbnail-1280x720.png` | 1280 x 720 | still | YouTube's custom thumbnail, its own storyboard (`walkthrough-thumbnail`) |
| `store/video/install-1920x1080.mp4` and `.srt` | 1920 x 1080 | 54 s | YouTube: from the website's download to the first right-click, in Chrome. Not kept in git, like the walkthrough |
| `store/video/install-thumbnail-1280x720.png` | 1280 x 720 | still | Its thumbnail (`install-thumbnail`) |

Every video is silent, with captions drawn in. The Windows keys (Ctrl V) lead, as most desktop visitors use Windows; the hero also comes with Cmd V. Each video has a written step list in [STEPS.md](STEPS.md): put it next to the video, because a silent video needs a text alternative.

## How it works

- `record.mjs` starts Chrome with a new profile in a work folder, loads a copy of the extension's runtime files with `Extensions.loadUnpacked` over a DevTools pipe (branded Chrome ignores `--load-extension`), as `tests/package/gmail-tab.mjs` does.
- The tab opens `https://mail.google.com/mail/u/0/`, but the recorder answers it with `stage/index.html`: a Gmail-like page built from the selectors `content.js` reads, its action toolbar (`[gh="mtb"]` with the More button) included. The extension's own content script runs in it, so the menu items, the button in Gmail's toolbar with its menu, the note at the bottom left and the copied prompt are the real ones.
- Chrome runs in British English (`--lang=en-GB`), so the prompts the extension copies, which name the browser's language, ask for British English.
- Nothing leaves the machine. Every host name is unresolvable, the tab fails any request that is not for the stage, and in the service worker the clipboard copy and the new AI tab are replaced with stand-ins that only record what the extension asked for. No AI website is ever loaded.
- The AI page is a plain drawing with the site's address and no logo. Chrome's "Open Claude?" prompt is drawn too. The settings page is the real `options.html`, captured from its own tab; rendered on a Mac with Windows keys, it shows the manifest's default shortcuts (Alt+Shift+O), as Chrome on Windows reports them. The toolbar list is the real `popup.html`, loaded afresh in a 320 px tab of its own each time the drawn icon is clicked and shown in a bubble under it; it is pointed at the stage's Gmail tab, so it asks the content script there what is open or ticked, as in the browser. The Claude Code card shows the real prompt from the link, shortened to fit (`screenPrompt` in `storyboards/common.mjs`): long asides become "(…)", a few lines break where the notes point, and each row is cut at a word; the render stops if the prompt no longer has the lines it expects. In `clip-desktop-agent`, which the website shows small, the card keeps only the prompt's key lines (what the link carries, the task's first line and the lines the notes point at) and sets them larger (`focus` in `promptCard`). An "Illustration" label sits at the right end of the tab strip, in front of the camera (like the captions), so it stays in view when the camera zooms in; it sits on a plate of the strip's own grey, which cannot be seen until the camera zooms and then hides whatever passes under the label. Every end card says the inbox and the AI page are made up.
- In the install video, the website is the real `docs/index.html`, served under `/__docs/` and shown in a frame (its videos are not served, so they keep their posters, and its links do nothing). The download bubble, the extensions page, the puzzle-piece Extensions menu, the file window with its right-click menu and the folder picker are plain, generic drawings, like the AI page. The file window unzips the Windows way (right-click, Extract All), as the video leads with Windows; the caption gives the Mac way. The extension's card on the extensions page takes its name, version and description from the manifest.
- Time is not real time. Each frame, the stage is drawn at time t, the content script's timers are moved to t (`CONTENT_CLOCK` in `lib/browser.mjs`), and every animation in the page, the extension's included, is set to t. So a render comes out the same on a slow or a fast machine, with one exception: the extension's messages to its service worker take real time, so the moment a thread is copied can land a few frames earlier or later (up to about half a second on a busy machine). Storyboards wait for it with `d.until` and count the hold on the note from the copy, so the pacing stays the same, but two renders are not byte-identical. Where a late copy would squeeze what follows, the storyboard gives `d.until` a latest time (`late`); the hero allows 4.5 s. A later copy stops that video with an error before it is encoded: render it again. The pointer is drawn, and the real mouse follows it, so hovers and clicks are real events.
- Captions sit at the bottom unless a storyboard puts one at the top. Shots with Gmail's menu open put it at the top, because the menu reaches nearly to the bottom of the page. A bottom caption that would cover the extension's note rises just above it in the frame the note appears or changes, and settles back once the note fades. Where a caption should change with the note, `d.caption(text, { toast: '<pattern>' })` holds it until the note matches and shows it in that very frame (follow it with `d.until` on the same note). Captions sit on a solid box, so nothing behind them shows through when the camera zooms in.
- Cards (title, end, and what a desktop agent gets) fade through paper: the paper covers the page before the words appear, and the words go before the paper, so they never sit over the inbox.
- Frames are PNG screenshots at 30 fps. `lib/encode.mjs` makes the MP4 (H.264), WebM (VP9), GIF, posters and the SRT with ffmpeg.

The made-up mailbox is `sam.morgan@example.com`, in `stage/data.js`. Change names, emails or rows there.

## Recording them again

You need Node 20 or later, Google Chrome (or set `CHROME` to a Chrome or Chromium binary) and an ffmpeg with libx264, libvpx-vp9 and the GIF encoder. On a Mac, `brew install ffmpeg`; on Ubuntu, `sudo apt install ffmpeg`; or download a static build from one of the builds linked at <https://ffmpeg.org/download.html> and point `FFMPEG` at it. Playwright's own ffmpeg will not do: it only encodes VP8.

This set was rendered on a Mac with nothing installed on the system: the static ffmpeg 9.0.2 build from <https://evermeet.cx/ffmpeg/> (the macOS build ffmpeg.org links to) was unzipped into a temporary folder and passed in with `FFMPEG`. That build is for Intel Macs; on Apple silicon it runs under Rosetta 2.

```sh
node media/record.mjs                    # everything, about 10 minutes
node media/record.mjs hero clip-bulk     # only these
node media/record.mjs walkthrough walkthrough-thumbnail   # the YouTube video, its SRT and thumbnail
node media/record.mjs install install-thumbnail           # the install video, its SRT and thumbnail
node media/record.mjs --list             # the videos and their files
node media/record.mjs --steps            # rewrite STEPS.md only
FFMPEG=/path/to/ffmpeg node media/record.mjs
MEDIA_WORK=/tmp/media node media/record.mjs   # work files somewhere else
```

Without a usable ffmpeg, the recorder says so and stops before it renders anything; `--frames-only` needs no ffmpeg.

Work files (frames, the Chrome profile, a copy of the extension, `report.json`) go to `media/.out/<video>-<time>/`, which git ignores. Delete old ones when you like. The recorder stops with an error if the extension does not do what the storyboard expects, for example if a menu item is renamed, so a changed release shows up the next time the videos are rendered. CI does not render them. A quick check that needs only Chrome: `MEDIA_WORK=tests/.out/media node media/record.mjs clip-copy --frames-only`.

After a render, look at a few frames in the work folder before committing. The run prints any caption that breaks the rules below and any request it had to block.

## Changing a video

Each video is a storyboard in `storyboards/`: its size, the AIs ticked at the start, its files, its step list and a `run(d)` script. The script moves the pointer (`d.move`), clicks (`d.click`), sets captions (`d.caption`), shows key caps (`d.keys`), moves the camera (`d.cam`) and waits for the extension (`d.until`, `d.copied`, `d.opened`). `d.at(ms)` keeps a step on the storyboard's clock.

Captions follow three rules: at most 2 lines, at most 42 characters a line and at most 15 characters a second. Use `\n` for a line break. British English, no em dashes.

## On the website

A suggested embed for the hero, with the poster for anyone who prefers reduced motion and a visible pause button (motion longer than 5 s needs one):

```html
<figure class="hero-video">
  <video id="hero-video" autoplay muted loop playsinline preload="metadata" poster="media/hero-poster.png"
         aria-label="Right-click an email in Gmail, pick an AI, the thread is copied, paste it and press Enter. Illustration with a made-up inbox.">
    <source src="media/hero.webm" type="video/webm">
    <source src="media/hero.mp4" type="video/mp4">
  </video>
  <button type="button" id="hero-pause" aria-pressed="false">Pause</button>
</figure>
<script>
  const v = document.getElementById('hero-video');
  const b = document.getElementById('hero-pause');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { v.removeAttribute('autoplay'); v.pause(); b.textContent = 'Play'; b.setAttribute('aria-pressed', 'true'); }
  b.addEventListener('click', () => { const paused = v.paused; paused ? v.play() : v.pause(); b.textContent = paused ? 'Pause' : 'Play'; b.setAttribute('aria-pressed', String(!paused)); });
  new IntersectionObserver(([e]) => { if (b.getAttribute('aria-pressed') === 'false') e.isIntersecting ? v.play() : v.pause(); }).observe(v);
</script>
```

The clips are not loops: embed them with `controls` and `preload="metadata"`, their poster, and no `loop`. Each ends on a settled frame. They are 1280 x 800. The prompt card in `clip-desktop-agent` keeps only the prompt's key lines, set larger, but it is still code: show the clips at least 800 px wide, or let a click open them full screen.

For Mac visitors, swap in `hero-mac.*` when `navigator.userAgentData?.platform || navigator.platform` reads Mac. In the README, the GIF: `![Right-click an email, pick an AI, paste the thread](docs/media/hero.gif)`.
