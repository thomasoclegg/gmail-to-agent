# Privacy policy: Open in AI Agent for Gmail

Last updated: 4 November 2026

This extension runs entirely on your computer. It has no server, no analytics and no tracking. The only requests it makes itself go to Gmail, for the print view of emails you chose (see below). Nothing is sent to me.

## What it reads, and when

When you right-click in Gmail, it checks whether you clicked an email so it can add its items to the menu. In the inbox list it also notes which emails are ticked, by thread ID only, so the menu can offer them together. It reads an email's details only after you pick one of its items, and only for the threads you picked it for. What it reads depends on what you pick.

**Claude Code or Codex** (desktop agents), one thread:

- the Gmail address of the mailbox you are signed in to,
- the ID of the thread you chose,
- the account number in the Gmail web address (for example `/u/0/`), to build a link back to the thread,
- for Claude Code only, the thread's subject, so the session is named after the email.

It does not use the body or attachments, and Codex does not get the subject. It takes the mailbox address from the Gmail tab's title and ignores the rest of the title.

**A web AI** (Claude, ChatGPT, Gemini, Microsoft Copilot, Perplexity, Grok, Le Chat or DeepSeek) **or "Copy thread for any AI"**, one thread:

- the mailbox address, thread ID and account number, as above,
- from the thread you chose only: the subject, each sender's name and email address, each message's date, and the text of each message as Gmail shows it.

If you picked it from an inbox row, the extension opens that thread first so it can read it. Gmail marks the thread as read, as it does whenever you open one. The extension then expands the thread's messages. The extension does not read attachments, other threads or anything else in your mailbox.

**Several emails at once** (two or more ticked in the inbox list, up to 25):

- For any AI: the mailbox address and account number, and each ticked thread's ID, subject and preview as the inbox list shows them.
- Claude Code gets each thread's ID, Gmail link and subject in its prompt. Codex gets the IDs and links only.
- For a web AI or "Copy N emails for any AI", also the full text of each ticked thread from Gmail's print view of it: each message's sender, recipients, date and text. Attachments are not read.

To get a print view, the extension asks Gmail for it from your Gmail tab, signed in as you already are, the same way the page itself would. It does not open, click or change anything in Gmail, so an unread email stays unread (checked on a real Gmail account on 4 November 2026).

Gmail requires a session key in that request. Each time you pick several emails for a web AI or Copy, the extension reads the key from the Gmail page, where Gmail keeps it (`GLOBALS[9]`). The key goes only into those requests to `mail.google.com`, the site that issued it. It is not stored and not sent anywhere else.

## Where it goes

**Desktop agents:** the items above are placed in a prompt and handed to the Claude desktop app or the ChatGPT desktop app on the same computer, through a `claude://` or `codex://` link. If you set a working folder, its path goes in the same link so the session starts there.

**Web AIs and "Copy":** the prompt, including the email text, is put on your computer's clipboard. For a web AI the extension then opens that AI's website in a new tab. The address it opens is fixed (for example `https://chatgpt.com/`) and carries no email content. The AI site receives only what you paste into it and send. "Copy" opens nothing.

Like anything you copy yourself, the text stays on your clipboard until you copy something else, and any app that can read your clipboard can read it. For several emails, the clipboard can hold up to 25 threads at once.

Nothing is sent to me. What you hand to an AI app or website goes to that service, and its own terms and privacy policy cover what it does with it.

The donate link on the settings page and website goes to Friends of Larnaca Cats with `?ref=ai-agent` added, so their site can tell the visit came from this extension. It carries nothing about you or your email.

## What it stores

Only your settings: which AIs appear in the menu and the working folder for desktop sessions. They are saved in Chrome's sync storage, so if Chrome sync is on they follow your Chrome profile to your other computers. No email content and no Gmail session key is stored. Uninstalling the extension removes the settings.

## Permissions

- `contextMenus`: adds your chosen AIs to Chrome's right-click menu inside an open Gmail thread.
- `storage`: saves your settings.
- `offscreen` and `clipboardWrite`: put the prepared prompt on your clipboard.
- `scripting` (from 1.2.0): adds the extension to Gmail tabs that are already open when you install or update it, so they need no reload, and reads Gmail's session key from the Gmail page when you pick several emails for a web AI or Copy.
- Access to `mail.google.com`: adds your chosen AIs to Gmail's right-click menu, reads the threads you pick, requests the print view of emails you ticked, and shows a short confirmation inside Gmail. From 1.2.0 this access is also listed as a host permission, which `scripting` needs. The extension already had it for Gmail's menu, so Chrome shows no new warning.

## Sharing and sale

No data is sold, shared or used for advertising, credit decisions, lending or any purpose other than handing the threads you chose to the AI you chose.

## Contact

Open an issue on [the project's GitHub page](https://github.com/thomasoclegg/gmail-to-agent/issues).
