# Chrome Web Store listing: Open in AI Agent for Gmail

Paste-ready answers for the Developer Dashboard. Upload `Open-in-AI-Agent_Store-Package_v1.1.1.zip` (manifest at the zip root, version 1.1.1).

## Store listing tab

**Name** (from manifest): Open in AI Agent for Gmail

**Summary** (from manifest, 122 of 132 characters): Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or another AI. Runs on your computer.

**Description:**

Right-click a Gmail thread to open it in Claude, ChatGPT, Codex or one of seven other AIs.

I built this for my own inbox. Web AIs (Claude, ChatGPT, Gemini, Microsoft Copilot, Perplexity, Grok, Le Chat and DeepSeek) open in a new tab next to Gmail with the whole thread copied: press Cmd+V (Ctrl+V on Windows), read it, then press Enter. Claude Code and Codex open a session on your computer and read the thread through their own Gmail connection.

Set up in two steps
1. Add the extension.
2. Tick the AIs you use on the page that opens.
Then reload Gmail and right-click any email.

What happens when you click
• Inbox: your AIs appear at the top of Gmail's right-click menu.
• Inside an open thread: right-click and use Chrome's menu (under "Open in AI Agent for Gmail" when you pick more than one AI).
• Web AIs: the extension opens the thread, copies the subject, senders, dates and message text with a short prompt, and opens the AI's site in a new tab next to Gmail. A note in Gmail names the keys to press. You paste and send.
• Copy thread for any AI: copies the same text and opens nothing.
• Claude Code pre-fills a session for you to start. With a working folder set, Codex starts straight away.
• Click the toolbar icon to change your AIs or the working folder.

Privacy
• Runs on your computer. No server and no analytics. Nothing is sent to me.
• It reads an email only after you pick an AI for it, and only that thread.
• Web AIs get the email only through your clipboard. You see it and press Enter yourself.
• The prompt asks the AI to treat the email as information, not instructions, and to draft a reply for you to review.
• Desktop agents never get the subject or body in their prompt, because Codex can run it straight away.
• Two side effects: picking a web AI or Copy thread for any AI from an inbox row opens the thread, so Gmail marks it read, and the copied text replaces whatever was on your clipboard.

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

**Single purpose:** Copies the Gmail thread you right-click, or its link, to the AI you pick.

**Permission justifications**
- `contextMenus`: adds the AIs the user picked (for example "Ask ChatGPT about this thread", "Open thread in Claude Code", "Copy thread for any AI") to Chrome's right-click menu inside an open Gmail thread.
- `storage`: saves the user's settings: which AIs appear in the menu and the working folder for desktop sessions.
- `offscreen`: copies the prepared prompt to the clipboard when the user picks a web AI or "Copy thread for any AI" from either right-click menu. The background service worker has no page to copy from, so it uses one offscreen document created with reason CLIPBOARD, which only writes the prompt to the clipboard.
- `clipboardWrite`: puts the prepared prompt on the clipboard so the user can paste it into the AI they chose.
- Host access `https://mail.google.com/*` (content script): adds the chosen AIs to Gmail's own right-click menu; after the user picks one, reads the mailbox address and thread ID (desktop agents) or the chosen thread's subject, senders, dates and message text (web AIs and copy) to build the prompt; shows a short confirmation inside Gmail.

**Remote code:** No. All JavaScript ships in the package.

**Data usage (tick):**
- Personally identifiable information: yes (the signed-in Gmail address, and the names and email addresses of senders in the chosen thread).
- Personal communications: yes (the subject, dates and message text of the thread the user chooses for a web AI or copy; for desktop agents only the thread ID).
- Website content: yes (the text read from the Gmail page to build the prompt).
- All other categories (health, financial and payment, authentication, location, web history, user activity): no.

All of it is used only to build the prompt the user asked for. It goes onto the user's own clipboard or to a desktop app on the user's computer, never to the developer's or anyone else's server.

**Certify all three:** not sold or transferred to third parties outside the approved use; not used for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

**Privacy policy URL:** https://github.com/thomasoclegg/gmail-to-agent/blob/main/PRIVACY.md

**Test instructions** (optional field): No account or login for the extension. Install it; on the settings page that opens, Claude and ChatGPT are already picked. Open Gmail (reload it if it was already open), right-click an email in the inbox and choose "Ask ChatGPT". A ChatGPT tab opens next to Gmail and the thread is on the clipboard, ready to paste.

## Distribution tab

**Visibility:** Public. **Regions:** All regions. **Pricing:** Free.

## Before submitting

- New in 1.1.0: the `offscreen` and `clipboardWrite` permissions. Chrome shows users "Read and change your data on mail.google.com" and "Modify data you copy and paste" at install.
- Screenshots: `store/shot1.png` (the right-click menu and the note, made-up inbox), `store/shot2.png` (the web prompt, made-up thread) and `store/shot3.png` (the real settings page). All three are 1280×800; the promo tile is 440×280. `python3 store/build.py` rebuilds shot1, shot3 and the promo tile from the website and options.html; shot2.html is written by hand.
- Build the package from the repository root with exactly these files (the settings page loads its fonts from `fonts/`):
  `zip -r -X Open-in-AI-Agent_Store-Package_v1.1.1.zip manifest.json background.js content.js targets.js options.html options.js offscreen.html offscreen.js LICENSE icons fonts/OFL.txt fonts/libre-franklin-latin-400-normal.woff2 fonts/libre-franklin-latin-600-normal.woff2`
  Unzip it into an empty folder and load that with Load unpacked before you upload it.
- 1.1.1 changes no permissions. It brings the new icon and settings page, renames the Codex item to Open in Codex and shortens one sentence in the desktop prompt.
