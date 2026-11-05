# Firefox Add-ons (AMO) listing: Open in AI Agent for Gmail

Paste-ready answers for the Add-on Developer Hub. Firefox has its own package: upload `dist/open-in-ai-agent-firefox-v1.3.0.zip`, built by `node scripts/package.mjs --target firefox`. Its manifest is written by the build from `manifest.json`: a background page in place of the service worker, no `offscreen` permission, add-on ID `open-in-ai-agent@thomasoclegg.github.io`, Firefox 140 or later, and the data collection statement below. Try the zip first as a temporary add-on: `about:debugging`, This Firefox, Load Temporary Add-on.

When the listing is live, paste its address into `STORES.firefox` at the top of the script in `docs/index.html`. That switches the website's Firefox Add-ons buttons on. The README needs its own edit by hand: the opening sentence of its Install section, the Firefox row of the table there and the Firefox paragraph under the steps.

Until then the website's Firefox button downloads `open-in-ai-agent-firefox.zip` from the latest GitHub release, so publish the v1.3.0 release, which attaches it, before the website changes reach `main`.

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

**Summary** (at most 250 characters and no web addresses; this is 237):

Right-click a Gmail thread to open it in Claude, ChatGPT, Gemini, Claude Code, Codex or another AI. Tick several emails and the AI sorts them into tasks and drafts the replies. Runs on your computer, and nothing is sent to the developer.

**Description** (at most 15,000 characters; basic Markdown works):

Right-click a Gmail thread to open it in Claude, ChatGPT, Codex or one of seven other AIs. Tick several emails first and the AI sorts them into tasks.

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
- Click the toolbar icon to change your AIs or the working folder.

**Several emails at once**

- Tick two or more emails in the inbox, right-click one of them and pick, for example, "Ask ChatGPT about 3 emails". Up to 25 at a time.
- Web AIs and Copy get each thread's full text, read in the background from Gmail's print view. Nothing is opened or clicked, so unread emails stay unread.
- The prompt asks the AI to group the threads into tasks, put related ones together, and give each task its status, what is asked, any deadline, the next step and a draft reply, most urgent first.
- Claude Code and Codex get a list of thread IDs and links, and read the emails through their own Gmail connection. They are asked to send, post, book, pay or change nothing without your approval.

**What it does with your email**

- Runs on your computer. No server and no analytics. Nothing is sent to me.
- It reads emails only after you pick an AI for them, and only those threads.
- Web AIs get the email only through your clipboard. You see it and press Enter yourself.
- Claude Code and Codex get the mailbox address, thread IDs and Gmail links through a link to their desktop app; Claude Code also gets the subject, to name the session. That hand-over, and the copy to your clipboard, is why Firefox lists "personal communications" when you install it.
- The prompt asks the AI to treat the email as information, not instructions, and to draft replies for you to review.
- Two side effects: picking a web AI or Copy thread for any AI for a single inbox row opens the thread, so Gmail marks it read, and the copied text replaces whatever was on your clipboard.

**You need**

- Firefox 140 or later on a computer, with Gmail in the browser (not the Gmail app).
- For a web AI: that AI's website, signed in if it asks.
- For Claude Code or Codex: the Claude desktop app or the ChatGPT desktop app, with Gmail connected for the same mailbox.

Free and open source (MIT). The homepage links to the source on GitHub.

If it saves you time, please give something to Friends of Larnaca Cats, a volunteer group that neuters, feeds and treats street cats in Larnaca, Cyprus. The donation link is on the settings page; the money goes straight to them.

Not affiliated with or endorsed by Google, Anthropic, OpenAI, Microsoft, Perplexity, xAI, Mistral AI, DeepSeek or Mozilla. Gmail, Gemini, Claude, ChatGPT, Codex, Copilot, Perplexity, Grok, Le Chat and DeepSeek are trademarks of their owners.

**Categories** (pick up to two; one fits): Social & Communication.

