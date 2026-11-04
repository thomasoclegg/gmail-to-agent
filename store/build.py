# Builds the store images' HTML from the repo, so they stay in step with the website and the settings page:
#   shot1.html  1280 x 800, the Gmail drawing from docs/index.html with notes in the margin
#   promo.html  440 x 280, the top of the same Gmail menu
#   shot3.html  1280 x 800, the real options.html with a stand-in for chrome.storage, always light
# shot2.html is written by hand. Usage: python3 store/build.py
# Then render each page at its size with headless Chrome, for example:
#   chrome --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1280,800 \
#          --screenshot=store/shot1.png file://$PWD/store/shot1.html
# and copy shot1.png to docs/shot-menu.png, shot2.png to docs/shot-prompt.png and shot3.png to docs/shot-onboarding.png.
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
site = open(os.path.join(REPO, 'docs/index.html')).read()

fonts = re.search(r"(  @font-face.*?)\n\n", site, re.S).group(1).replace('url(fonts/', 'url(../docs/fonts/')
gm_css = re.search(r"  /\* gm:start.*?/\* gm:end \*/", site, re.S).group(0)
# Store images are always light.
gm_css = re.sub(r"  @media \(prefers-color-scheme: dark\) \{.*?\n  \}\n", "", gm_css, flags=re.S)
sprite = re.search(r'<svg width="0" height="0".*?</svg>', site, re.S).group(0)
extra = '''  <symbol id="i-snooze" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></symbol>
  <symbol id="i-task" viewBox="0 0 24 24"><path d="M22 5.18 10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zM12 20a8 8 0 1 1 4.28-14.75l1.45-1.45A10 10 0 1 0 16.78 20.78l-1.5-1.5c-1 .46-2.11.72-3.28.72zm7-5h-3v2h3v3h2v-3h3v-2h-3v-3h-2v3z"/></symbol>
  <symbol id="i-move" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4a2 2 0 0 0-1.99 2L2 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm0 12H4V6h5.17l2 2H20v10zm-7.84-6H8v2h4.16l-1.59 1.59L11.99 17 16 13.01 11.99 9l-1.41 1.41L12.16 12z"/></symbol>
  <symbol id="i-label" viewBox="0 0 24 24"><path d="M17.63 5.84A1.99 1.99 0 0 0 16 5L5 5.01A2 2 0 0 0 3 7v10a2 2 0 0 0 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z"/></symbol>
  <symbol id="i-chev" viewBox="0 0 24 24"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></symbol>
</svg>'''
sprite = sprite[:-len('</svg>')] + extra
icon = re.search(r'<svg class="icon" viewBox="0 0 16 16".*?</svg>', site, re.S).group(0).replace('class="icon" ', '')

# The same tokens as the website (light).
TOKENS = '''  :root { --paper: #fafaf8; --ink: #15171a; --ink-2: #555a61; --rule: #dcdfe3; --rubric: #fb3e36;
          --sans: 'Libre Franklin', -apple-system, sans-serif; }'''


def row(frm, subj, snip, when, cls=''):
    return (f'<div class="gm-row {cls}"><span class="gm-box"></span><svg class="star"><use href="#i-star"/></svg>'
            f'<span class="from">{frm}</span><span class="subj">{subj} <span>- {snip}</span></span><span class="when">{when}</span></div>')


def mi(icon_id, text, cls='', sub=False):
    chev = '<svg class="chev"><use href="#i-chev"/></svg>' if sub else ''
    return f'<div class="gm-mi {cls}"><svg><use href="#{icon_id}"/></svg>{text}{chev}</div>'


OURS = [mi('i-mark', 'Open in Claude Code'), mi('i-mark', 'Ask Claude'), mi('i-mark', 'Ask ChatGPT', 'hover'),
        mi('i-mark', 'Copy thread for any AI')]

