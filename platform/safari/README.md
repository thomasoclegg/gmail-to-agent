# Safari

There is no Safari release yet. Safari runs web extensions only inside a Mac app built with Xcode, and listing that app needs Apple's paid Developer Program. The build already writes a folder that Apple's converter can turn into that app.

## Build the folder

```
node scripts/package.mjs --target safari
```

This writes `dist/safari-src/`: the same files as the Firefox package, with three changes to the Chrome manifest.

- `background.js` runs as a non-persistent background page with `targets.js` listed before it, because Safari has no offscreen documents and a service worker cannot reach the clipboard.
- No `offscreen` permission.
- No `minimum_chrome_version`.

The script never deletes files. If `dist/safari-src/` holds a file from an earlier build that this build would not write, it stops and names the file. Move the folder aside and build again.

## Convert it (needs Xcode)

Install Xcode from the Mac App Store, open it once to accept its licence, then run:

```
xcrun safari-web-extension-converter dist/safari-src --app-name "Open in AI Agent" --bundle-identifier <a reverse-DNS id you own> --macos-only --copy-resources
```

- `--macos-only`: the items go into desktop Gmail's menus; Gmail on an iPhone or iPad is a different site.
- `--copy-resources`: the Xcode project gets its own copy of the files, so a later build does not change it.

In Xcode, choose your team under Signing & Capabilities, then build and run. In Safari, allow unsigned extensions in the developer settings (Safari turns this off again when it quits), tick the extension under Settings > Extensions, and give it access to mail.google.com.

## Check in Safari before any release

None of these has been tested in Safari.

- Copying. `background.js` copies with `navigator.clipboard.writeText` and falls back to a textarea and `execCommand('copy')`. Firefox allows both from a background page with `clipboardWrite`. If Safari wants a click in the page first, the copy has to move into `content.js`.
- Gmail's session key for several emails at once. `background.js` reads it with `scripting.executeScript` in the page's main world, which MDN's compatibility data lists for Safari from 15.4.
- Gmail tabs open at install. Safari has no `runtime.getBrowserInfo`, so `background.js` adds the content script to them as it does in Chrome; `content.js` ignores a second copy.
- Settings. `storage.sync` may stay on one Mac.
- The `claude://` and `codex://` links to the desktop apps.
- Any warnings the converter prints about the manifest.
