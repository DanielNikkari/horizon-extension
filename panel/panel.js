(function () {
  // ── Main view elements ───────────────────────────────────
  const mainView = document.getElementById('main-view');
  const settingsView = document.getElementById('settings-view');
  const textarea = document.getElementById('selected-text');
  const explainBtn = document.getElementById('explain-btn');
  const explanationSection = document.getElementById('explanation-section');
  const loading = document.getElementById('loading');
  const explanationContent = document.getElementById('explanation-content');
  const errorMessage = document.getElementById('error-message');
  const followupsSection = document.getElementById('followups-section');
  const followupList = document.getElementById('followup-list');
  const emptyState = document.getElementById('empty-state');
  const expertiseBadge = document.getElementById('expertise-badge');
  const enabledToggle = document.getElementById('enabled-toggle');
  const settingsBtn = document.getElementById('settings-btn');
  const backBtn = document.getElementById('back-btn');

  // ── Settings elements ────────────────────────────────────
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

  let port = null;
  let userIsEditing = false;
  let explanationBuffer = '';
  let currentTabId = null;

  // ── Port connection ──────────────────────────────────────
  function connectPort() {
    port = chrome.runtime.connect({ name: 'panel-port' });
    port.onMessage.addListener(handlePortMessage);
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connectPort, 500);
    });
  }

  connectPort();

  // ── Port message handler ─────────────────────────────────
  function handlePortMessage(msg) {
    switch (msg.type) {
      case 'SELECTION_LIVE':
        if (!userIsEditing) textarea.value = msg.text;
        showEmptyState(false);
        break;
      case 'EXPLAIN_START':
        if (!userIsEditing) textarea.value = msg.text;
        startExplaining();
        break;
      case 'CHUNK':
        appendChunk(msg.text);
        break;
      case 'EXPLAIN_DONE':
        finishExplaining();
        break;
      case 'ERROR':
        showError(msg.message);
        break;
      case 'FOLLOW_UPS':
        renderFollowUps(msg.questions);
        break;
    }
  }

  // ── Explanation flow ─────────────────────────────────────
  function startExplaining() {
    explanationBuffer = '';
    explanationContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    followupsSection.classList.add('hidden');
    followupList.innerHTML = '';
    explanationSection.classList.remove('hidden');
    loading.classList.remove('hidden');
    emptyState.classList.add('hidden');
  }

  function appendChunk(text) {
    loading.classList.add('hidden');
    explanationBuffer += text;
    explanationContent.innerHTML = renderMarkdown(explanationBuffer);
    explanationSection.scrollTop = explanationSection.scrollHeight;
  }

  function finishExplaining() {
    loading.classList.add('hidden');
  }

  function showError(message) {
    loading.classList.add('hidden');
    explanationSection.classList.remove('hidden');
    emptyState.classList.add('hidden');
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  // ── Follow-ups ───────────────────────────────────────────
  function renderFollowUps(questions) {
    followupList.innerHTML = '';
    questions.slice(0, 3).forEach(q => {
      const li = document.createElement('li');
      li.textContent = q;
      li.addEventListener('click', () => sendFollowUp(q));
      followupList.appendChild(li);
    });
    followupsSection.classList.remove('hidden');
  }

  function sendFollowUp(question) {
    textarea.value = question;
    chrome.runtime.sendMessage({ type: 'FOLLOW_UP_CLICK', text: question, tabId: currentTabId }).catch(() => {});
  }

  // ── Manual explain button ────────────────────────────────
  explainBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) return;
    chrome.runtime.sendMessage({ type: 'FOLLOW_UP_CLICK', text, tabId: currentTabId }).catch(() => {});
  });

  // ── Textarea focus guard ─────────────────────────────────
  textarea.addEventListener('focus', () => { userIsEditing = true; });
  textarea.addEventListener('blur', () => { userIsEditing = false; });

  // ── View switching ───────────────────────────────────────
  settingsBtn.addEventListener('click', () => {
    mainView.classList.add('hidden');
    settingsView.classList.remove('hidden');
  });

  backBtn.addEventListener('click', () => {
    settingsView.classList.add('hidden');
    mainView.classList.remove('hidden');
  });

  // ── Load settings ────────────────────────────────────────
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
    expertiseBadge.textContent = capitalize(prefs.expertiseLevel);
    setAiMode(prefs.aiMode);
    apiKeyInput.value = prefs.apiKey;
    remoteModelInput.value = prefs.remoteModel;
    localModelInput.value = prefs.localModel;
    ollamaHostInput.value = prefs.ollamaHost;
    debounceSlider.value = prefs.debounceDelay;
    debounceValue.textContent = prefs.debounceDelay + 'ms';
  });

  // ── Enabled toggle ───────────────────────────────────────
  enabledToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ enabled: enabledToggle.checked });
  });

  // ── Expertise level ──────────────────────────────────────
  expertiseGroup.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    const level = btn.dataset.level;
    setActiveLevel(level);
    expertiseBadge.textContent = capitalize(level);
    chrome.storage.sync.set({ expertiseLevel: level });
  });

  function setActiveLevel(level) {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.level === level));
  }

  // ── AI mode ──────────────────────────────────────────────
  aiModeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      setAiMode(radio.value);
      chrome.storage.sync.set({ aiMode: radio.value });
    });
  });

  function setAiMode(mode) {
    document.querySelectorAll('input[name="ai-mode"]').forEach(r => { r.checked = r.value === mode; });
    remoteSettings.classList.toggle('hidden', mode !== 'remote');
    localSettings.classList.toggle('hidden', mode !== 'local');
  }

  // ── Field inputs ─────────────────────────────────────────
  apiKeyInput.addEventListener('input', () => chrome.storage.sync.set({ apiKey: apiKeyInput.value }));
  toggleKeyBtn.addEventListener('click', () => { apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password'; });
  remoteModelInput.addEventListener('input', () => chrome.storage.sync.set({ remoteModel: remoteModelInput.value }));
  ollamaHostInput.addEventListener('input', () => chrome.storage.sync.set({ ollamaHost: ollamaHostInput.value }));
  localModelInput.addEventListener('input', () => chrome.storage.sync.set({ localModel: localModelInput.value }));

  // ── Test connection ──────────────────────────────────────
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

  // ── Debounce slider ──────────────────────────────────────
  debounceSlider.addEventListener('input', () => { debounceValue.textContent = debounceSlider.value + 'ms'; });
  debounceSlider.addEventListener('change', () => { chrome.storage.sync.set({ debounceDelay: Number(debounceSlider.value) }); });

  // ── Expertise badge sync (from other sources) ────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.expertiseLevel) expertiseBadge.textContent = capitalize(changes.expertiseLevel.newValue);
  });

  // ── Get current tab ──────────────────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) currentTabId = tabs[0].id;
  });

  // ── Markdown renderer ────────────────────────────────────
  function renderMarkdown(text) {
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    const lines = html.split('\n');
    const output = [];
    let inList = false;
    for (const line of lines) {
      const m = line.match(/^[-*]\s+(.+)/);
      if (m) {
        if (!inList) { output.push('<ul>'); inList = true; }
        output.push(`<li>${m[1]}</li>`);
      } else {
        if (inList) { output.push('</ul>'); inList = false; }
        output.push(line);
      }
    }
    if (inList) output.push('</ul>');

    return output.join('\n')
      .split(/\n\n+/)
      .map(block => {
        const t = block.trim();
        if (!t || t.startsWith('<ul') || t.startsWith('<li')) return t;
        return `<p>${t.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');
  }

  // ── Helpers ──────────────────────────────────────────────
  function showEmptyState(visible) { emptyState.classList.toggle('hidden', !visible); }
  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
})();
