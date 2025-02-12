let blockAll = true;
let blockUntil = null;
let contextData = {};
let nonProductiveWebsites = [];
let currentDomain = null;
let blockingEnabled = true; // Initially block all websites

chrome.runtime.onInstalled.addListener(() => {
  blockingEnabled = true;
});

chrome.runtime.onStartup.addListener(() => {
  blockingEnabled = true;
});

async function startQuestionnaire(domain) {
  blockAll = true;
  blockUntil = null;
  contextData = {};
  nonProductiveWebsites = [];
  currentDomain = domain;

  // Fetch and display questions for the active domain
  try {
    const questions = await fetchQuestions(currentDomain);
    // Send questions to content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'displayQuestions',
        questions: questions,
      });
    });
  } catch (error) {
    if (error.message.includes('status: 403')) {
      console.error("Error fetching questions: HTTP 403 Forbidden");
      // Display a user-friendly message when a 403 error occurs
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'displayErrorMessage',
          message: 'Access to the questions is forbidden. Please contact support.',
        });
      });
    } else {
      console.error("Error fetching questions:", error);
      // Handle other errors appropriately (e.g., display a message to the user)
    }
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const blockedUrl = chrome.runtime.getURL("blocked.html");
    return { redirectUrl: blockedUrl };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "setDomain") {
    currentDomain = message.domain;
    startQuestionnaire(currentDomain);
    sendResponse({ status: "domainSet" });
  } else if (message.type === "questionnaireComplete") {
    blockingEnabled = false;
    sendResponse({ status: "unblocked" });
  } else if (message.type === "unblock") {
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
    fetchQuestions(message.domain).then((questions) => {
      sendResponse({ questions });
    });
    return true; // Will respond asynchronously
  } else if (message.type === "contextualize") {
    fetchContextualization(message.domain).then((context) => {
      contextData = context;
      sendResponse({ context });
    });
    return true; // Will respond asynchronously
  } else if (message.type === 'resetQuestions') {
    startQuestionnaire(currentDomain);
  }
});

setInterval(() => {
  if (blockUntil && Date.now() > blockUntil) {
    blockAll = true;
    chrome.runtime.sendMessage({ type: 'resetQuestions' });
  }
}, 1000);

async function fetchQuestions(domain) {
  const response = await fetch(`http://localhost:5000/getQuestions?domain=${domain}`);
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('HTTP error! status: 403');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data.questions;
}

async function analyzeWebsite(url, domain) {
  const response = await fetch('http://localhost:5000/analyzeWebsite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: url, domain: domain, contextData: contextData }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
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
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data.context;
}
