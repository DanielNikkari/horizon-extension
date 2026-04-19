(function () {
  const enabledToggle = document.getElementById('enabled-toggle');
  const expertiseGroup = document.getElementById('expertise-group');
  const aiModeRadios = document.querySelectorAll('input[name="ai-mode"]');
  const remoteSettings = document.getElementById('remote-settings');
  const localSettings = document.getElementById('local-settings');
  const apiKeyInput = document.getElementById('api-key');
  const toggleKeyBtn = document.getElementById('toggle-key');
  const remoteModelInput = document.getElementById('remote-model');
  const ollamaHostInput = document.getElementById('ollama-host');
  const localModelInput = document.getElementById('local-model');
  const testBtn = document.getElementById('test-btn');
  const testResult = document.getElementById('test-result');
  const debounceSlider = document.getElementById('debounce-slider');
  const debounceValue = document.getElementById('debounce-value');

  // ── Load settings ──────────────────────────────────────
  chrome.storage.sync.get({
    enabled: true,
    expertiseLevel: 'intermediate',
    aiMode: 'remote',
    apiKey: '',
    remoteModel: 'claude-opus-4-5',
    localModel: 'llama3.2',
    debounceDelay: 800,
    ollamaHost: 'http://localhost:11434',
  }, prefs => {
    enabledToggle.checked = prefs.enabled;
    setActiveLevel(prefs.expertiseLevel);
    setAiMode(prefs.aiMode);
    apiKeyInput.value = prefs.apiKey;
    remoteModelInput.value = prefs.remoteModel;
    localModelInput.value = prefs.localModel;
    ollamaHostInput.value = prefs.ollamaHost;
    debounceSlider.value = prefs.debounceDelay;
    debounceValue.textContent = prefs.debounceDelay + 'ms';
  });

  // ── Enable toggle ──────────────────────────────────────
  enabledToggle.addEventListener('change', () => {
    save({ enabled: enabledToggle.checked });
  });

  // ── Expertise level ────────────────────────────────────
  expertiseGroup.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    const level = btn.dataset.level;
    setActiveLevel(level);
    save({ expertiseLevel: level });
  });

  function setActiveLevel(level) {
    document.querySelectorAll('.seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.level === level);
    });
  }

  // ── AI mode radio ──────────────────────────────────────
  aiModeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      setAiMode(radio.value);
      save({ aiMode: radio.value });
    });
  });

  function setAiMode(mode) {
    document.querySelectorAll('input[name="ai-mode"]').forEach(r => {
      r.checked = r.value === mode;
    });
    remoteSettings.classList.toggle('hidden', mode !== 'remote');
    localSettings.classList.toggle('hidden', mode !== 'local');
  }

  // ── API key ────────────────────────────────────────────
  apiKeyInput.addEventListener('input', () => save({ apiKey: apiKeyInput.value }));

  toggleKeyBtn.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  // ── Remote model ───────────────────────────────────────
  remoteModelInput.addEventListener('input', () => save({ remoteModel: remoteModelInput.value }));

  // ── Ollama host + local model ──────────────────────────
  ollamaHostInput.addEventListener('input', () => save({ ollamaHost: ollamaHostInput.value }));
  localModelInput.addEventListener('input', () => save({ localModel: localModelInput.value }));

  // ── Test connection ────────────────────────────────────
  testBtn.addEventListener('click', () => {
    testBtn.disabled = true;
    testBtn.textContent = 'Testing…';
    testResult.className = 'test-result hidden';

    chrome.storage.sync.get({
      aiMode: 'local', apiKey: '', remoteModel: 'claude-opus-4-5',
      localModel: 'llama3.2', ollamaHost: 'http://localhost:11434',
    }, settings => {
      chrome.runtime.sendMessage({ type: 'TEST_CONNECTION', settings }, result => {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
        testResult.textContent = result?.message || 'Unknown error';
        testResult.className = `test-result ${result?.ok ? 'ok' : 'fail'}`;
      });
    });
  });

  // ── Debounce slider ────────────────────────────────────
  debounceSlider.addEventListener('input', () => {
    debounceValue.textContent = debounceSlider.value + 'ms';
  });
  debounceSlider.addEventListener('change', () => {
    save({ debounceDelay: Number(debounceSlider.value) });
  });

  // ── Save helper ────────────────────────────────────────
  function save(partial) {
    chrome.storage.sync.set(partial);
  }
})();
