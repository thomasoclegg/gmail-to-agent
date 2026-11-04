const input = document.getElementById('folder');
const status = document.getElementById('status');

chrome.storage.sync.get({ folder: '' }, (s) => (input.value = s.folder));

document.getElementById('save').addEventListener('click', () => {
  const folder = input.value.trim().replace(/^['"]|['"]$/g, '');
  input.value = folder;
  chrome.storage.sync.set({ folder }, () => {
    status.textContent = 'Saved. Reload any open Gmail tab.';
  });
});
