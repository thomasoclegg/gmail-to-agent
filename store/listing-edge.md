# Microsoft Edge Add-ons listing: Open in AI Agent for Gmail

Paste-ready answers for Partner Center. Edge takes the Chrome package unchanged: upload `dist/open-in-ai-agent-v1.3.0.zip`, built by `node scripts/package.mjs` (manifest at the zip root, version 1.3.0). Load the unzipped copy in `edge://extensions` with Developer mode and Load unpacked before you upload it.

When the listing is live, paste its address (from the Extension overview page) into `STORES.edge` at the top of the script in `docs/index.html`. That switches the website's Edge Add-ons buttons on. The README needs its own edit by hand: the opening sentence of its Install section and the Edge row of the table there.

## Before you start: the developer account

- Register at [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/public/login). There is no registration fee.
- Use a personal Microsoft account (Outlook.com, Live.com or Hotmail.com), or sign in with GitHub, which creates one. Partner Center does not accept a work or school account for the Edge programme.
- Account type: **Individual**. It cannot be changed after enrolment, and verification is shorter than for a company.
- Publisher display name (at most 50 characters, shown on the listing): Thomas Clegg. The contact details are for Microsoft only.

## Availability

**Visibility:** Public. **Markets:** All markets (the default, which also takes in markets added later).

## Properties

**Category:** Productivity. Microsoft's documentation does not list the categories; pick the nearest one if Partner Center names it differently.
**Website:** https://thomasoclegg.github.io/gmail-to-agent/
**Support contact detail:** https://github.com/thomasoclegg/gmail-to-agent/issues
**Mature content:** No.

## Privacy

**Single purpose description:** Copies the Gmail threads you right-click or tick, or their links, to the AI you pick.

**Permission justification** (Partner Center lists the permissions from the manifest; paste one answer into each box):
- `contextMenus`: adds the AIs the user picked (for example "Ask ChatGPT about this thread", "Open thread in Claude Code", "Copy thread for any AI") to the browser's right-click menu inside an open Gmail thread.
- `storage`: saves the user's settings: which AIs appear in the menu and the working folder for desktop sessions.
- `offscreen`: copies the prepared prompt to the clipboard when the user picks a web AI or "Copy" from either right-click menu. The background service worker has no page to copy from, so it uses one offscreen document created with reason CLIPBOARD, which only writes the prompt to the clipboard.
- `clipboardWrite`: puts the prepared prompt on the clipboard so the user can paste it into the AI they chose.
- `scripting`: used on mail.google.com only, for two things. On install and update, it injects the extension's own packaged scripts (`targets.js` and `content.js`, the same files as the content script) into Gmail tabs that are already open, so the user does not have to reload Gmail. When the user ticks several emails and picks a web AI or "Copy", it runs one packaged function in the Gmail page that returns Gmail's session key (`window.GLOBALS[9]`), which the content script needs to request each ticked thread's print view from mail.google.com. No remote code. The key is not stored or sent anywhere except in those requests to mail.google.com.
- Host access `https://mail.google.com/*`: adds the chosen AIs to Gmail's own right-click menu; after the user picks one, reads the mailbox address and thread IDs (desktop agents; Claude Code also the subjects) or the chosen threads' text (web AIs and copy) to build the prompt; for several ticked emails, requests each one's print view from mail.google.com in the same tab; shows a short confirmation inside Gmail.

**Are you using remote code?** No, I am not using remote code. All JavaScript ships in the package.

