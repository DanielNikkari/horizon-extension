export const DEFAULTS = {
  enabled: true,
  expertiseLevel: 'intermediate',
  aiMode: 'remote',
  apiKey: '',
  remoteModel: 'claude-opus-4-5',
  localModel: 'llama3.2',
  debounceDelay: 800,
  ollamaHost: 'http://localhost:11434',
  theme: 'system',
};

export function getSettings() {
  return new Promise(resolve => chrome.storage.sync.get(DEFAULTS, resolve));
}

export function saveSettings(partial) {
  return new Promise(resolve => chrome.storage.sync.set(partial, resolve));
}

export function onSettingsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') callback(changes);
  });
}
