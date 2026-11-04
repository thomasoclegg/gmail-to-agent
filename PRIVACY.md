# Privacy policy: Open in AI Agent for Gmail

Last updated: 4 November 2026

This extension runs entirely on your computer. It has no server, no analytics and no tracking.

## What it reads

When you choose "Open in Claude Code" or "Open in Codex (GPT)", it reads three things from the Gmail page you are on:

- the Gmail address of the mailbox you are signed in to,
- the ID of the thread you right-clicked,
- the account number in the Gmail web address (for example `/u/0/`), to build a link back to the thread.

It does not read the subject, body or attachments of any email.

## Where that goes

Those three items are placed in a prompt and handed to the Claude desktop app or the ChatGPT desktop app on the same computer, through a `claude://` or `codex://` link. Nothing is sent to the extension's developer or to anyone else. What the desktop app then does is governed by that app's own terms and privacy policy.

## What it stores

The working folder you enter on the options page, saved in Chrome's sync storage so it follows your Chrome profile. Remove it by clearing the field or uninstalling the extension.

## Sharing and sale

No data is sold, shared, or used for advertising, credit decisions or any purpose other than opening the session you asked for.

## Contact

Open an issue at https://github.com/thomasoclegg/gmail-to-agent/issues.