**Data usage: what user data do you plan to collect?** Tick these three, matching the Chrome Web Store answers (Microsoft's documentation does not print the checkbox labels, so tick the nearest match if they differ):
- Personally identifiable information: the signed-in Gmail address, and the names and email addresses of senders, and for several emails also recipients, in the chosen threads.
- Personal communications: the subject, dates and message text of the threads the user chooses for a web AI or copy; for desktop agents the thread IDs, and for Claude Code the subjects.
- Website content: the text read from the Gmail page and from Gmail's print view to build the prompt.

Leave the rest unticked. All of it is used only to build the prompt the user asked for. It goes onto the user's own clipboard or to a desktop app on the user's computer, never to the developer's or anyone else's server.

**Certify the disclosures:** tick each statement. They must agree with the privacy policy.

**Privacy policy URL:** https://github.com/thomasoclegg/gmail-to-agent/blob/main/PRIVACY.md

## Store listing: English

**Extension name** (from the manifest, read-only here): Open in AI Agent for Gmail

**Short description** (from the manifest's `description`, read-only here, 122 characters): Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or another AI. Runs on your computer.

**Description** (at least 250 and at most 10,000 characters; this one is about 3,500):

Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or one of five other AIs, all listed on the website and in the screenshots. Tick several emails first to have them sorted into tasks.

I built this for my own inbox. Web AIs open in a new tab next to your inbox with the whole thread copied: press Ctrl+V (Cmd+V on a Mac), read it, then press Enter. The two desktop agents open a session on your computer and read the thread through their own connection to your mailbox.

Set up in two steps
1. Add the extension.
2. Tick the AIs you use on the page that opens.
Then right-click any email. Tabs that are already open need no reload.

What happens when you click
• Inbox: your picks appear at the top of the inbox's own right-click menu.
• Inside an open thread: right-click and use Edge's menu (under the extension's name when you pick more than one).
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

You need
• Microsoft Edge 116 or later on a computer. It works with Gmail in the browser, not in the Gmail app.
• For a web AI: its website, signed in if it asks.
• For a desktop agent: the Claude desktop app or the ChatGPT desktop app, with Gmail connected for the same mailbox.

Free and open source (MIT). The website links to the source on GitHub.

If it saves you time, please give something to Friends of Larnaca Cats, a volunteer group that neuters, feeds and treats street cats in Larnaca, Cyprus. The donation link is on the settings page; the money goes straight to them. Microsoft is not the fundraiser or sponsor of this donation.

Not affiliated with or endorsed by Google or any AI provider named here. All trademarks belong to their owners.

**Extension logo** (1:1, 300×300 recommended, 128×128 minimum): `icons/icon128.png` meets the minimum. For the recommended size, render `store/icon.svg` at 300×300 before uploading.
**Small promotional tile** (440×280, optional): `store/promo.png`
**Large promotional tile** (1400×560, optional): none yet.
**Screenshots** (up to 6, each 640×480 or 1280×800): `store/shot1.png` (the right-click menu and the note), `store/shot2.png` (what a web AI receives), `store/shot3.png` (the real settings page). All three are 1280×800.
**YouTube video URL** (optional): leave empty until there is a walkthrough. Microsoft asks for ads to be turned off on the video.

**Search terms** (optional and not shown to users; at most 7 terms of up to 30 characters each, and 21 words in all). These 7 terms use 20 words:

```
Gmail to ChatGPT
Gmail to Claude
Claude Code Gmail
email summary AI
AI email assistant
Gmail AI reply
Codex Gmail
```

## Before submitting

- Try it in Edge itself first. The test suites run in Chrome, and as of 5 Nov 2026 the package has not been loaded in Edge: unzip it, load it in `edge://extensions` with Developer mode and Load unpacked, then follow the certification notes below against a real Gmail inbox.
- No other browser names (Edge policy 1.1.2: an extension "must not reference other browsers"). Check the description, the certification notes, the screenshots and the extension's own text. As of 5 Nov 2026 the listing text and the three screenshots are clean, but two places outside this file are not:
  - `PRIVACY.md`, which Edge policy 1.5.2 says should refer mainly to Edge, names Chrome's sync storage, Chrome's right-click menu and "Chrome shows no new warning". Make it browser-neutral before you submit.
  - The desktop prompt in `content.js` asks the agent to "use the link in Chrome" (one thread) and "use the links in Chrome" (several). Reviewers see it only if they open Claude Code or Codex, but "your browser" would be safer.
- The donation paragraph ends with "Microsoft is not the fundraiser or sponsor of this donation" (Edge policy 1.8.1 asks for that wherever an extension helps people give to a charity). Keep it if you edit the paragraph.
- Recount keywords after any edit to the description, as for the Chrome Web Store: at most five AI names listed, and each name fewer than five times.

## Notes for certification

No account or login for the extension. Install it; on the settings page that opens, Claude and ChatGPT are already picked. Open Gmail (https://mail.google.com) with any Google account, right-click an email in the inbox and choose "Ask ChatGPT". A ChatGPT tab opens next to Gmail and the thread is on the clipboard, ready to paste with Ctrl+V. For several emails, tick two or more in the inbox, right-click one of them and choose "Ask ChatGPT about 2 emails" (the number follows how many are ticked). No remote code; nothing is sent to the developer.

## After you press Publish

Certification can take up to seven business days. When the status reads In the Store, copy the listing address from the Extension overview page into `STORES.edge` in `docs/index.html`, and update the Edge row and the opening sentence of the README's Install section.

## Field limits and rules (checked 5 Nov 2026)

- Description 250 to 10,000 characters; logo 1:1, 300×300 recommended, 128×128 minimum; small tile 440×280; large tile 1400×560; up to 6 screenshots at 640×480 or 1280×800; search terms at most 7, each up to 30 characters, 21 words in all; name and short description come from the manifest; certification up to seven business days ([Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension), updated 2 Sep 2026).
- No registration fee; a personal Microsoft account, not a work or school account; publisher display name at most 50 characters ([Register as a Microsoft Edge extension developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)).
- Policies ([Developer policies for the Microsoft Edge Add-ons website](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies), dated 24 Jul 2026): 1.1.2, an extension "must not reference other browsers"; 1.2.3, a dependency on other software (here the Claude and ChatGPT desktop apps) must be disclosed in the description; 1.5.2, the privacy policy "should primarily refer to the Microsoft Edge browser"; 1.8.1, an extension that helps collect charitable contributions must "state clearly and prominently that Microsoft is not the fundraiser or sponsor".
