import { getSettings } from './utils/storage.js';
import { streamExplanation, fetchFollowUps, testConnection } from './utils/api.js';

let panelPort = null;
let pendingText = null; // text that arrived before panel connected

// Make clicking the extension icon open/close the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Inject content script into all existing http/https tabs on install/update
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, tabs => {
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
      }).catch(() => {}); // tab may not allow scripts — ignore
    }
  });
});

// Panel connects on load via chrome.runtime.connect
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'panel-port') return;
  panelPort = port;

  // If a selection arrived before the panel was open, process it now
  if (pendingText) {
    const text = pendingText;
    pendingText = null;
    setTimeout(() => handleExplain(text), 200);
  }

  port.onDisconnect.addListener(() => { panelPort = null; });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SELECTION_LIVE':
      panelPort?.postMessage({ type: 'SELECTION_LIVE', text: message.text });
      break;

    case 'SELECTION_FINAL':
      if (panelPort) {
        handleExplain(message.text);
      } else {
        // Panel not open yet — store and it will be picked up on connect
        pendingText = message.text;
      }
      break;

    case 'FOLLOW_UP_CLICK':
      handleExplain(message.text);
      break;

    case 'TEST_CONNECTION':
      testConnection(message.settings).then(result => sendResponse(result));
      return true; // async

    case 'GET_SELECTION':
      // Panel asking for the latest pending text
      if (pendingText) {
        sendResponse({ text: pendingText });
        pendingText = null;
      } else {
        sendResponse({ text: null });
      }
      break;
  }
});

async function handleExplain(text) {
  const settings = await getSettings();

  // Small delay to ensure panel port is fully ready
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

  if (!doneCalled) onDone();
}

async function generateFollowUps(text, settings) {
  try {
    const questions = await fetchFollowUps(text, settings);
    if (questions?.length) {
      panelPort?.postMessage({ type: 'FOLLOW_UPS', questions });
    }
  } catch {
    // best-effort
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