rows = '\n        '.join([
    row('Marta Ioannou, me <i>2</i>', 'Lease renewal for flat 4B', 'Thanks Marta. Is the 4% fixed for the whole year?', '18:40', 'ctx'),
    row('Andreas K.', 'Boat on Saturday?', 'Forecast says 18 knots, so maybe Sunday instead', '16:05', 'unread'),
    row('Sam Lee', 'Delivery date for order 1042', 'Your sofa is booked for the 14th, between 8 and 12', '11:30', 'unread'),
    row('Book club', 'December pick', "We're down to two. Vote by Friday", '2 Nov'),
    row('Hannah Kim', 'School trip consent form', 'Please sign and return it by Thursday', '2 Nov'),
    row('Dimitris P.', 'Quote for the bathroom', 'Labour is now split into two stages', '1 Nov'),
    row('Nadia Haddad', 'Tickets for the 22nd', "I've got two spares if you still want them", '31 Oct'),
    row('Chris Walker', 'Boiler service booked', 'The engineer can come on Tuesday between 9 and 12', '30 Oct'),
    row('Tom Becker, me <i>3</i>', 'Photos from the weekend', 'The good ones are in the shared album', '30 Oct'),
    row('Elena Rossi', 'Can you look at the floor plan?', "I've marked the two walls we talked about", '29 Oct'),
    row('Ravi Menon', 'Dinner Saturday?', "We're thinking 8pm at the usual place", '28 Oct'),
    row('Library', 'Your loan is due on 6 November', 'Renew online or at the desk', '27 Oct'),
])

menu = '\n        '.join(OURS + [
    '<div class="gm-sep"></div>',
    mi('i-reply', 'Reply'), mi('i-replyall', 'Reply all'), mi('i-forward', 'Forward'), mi('i-attach', 'Forward as attachment'),
    '<div class="gm-sep"></div>',
    mi('i-archive', 'Archive'), mi('i-trash', 'Delete'), mi('i-unread', 'Mark as unread'), mi('i-snooze', 'Snooze'), mi('i-task', 'Add to Tasks'),
    '<div class="gm-sep"></div>',
    mi('i-move', 'Move to', sub=True), mi('i-label', 'Label as', sub=True),
])

