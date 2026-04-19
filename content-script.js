(function () {
  let enabled = true;
  let debounceDelay = 800;
  let debounceTimer = null;
  let lastSentText = '';

  // Load settings once on init
  chrome.storage.sync.get({ enabled: true, debounceDelay: 800 }, prefs => {
    enabled = prefs.enabled;
    debounceDelay = prefs.debounceDelay;
  });

  // Hot-reload settings without page refresh
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.enabled !== undefined) enabled = changes.enabled.newValue;
    if (changes.debounceDelay !== undefined) debounceDelay = changes.debounceDelay.newValue;
  });

  // Live update as user drags selection
  document.addEventListener('selectionchange', () => {
    if (!enabled) return;
    const text = window.getSelection().toString().trim();
    if (text.length > 0 && text !== lastSentText) {
      chrome.runtime.sendMessage({ type: 'SELECTION_LIVE', text }).catch(() => {});
    }
  });

  // On release, start debounce countdown
  document.addEventListener('mouseup', () => {
    if (!enabled) return;
    const text = window.getSelection().toString().trim();
    if (text.length < 3) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      lastSentText = text;
      chrome.runtime.sendMessage({ type: 'SELECTION_FINAL', text }).catch(() => {});
    }, debounceDelay);
  });

  // Touch support
  document.addEventListener('touchend', () => {
    if (!enabled) return;
    setTimeout(() => {
      const text = window.getSelection().toString().trim();
      if (text.length < 3) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        lastSentText = text;
        chrome.runtime.sendMessage({ type: 'SELECTION_FINAL', text }).catch(() => {});
      }, debounceDelay);
    }, 50);
  });
})();
