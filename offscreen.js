// Clipboard helper for background.js: a service worker cannot write to the
// clipboard, so it hands the text to this hidden offscreen document.
const box = document.getElementById('clip');

function copy(text) {
  box.value = text;
  box.select();
  const ok = document.execCommand('copy');
  box.value = '';
  return ok ? { ok: true } : { ok: false, error: 'Copy was blocked' };
}

// Only the service worker asks for copies; content scripts go through it.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.target !== 'offscreen' || msg.action !== 'copy' || sender.id !== chrome.runtime.id || sender.tab) return;
  reply(copy(String(msg.text ?? '')));
});
