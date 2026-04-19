(function () {
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
      // Reconnect after brief delay (service worker may have been terminated)
      setTimeout(connectPort, 500);
    });
  }

  connectPort();

  // ── Handle messages from background ─────────────────────
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

  // ── Explaining state ─────────────────────────────────────
  function startExplaining() {
    explanationBuffer = '';
    explanationContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    errorMessage.textContent = '';
    followupsSection.classList.add('hidden');
    followupList.innerHTML = '';
    show(explanationSection);
    show(loading);
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
    show(explanationSection);
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    emptyState.classList.add('hidden');
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
    chrome.runtime.sendMessage({
      type: 'FOLLOW_UP_CLICK',
      text: question,
      tabId: currentTabId,
    }).catch(() => {});
  }

  // ── Manual explain button ────────────────────────────────
  explainBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) return;
    chrome.runtime.sendMessage({
      type: 'FOLLOW_UP_CLICK',
      text,
      tabId: currentTabId,
    }).catch(() => {});
  });

  // ── Textarea focus guard ─────────────────────────────────
  textarea.addEventListener('focus', () => { userIsEditing = true; });
  textarea.addEventListener('blur', () => { userIsEditing = false; });

  // ── Expertise badge sync ─────────────────────────────────
  chrome.storage.sync.get({ expertiseLevel: 'intermediate' }, prefs => {
    expertiseBadge.textContent = capitalize(prefs.expertiseLevel);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.expertiseLevel) {
      expertiseBadge.textContent = capitalize(changes.expertiseLevel.newValue);
    }
  });

  // Get current tab for follow-up routing
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) currentTabId = tabs[0].id;
  });

  // ── Markdown renderer ────────────────────────────────────
  function renderMarkdown(text) {
    // Escape HTML first
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullet lists
    const lines = html.split('\n');
    const output = [];
    let inList = false;
    for (const line of lines) {
      const listMatch = line.match(/^[-*]\s+(.+)/);
      if (listMatch) {
        if (!inList) { output.push('<ul>'); inList = true; }
        output.push(`<li>${listMatch[1]}</li>`);
      } else {
        if (inList) { output.push('</ul>'); inList = false; }
        output.push(line);
      }
    }
    if (inList) output.push('</ul>');

    // Paragraphs from double newlines
    return output.join('\n')
      .split(/\n\n+/)
      .map(block => {
        const trimmed = block.trim();
        if (!trimmed || trimmed.startsWith('<ul') || trimmed.startsWith('<li')) return trimmed;
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');
  }

  // ── Helpers ──────────────────────────────────────────────
  function show(el) { el.classList.remove('hidden'); }
  function showEmptyState(visible) {
    emptyState.classList.toggle('hidden', !visible);
  }
  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
})();
