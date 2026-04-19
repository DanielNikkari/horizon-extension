import { getSettings } from './utils/storage.js';
import { streamExplanation, fetchFollowUps, testConnection } from './utils/api.js';

let panelPort = null;
let pendingText = null;
let currentAbortController = null; // tracks the in-flight request

// Make clicking the extension icon open/close the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Inject content script into all existing http/https tabs on install/update
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, tabs => {
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
      }).catch(() => {});
    }
  });
});

// Panel connects on load via chrome.runtime.connect
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'panel-port') return;
  panelPort = port;

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
        pendingText = message.text;
      }
      break;

    case 'FOLLOW_UP_CLICK':
      handleExplain(message.text);
      break;

    case 'TEST_CONNECTION':
      testConnection(message.settings).then(result => sendResponse(result));
      return true;

    case 'GET_SELECTION':
      if (pendingText) {
        sendResponse({ text: pendingText });
        pendingText = null;
      } else {
        sendResponse({ text: null });
      }
      break;
  }
});

function abortCurrent() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

async function handleExplain(text) {
  // Cancel any in-flight request before starting a new one
  abortCurrent();
  const controller = new AbortController();
  currentAbortController = controller;

  const settings = await getSettings();

  // If already aborted by an even newer request, bail out
  if (controller.signal.aborted) return;

  await sleep(150);
  if (controller.signal.aborted) return;

  panelPort?.postMessage({ type: 'EXPLAIN_START', text });

  let doneCalled = false;
  const onDone = () => {
    if (doneCalled) return;
    doneCalled = true;
    if (controller.signal.aborted) return; // stale — don't update UI
    panelPort?.postMessage({ type: 'EXPLAIN_DONE' });
    generateFollowUps(text, settings, controller.signal);
  };

  await streamExplanation(
    text,
    settings,
    chunk => {
      if (!controller.signal.aborted) {
        panelPort?.postMessage({ type: 'CHUNK', text: chunk });
      }
    },
    onDone,
    err => {
      if (!controller.signal.aborted) {
        panelPort?.postMessage({ type: 'ERROR', message: err });
      }
      if (!doneCalled) { doneCalled = true; }
    },
    controller.signal
  );

  if (!doneCalled) onDone();
}

async function generateFollowUps(text, settings, signal) {
  try {
    const questions = await fetchFollowUps(text, settings, signal);
    if (!signal?.aborted && questions?.length) {
      panelPort?.postMessage({ type: 'FOLLOW_UPS', questions });
    }
  } catch {
    // best-effort
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
