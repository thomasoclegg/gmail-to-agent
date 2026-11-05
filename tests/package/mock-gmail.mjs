// The mock Gmail inbox that tests/package/gmail-tab.mjs (Chrome) and tests/package/firefox.mjs serve for
// https://mail.google.com/*: three rows, two of them ticked, Gmail's row menu and session key, and the print
// view that a bulk read asks for. Nothing in it is real mail.

export const TITLE = 'Inbox (3) - tester@example.com - Test Mail';
export const IK = 'a1b2c3d4e5';
export const GMAIL_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>${TITLE}</title>
<script>window.GLOBALS = [null, 1, 2, 3, 4, 5, 6, 7, 8, '${IK}'];</script></head><body>
<table><tbody>
<tr class="zA" id="r1"><td><div role="checkbox" aria-checked="true"></div></td><td><span class="bog"><span class="bqe" data-legacy-thread-id="19a0b1c2d3e4f501">Re: Pallet order for Fernhill</span></span><span class="y2"><span>&nbsp;-&nbsp;</span>Could we get a mixed pallet</span></td></tr>
<tr class="zA" id="r2"><td><div role="checkbox" aria-checked="true"></div></td><td><span class="bog"><span class="bqe" data-legacy-thread-id="19a0b1c2d3e4f502">Invoice 4471</span></span><span class="y2"><span>&nbsp;-&nbsp;</span>Please find attached</span></td></tr>
<tr class="zA" id="r3"><td><div role="checkbox" aria-checked="false"></div></td><td><span class="bog"><span class="bqe" data-legacy-thread-id="19a0b1c2d3e4f503">Unselected row</span></span></td></tr>
</tbody></table>
<div class="J-M" role="menu" style="display:none; position:fixed; top:10px; left:10px"><div class="J-N" role="menuitem"><div class="J-N-Jz">Reply</div></div></div>
<script>
  const menu = document.querySelector('.J-M');
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('tr.zA')) return; e.preventDefault(); setTimeout(() => (menu.style.display = 'block'), 20); });
  document.body.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.style.display = 'none'; });
</script></body></html>`;
export const printView = (th) =>
  '<html><head><title>Gmail - x</title><style>b{}</style></head><body><table><tr><td><b>Tester &lt;tester@example.com&gt;</b></td></tr></table><hr>' +
  `<div>Thread ${th}: Hello &amp; welcome.<br>Second line.</div></body></html>`;

export const SINGLE = ['Open in Claude Code', 'Open in Codex', 'Ask Claude', 'Copy thread for any AI'];
export const BULK = ['Open 2 in Claude Code', 'Open 2 in Codex (GPT)', 'Ask Claude about 2 emails', 'Copy 2 emails for any AI'];
export const TARGETS_SET = ['claude-code', 'codex', 'claude', 'copy'];
