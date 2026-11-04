# Chrome Web Store listing: Open in AI Agent for Gmail

Paste-ready answers for the Developer Dashboard. Upload `Open-in-AI-Agent_Store-Package_v1.0.0.zip` (manifest at the zip root).

## Store listing tab

**Name** (from manifest): Open in AI Agent for Gmail (Claude Code & Codex)

**Summary** (from manifest): Right-click a Gmail thread to start a Claude Code or Codex session on it. Runs on your computer; sends nothing to any server.

**Description:**

Hand any Gmail thread to your AI agent in one click.

Right-click a thread in your inbox and choose "Open in Claude Code" or "Open in Codex (GPT)". A new session opens in the desktop app on your computer, pointed at that exact thread. The agent reads the full conversation through its own Gmail connection, tells you where things stand, and drafts a reply for you to approve.

How it works
• Inbox: two items appear at the top of Gmail's right-click menu.
• Inside an open thread: right-click and use Chrome's menu.
• Claude Code opens a pre-filled session; you press Enter to start.
• Codex starts the session straight away.
• Choose the working folder once in Options.

Built to be safe by default
• The prompt tells the agent to draft only and send nothing without your approval.
• The email subject is never placed in the prompt, so a sender cannot slip instructions into it.
• No server, no analytics, no tracking. The extension only reads the mailbox address and thread ID, and hands them to the app on your computer.

You need
• The Claude desktop app (for Claude Code) and/or OpenAI's ChatGPT desktop app with Codex.
• Gmail connected inside that app for the same mailbox.
• Tested on macOS.

Free and open source (MIT): https://github.com/thomasoclegg/gmail-to-agent

Not affiliated with or endorsed by Google, Anthropic or OpenAI. Gmail, Claude and Codex are trademarks of their respective owners.

**Category:** Productivity › Workflow & Planning (fallback: Tools)
**Language:** English (UK)
**Store icon:** `icons/icon128.png`
**Screenshots (1280×800):** `store/shot1.png`, `store/shot2.png`
**Small promo tile (440×280):** `store/promo.png`
**Homepage URL:** https://thomasoclegg.github.io/gmail-to-agent/
**Support URL:** https://github.com/thomasoclegg/gmail-to-agent/issues

## Privacy tab

**Single purpose:** Opens the Gmail thread you right-click in a new Claude Code or Codex session on your computer.

**Permission justifications**
- `contextMenus`: adds "Open thread in Claude Code" and "Open thread in Codex (GPT)" to Chrome's right-click menu inside an open Gmail thread.
- `storage`: saves the working folder the user enters on the options page.
- Host access `https://mail.google.com/*` (content script): reads the mailbox address and the right-clicked thread's ID from the Gmail page, and adds the two items to Gmail's own right-click menu.

**Remote code:** No. All JavaScript ships in the package.

**Data usage (tick):**
- Personally identifiable information: yes (the signed-in Gmail address, placed in the prompt handed to a local desktop app).
- Personal communications: yes, conservatively (the thread ID that identifies an email conversation; no subject, body or attachments are read).
- All other categories: no.

**Certify all three:** not sold or transferred to third parties outside the approved use; not used for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

**Privacy policy URL:** https://github.com/thomasoclegg/gmail-to-agent/blob/main/PRIVACY.md

## Distribution tab

**Visibility:** Public. **Regions:** All regions. **Pricing:** Free.
