# Walkthrough video for YouTube

`walkthrough-1920x1080.mp4` is the 90 s walkthrough, recorded by `media/record.mjs` (see `media/README.md`). The Chrome Web Store and Edge Add-ons only take a promo video as a YouTube link, so it goes on YouTube first.

| File | What it is |
| --- | --- |
| `walkthrough-1920x1080.mp4` | The video: 1920 x 1080, 30 fps, H.264, silent, captions drawn in. Not kept in git (about 16 MB, needed once per upload): make it with `node media/record.mjs walkthrough` |
| `walkthrough-1920x1080.srt` | The same captions as a subtitle file |
| `walkthrough-thumbnail-1280x720.png` | A custom thumbnail |
| `install-1920x1080.mp4` | The 54 s install video, from the website's download to the first right-click, in Chrome. Not kept in git either: make it with `node media/record.mjs install install-thumbnail` |
| `install-1920x1080.srt` | Its captions as a subtitle file |
| `install-thumbnail-1280x720.png` | Its thumbnail |

## Upload

1. Render the video if `walkthrough-1920x1080.mp4` is missing or older than the release: `node media/record.mjs walkthrough walkthrough-thumbnail`. Look at a few frames before uploading (see `media/README.md`).
2. In YouTube Studio, signed in to the channel the video should appear under, choose Create, then Upload videos, and pick `walkthrough-1920x1080.mp4`.
3. Title: `Open in AI Agent for Gmail: right-click an email, open it in your AI`
4. Description:

   ```text
   A free Chrome extension. Right-click an email in Gmail and open the whole thread in Claude, ChatGPT, Gemini, Claude Code, Codex or another AI, or triage your unread emails from Gmail's toolbar. It runs on your computer: no server, no account, no tracking.

   The video shows Windows keys. On a Mac, press Cmd V instead of Ctrl V, and Control Shift L instead of Alt Shift L.

   Website and download: https://thomasoclegg.github.io/gmail-to-agent/
   Source code: https://github.com/thomasoclegg/gmail-to-agent

   0:00 Pick your AIs
   0:12 Open a thread in an AI
   0:24 Paste and check
   0:34 Several emails, or copy for any AI
   0:49 Claude Code and Codex
   1:01 Triage unread
   1:12 The toolbar list and your own instructions

   An illustration with a made-up inbox. The AI page is drawn, not a real site. Not made by or affiliated with Google, OpenAI or Anthropic.
   ```

5. Thumbnail: upload `walkthrough-thumbnail-1280x720.png`. YouTube allows custom thumbnails once the channel is verified by phone.
6. Audience: No, it's not made for kids.
7. Subtitles: Add, then Upload file, With timing, and pick `walkthrough-1920x1080.srt`, language English (United Kingdom). The captions are already in the picture; the file makes them searchable and readable by screen readers.
8. Before publishing, play the video in YouTube Studio with captions (CC) on. Many viewers keep them on, and most of the drawn-in captions sit at the bottom, where YouTube puts its own. If the two stack, delete the subtitle track and add the walkthrough's step list from `media/STEPS.md` to the description instead.
9. Visibility: Public, so it shows up in YouTube search. Leave monetisation off; Edge asks for a video without ads, although YouTube may still show ads on channels outside its Partner Programme.
10. Copy the video's link into the Chrome Web Store listing (Store listing, Promo video) and into Edge Add-ons (Store listing, YouTube video URL).

The install video goes up the same way, with its own thumbnail and SRT. Put its step list from `media/STEPS.md` in the description: it covers Edge's and Windows' differences, which the video only touches on.

When a release changes what the video shows, record it again and upload the new file as a new video, then update both links. If the timeline changes, check the chapter times against the SRT: each chapter's time is its first caption's start, rounded down to the second, and YouTube needs every chapter to last at least 10 s.
