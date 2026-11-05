# Chrome Web Store listing: Open in AI Agent for Gmail

Paste-ready answers for the Developer Dashboard. Upload `dist/open-in-ai-agent-v1.3.0.zip`, built by `node scripts/package.mjs` (the Chrome package, manifest at the zip root, version 1.3.0).

This one listing serves Chrome and every browser that installs from the Chrome Web Store: Chromium, Brave, Opera, Vivaldi, Arc and Perplexity Comet. Edge has its own store (`store/listing-edge.md`, same package) and Firefox its own package and store (`store/listing-firefox.md`). Safari is planned. Internet Explorer is retired and has no extensions.

When the listing is live, paste its address into `STORES.chrome` at the top of the script in `docs/index.html`. That switches the website's Chrome Web Store buttons on. The README needs its own edit by hand: the opening sentence of its Install section and the Chrome row of the table there.

## Store listing tab

**Name** (from manifest): Open in AI Agent for Gmail

**Summary** (from manifest, 122 of 132 characters): Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or another AI. Runs on your computer.

**Description:**

Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or one of five other AIs, all listed on the website and in the screenshots. Tick several emails first to have them sorted into tasks.

I built this for my own inbox. Web AIs open in a new tab next to your inbox with the whole thread copied: press Cmd+V (Ctrl+V on Windows), read it, then press Enter. The two desktop agents open a session on your computer and read the thread through their own connection to your mailbox.

Set up in two steps
1. Add the extension.
2. Tick the AIs you use on the page that opens.
Then right-click any email. Tabs that are already open need no reload.

What happens when you click
• Inbox: your picks appear at the top of the inbox's own right-click menu.
• Inside an open thread: right-click and use the browser's menu (under the extension's name when you pick more than one).
• Web AIs: the extension opens the thread, copies the subject, senders, dates and message text with a short prompt, and opens the site in a new tab. A note on the page names the keys to press. You paste and send.
• Copy thread for any AI: copies the same text and opens nothing.
• Claude Code pre-fills a session named after the email's subject for you to start. Codex gets no subject and, with a working folder set, starts straight away.
• Click the toolbar icon to change your picks or the working folder.

Several emails at once
• Tick two or more emails in the inbox, right-click one of them and pick, for example, "Ask ChatGPT about 3 emails". Up to 25 at a time.
• Web AIs and Copy get each thread's full text, read in the background from its print view. Nothing is opened or clicked, so unread emails stay unread.
• The prompt asks for the threads to be grouped into tasks, related ones together, each with its status, what is asked, any deadline, the next step and a draft reply, most urgent first.
• The desktop agents get a list of thread IDs and links, and read the emails themselves. They are asked to send, post, book, pay or change nothing without your approval.

Privacy
• Runs on your computer. No server and no analytics. Nothing is sent to me.
• It reads emails only after you pick an AI for them, and only those threads.
• Web AIs get the email only through your clipboard. You see it and press Enter yourself.
• The prompt says to treat the email as information, not instructions, and to draft replies for you to review.
• Desktop agents never get the message text in their prompt; they read the email through their own mail connection.
• Two side effects: picking a web AI or Copy for a single inbox row opens the thread, so it is marked read, and the copied text replaces whatever was on your clipboard.

Which browsers
• Chrome and other browsers that install from the Chrome Web Store (the website lists them, along with the Edge and Firefox versions).
• It works in a desktop browser, not in the Gmail app.

You need
• Chrome 116 or later, or a browser built on the same version. Tested in Chrome on macOS.
• For a web AI: its website, signed in if it asks.
• For a desktop agent: the Claude desktop app or the ChatGPT desktop app, with Gmail connected for the same mailbox.

Free and open source (MIT). The website links to the source on GitHub.

If it saves you time, please give something to Friends of Larnaca Cats, a volunteer group that neuters, feeds and treats street cats in Larnaca, Cyprus. The donation link is on the settings page; the money goes straight to them.

Not affiliated with or endorsed by Google or any AI provider named here. All trademarks belong to their owners.

**Category:** Productivity › Communication, where the store lists Gmail tools (fallback: Productivity › Workflow & Planning). Both category pages exist on the store, checked 5 Nov 2026.
**Language:** English (UK)
**Store icon:** `icons/icon128.png`
**Screenshots (1280×800):** `store/shot1.png` (the right-click menu and the note), `store/shot2.png` (what a web AI receives), `store/shot3.png` (the real settings page)
**Small promo tile (440×280):** `store/promo.png`
**Homepage URL:** https://thomasoclegg.github.io/gmail-to-agent/
**Support URL:** https://github.com/thomasoclegg/gmail-to-agent/issues

## Privacy tab

**Single purpose:** Copies the Gmail threads you right-click or tick, or their links, to the AI you pick.

**Permission justifications**
- `contextMenus`: adds the AIs the user picked (for example "Ask ChatGPT about this thread", "Open thread in Claude Code", "Copy thread for any AI") to Chrome's right-click menu inside an open Gmail thread.
- `storage`: saves the user's settings: which AIs appear in the menu and the working folder for desktop sessions.
- `offscreen`: copies the prepared prompt to the clipboard when the user picks a web AI or "Copy" from either right-click menu. The background service worker has no page to copy from, so it uses one offscreen document created with reason CLIPBOARD, which only writes the prompt to the clipboard.
- `clipboardWrite`: puts the prepared prompt on the clipboard so the user can paste it into the AI they chose.
- `scripting`: used on mail.google.com only, for two things. On install and update, it injects the extension's own packaged scripts (`targets.js` and `content.js`, the same files as the content script) into Gmail tabs that are already open, so the user does not have to reload Gmail. When the user ticks several emails and picks a web AI or "Copy", it runs one packaged function in the Gmail page that returns Gmail's session key (`window.GLOBALS[9]`), which the content script needs to request each ticked thread's print view from mail.google.com. No remote code. The key is not stored or sent anywhere except in those requests to mail.google.com.
- Host access `https://mail.google.com/*` (content script and host permission): adds the chosen AIs to Gmail's own right-click menu; after the user picks one, reads the mailbox address and thread IDs (desktop agents; Claude Code also the subjects) or the chosen threads' text (web AIs and copy) to build the prompt; for several ticked emails, requests each one's print view from mail.google.com in the same tab; shows a short confirmation inside Gmail. It is listed as a host permission from 1.2.0 because `scripting` needs it. The content script already matched the same host.