**Tags** (up to 10, chosen from Mozilla's fixed list): `google`, `chat`. The list has no email or AI tag (the full list, from `https://addons.mozilla.org/api/v5/addons/tags/` on 5 Nov 2026, runs from "ad blocker" to "zoom"), so leave the rest empty rather than pick unrelated ones.

**Support email** (optional, public): leave empty, or use an address you are happy to publish.
**Support site:** https://github.com/thomasoclegg/gmail-to-agent/issues
**Homepage:** https://thomasoclegg.github.io/gmail-to-agent/
**Licence:** The MIT License.
**Privacy policy:** AMO takes the text, not a link. Paste the contents of `PRIVACY.md` once it describes the Firefox build too (as of 5 Nov 2026 it names Chrome's sync storage and the offscreen document, which the Firefox build does not use).
**This add-on is experimental:** No. **Requires payment:** No.

## Images

**Icon:** AMO takes the icon from the package (`icons/icon128.png`); upload the same file if it asks.
**Screenshots** (1280×800 recommended, or another 1.6:1 size; one set, captions can be localised):
1. `store/shot1.png`: "Your AIs at the top of Gmail's right-click menu, and the note that names the keys to paste with."
2. `store/shot2.png`: "What a web AI receives: a short prompt and the thread between markers."
3. `store/shot3.png`: "The settings page: tick the AIs you use."

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

Why not `"none"`: Mozilla counts data "handled outside of the add-on or the local browser" as transmission. The extension hands the threads you pick to the desktop app you pick (`claude://` or `codex://`) and to the system clipboard, so it declares personal communications (emails), although nothing goes to the developer. The listing text above says the same. If a reviewer asks for more, the nearest further categories are `personallyIdentifyingInfo` (the mailbox address and senders' addresses) and `websiteContent` (text read from the Gmail page), which the Chrome Web Store form already ticks; adding either means a new package, since the statement lives in the manifest.

## Notes to reviewer

No account or login for the extension. Install it; on the settings page that opens, Claude and ChatGPT are already picked. Open Gmail (https://mail.google.com) with any Google account, right-click an email in the inbox and choose "Ask ChatGPT". A ChatGPT tab opens next to Gmail and the thread is on the clipboard, ready to paste. For several emails, tick two or more in the inbox, right-click one of them and choose "Ask ChatGPT about 2 emails". No remote code: every script ships in the package and none is minified. `scripting` is used on mail.google.com only, to add the packaged content scripts to Gmail tabs that were open before install and to read Gmail's own session key (`GLOBALS[9]`) from the page for the print-view requests to mail.google.com; the key is not stored. Source and build script: https://github.com/thomasoclegg/gmail-to-agent

## After it is approved

Copy the listing address into `STORES.firefox` in `docs/index.html`, and update the README's Install section as above. Firefox then installs it for good, instead of as a temporary add-on.

## Optional: a signed zip while the listing is in review

Firefox keeps an unsigned add-on only until it restarts; a signed one stays. Mozilla also signs add-ons that are not listed on its site: upload the same zip with "On your own" as the distribution choice (or run `web-ext sign --channel=unlisted` with your AMO API key), and attach the signed `.xpi` it returns to the GitHub release. Firefox users can then install it for good straight away. Two catches: AMO accepts each version number only once for an add-on, across both choices, so signing 1.3.0 this way means the listed submission has to be 1.3.1 or later; and whether Firefox then moves those users to the listed version on its own is not checked. Not done yet: it needs your AMO account.

## Field limits and rules (checked 5 Nov 2026)

- Name at most 50 characters, summary at most 250 with no web addresses, description at most 15,000, homepage and support site at most 255, support email at most 100, privacy policy as text: field definitions in [addons-server `src/olympia/addons/models.py`](https://github.com/mozilla/addons-server/blob/master/src/olympia/addons/models.py).
- Tags: at most 10 (`MAX_TAGS` in [addons-server `constants/base.py`](https://github.com/mozilla/addons-server/blob/master/src/olympia/constants/base.py)) from the fixed list at https://addons.mozilla.org/api/v5/addons/tags/. Categories: Mozilla's guide says up to two ([Creating an appealing add-on listing](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)); the form's code allows three. The extension categories are listed in [addons-server `constants/categories.py`](https://github.com/mozilla/addons-server/blob/master/src/olympia/constants/categories.py).
- Screenshots 1280×800 recommended, 1.6:1 otherwise; a privacy policy is required when the add-on handles personal data (same guide).
- Data collection: required in the manifest for every new extension since 3 Nov 2025; shown at install from Firefox 140 for desktop; categories include `personalCommunications`, `personallyIdentifyingInfo`, `websiteContent` and `none` ([Firefox built-in consent for data collection and transmission](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)). Transmission means data "handled outside of the add-on or the local browser" ([Add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/), section 6).
