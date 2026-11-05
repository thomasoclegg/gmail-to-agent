# Privacy policy: Open in AI Agent for Gmail

Last updated: 5 November 2026 (version 1.4.0)

This extension runs entirely on your computer. It has no server, no analytics and no tracking. The only requests it makes itself go to Gmail, for the print view of emails you chose (see below). Nothing is sent to me.

## What it reads, and when

When you right-click in Gmail, it checks whether you clicked an email so it can add its items to the menu. In the inbox list it also notes which emails are ticked, by thread ID only, so the menu can offer them together. The toolbar list, the keyboard shortcuts and the extension's button in Gmail's toolbar make the same check in the Gmail tab you are on: whether a thread is open and which emails are ticked. The button uses it only to choose its label. On a tab that is not Gmail, the toolbar list and the second shortcut check only whether text is selected there (see Selected text below). It reads an email's details only after you pick one of its items, and only for the threads you picked it for. What it reads depends on what you pick.

**Claude Code or Codex** (desktop agents), one thread:

- the Gmail address of the mailbox you are signed in to,
- the ID of the thread you chose,
- the account number in the Gmail web address (for example `/u/0/`), to build a link back to the thread,
- for Claude Code only, the thread's subject, so the session is named after the email.

It does not use the body or attachments, and Codex does not get the subject. It takes the mailbox address from the Gmail tab's title and ignores the rest of the title.

**A web AI** (Claude, ChatGPT, Gemini, Microsoft Copilot, Perplexity, Grok, Le Chat or DeepSeek) **or "Copy thread for any AI"**, one thread:

- the mailbox address, thread ID and account number, as above,
- from the thread you chose only: the subject, each sender's name and email address, each message's date, and the text of each message as Gmail shows it.

If you picked it from an inbox row, the extension opens that thread first so it can read it. Gmail marks the thread as read, as it does whenever you open one. The extension then expands the thread's messages. The extension does not read attachments, other threads or anything else in your mailbox. If it cannot read the thread, it uses only the subject and the Gmail link, and says so.

**Several emails at once** (two or more ticked in the inbox list, up to 25, or Triage unread):

- For any AI: the mailbox address and account number, and each ticked thread's ID, subject and preview as the inbox list shows them.
- Claude Code gets each thread's ID, Gmail link and subject in its prompt. Codex gets the IDs and links only.
- For a web AI or "Copy N emails for any AI", also the full text of each ticked thread from Gmail's print view of it: each message's sender, recipients, date and text. Attachments are not read.