shot1 = f'''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1280">
<title>Store image 1: the menu and the note</title>
<!-- 1280 x 800. Built by store/build.py from the Gmail drawing in docs/index.html. The inbox is made up. -->
<style>
{fonts}

{TOKENS}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; }}
  body {{ position: relative; width: 1280px; height: 800px; overflow: hidden; background: var(--paper); color: var(--ink);
         font: 400 16px/1.5 var(--sans); -webkit-font-smoothing: antialiased; }}

  .window {{ position: absolute; left: 0; top: 0; width: 830px; height: 800px; overflow: hidden;
             box-shadow: 1px 0 0 rgba(21, 23, 26, 0.14); }}
  .window .gm {{ height: 800px; border-radius: 0; }}
  .window .gm-main {{ border-radius: 16px 0 0 0; }}
  .window .gm-menu {{ right: 16px; top: 188px; }}
  .window .gm-cursor {{ right: 265px; top: 184px; }}
  .window .vpa-toast {{ left: 24px; bottom: 24px; }}

  .panel {{ position: absolute; left: 830px; top: 0; width: 450px; height: 800px; padding: 48px 40px 44px 46px; }}
  .brand {{ display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px; }}
  .brand svg {{ width: 26px; height: 26px; }}
  h1 {{ margin: 30px 0 0; font: 600 31px/1.1 var(--sans); letter-spacing: -0.025em; }}
  .note {{ position: absolute; left: 46px; right: 40px; margin: 0; font: 400 18px/1.42 var(--sans); }}
  .n1 {{ top: 287px; }}
  .n2 {{ top: 741px; }}
  .n3 {{ top: 422px; color: var(--ink-2); }}
  /* Bracket on the extension's items and leaders into the panel; nothing crosses Gmail's text. */
  .brace {{ position: absolute; left: 818px; top: 196px; width: 6px; height: 128px; border: 1px solid var(--rubric); border-left: 0; }}
  .lead {{ position: absolute; height: 1px; background: var(--rubric); }}
  .lead1 {{ left: 824px; width: 36px; top: 300px; }}
  .lead2 {{ left: 478px; width: 382px; top: 754px; }}
  .brace.quiet {{ top: 349px; height: 113px; border-color: var(--ink-2); }}
  .lead.quiet {{ top: 435px; background: var(--ink-2); }}
  .lead2::before {{ content: ""; position: absolute; left: -3px; top: -3px; width: 7px; height: 7px; border-radius: 50%; background: var(--rubric); }}

{gm_css}
</style>
</head>
<body>
{sprite}

<div class="window">
  <div class="gm" role="img" aria-label="Gmail's inbox with one row right-clicked. The extension's four items, each with a small envelope mark, sit at the top of Gmail's menu. The extension's note is at the bottom left.">
    <div aria-hidden="true">
      <div class="gm-top">
        <svg class="gm-burger"><use href="#i-burger"/></svg>
        <div class="gm-search"><svg><use href="#i-search"/></svg>Search mail</div>
      </div>
      <div class="gm-nav">
        <div class="gm-compose"><svg><use href="#i-pencil"/></svg>Compose</div>
        <div class="gm-ni on"><svg><use href="#i-inbox"/></svg>Inbox<b>2</b></div>
        <div class="gm-ni"><svg><use href="#i-star"/></svg>Starred</div>
        <div class="gm-ni"><svg><use href="#i-clock"/></svg>Snoozed</div>
        <div class="gm-ni"><svg><use href="#i-send"/></svg>Sent</div>
        <div class="gm-ni"><svg><use href="#i-file"/></svg>Drafts</div>
      </div>
      <div class="gm-main">
        <div class="gm-tools"><span class="gm-box"></span><svg><use href="#i-refresh"/></svg><svg><use href="#i-more"/></svg><span class="count">1–12 of 12</span></div>
        <div class="gm-tabs"><span class="on">Primary</span><span>Promotions</span><span>Updates</span></div>
        {rows}
      </div>
      <div class="gm-menu">
        {menu}
      </div>
      <svg class="gm-cursor"><use href="#i-cursor"/></svg>
      <div class="vpa-toast"><svg><use href="#i-mark"/></svg><span>Copied. Opening ChatGPT: press <kbd>Cmd</kbd><kbd>V</kbd>, then <kbd>Enter</kbd>.</span><span class="left"></span></div>
    </div>
  </div>
</div>

<span class="brace" aria-hidden="true"></span><span class="lead lead1" aria-hidden="true"></span><span class="lead lead2" aria-hidden="true"></span>
<span class="brace quiet" aria-hidden="true"></span><span class="lead lead1 quiet" aria-hidden="true"></span>

<div class="panel">
  <div class="brand">
    {icon}
    Open in AI Agent for Gmail
  </div>
  <h1>Right-click a Gmail thread to open it in Claude, ChatGPT or Codex.</h1>
  <p class="note n1">The AIs you picked sit at the top of Gmail's own menu.</p>
  <p class="note n3">Gmail's own menu carries on below, unchanged.</p>
  <p class="note n2">Click one. The AI opens in a new tab next to Gmail, and this note goes after six seconds.</p>
</div>
</body>
</html>
'''

