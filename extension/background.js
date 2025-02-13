let blockData = {};
let sessionContext = {};
let analyzedUrls = new Map(); // Change to Map to store productivity status
let analysisInProgress = new Set();

// Add initialization on extension load
chrome.runtime.onInstalled.addListener(async () => {
    await updateDefaultBlock();
});

async function updateDefaultBlock() {
    try {
        const { sessionData } = await chrome.storage.local.get('sessionData');
        if (!sessionData?.active) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [100],
                addRules: [{
                    id: 100,
                    priority: 2,
                    action: {
                        type: "redirect",
                        redirect: {
                            url: `http://localhost:5000/block?reason=no-session&t=${Date.now()}`
                        }
                    },
                    condition: {
                        urlFilter: "*",
                        resourceTypes: ["main_frame"],
                        excludedRequestDomains: ["localhost", "127.0.0.1"],
                        excludedInitiatorDomains: [chrome.runtime.id]
                    }
                }]
            });
        }
    } catch (error) {
        console.error('Error setting default block:', error);
    }
}

// Update initialization function
async function initializeSession(domain, endTime) {
    try {
        // Clear previous state
        analyzedUrls.clear(); // Clear previous analysis results
        analysisInProgress.clear();
        await chrome.storage.local.remove(['productiveUrls']);
        
        // Remove existing rules
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [100]
        });

        // Set up new session
        await chrome.storage.local.set({
            sessionData: {
                active: true,
                domain: domain,
                startTime: Date.now()
            },
            blockData: {
                endTime: endTime,
                blockedDomains: []
            }
        });

        console.log('Session initialized for domain:', domain);
    } catch (error) {
        console.error('Error initializing session:', error);
        throw error;
    }
}

// Add session cleanup
async function endSession() {
    await chrome.storage.local.remove(['sessionData', 'blockData']);
    await updateDefaultBlock();
}

// Add tab monitoring
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const { sessionData } = await chrome.storage.local.get('sessionData');
        if (sessionData?.active) {
            analyzeAndBlockIfNeeded(changeInfo.url, sessionData.domain, tabId);
        }
    }
});

// Add helper function to clean URLs
function getDomainFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        console.error('Invalid URL:', url);
        return null;
    }
}

function isBlockPage(url) {
    return url.startsWith('chrome-extension://') && url.includes('/block.html');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'setBlock') {
        const { url, endTime } = request.data;
        updateBlockRules(url, endTime);
        blockData = request.data;
        chrome.storage.local.set({ blockData });
        sendResponse({ success: true });
        return true;
    }
    
    if (request.type === 'checkBlock') {
        const isBlocked = isUrlBlocked(request.url);
        sendResponse({ isBlocked });
        return true;
    }

    if (request.type === 'analyze') {
        fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.data)
        })
        .then(response => response.json())
        .then(data => sendResponse(data))
        .catch(error => sendResponse({ error: error.message }));
        return true;
    }

    if (request.type === 'initializeSession') {
        const { domain, endTime } = request.data;
        initializeSession(domain, endTime)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
});

async function analyzeAndBlockIfNeeded(url, domain, tabId) {
    try {
        if (url.startsWith('chrome-extension://') || url.startsWith('chrome://')) {
            return;
        }

        const urlKey = `${url}-${domain}`;
        
        // Check if already analyzed
        if (analyzedUrls.has(urlKey)) {
            const isProductive = analyzedUrls.get(urlKey);
            if (!isProductive) {
                await showBlockPage(tabId);
            }
            return;
        }

        // Show analyzing page
        await chrome.tabs.update(tabId, { 
            url: chrome.runtime.getURL('block.html?reason=analyzing') 
        });

        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, domain })
        });

        const data = await response.json();
        console.log('Analysis result:', data); // Debug log

        // Store result
        analyzedUrls.set(urlKey, data.isProductive);

        if (data.isProductive) {
            // Allow access to productive sites
            console.log('Site is productive, allowing access:', url);
            await chrome.tabs.update(tabId, { url });
        } else {
            // Block unproductive sites
            console.log('Site is not productive, blocking:', url);
            const { blockData } = await chrome.storage.local.get('blockData');
            if (blockData?.endTime > Date.now()) {
                const blockedDomains = new Set(blockData.blockedDomains || []);
                blockedDomains.add(getDomainFromUrl(url));
                
                await updateBlockRules(Array.from(blockedDomains), blockData.endTime);
                await showBlockPage(tabId);
            }
        }
    } catch (error) {
        console.error('Error analyzing URL:', error);
        // On error, return to original URL
        await chrome.tabs.update(tabId, { url });
    }
}

async function showBlockPage(tabId, reason = 'blocked') {
    await chrome.tabs.update(tabId, { 
        url: `http://localhost:5000/block?reason=${reason}&t=${Date.now()}`
    });
}

async function updateBlockRules(blockedDomains, endTime) {
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [100],
            addRules: [{
                id: 100,
                priority: 2,
                action: {
                    type: "redirect",
                    redirect: {
                        url: `http://localhost:5000/block?reason=blocked&t=${Date.now()}`
                    }
                },
                condition: {
                    domains: blockedDomains,
                    resourceTypes: ["main_frame"],
                    excludedRequestDomains: ["localhost", "127.0.0.1"]
                }
            }]
        });

        await chrome.storage.local.set({
            blockData: {
                endTime,
                blockedDomains
            }
        });
    } catch (error) {
        console.error('Error updating block rules:', error);
    }
}

// Update block check function
function isUrlBlocked(url) {
    const domain = getDomainFromUrl(url);
    return domain && blockData.domain === domain && Date.now() < blockData.endTime;
}

// Check and update block rules periodically
setInterval(async () => {
    const { blockData } = await chrome.storage.local.get('blockData');
    if (blockData?.endTime && blockData.endTime <= Date.now()) {
        await endSession();
    }
}, 1000);

async function analyzeCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Skip blocking for extension pages
        if (tab.url.startsWith('chrome-extension://')) {
            return;
        }

        // Rest of the analysis logic
        // ...existing code...
    } catch (error) {
        console.error('Error analyzing tab:', error);
    }
}
