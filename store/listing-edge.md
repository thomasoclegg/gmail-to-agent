# Microsoft Edge Add-ons listing: Open in AI Agent for Gmail

Paste-ready answers for Partner Center. Edge takes the Chrome package unchanged: upload `dist/open-in-ai-agent-v1.5.0.zip`, built by `node scripts/package.mjs` (manifest at the zip root, version 1.5.0). Load the unzipped copy in `edge://extensions` with Developer mode and Load unpacked before you upload it.

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

**Single purpose description:** Hands email to the AI you pick: the Gmail threads you right-click, tick, have open or ask it to triage, their links, or text you select on a page, such as an email in another webmail.

**Permission justification** (Partner Center lists the permissions from the manifest; paste one answer into each box):
- `contextMenus`: adds the AIs the user picked (for example "Ask ChatGPT about this thread", "Open thread in Claude Code", "Copy thread for any AI") to the browser's right-click menu inside an open Gmail thread: one item when one AI is picked, grouped under the extension's name when there are more. From 1.4.0 it also adds, on any page, items such as "Ask ChatGPT about the selected text" that show only while text is selected. They use the `selectionText` the browser passes with the click and the `activeTab` grant that comes with it (below), so the extension needs no host access to those sites.
- `storage`: saves the user's settings (which AIs appear in the menus, Gmail's toolbar button and the toolbar list, whether that button shows, the working folder for desktop sessions, from 1.4.0 the user's own instructions for the prompts, if any, which from 1.5.0 are the user's saved prompts, up to three, each its own item, and the default prompt style) and, in local storage, which AI the user picked last, for the "send to the AI you used last" keyboard shortcut.
- `offscreen`: copies the prepared prompt to the clipboard when the user picks a web AI or "Copy" from either right-click menu. The background service worker has no page to copy from, so it uses one offscreen document created with reason CLIPBOARD, which only writes the prompt to the clipboard.
- `clipboardWrite`: puts the prepared prompt on the clipboard so the user can paste it into the AI they chose.
- `scripting`: used on mail.google.com, and from 1.4.0 in the one tab where the user picked a selected-text item (through `activeTab`). On install and update, it injects the extension's own packaged scripts (`targets.js`, `toast.js` and `content.js`, the same files as the content script) into Gmail tabs that are already open, so the user does not have to reload Gmail. After a selected-text pick, it runs packaged code in that tab: one function that returns the selected text, the extension's own `toast.js` and one function that shows its confirmation note. When the user ticks several emails and picks a web AI or "Copy", it runs one packaged function in the Gmail page that returns Gmail's session key (`window.GLOBALS[9]`), which the content script needs to request each ticked thread's print view from mail.google.com. No remote code. The key is not stored or sent anywhere except in those requests to mail.google.com.
- `activeTab`: when the user picks a selected-text item on a page, or uses the toolbar list or the second keyboard shortcut on a page that is not Gmail, reads the text the user selected in that tab (keeping its line breaks) and shows the extension's confirmation note in that page. Nothing else on the page is read, and the access ends when the user leaves the page. It shows no install warning.
- Host access `https://mail.google.com/*`: adds the chosen AIs to Gmail's own right-click menu; after the user picks one, reads the mailbox address and thread IDs (desktop agents; Claude Code also the subjects) or the chosen threads' text (web AIs and copy) to build the prompt; for several ticked emails, requests each one's print view from mail.google.com in the same tab; shows a short confirmation inside Gmail; adds one button to Gmail's toolbar that offers the same AIs for the open thread, the ticked emails or, with nothing ticked, the unread emails on that page of the list, which it reads from the list and their print view without opening them; answers the settings page's Gmail self-check with counts and yes-or-no results, never email text. The toolbar list and the keyboard shortcuts act through the same content script.

**Are you using remote code?** No, I am not using remote code. All JavaScript ships in the package.