**Remote code:** No. All JavaScript ships in the package.

**Data usage (tick):**
- Personally identifiable information: yes (the signed-in Gmail address, and the names and email addresses of senders, and for several emails also recipients, in the chosen threads).
- Personal communications: yes (the subject, dates and message text of the threads the user chooses for a web AI or copy; for desktop agents the thread IDs, and for Claude Code the subjects).
- Website content: yes (the text read from the Gmail page and from Gmail's print view to build the prompt).
- All other categories (health, financial and payment, authentication, location, web history, user activity): no. Gmail's session key, read for the print-view requests, is not a password or sign-in cookie; it is used only in requests to mail.google.com from the user's own Gmail tab and is never stored or sent elsewhere.

All of it is used only to build the prompt the user asked for. It goes onto the user's own clipboard or to a desktop app on the user's computer, never to the developer's or anyone else's server. The extension's only own network requests are the print-view requests to mail.google.com for emails the user ticked.

**Certify all three:** not sold or transferred to third parties outside the approved use; not used for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

**Privacy policy URL:** https://github.com/thomasoclegg/gmail-to-agent/blob/main/PRIVACY.md

**Test instructions** (optional field): No account or login for the extension. Install it; on the settings page that opens, Claude and ChatGPT are already picked. Open Gmail, right-click an email in the inbox and choose "Ask ChatGPT". A ChatGPT tab opens next to Gmail and the thread is on the clipboard, ready to paste. For several emails, tick two or more in the inbox, right-click one of them and choose "Ask ChatGPT about 2 emails" (the number follows how many are ticked).

## Distribution tab

**Visibility:** Public. **Regions:** All regions. **Pricing:** Free.

## Before submitting

- New in 1.3.0: the same source now also builds the Firefox package and a Safari-ready folder (`node scripts/package.mjs --target all`). The Chrome package's manifest changes only its version, so there is no new permission and no new install warning. Check the final `manifest.json` against 1.2.0's before uploading.
- Upload the Chrome package here, not the Firefox one: `dist/open-in-ai-agent-v1.3.0.zip`.
- Carried over from 1.2.0:
  - Several emails at once: tick two or more in the inbox, right-click one, and up to 25 go to the AI together, read from Gmail's print view without marking them read.
  - Claude Code sessions are named after the email (single thread) or "Inbox triage: N emails" (several).
  - Gmail tabs that are already open pick the extension up on install and update, with no reload.
  - Permissions: adds `scripting` and lists `https://mail.google.com/*` as a host permission. The content script already had that host, and `scripting` has no warning of its own, so by Chrome's permission-warning rules users see no new warning and updates are not held for approval. Install still shows "Read and change your data on mail.google.com" and "Modify data you copy and paste".
- Screenshots: `store/shot1.png` (the right-click menu and the note, made-up inbox), `store/shot2.png` (the web prompt, made-up thread) and `store/shot3.png` (the real settings page). All three are 1280×800; the promo tile is 440×280. They show the single-thread menu, which 1.2.0 keeps. `python3 store/build.py` rebuilds shot1, shot3 and the promo tile from the website and options.html; shot2.html is written by hand.
- Build the package from the repository root with `node scripts/package.mjs`. It writes `dist/open-in-ai-agent.zip` and `dist/open-in-ai-agent-v1.3.0.zip` with only the files Chrome loads, plus the licences. Unzip it into an empty folder and load that with Load unpacked before you upload it.
- Register the developer account with a personal Google account, not a work one: the publisher name and contact details are public on the listing. Registration takes a one-time fee, paid when you register; Chrome's [register page](https://developer.chrome.com/docs/webstore/register) does not state the amount, so check it at checkout.
- Publish the v1.3.0 release on GitHub, with both Firefox zips attached, before the website and README changes reach `main`. GitHub Pages builds the site from `main`, and its Firefox button points at the latest release's `open-in-ai-agent-firefox.zip`.

## Field limits (checked 5 Nov 2026)

- Summary: the manifest's `description`, at most 132 characters ([manifest description](https://developer.chrome.com/docs/extensions/reference/manifest/description)). The one above is 122.
- Screenshots: at least one and up to five, 1280×800. Store icon 128×128. Small promo tile 440×280, marquee 1400×560, both optional. Video: an optional YouTube link. Homepage and support URLs are optional ([Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)).
- Keyword spam ([Spam FAQ](https://developer.chrome.com/docs/webstore/spam-faq)): list at most five supported websites or brands in the description, and keep each keyword to fewer than five instances; a longer list belongs behind a link or in a promotional screenshot. So the description names five AIs and points to the website and `store/shot3.png` (the settings page, which shows all ten), and names no browser but Chrome, Edge and Firefox. Counted on 5 Nov 2026: Gmail 3, Claude 4 (2 of them Claude Code), ChatGPT 3, Codex 2, Chrome 4. Recount after any edit.
