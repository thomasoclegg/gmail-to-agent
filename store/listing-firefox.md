# Firefox Add-ons (AMO) listing: Open in AI Agent for Gmail

Paste-ready answers for the Add-on Developer Hub. Firefox has its own package: upload `dist/open-in-ai-agent-firefox-v1.5.0.zip`, built by `node scripts/package.mjs --target firefox`. Its manifest is written by the build from `manifest.json`: a background page in place of the service worker, no `offscreen` permission, add-on ID `open-in-ai-agent@thomasoclegg.github.io`, Firefox 140 or later, and the data collection statement below. Try the zip first as a temporary add-on: `about:debugging`, This Firefox, Load Temporary Add-on.

When the listing is live, paste its address into `STORES.firefox` at the top of the script in `docs/index.html`. That switches the website's Firefox Add-ons buttons on. The README needs its own edit by hand: the opening sentence of its Install section, the Firefox row of the table there and the Firefox paragraph under the steps.

Until then the website's Firefox button downloads `open-in-ai-agent-firefox.zip` from the latest GitHub release, so publish the v1.4.0 release, which attaches it, before the website changes reach `main`.

## Before you start: the developer account

- Sign in to the [Add-on Developer Hub](https://addons.mozilla.org/developers/) with a personal Mozilla account and accept the developer agreement. Listing is free.
- Your account's display name appears on the listing as the author: Thomas Clegg.
- The add-on ID above is fixed for good once the first version is uploaded, so upload only the package the build writes.

## Upload

**How to distribute:** On this site (listed on addons.mozilla.org).
**Compatibility:** Firefox only. Leave Firefox for Android unticked: it needs Gmail in a desktop browser.
**Do you need to submit source code?** No. Every file in the package is the source as written: nothing is minified, bundled or transpiled.

## Describe the add-on

**Name** (at most 50 characters; this is 26): Open in AI Agent for Gmail

**Add-on URL:** `open-in-ai-agent-for-gmail`, giving https://addons.mozilla.org/firefox/addon/open-in-ai-agent-for-gmail/ if it is free.

**Summary** (at most 250 characters and no web addresses; this is 239):

Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or another AI. Tick several emails and the AI sorts them into tasks and resolves what it can. Runs on your computer, and nothing is sent to the developer.

**Description** (at most 15,000 characters; basic Markdown works):

Right-click a Gmail thread to open it in Claude, ChatGPT, Codex or one of seven other AIs. Tick several emails first and the AI sorts them into tasks, or press Triage unread in Gmail's toolbar to have the unread ones sorted. In Outlook, Yahoo Mail or any other page, select text and right-click it to send just that.

I built this for my own inbox. Web AIs (Claude, ChatGPT, Gemini, Microsoft Copilot, Perplexity, Grok, Le Chat and DeepSeek) open in a new tab next to Gmail with the whole thread copied: press Cmd+V on a Mac or Ctrl+V elsewhere, read it, then press Enter. Claude Code and Codex open a session on your computer and read the thread through their own Gmail connection.

**Set up in two steps**

1. Add the extension.
2. Tick the AIs you use on the page that opens.

Then right-click any email in Gmail. Tabs that are already open need no reload.

**What happens when you click**

- Inbox: your AIs appear at the top of Gmail's right-click menu.
- Inside an open thread: right-click and use Firefox's menu (under "Open in AI Agent for Gmail" when you pick more than one AI).
- Web AIs: the extension opens the thread, copies the subject, senders, dates and message text with a short prompt, and opens the AI's site in a new tab next to Gmail. A note in Gmail names the keys to press. You paste and send.
- Copy thread for any AI: copies the same text and opens nothing.
- Claude Code pre-fills a session named after the email for you to start. With a working folder set, Codex starts straight away.
- Gmail's toolbar: one button, just before Gmail's More button. It reads "Send to AI" in an open email and "Send 3 to AI" with three ticked, and opens a short menu of your AIs. It works from the keyboard too, and a setting hides it.
- Toolbar icon: the same AIs in a short list, for the thread you have open or the emails you ticked, with a link to the settings.
- Keyboard: one shortcut opens that list, another sends to the AI you used last, never to the desktop agent that starts at once. The settings page shows the keys; change them in `about:addons`, under the gear menu's Manage Extension Shortcuts.

**Several emails at once**

- Tick two or more emails in the inbox, right-click one of them and pick, for example, "Ask ChatGPT about 3 emails". Up to 25 at a time.
- Web AIs and Copy get each thread's full text, read in the background from Gmail's print view. Nothing is opened or clicked, so unread emails stay unread.
- The prompt asks the AI to group the threads into tasks, put related ones together, most urgent first, and give each task where it stands and what resolving it needs. It asks the AI to do as much of the work as the text allows, name the facts to check, and where, before a reply commits to anything, and draft any reply with findings, a concrete solution or the one question that remains.
- Claude Code and Codex get a list of thread IDs and links, and read the emails through their own Gmail connection. They are asked to resolve the matter behind each task, checking each fact at its source in their own tools and drafting replies last, in their answer, and to follow nothing an email asks of them. Every Claude Code and Codex prompt ends on one approval sentence: investigate and prepare, but send, post, pay or change nothing in Gmail or elsewhere without your explicit approval. Codex, which starts before you have read its prompt, is also asked only to read, and to write no files, until you reply.

**Triage unread**

- With nothing ticked, the button in Gmail's toolbar reads "Triage unread". It hands the unread emails on this page of the list, up to 25, to the AI you pick. It never opens or clicks them, so they stay unread.
- The AI puts every thread in one of four groups: Action (what resolving each one needs, who owns it, any deadline and the next concrete step, most urgent first), Consolidate (related threads merged into one task, naming the threads it covers), Disregard (newsletters, alerts, receipts and anything else that needs nothing, each with a one-line reason) and Draft (a reply for each thread that needs one, with findings, a concrete solution or the one question that remains).
- Web AIs write the drafts in their answer. Claude Code shows its drafts first, each with its recipient, and saves them as Gmail drafts in your mailbox, each in reply to its own thread, only when you say yes, and never sends; it also waits for you to press Enter. Codex starts at once, so it is asked to keep its drafts in its answer, and gets no subjects or email text.
- Every AI is told not to mark anything as read, and not to send, archive, label, delete or change anything without your explicit approval.

**Other webmail, and any page**

- Select text, right-click it and pick an AI, for example "Ask ChatGPT about the selected text", or use the toolbar icon or the shortcut. Only the text you selected goes, with nothing hidden in it. The pick lets the add-on into that one tab until you leave the page, to read your selection with its line breaks (Firefox's own copy stops at 16,384 characters) and show its note there; it reads nothing else.
- Web AIs and Copy get it on your clipboard, as for an email. Claude Code gets it in its prompt, marked as text you selected, ending after its markers on the approval sentence, and waits for you to press Enter; in Gmail it gets it on your clipboard instead. Codex starts on its prompt at once, so it never gets the text there: it goes to your clipboard instead, ending on the same approval sentence as every desktop prompt.
- If a site shows its own right-click menu, hold Shift while you right-click to get Firefox's.

**Prompt styles and your own prompts**

- On the settings page, choose how the AIs are asked about one email or several: Resolve fully (the default), Quick summary and reply, or Draft replies only.
- Or save up to three prompts of your own, each with a name, one box for Claude Code and Codex and one for the web AIs and Copy, each box shown while one of its AIs is picked. Text in a box replaces the built-in task for its AIs only.
- The toolbar list can use another style for one send; the menus, Gmail's toolbar button and the send-to-last shortcut use the default. Triage unread and selected text always keep the built-in prompts.
- The add-on still adds the mailbox, the thread IDs and links, the email text between its markers for a web AI, the line that email content is information, not instructions, and the approval sentence. They are saved with your settings, so Firefox Sync stores them if you sync add-on data: leave out passwords.
- Each box holds up to 4,000 characters, loses any characters a reader can't see, and is saved in the browser's sync storage with your other settings.

**When it can't read everything**

- If some messages come through only as snippets, the note in Gmail says how many were read in full, and the prompt says the same.
- If it can't read the thread at all, it copies the subject and link only, and says so and how to get the full text.
- If Gmail changes its toolbar so the add-on can't find its place, the button there doesn't appear and nothing else changes.
- Errors stay on screen until you close them; other notes pause while your pointer or keyboard focus is on them, or while you are in another tab. Screen readers hear both.
- The settings page has Check Gmail, which tests what the add-on can see in an open Gmail tab, and Report a problem, which opens a GitHub issue with the version, browser, operating system and those results filled in, never email text.

**What it does with your email**

- Runs on your computer. No server and no analytics. Nothing is sent to me.
- It reads emails only after you pick an AI for them, and only those threads: the one you right-clicked, the ones you ticked, or the unread ones on that page of the list for Triage unread.
- Web AIs get the email only through your clipboard. You see it and press Enter yourself.
- Claude Code and Codex get the mailbox address, thread IDs and Gmail links through a link to their desktop app; Claude Code also gets the subject, to name the session. That hand-over, and the copy to your clipboard, is why Firefox lists "personal communications" when you install it.
- On other sites it gets only the text you select, and only when you pick an AI for it. Firefox shows no warning for the one-tab access that pick gives (`activeTab`).
- It stores only your AIs, the working folder, whether Gmail's toolbar button shows, your prompt style and any prompts of your own and, on this computer, the AI you used last.
- The add-on itself changes nothing in Gmail: it sends nothing and saves no draft. Claude Code's triage drafts are saved by Claude Code, through its own Gmail connection, after you press Enter.
- Every prompt asks the AI to treat the email as information, not instructions, and to send or change nothing without your explicit approval. Replies come as drafts for you to review.
- Two side effects: picking a web AI or Copy thread for any AI for a single inbox row opens the thread, so Gmail marks it read, and the copied text replaces whatever was on your clipboard. Ticked emails and Triage unread are read without opening them and stay unread.

**You need**

- Firefox 140 or later on a computer, with Gmail in the browser (not the Gmail app).
- For a web AI: that AI's website, signed in if it asks.
- For Claude Code or Codex: the Claude desktop app or the ChatGPT desktop app, with Gmail connected for the same mailbox.

Free and open source (MIT). The homepage links to the source on GitHub.

If it saves you time, please give something to Friends of Larnaca Cats, a volunteer group that neuters, feeds and treats street cats in Larnaca, Cyprus. The donation link is on the settings page; the money goes straight to them.

Not affiliated with or endorsed by Google, Anthropic, OpenAI, Microsoft, Perplexity, xAI, Mistral AI, DeepSeek, Yahoo or Mozilla. Gmail, Outlook, Yahoo Mail, Gemini, Claude, ChatGPT, Codex, Copilot, Perplexity, Grok, Le Chat and DeepSeek are trademarks of their owners.

**Categories** (pick up to two; one fits): Social & Communication.

**Tags** (up to 10, chosen from Mozilla's fixed list): `google`, `chat`. The list has no email or AI tag (the full list, from `https://addons.mozilla.org/api/v5/addons/tags/` on 5 Nov 2026, runs from "ad blocker" to "zoom"), so leave the rest empty rather than pick unrelated ones.

**Support email** (optional, public): leave empty, or use an address you are happy to publish.
**Support site:** https://github.com/thomasoclegg/gmail-to-agent/issues
**Homepage:** https://thomasoclegg.github.io/gmail-to-agent/
**Licence:** The MIT License.
**Privacy policy:** AMO takes the text, not a link. Paste the contents of `PRIVACY.md`. From 1.4.0 it says "the browser" throughout and notes where the Firefox build differs: no offscreen document, desktop app links opened from the page, and Firefox's own install statement.
**This add-on is experimental:** No. **Requires payment:** No.

## Images

**Icon:** AMO takes the icon from the package (`icons/icon128.png`); upload the same file if it asks.
**Screenshots** (1280×800 recommended, or another 1.6:1 size; one set, captions can be localised):
1. `store/shot1.png`: "Your AIs at the top of Gmail's right-click menu, and the note that names the keys to paste with."
2. `store/shot2.png`: "What a web AI receives: a short prompt and the thread between markers."
3. `store/shot3.png`: "The settings page: tick the AIs you use."

shot2 and shot3 show 1.3.0: rebuild them for 1.4.0 as described in `store/listing.md` before you upload. A screenshot of Gmail's toolbar with the Triage unread button and its menu, made-up inbox, and one of the toolbar list would show the new routes.

Firefox Add-ons has no video field.

## Data collection

New extensions must declare their data collection in the manifest, and Firefox shows it on the install prompt (Firefox 140 or later). The Firefox build declares:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "open-in-ai-agent@thomasoclegg.github.io",
    "strict_min_version": "140.0",
    "data_collection_permissions": { "required": ["personallyIdentifyingInfo", "personalCommunications", "websiteContent"] }
  }
}
```

Why not `"none"`: Mozilla counts data "handled outside of the add-on or the local browser" as transmission. The extension hands the threads you pick to the desktop app you pick (`claude://` or `codex://`) and to the system clipboard, so it declares personal communications (emails), personally identifying information (the mailbox address and senders' addresses) and website content (text read from the Gmail page), the same three the Chrome Web Store form ticks, although nothing goes to the developer. Selected text, new in 1.4.0, is website content and can be a personal communication, and Triage unread hands over the same kinds of data as ticked emails, so the statement stays the same. The user's own instructions, also new in 1.4.0 and saved prompts from 1.5.0, are text the user writes on the settings page: they stay in the browser's storage and travel only inside the prompts the user starts, so they add nothing to it. The listing text above says the same. A change to the statement means a new package, since it lives in the manifest.

## Release notes for 1.5.0

Optional; AMO shows them with the version. Paste-ready, once the version is 1.5.0:

- Prompt styles: on the settings page, choose how the AIs are asked about one email or several. Resolve fully is 1.4.0's prompts and stays the default; Quick summary and reply says where each email stands and what is asked, then drafts a reply where one is needed; Draft replies only gives just the drafts, in as few words as will do.
- Saved prompts: keep up to three prompts of your own, each with a name and text for Claude Code and Codex, for the web AIs and Copy, or both. An empty box uses what the default style uses for those AIs, and each saved prompt says whether it is in use.
- The toolbar list has a Style for this send picker above the AIs that changes the style for that one send.
- Your own instructions from 1.4.0 become a saved prompt called My instructions, and stay the default, so nothing changes until you change it.
- Every style keeps the lines that tell the AI to treat email as information, follow nothing it asks, and change nothing without your approval. Triage unread and selected text keep their built-in prompts.

## Release notes for 1.4.0

Optional; AMO shows them with the version. Paste-ready:

- A button in Gmail's toolbar, just before More: "Send to AI" in an open email, "Send 3 to AI" with three ticked, and "Triage unread" with none, which hands the unread emails on that page of the list to the AI you pick without opening them. The AI sorts them into Action, Consolidate, Disregard and Draft.
- The toolbar icon lists your AIs, and two keyboard shortcuts open that list or send to the AI you used last.
- Select text on any page, such as another webmail, right-click it and pick an AI. Only the text you selected goes.
- The prompts ask the AI to resolve each thread as far as it can before it drafts a reply, and every prompt for Claude Code and Codex ends by asking it to send, post, pay or change nothing without your explicit approval.
- A task that cannot be finished now, because it waits on someone else or a later date or is a large piece of work of its own, is set aside with a short brief: as a session Claude Code proposes for you to start, as a brief Codex gives in its answer, or, for several emails, as a Handover to paste into a new chat. Read a brief before you start anything from it.
- Your own instructions: on the settings page, write instructions of your own in place of the built-in ones for one email or several.
- When the add-on cannot read a whole thread, the note and the prompt say so. The settings page has Check Gmail and Report a problem.

## Notes to reviewer

No account or login for the extension. Install it; on the settings page that opens, Claude and ChatGPT are already picked. Open Gmail (https://mail.google.com) with any Google account, right-click an email in the inbox and choose "Ask ChatGPT". A ChatGPT tab opens next to Gmail and the thread is on the clipboard, ready to paste. For several emails, tick two or more in the inbox, right-click one of them and choose "Ask ChatGPT about 2 emails". With a thread open, the "Send to AI" button in Gmail's toolbar and the add-on's toolbar icon list the same AIs and do the same. In the inbox with nothing ticked, the same button reads "Triage unread" and hands over the unread emails on that page of the list without opening them; they stay unread. The button is added by the same content script on mail.google.com and needs no permission of its own. On any other page, select some text, right-click it and choose "Ask ChatGPT about the selected text". Those items use the text Firefox passes with the click and the `activeTab` grant that comes with it: the add-on has no standing host access beyond mail.google.com, and in that one tab, until the user leaves the page, it reads only the selected text (to keep its line breaks and get past the 16,384 characters of `selectionText`), shows its confirmation note with the packaged `toast.js`, and for Claude Code or Codex clicks the desktop app's link in the page. The toolbar list and the two keyboard shortcuts (`commands`) need no other permission; on a page that is not Gmail they use `activeTab` in the same way. On the settings page, under "Prompts", the default style is Resolve fully, the built-in prompts; choose "Quick summary and reply" or "Draft replies only" to test the lighter ones, or press "Add a saved prompt" and type text that replaces the built-in task for emails. Saved prompts and the default style are kept in `storage.sync` and go only into the prompts; 1.4.0's own instructions move into the first saved prompt on update. In the toolbar list, the "Prompt style" picker above the AIs changes the style for that one pick. Resolve fully also asks the AI to set aside each task that cannot be finished now (one that waits on someone else or a later date, or is a large piece of work of its own) with a short brief: Claude Code by proposing a session for the user to start, never starting one itself; Codex, which starts before the user has read its prompt, by giving the brief in its answer for the user to start after replying; a web AI or Copy, for several emails, with a short Handover to paste into a new chat. No remote code: every script ships in the package and none is minified. `scripting` is used on mail.google.com, to add the packaged content scripts to Gmail tabs that were open before install and to read Gmail's own session key (`GLOBALS[9]`) from the page for the print-view requests to mail.google.com (the key is not stored), and in the `activeTab` tab for the packaged functions above. Source and build script: https://github.com/thomasoclegg/gmail-to-agent

## After it is approved

Copy the listing address into `STORES.firefox` in `docs/index.html`, and update the README's Install section as above. Firefox then installs it for good, instead of as a temporary add-on.

## Optional: a signed zip while the listing is in review

Firefox keeps an unsigned add-on only until it restarts; a signed one stays. Mozilla also signs add-ons that are not listed on its site: upload the same zip with "On your own" as the distribution choice (or run `web-ext sign --channel=unlisted` with your AMO API key), and attach the signed `.xpi` it returns to the GitHub release. Firefox users can then install it for good straight away. Two catches: AMO accepts each version number only once for an add-on, across both choices, so signing 1.4.0 this way means the listed submission has to be 1.4.1 or later; and whether Firefox then moves those users to the listed version on its own is not checked. Not done yet: it needs your AMO account.

## Field limits and rules (checked 5 Nov 2026)

- Name at most 50 characters, summary at most 250 with no web addresses, description at most 15,000, homepage and support site at most 255, support email at most 100, privacy policy as text: field definitions in [addons-server `src/olympia/addons/models.py`](https://github.com/mozilla/addons-server/blob/master/src/olympia/addons/models.py).
- Tags: at most 10 (`MAX_TAGS` in [addons-server `constants/base.py`](https://github.com/mozilla/addons-server/blob/master/src/olympia/constants/base.py)) from the fixed list at https://addons.mozilla.org/api/v5/addons/tags/. Categories: Mozilla's guide says up to two ([Creating an appealing add-on listing](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)); the form's code allows three. The extension categories are listed in [addons-server `constants/categories.py`](https://github.com/mozilla/addons-server/blob/master/src/olympia/constants/categories.py).
- Screenshots 1280×800 recommended, 1.6:1 otherwise; a privacy policy is required when the add-on handles personal data (same guide).
- Data collection: required in the manifest for every new extension since 3 Nov 2025; shown at install from Firefox 140 for desktop; categories include `personalCommunications`, `personallyIdentifyingInfo`, `websiteContent` and `none` ([Firefox built-in consent for data collection and transmission](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)). Transmission means data "handled outside of the add-on or the local browser" ([Add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/), section 6).