promo = f'''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=440">
<title>Store promo tile</title>
<!-- 440 x 280 small promo tile. Built by store/build.py; the menu is the Gmail drawing from docs/index.html. -->
<style>
{fonts}

{TOKENS}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; }}
  body {{ position: relative; width: 440px; height: 280px; overflow: hidden; background: var(--paper); color: var(--ink);
         -webkit-font-smoothing: antialiased; }}
  .left {{ position: absolute; left: 0; top: 0; bottom: 0; width: 198px; padding: 28px 14px 30px 26px;
           display: flex; flex-direction: column; justify-content: space-between; }}
  .brand {{ display: flex; flex-direction: column; gap: 12px; font: 600 15px/1.25 var(--sans); text-wrap: balance; }}
  .brand svg {{ width: 34px; height: 34px; }}
  .line {{ margin: 0; font: 600 21px/1.14 var(--sans); letter-spacing: -0.02em; }}
  /* A crop of Gmail: the right-clicked row, then the top of the menu running off the right edge.
     The menu is placed so the tile's bottom edge falls between two items, never through one. */
  .crop {{ position: absolute; left: 198px; top: 0; right: 0; bottom: 0; }}
  .crop .gm {{ position: absolute; inset: 0; height: auto; border-radius: 0; }}
  .crop .gm-row.ctx {{ position: absolute; left: 0; right: -60px; top: 25px; }}
  .crop .gm-menu {{ left: 20px; right: auto; top: 63px; }}
  .crop .gm-cursor {{ left: 14px; right: auto; top: 58px; }}

{gm_css}
</style>
</head>
<body>
{sprite}
<div class="left">
  <div class="brand">
    {icon}
    Open in AI Agent for Gmail
  </div>
  <p class="line">Your AIs,<br>in Gmail's<br>right-click menu</p>
</div>
<div class="crop" aria-hidden="true">
  <div class="gm">
    <div class="gm-row ctx"><span class="gm-box"></span><span class="from">Marta Ioannou</span></div>
    <div class="gm-menu">
        {(chr(10) + '        ').join(OURS)}
        <div class="gm-sep"></div>
        {mi('i-reply', 'Reply')}
        {mi('i-replyall', 'Reply all')}
    </div>
    <svg class="gm-cursor"><use href="#i-cursor"/></svg>
  </div>
</div>
</body>
</html>
'''

# shot3: options.html as it ships, plus a stand-in for chrome.storage. Always light, whatever the Mac is set to.
options = open(os.path.join(REPO, 'options.html')).read()
options = re.sub(r"  @media \(prefers-color-scheme: dark\) \{.*?\n  \}\n", "", options, count=1, flags=re.S)
options = options.replace('<meta name="color-scheme" content="light dark">', '<meta name="color-scheme" content="light">', 1)
STUB = '''<base href="../">
<!-- Store image 3, 1280 x 800. Built by store/build.py from options.html; a stand-in replaces chrome.storage. -->
<script>
window.chrome = {
  runtime: { lastError: undefined },
  storage: {
    sync: {
      get: (d, cb) => setTimeout(() => cb({ ...d, targets: ['claude-code', 'claude', 'chatgpt', 'copy'], folder: '/Users/you/Documents/Work' }), 0),
      set: (o, cb) => setTimeout(() => cb && cb(), 0),
    },
    onChanged: { addListener() {} },
  },
};
</script>'''
# The donation block would run past the bottom of the frame; the listing text covers it instead.
SHOT3_CSS = '''  /* Store image only: the page at 92 %, in a fixed 1280 x 800 frame, without the donation block. */
  html { zoom: 0.92; }
  body { width: 1391px; height: 870px; overflow: hidden; }
  #donate { display: none !important; }
'''
shot3 = options.replace('<head>', '<head>\n' + STUB, 1)
shot3 = shot3.replace('<title>Open in AI Agent for Gmail settings</title>', '<title>Store image 3: the settings page</title>', 1)
shot3 = shot3.replace('</style>', SHOT3_CSS + '</style>', 1)
assert 'window.chrome' in shot3 and 'Store image 3' in shot3 and '#donate { display: none' in shot3
assert 'prefers-color-scheme: dark' not in shot3

for name, html in [('shot1.html', shot1), ('promo.html', promo), ('shot3.html', shot3)]:
    open(os.path.join(HERE, name), 'w').write(html)
    print('wrote', name, len(html))
