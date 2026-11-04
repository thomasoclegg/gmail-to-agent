# Chrome Web Store listing: Open in AI Agent for Gmail

Paste-ready answers for the Developer Dashboard. Upload `Open-in-AI-Agent_Store-Package_v1.1.0.zip` (manifest at the zip root, version 1.1.0).

## Store listing tab

**Name** (from manifest): Open in AI Agent for Gmail

**Summary** (from manifest, 126 of 132 characters): Right-click a Gmail thread to hand it to Claude, ChatGPT, Gemini, Copilot, Claude Code, Codex and more. Runs on your computer.

**Description:**

Hand any Gmail thread to the AI you use, with one right-click.

Right-click an email and pick your AI. Web AIs (Claude, ChatGPT, Gemini, Microsoft Copilot, Perplexity, Grok, Le Chat and DeepSeek) open in a new tab with the email copied: press Cmd+V (Ctrl+V), then Enter. Desktop agents (Claude Code and Codex) start a session on your computer and read the thread through their own Gmail connection.

Set up in two steps
1. Add the extension.
2. Pick the AI you use on the page that opens.
Then right-click any email.

How it works
• Inbox: your AIs appear at the top of Gmail's right-click menu.
• Inside an open thread: right-click and use Chrome's menu (under "Open in AI Agent for Gmail" when you pick more than one AI).
• Web AIs: the extension opens the thread, copies the subject, senders, dates and message text with a short prompt, and opens the AI's site next to Gmail. You paste and send.
• Copy for any AI: copies the same text and opens nothing.
• Claude Code pre-fills a session for you to start. Codex starts straight away.
• Click the toolbar icon to change your AIs or the working folder.

Safe by default
• Runs on your computer. No server, no analytics, no tracking. Nothing is sent to us.
• It reads an email only after you pick an AI for it, and only that thread.
• Web AIs get the email only through your clipboard. You see it and press Enter yourself.
• The prompt tells the AI to treat the email as information, not instructions, and to draft a reply for you to review.
• Desktop agents never get the subject or body in their prompt, because Codex runs it straight away.

You need
• Chrome. Tested on macOS.
• For a web AI: that AI's website, signed in if it asks.
• For Claude Code or Codex: the Claude desktop app or OpenAI's ChatGPT desktop app with Codex, with Gmail connected for the same mailbox.

Free and open source (MIT): https://github.com/thomasoclegg/gmail-to-agent

Not affiliated with or endorsed by Google, Anthropic, OpenAI, Microsoft, Perplexity, xAI, Mistral AI or DeepSeek. Gmail, Gemini, Claude, ChatGPT, Codex, Copilot, Perplexity, Grok, Le Chat and DeepSeek are trademarks of their respective owners.

**Category:** Productivity › Workflow & Planning (fallback: Tools)
**Language:** English (UK)
**Store icon:** `icons/icon128.png`
**Screenshots (1280×800):** `store/shot1.png`, `store/shot2.png`, `store/shot3.png` (onboarding page)
**Small promo tile (440×280):** `store/promo.png`
**Homepage URL:** https://thomasoclegg.github.io/gmail-to-agent/
**Support URL:** https://github.com/thomasoclegg/gmail-to-agent/issues

## Privacy tab

**Single purpose:** Hands the Gmail thread you right-click to the AI assistant you choose.

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
- Screenshots: `store/shot1.png` (the right-click menu), `store/shot2.png` (both prompt types, made-up data) and `store/shot3.png` (the real settings page). All three are 1280×800; the promo tile is 440×280.
