# Privacy policy: Open in AI Agent for Gmail

Last updated: 4 November 2026

This extension runs entirely on your computer. It has no server, no analytics and no tracking, and it sends nothing anywhere itself. Nothing is sent to us.

## What it reads, and when

When you right-click in Gmail, it checks whether you clicked an email so it can add its items to the menu. It reads the email's details only after you pick one of those items, and only for that thread. What it reads depends on what you pick.

**Claude Code or Codex** (desktop agents):

- the Gmail address of the mailbox you are signed in to,
- the ID of the thread you chose,
- the account number in the Gmail web address (for example `/u/0/`), to build a link back to the thread.

It does not read the subject, body or attachments.

**A web AI** (Claude, ChatGPT, Gemini, Microsoft Copilot, Perplexity, Grok, Le Chat or DeepSeek) **or "Copy for any AI"**:

- the three items above,
- from the thread you chose only: the subject, each sender's name and email address, each message's date, and the text of each message as Gmail shows it.

If you picked it from an inbox row, the extension opens that thread first so it can read it. Gmail marks the thread as read, as it does whenever you open one. The extension then expands the thread's messages. The extension does not read attachments, other threads or anything else in your mailbox.

## Where it goes

**Desktop agents:** the three items are placed in a prompt and handed to the Claude desktop app or the ChatGPT desktop app on the same computer, through a `claude://` or `codex://` link.

**Web AIs and "Copy for any AI":** the prompt, including the thread, is put on your computer's clipboard. For a web AI the extension then opens that AI's website in a new tab. The address it opens is fixed (for example `https://chatgpt.com/`) and carries no email content. The AI site receives only what you paste into it and send. "Copy for any AI" opens nothing.

The text stays on your clipboard until you copy something else, like anything you copy yourself, so other apps that can read your clipboard can read it too.

Nothing is sent to the extension's developer or to anyone else. Once you hand a thread to an AI app or website, that service's own terms and privacy policy govern what it does with it.

## What it stores

Only your settings: which AIs appear in the menu and the working folder for desktop sessions. They are saved in Chrome's sync storage, so if Chrome sync is on they follow your Chrome profile to your other computers. No email content is stored. Uninstalling the extension removes the settings.

## Permissions

- `contextMenus`: adds your chosen AIs to Chrome's right-click menu inside an open Gmail thread.
- `storage`: saves your settings.
- `offscreen` and `clipboardWrite`: put the prepared prompt on your clipboard.
- Access to `mail.google.com`: adds your chosen AIs to Gmail's right-click menu, reads the thread you pick, and shows a short confirmation inside Gmail.

## Sharing and sale

No data is sold, shared, or used for advertising, credit decisions, lending or any purpose other than handing the thread you chose to the AI you chose.

## Contact

Open an issue at https://github.com/thomasoclegg/gmail-to-agent/issues.
