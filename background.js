import { getSettings } from './utils/storage.js';
import { streamExplanation, fetchFollowUps, testConnection } from './utils/api.js';

let panelPort = null;

// Panel connects on load via chrome.runtime.connect
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'panel-port') return;
  panelPort = port;
  port.onDisconnect.addListener(() => { panelPort = null; });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SELECTION_LIVE':
      panelPort?.postMessage({ type: 'SELECTION_LIVE', text: message.text });
      break;

    case 'SELECTION_FINAL':
      handleExplain(message.text, sender.tab?.id);
      break;

    case 'FOLLOW_UP_CLICK':
      handleExplain(message.text, message.tabId);
      break;

    case 'TEST_CONNECTION':
      testConnection(message.settings).then(result => sendResponse(result));
      return true; // async

    case 'OPEN_PANEL':
      if (sender.tab?.id) chrome.sidePanel.open({ tabId: sender.tab.id });
      break;
  }
});

async function handleExplain(text, tabId) {
  const settings = await getSettings();

  if (tabId) {
    try { await chrome.sidePanel.open({ tabId }); } catch { /* panel may already be open */ }
  }

  // Small delay to let panel initialize its port connection
  await sleep(150);

  panelPort?.postMessage({ type: 'EXPLAIN_START', text });

  let doneCalled = false;
  const onDone = () => {
    if (doneCalled) return;
    doneCalled = true;
    panelPort?.postMessage({ type: 'EXPLAIN_DONE' });
    generateFollowUps(text, settings);
  };

  await streamExplanation(
    text,
    settings,
    chunk => panelPort?.postMessage({ type: 'CHUNK', text: chunk }),
    onDone,
    err => {
      panelPort?.postMessage({ type: 'ERROR', message: err });
      if (!doneCalled) { doneCalled = true; }
    }
  );

  // Fallback: if stream ended without calling onDone
  if (!doneCalled) onDone();
}

async function generateFollowUps(text, settings) {
  try {
    const questions = await fetchFollowUps(text, settings);
    if (questions?.length) {
      panelPort?.postMessage({ type: 'FOLLOW_UPS', questions });
    }
  } catch {
    // follow-ups are best-effort
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
