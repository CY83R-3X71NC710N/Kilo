let blockAll = true;
let blockUntil = null;
let contextData = {};
let nonProductiveWebsites = [];

chrome.runtime.onInstalled.addListener(() => {
  blockAll = true;
  blockUntil = null;
  contextData = {};
  nonProductiveWebsites = [];
});

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (blockAll) {
      return { cancel: true };
    }

    const url = new URL(details.url);
    const domain = url.hostname;

    if (nonProductiveWebsites.includes(domain)) {
      return { cancel: true };
    }

    const isProductive = await analyzeWebsite(details.url);
    if (!isProductive) {
      nonProductiveWebsites.push(domain);
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
  } else if (message.type === "getQuestions") {
    fetchQuestions().then((questions) => {
      sendResponse({ questions });
    });
    return true; // Will respond asynchronously
  } else if (message.type === "contextualize") {
    fetchContextualization(message.domain).then((context) => {
      contextData = context;
      sendResponse({ context });
    });
    return true; // Will respond asynchronously
  }
});

setInterval(() => {
  if (blockUntil && Date.now() > blockUntil) {
    blockAll = true;
    blockUntil = null;
    contextData = {};
  }
}, 1000);

async function fetchQuestions() {
  const response = await fetch('http://localhost:5000/getQuestions');
  const data = await response.json();
  return data.questions;
}

async function analyzeWebsite(url) {
  const response = await fetch('http://localhost:5000/analyzeWebsite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, contextData }),
  });
  const data = await response.json();
  return data.isProductive;
}

async function fetchContextualization(domain) {
  const response = await fetch('http://localhost:5000/contextualize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ domain }),
  });
  const data = await response.json();
  return data.context;
}