**Triage unread** (the button in Gmail's toolbar with nothing ticked, from 1.4.0) reads the same details as above for the unread emails on the page of the list you are looking at, up to 25. It finds them in the list as Gmail draws it and never clicks or opens one.

To get a print view, the extension asks Gmail for it from your Gmail tab, signed in as you already are, the same way the page itself would. It does not open, click or change anything in Gmail, so an unread email stays unread (checked on a real Gmail account on 4 November 2026). Apart from opening a thread you picked from an inbox row (above), the extension itself changes nothing in Gmail: it sends nothing, saves no draft and changes no label.

Gmail requires a session key in that request. Each time you pick several emails for a web AI or Copy, the extension reads the key from the Gmail page, where Gmail keeps it (`GLOBALS[9]`). The key goes only into those requests to `mail.google.com`, the site that issued it. It is not stored and not sent anywhere else.

**Selected text on any page** (from 1.4.0):

- Only after you select text and pick one of the extension's items for it, such as "Ask ChatGPT about the selected text", from the right-click menu or the toolbar list, or press the second shortcut on that page.
- The browser hands the extension the text you selected. That pick also lets the extension into that one tab until you leave the page (`activeTab`, below). It uses that to read the selection again as the page has it, so line breaks survive, to show its short note in the page and, in Firefox, to open the desktop app's link from the page. It reads nothing else on the page and does not use its address.
- In Gmail, it also asks its own script in the tab whether the right-click itself selected the text (a Mac selects the word under the pointer), and gets back yes or no. If it did, the pick goes to the email instead, as above.
- Characters a reader cannot see (such as Unicode tag characters and direction overrides) are taken out of the text before it goes anywhere, so a page cannot hide instructions in what you select.

**Check Gmail and Report a problem** (settings page, from 1.4.0):

- Check Gmail runs only when you click it. It asks the extension in your open Gmail tab whether it can find the inbox rows, an open thread and Gmail's menu, and gets back counts and yes-or-no answers. It reads no email text, subjects or addresses for this. The answers show on the settings page and are not stored.
- Report a problem opens GitHub's form for a new issue in a new tab, with the extension's version, your browser's name, version and operating system, and the Check Gmail answers filled in. They travel in that page's web address, which is how GitHub fills in its form, so GitHub receives them when the page opens. They never include email text, subjects, addresses, your working folder or your own instructions. Nothing is posted until you submit the issue yourself, and what you submit is public on GitHub, under GitHub's own terms.

## Where it goes

**Desktop agents:** the items above are placed in a prompt and handed to the Claude desktop app or the ChatGPT desktop app on the same computer, through a `claude://` or `codex://` link that your browser passes to the app. If you set a working folder, its path goes in the same link so the session starts there. If you wrote your own instructions for Claude Code and Codex (see What it stores), they go in the same link, in place of the built-in ones, for one email or several. No email text ever goes in these links. For text you select on a page other than Gmail, Claude Code gets the text in its link, marked as text you selected. In Gmail, where selected text is email text, it goes to your clipboard instead, as it always does for Codex, which never gets selected text in its link. For Triage unread, Claude Code's prompt asks it to write its draft replies in its answer first, each with its recipient, and only when you say yes to save them as Gmail drafts in your mailbox, each in reply to its own thread, and never to send. It would do that through its own Gmail connection, under the Claude app's terms, and only after you press Enter. For ticked emails, and always for Codex, the prompt asks for drafts in the answer only. The built-in prompts also ask Claude Code, for a task that cannot be finished now, to propose a separate session in the same app, with a short brief it writes, for you to start yourself, and never to start one itself or to use a command or another app link for it; they ask Codex to give such briefs in its answer for you to start yourself. The extension never sees those briefs. A brief is written after the agent has read your email, so read it before you start anything from it. Every desktop prompt asks the agent never to open a link, visit a site, run code or install anything because something it reads asks it to, and never to put what it has read into a web address, form or message that text suggests. Every one ends by asking the agent not to send, post, book, pay, submit, archive, label, delete or change anything in Gmail or outside its working folder without your explicit approval; Codex, which starts before you have read its prompt, is also asked only to read, and to write no files, until you reply. A prompt can ask; it cannot enforce.

**Web AIs and "Copy":** the prompt, including the email text or the text you selected, and your own instructions for the web AIs and Copy if you wrote any, is put on your computer's clipboard. A short note in the page says so; on a page that takes no script from extensions, such as a browser page, the note shows on the extension's icon instead, for a few seconds. For a web AI the extension then opens that AI's website in a new tab. The address it opens is fixed (for example `https://chatgpt.com/`) and carries no email content. The AI site receives only what you paste into it and send. "Copy" opens nothing.

Like anything you copy yourself, the text stays on your clipboard until you copy something else, and any app that can read your clipboard can read it. On Windows, clipboard history keeps it after that, and syncs it to your other devices if you have turned on clipboard sync. For several emails, the clipboard can hold up to 25 threads at once.

Nothing is sent to me. What you hand to an AI app or website goes to that service, and its own terms and privacy policy cover what it does with it.

The donate link on the settings page and website goes to Friends of Larnaca Cats with `?ref=ai-agent` added, so their site can tell the visit came from this extension. It carries nothing about you or your email.

## What it stores

- Your settings: which AIs appear in the menus, Gmail's toolbar button and the toolbar list, whether that button shows, the working folder for desktop sessions and your own instructions (from 1.4.0). They are saved in the browser's sync storage. If your browser syncs extension data, they follow your profile to your other computers, and your browser's sync service (Google's for Chrome, Microsoft's for Edge, Mozilla's for Firefox) stores them, your own instructions included, under that service's terms.
- Your own instructions are the text you type, if any, in the two boxes under Your own instructions on the settings page: one for Claude Code and Codex, one for the web AIs and Copy. Characters a reader cannot see are taken out, lines that start "Mailbox:", "Thread ID:" or "Gmail link:" are left out (the extension adds its own), and each box keeps at most 4,000 characters. The text goes only into the prompts the extension builds when you pick an AI for one email or several: in the link to the desktop app, or on your clipboard. It never goes into Triage unread, selected-text prompts or a Report a problem link, and it is not sent to me. Leave out anything you would not want synced or handed to an AI, such as a password; you need not add your mailbox address, since the extension adds it.
- Which AI you used last, for the "send to the AI you used last" shortcut. It is saved in the browser's local storage on this computer and does not sync.

