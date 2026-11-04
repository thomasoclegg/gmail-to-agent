# Chrome Web Store listing: Open in AI Agent for Gmail

Paste-ready answers for the Developer Dashboard. Upload `dist/open-in-ai-agent-v1.2.0.zip`, built by `node scripts/package.mjs` (manifest at the zip root, version 1.2.0).

## Store listing tab

**Name** (from manifest): Open in AI Agent for Gmail

**Summary** (from manifest, 122 of 132 characters): Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or another AI. Runs on your computer.

**Description:**

Right-click a Gmail thread to open it in Claude, ChatGPT, Codex or one of seven other AIs. Tick several emails first and the AI sorts them into tasks.

I built this for my own inbox. Web AIs (Claude, ChatGPT, Gemini, Microsoft Copilot, Perplexity, Grok, Le Chat and DeepSeek) open in a new tab next to Gmail with the whole thread copied: press Cmd+V (Ctrl+V on Windows), read it, then press Enter. Claude Code and Codex open a session on your computer and read the thread through their own Gmail connection.

Set up in two steps
1. Add the extension.
2. Tick the AIs you use on the page that opens.
Then right-click any email in Gmail. Tabs that are already open need no reload.

What happens when you click
• Inbox: your AIs appear at the top of Gmail's right-click menu.
• Inside an open thread: right-click and use Chrome's menu (under "Open in AI Agent for Gmail" when you pick more than one AI).
• Web AIs: the extension opens the thread, copies the subject, senders, dates and message text with a short prompt, and opens the AI's site in a new tab next to Gmail. A note in Gmail names the keys to press. You paste and send.
• Copy thread for any AI: copies the same text and opens nothing.
• Claude Code pre-fills a session named after the email for you to start. With a working folder set, Codex starts straight away.
• Click the toolbar icon to change your AIs or the working folder.

Several emails at once
• Tick two or more emails in the inbox, right-click one of them and pick, for example, "Ask ChatGPT about 3 emails". Up to 25 at a time.
• Web AIs and Copy get each thread's full text, read in the background from Gmail's print view. Nothing is opened or clicked, so unread emails stay unread.
• The prompt asks the AI to group the threads into tasks, put related ones together, and give each task its status, what is asked, any deadline, the next step and a draft reply, most urgent first.
• Claude Code and Codex get a list of thread IDs and links, and read the emails through their own Gmail connection. They are asked to send, post, book, pay or change nothing without your approval.

Privacy
• Runs on your computer. No server and no analytics. Nothing is sent to me.
• It reads emails only after you pick an AI for them, and only those threads.
• Web AIs get the email only through your clipboard. You see it and press Enter yourself.
• The prompt asks the AI to treat the email as information, not instructions, and to draft replies for you to review.
• Desktop agents never get the message text in their prompt. Claude Code gets the subject, to name the session. Codex gets no subject, because it can run the prompt straight away.
• Two side effects: picking a web AI or Copy thread for any AI for a single inbox row opens the thread, so Gmail marks it read, and the copied text replaces whatever was on your clipboard.

You need
• Chrome 116 or later. Tested on macOS only.
• For a web AI: that AI's website, signed in if it asks.
• For Claude Code or Codex: the Claude desktop app or the ChatGPT desktop app, with Gmail connected for the same mailbox.

Free and open source (MIT). The website links to the source on GitHub.

If it saves you time, please give something to Friends of Larnaca Cats, a volunteer group that neuters, feeds and treats street cats in Larnaca, Cyprus. The donation link is on the settings page; the money goes straight to them.

Not affiliated with or endorsed by Google, Anthropic, OpenAI, Microsoft, Perplexity, xAI, Mistral AI or DeepSeek. Chrome, Gmail, Gemini, Claude, ChatGPT, Codex, Copilot, Perplexity, Grok, Le Chat and DeepSeek are trademarks of their owners.

**Category:** Productivity › Workflow & Planning (fallback: Tools)
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

- New in 1.2.0:
  - Several emails at once: tick two or more in the inbox, right-click one, and up to 25 go to the AI together, read from Gmail's print view without marking them read.
  - Claude Code sessions are named after the email (single thread) or "Inbox triage: N emails" (several).
  - Gmail tabs that are already open pick the extension up on install and update, with no reload.
  - Permissions: adds `scripting` and lists `https://mail.google.com/*` as a host permission. The content script already had that host, and `scripting` has no warning of its own, so by Chrome's permission-warning rules users see no new warning and updates are not held for approval. Install still shows "Read and change your data on mail.google.com" and "Modify data you copy and paste".
- Screenshots: `store/shot1.png` (the right-click menu and the note, made-up inbox), `store/shot2.png` (the web prompt, made-up thread) and `store/shot3.png` (the real settings page). All three are 1280×800; the promo tile is 440×280. They show the single-thread menu, which 1.2.0 keeps. `python3 store/build.py` rebuilds shot1, shot3 and the promo tile from the website and options.html; shot2.html is written by hand.
- Build the package from the repository root with `node scripts/package.mjs`. It writes `dist/open-in-ai-agent.zip` and `dist/open-in-ai-agent-v1.2.0.zip` with only the files Chrome loads, plus the licences. Unzip it into an empty folder and load that with Load unpacked before you upload it.