**Data usage: what user data do you plan to collect?** Tick these three, matching the Chrome Web Store answers (Microsoft's documentation does not print the checkbox labels, so tick the nearest match if they differ):
- Personally identifiable information: the signed-in Gmail address, and the names and email addresses of senders, and for several emails also recipients, in the chosen threads.
- Personal communications: the subject, dates and message text of the threads the user chooses for a web AI or copy, including the unread threads the user asks it to triage; for desktop agents the thread IDs, and for Claude Code the subjects; and any text the user selects on a page and sends to an AI, which may be an email in another webmail.
- Website content: the text read from the Gmail page and from Gmail's print view, and text the user selects on any page, to build the prompt.

Leave the rest unticked. All of it is used only to build the prompt the user asked for. It goes onto the user's own clipboard or to a desktop app on the user's computer, never to the developer's or anyone else's server. The user's own instructions for the prompts, new in 1.4.0 and saved prompts from 1.5.0, are text the user writes on the settings page: they are kept in the browser's sync storage with the other settings (so Edge's sync stores them if the user syncs extension data) and go only into the prompts the user starts. A saved prompt's name is a label and goes nowhere.

**Certify the disclosures:** tick each statement. They must agree with the privacy policy.

**Privacy policy URL:** https://github.com/thomasoclegg/gmail-to-agent/blob/main/PRIVACY.md

## Store listing: English

**Extension name** (from the manifest, read-only here): Open in AI Agent for Gmail

**Short description** (from the manifest's `description`, read-only here, 122 characters): Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or another AI. Runs on your computer.

**Description** (at least 250 and at most 10,000 characters; this one is about 7,100):

Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or one of five other AIs, all listed on the website and in the screenshots. Tick several emails first to have them sorted into tasks, or triage the unread ones from the inbox's own toolbar.

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
• The inbox's own toolbar: one button, just before More. It reads Send to AI in an open email and Send 3 to AI with three ticked, and opens a short menu of your picks.
• Toolbar icon: the same picks in a short list, for the thread you have open, the emails you ticked or, on another site, the text you selected, with a link to the settings. Pin it from the browser's Extensions menu.
• Keyboard: one shortcut opens that list, another sends to the AI you used last, never to the desktop agent that starts at once. The settings page shows the keys and links to edge://extensions/shortcuts to change them.

Several emails at once
• Tick two or more emails in the inbox, right-click one of them and pick, for example, "Ask ChatGPT about 3 emails". Up to 25 at a time.
• Web AIs and Copy get each thread's full text, read in the background from its print view. Nothing is opened or clicked, so unread emails stay unread.
• The prompt asks for the threads to be grouped into tasks, related ones together and the most urgent first, each with where it stands and what resolving it needs. It asks the AI to do as much of the work as the text allows, name the facts to check before a reply commits to anything, and draft any reply with findings or the one question that remains.
• The desktop agents get a list of thread IDs and links, and read the emails themselves. They are asked to resolve the matter behind each task before drafting, to follow nothing an email asks of them, and to send, post, pay or change nothing without your explicit approval.

Triage unread
• With nothing ticked, the button in the inbox's toolbar reads Triage unread. It hands the unread emails on this page of the list, up to 25, to the AI you pick, without opening them, so they stay unread.
• The AI puts every thread in one of four groups: Action (what resolving it needs, who owns it, any deadline and the next step, most urgent first), Consolidate (related threads merged into one task), Disregard (newsletters, alerts and receipts, each with a one-line reason) and Draft (a reply with substance for each thread that needs one).
• Every AI is told not to mark anything as read, and not to send, archive, label, delete or change anything without your explicit approval. The desktop agent you start yourself shows its replies first and saves them as drafts in your mailbox, each in reply to its own thread, only when you say yes; the one that starts straight away keeps its drafts in its answer.

Other webmail, and any page
• Select text, right-click it and pick an AI, or use the toolbar icon or the shortcut. Only the text you selected goes, with nothing hidden in it. The pick lets the extension into that one tab until you leave the page, to read your selection with its line breaks and show its note; it reads nothing else there.
• Web AIs get it on your clipboard, as for an email. The desktop agent that starts straight away never gets it in its prompt.

Prompt styles and your own prompts
• On the settings page, choose how the AIs are asked about one email or several: resolve fully (the default), a quick summary with a draft reply where needed, or draft replies only. Or save up to three prompts of your own, each with a name, a box for the desktop agents and one for the web AIs and Copy. The toolbar list can use another style for one send. Triage unread and selected text keep the built-in prompts.
• The extension still adds the thread details, the line that email content is information, not instructions, and the line asking the AI to change nothing without your approval. Each box holds up to 4,000 characters and is saved with your other settings, so it syncs with your browser: leave out passwords.

When it cannot read everything
• If some messages come through only as snippets, the note says how many were read in full, and the prompt says the same.
• If it cannot read the thread at all, it copies the subject and link only, and says so and how to get the full text.
• The settings page has a self-check for your inbox tab and a Report a problem link that never includes email text.

Privacy
• Runs on your computer. No server and no analytics. Nothing is sent to me.
• It reads emails only after you pick an AI for them, and only those threads.
• Web AIs get the email only through your clipboard. You see it and press Enter yourself.
• Every prompt says to treat the email as information, not instructions, and to send or change nothing without your explicit approval. Replies come as drafts for you to review.
• Desktop agents never get the message text in their prompt; they read the email through their own mail connection.
• Two side effects: picking a web AI or Copy for a single inbox row opens the thread, so it is marked read, and the copied text replaces whatever was on your clipboard.
• It stores only your picks, the working folder, your prompt style and any prompts of your own and, on this computer, the AI you used last.

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

- Try it in Edge itself first. The test suites run in Chrome, and as of 5 Nov 2026 the package has not been loaded in Edge: unzip it, load it in `edge://extensions` with Developer mode and Load unpacked, then follow the certification notes below against a real Gmail inbox. For 1.4.0, also use the button in Gmail's toolbar in an open email, with emails ticked and as Triage unread (the unread emails must stay unread), open the toolbar list, press both shortcuts, run Check Gmail on the settings page and use a selected-text item on another site.
- New in 1.5.0: prompt styles on the settings page, under a new "Prompts" section that replaces "Your own instructions": Resolve fully (1.4.0's prompts, still the default), Quick summary and reply, and Draft replies only, which change only the task or the ask and keep every safety line. Up to three saved prompts of the user's own, each its own sync-storage item with a name of at most 40 characters and optional text for the desktop agents and for the web AIs and Copy (4,000 characters each); text for one group replaces only that group's task, and an empty group uses what the default uses for it. Delete has an Undo. 1.4.0's own instructions move into the first empty saved prompt on update, saved prompt 1, "My instructions", made the default, on a normal upgrade. The toolbar list gains a "Style for this send" picker for one pick; the menus, Gmail's toolbar button and the shortcut use the default. Triage unread and selected text keep their built-in prompts. No permission is added. In Edge, check that the Prompts section and the toolbar list's picker name no other browser.
- New in 1.4.0: the button in Gmail's toolbar (Send to AI, Send N to AI, Triage unread) and the four-group triage prompt, the toolbar list, the two keyboard shortcuts, the selected-text items on any page, a single menu item without the submenu when one AI is picked, the partial-read warnings and subject-and-link fallback, Check Gmail and Report a problem, and notes that stay for errors. Claude Code's session for ticked emails is now named "Batch: N emails". The prompts ask the AI to resolve each thread as far as it can before it drafts, and every Claude Code and Codex prompt ends on one approval sentence in place of 1.3.0's "Only read and draft; ...": the agent may investigate and prepare, but sends, posts, pays or changes nothing without the user's explicit approval (the full prompts are in the README). The built-in prompts set aside each task that cannot be finished now with a short brief: Claude Code proposes a session for the user to start and is asked never to start one itself, Codex gives the brief in its answer for the user to start after replying, and for several emails the web AIs and Copy end it with a Handover to paste into a new chat. A new settings section, Your own instructions, takes optional text that replaces the built-in instructions for emails, never for selected text, up to 4,000 characters for each of its two boxes; the extension still adds the thread details and the safety lines. 1.4.0 adds `activeTab`, which shows no warning; its justification is in the Privacy section above. `commands` and the popup are manifest keys, not permissions, and the Gmail button comes from the content script that already runs on mail.google.com. Check the final `manifest.json` against 1.3.0's.
- No other browser names (Edge policy 1.1.2: an extension "must not reference other browsers"). Check the description, the certification notes, the screenshots and the extension's own text. As of 5 Nov 2026:
  - The listing text above is clean. The three screenshots were clean for 1.3.0; check any new one, such as Gmail's toolbar button or the toolbar list.
  - The desktop prompts in 1.4.0 say "use the link in your browser" where 1.3.0 said "in Chrome".
  - `PRIVACY.md` now says "the browser" throughout. It names Firefox only where it has to: Firefox's own install statement, its lack of an offscreen page, and the desktop app links that only Firefox opens from the page (`activeTab`). Policy 1.5.2 says the policy "should primarily refer to the Microsoft Edge browser"; a neutral policy is as close as one shared file gets. If certification objects, publish a copy for Edge without the Firefox section and link that instead.
  - The settings page's shortcut link, the Report a problem text, the toolbar list, the Gmail toolbar button's menu, the triage prompts, the resolve-first prompts and the Your own instructions section are new in 1.4.0: in Edge, check that the link opens `edge://extensions/shortcuts` and that none of them names another browser.
- The donation paragraph ends with "Microsoft is not the fundraiser or sponsor of this donation" (Edge policy 1.8.1 asks for that wherever an extension helps people give to a charity). Keep it if you edit the paragraph.
- Recount keywords after any edit to the description, as for the Chrome Web Store: at most five AI names listed, and each name fewer than five times. Counted on 5 Nov 2026 for 1.4.0, after the resolve-first prompts and Your own instructions were added: Gmail 4, Claude 4 (2 of them Claude Code), ChatGPT 3, Codex 2, Gemini 1, and no browser but Edge. The new paragraphs name no webmail and no AI, and call Gmail "the inbox", so Gmail stays at four. Recounted on 5 Nov 2026 for 1.5.0, after Your own instructions became "Prompt styles and your own prompts": that paragraph names no AI and no webmail, so the counts stand.

## Notes for certification

No account or login for the extension. Install it; on the settings page that opens, Claude and ChatGPT are already picked. Open Gmail (https://mail.google.com) with any Google account, right-click an email in the inbox and choose "Ask ChatGPT". A ChatGPT tab opens next to Gmail and the thread is on the clipboard, ready to paste with Ctrl+V. For several emails, tick two or more in the inbox, right-click one of them and choose "Ask ChatGPT about 2 emails" (the number follows how many are ticked). With a thread open, the "Send to AI" button in Gmail's toolbar and the extension's toolbar icon list the same AIs and do the same. In the inbox with nothing ticked, the same button reads "Triage unread" and hands over the unread emails on that page of the list without opening them. On any other page, select some text, right-click it and choose "Ask ChatGPT about the selected text". On the settings page, under "Prompts", the default style is Resolve fully, the built-in prompts; choose "Quick summary and reply" or "Draft replies only" to test the lighter ones, or press "Add a saved prompt" and type text that replaces the built-in task for emails. In the toolbar list, the "Prompt style" picker above the AIs changes the style for that one pick. Resolve fully also asks the AI to set aside each task that cannot be finished now (one that waits on someone else or a later date, or is a large piece of work of its own) with a short brief: Claude Code by proposing a session for the user to start, never starting one itself; Codex, which starts before the user has read its prompt, by giving the brief in its answer for the user to start after replying; a web AI or Copy, for several emails, with a short Handover to paste into a new chat. No remote code; nothing is sent to the developer.

## After you press Publish

Certification can take up to seven business days. When the status reads In the Store, copy the listing address from the Extension overview page into `STORES.edge` in `docs/index.html`, and update the Edge row and the opening sentence of the README's Install section.

## Field limits and rules (checked 5 Nov 2026)

- Description 250 to 10,000 characters; logo 1:1, 300×300 recommended, 128×128 minimum; small tile 440×280; large tile 1400×560; up to 6 screenshots at 640×480 or 1280×800; search terms at most 7, each up to 30 characters, 21 words in all; name and short description come from the manifest; certification up to seven business days ([Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension), updated 2 Sep 2026).
- No registration fee; a personal Microsoft account, not a work or school account; publisher display name at most 50 characters ([Register as a Microsoft Edge extension developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)).
- Policies ([Developer policies for the Microsoft Edge Add-ons website](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies), dated 24 Jul 2026): 1.1.2, an extension "must not reference other browsers"; 1.2.3, a dependency on other software (here the Claude and ChatGPT desktop apps) must be disclosed in the description; 1.5.2, the privacy policy "should primarily refer to the Microsoft Edge browser"; 1.8.1, an extension that helps collect charitable contributions must "state clearly and prominently that Microsoft is not the fundraiser or sponsor".