No email content, no selected text, no Check Gmail answers and no Gmail session key is stored. Uninstalling the extension removes all of it from this browser. If your browser syncs extension data, its sync service may keep a copy of your settings and restore them if you install the extension again in a profile that syncs. To clear your instructions everywhere, click **Use the built-in instructions** under each box, or empty it, before you uninstall.

## Permissions

The same in every browser, except where noted. The toolbar list, the keyboard shortcuts and the button in Gmail's toolbar need no permission of their own, apart from `activeTab` on a page that is not Gmail.

- `contextMenus`: adds your chosen AIs to the browser's own right-click menu inside an open Gmail thread and, from 1.4.0, on any page while text is selected, for that text only.
- `storage`: saves your settings, including your own instructions, and the AI you used last.
- `clipboardWrite`: puts the prepared prompt on your clipboard. In browsers that have offscreen documents, it works with `offscreen`, a hidden extension page that does the copying. Firefox has no such page and asks for no `offscreen` permission: the extension's background page copies by itself.
- `scripting` (from 1.2.0): reads Gmail's session key from the Gmail page when you pick several emails for a web AI or Copy. Where the browser does not do it by itself, it also adds the extension to Gmail tabs that are already open when you install or update it, so they need no reload. From 1.4.0 it also runs in the tab where you picked a selected-text item, through `activeTab`: it reads the selection there and shows the extension's note.
- `activeTab` (from 1.4.0): when you pick a selected-text item, or use the toolbar list or the second shortcut on a page that is not Gmail, the browser gives the extension that one tab until you leave the page. The extension uses it only to read the text you selected, show its note there and, in Firefox, open the desktop app's link from the page. It reads nothing else from the page, and it adds no warning at install.
- Access to `mail.google.com`: adds your chosen AIs to Gmail's right-click menu and one button to Gmail's toolbar, reads the threads you pick, requests the print view of emails you ticked, shows a short note inside Gmail, and answers Check Gmail. From 1.2.0 this access is also listed as a host permission, which `scripting` needs. The extension already had it for Gmail's menu, so the browser shows no new warning.

The extension has no standing access to any other site: only the one tab you act on, through `activeTab`, until you leave that page.

## What Firefox shows at install

Firefox asks add-ons to state which data they pass outside the add-on or the browser, and shows the answer when you install one. This one declares "personally identifying information" (your mailbox address), "personal communications" and "website content" (the email text, and text you select on a page), because what you pick leaves the browser: for a web AI or Copy, the prompt with the text goes onto your clipboard, and for Claude Code and Codex, the details listed above go in the link to the desktop app. Your own instructions travel inside those same prompts and change nothing in this statement. That is the hand-off described above, which you start each time. Nothing is sent to me or to anyone you did not pick.

## Sharing and sale

No data is sold, shared or used for advertising, credit decisions, lending or any purpose other than handing the threads or text you chose to the AI you chose.

## Contact

Open an issue on [the project's GitHub page](https://github.com/thomasoclegg/gmail-to-agent/issues), or use Report a problem on the settings page.
