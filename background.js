let blockAll = true;
let blockUntil = null;
let contextData = {};

chrome.runtime.onInstalled.addListener(() => {
  blockAll = true;
  blockUntil = null;
  contextData = {};
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (blockAll) {
      return { cancel: true };
    }
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "unblock") {
    blockAll = false;
    blockUntil = Date.now() + message.timeLimit * 60 * 1000;
    contextData = message.contextData;
    sendResponse({ status: "unblocked" });
  } else if (message.type === "checkBlock") {
    if (blockUntil && Date.now() > blockUntil) {
      blockAll = true;
      blockUntil = null;
      contextData = {};
    }
    sendResponse({ blockAll });
  }
});

setInterval(() => {
  if (blockUntil && Date.now() > blockUntil) {
    blockAll = true;
    blockUntil = null;
    contextData = {};
  }
}, 1000);
