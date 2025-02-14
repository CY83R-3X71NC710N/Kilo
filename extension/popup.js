let context = {};
let currentDomain = '';
let blockDuration = 0;
const API_BASE_URL = 'http://localhost:5000';

// Add session check at start
async function checkBlockStatus() {
    const { blockData } = await chrome.storage.local.get('blockData');
    if (blockData?.endTime && Date.now() < blockData.endTime) {
        document.getElementById('domainSelect').classList.add('hidden');
        document.getElementById('analysisResult').classList.remove('hidden');
        const resultDiv = document.getElementById('result');
        resultDiv.textContent = 'Block active - Please wait for the current block to end';
        resultDiv.className = 'result not-productive';
        return true;
    }
    return false;
}

// Modify fetchAPI to remove Chrome extension API dependency
async function fetchAPI(endpoint, data) {
    try {
        console.log('Fetching:', endpoint, 'with data:', data);
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            mode: 'cors',
            body: JSON.stringify(data)
        });

        console.log('Response:', response);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error(`Server error (${response.status}): ${errorText}`);
        }

        const responseData = await response.json();
        console.log('Response data:', responseData);
        return responseData;

    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// Add this right after your fetchAPI function to debug click events
function debugClick(e) {
    console.log('Button clicked:', e);
}

function showLoading(show) {
    document.getElementById('loadingIndicator').classList.toggle('hidden', !show);
}

// Update showError to create errorDisplay if it doesn't exist
function showError(message) {
    console.error('Error:', message);
    let errorDiv = document.getElementById('errorDisplay');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'errorDisplay';
        errorDiv.className = 'error hidden';
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    setTimeout(() => errorDiv.classList.add('hidden'), 5000);
}

// Add these functions at the top
const matrixChars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデド';
let matrixInterval;

function createMatrixEffect() {
    const content = document.getElementById('matrix-content');
    let text = '';
    for (let i = 0; i < 50; i++) {
        text += `<span class="matrix-char" style="animation-delay: ${Math.random() * 2}s">
            ${matrixChars[Math.floor(Math.random() * matrixChars.length)]}
        </span>`;
    }
    content.innerHTML = text + '<span id="terminal-cursor"></span>';
}

function startMatrixAnimation() {
    clearInterval(matrixInterval);
    matrixInterval = setInterval(createMatrixEffect, 100);
}

function stopMatrixAnimation() {
    clearInterval(matrixInterval);
}

// Modify the initialization function
async function initializeSession() {
    try {
        console.log('Starting initialization');
        const domain = document.getElementById('domain').value;
        console.log('Selected domain:', domain);

        if (!domain) {
            showError("Please select a domain");
            return;
        }

        showLoading(true);
        console.log('Fetching first question...');
        
        const response = await fetchAPI('/get_question', {
            domain: domain,
            context: {}
        });

        console.log('API response:', response);

        // Store current domain and reset context
        currentDomain = domain;
        context = {};

        // Show first question
        const questionElement = document.getElementById('question');
        if (questionElement) {
            questionElement.textContent = response.question;
            document.getElementById('domainSelect').classList.add('hidden');
            document.getElementById('contextQuestions').classList.remove('hidden');
            document.getElementById('answer').value = '';
            document.getElementById('answer').focus();
        } else {
            throw new Error('Question element not found');
        }

    } catch (error) {
        console.error('Initialization error:', error);
        showError(error.message || 'Error initializing session');
    } finally {
        showLoading(false);
    }
}

document.getElementById('startContext').addEventListener('click', initializeSession);

document.getElementById('nextQuestion').addEventListener('click', async () => {
    const answer = document.getElementById('answer').value;
    if (!answer.trim()) return;

    const question = document.getElementById('question').textContent;
    context[question] = answer;
    document.getElementById('answer').value = '';
    
    await getNextQuestion();
});

async function getNextQuestion() {
    try {
        showLoading(true);
        const data = await fetchAPI('/get_question', {
            domain: currentDomain,
            context: context
        });
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (data.done) {
            await sendContext();
            return;
        }
        
        document.getElementById('question').textContent = data.question;
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

async function sendContext() {
    try {
        showLoading(true);
        await fetchAPI('/contextualize', {
            domain: currentDomain, 
            context: context 
        });
        
        await analyzeCurrentTab();
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// Modify the analyzeCurrentTab function
async function analyzeCurrentTab() {
    try {
        showLoading(true);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Allow extension pages
        if (tab.url.startsWith('chrome-extension://') || tab.url.startsWith('chrome://')) {
            document.getElementById('contextQuestions').classList.add('hidden');
            document.getElementById('analysisResult').classList.remove('hidden');
            startMatrixAnimation();
            return;
        }

        const data = await fetchAPI('/analyze', {
            url: tab.url,
            domain: currentDomain
        });
        
        if (!data.isProductive) {
            const endTime = Date.now() + blockDuration;
            console.log('Setting block for:', tab.url);
            
            await chrome.runtime.sendMessage({
                type: 'setBlock',
                data: {
                    url: tab.url,
                    endTime: endTime
                }
            });
        }
        
        document.getElementById('contextQuestions').classList.add('hidden');
        document.getElementById('analysisResult').classList.remove('hidden');
        
        const resultDiv = document.getElementById('result');
        if (data.isProductive) {
            resultDiv.innerHTML = '<div class="matrix-output">ACCESS GRANTED: Site is productive!<span id="terminal-cursor"></span></div>';
            resultDiv.className = 'result productive';
        } else {
            resultDiv.innerHTML = '<div class="matrix-output">ACCESS DENIED: Site has been blocked.<span id="terminal-cursor"></span></div>';
            resultDiv.className = 'result not-productive';
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
        startMatrixAnimation();
    } finally {
        showLoading(false);
    }
}

// Add cleanup on popup close
window.addEventListener('unload', () => {
    stopMatrixAnimation();
});

// Remove the duplicate DOMContentLoaded event listener and merge the functionality
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded');
    
    const startButton = document.getElementById('startContext');
    if (startButton) {
        console.log('Found start button');
        // Remove old listeners first
        const newButton = startButton.cloneNode(true);
        startButton.parentNode.replaceChild(newButton, startButton);
        
        newButton.addEventListener('click', (e) => {
            console.log('Execute button clicked');
            debugClick(e);
            initializeSession();
        });
    }

    const { blockData, sessionData } = await chrome.storage.local.get(['blockData', 'sessionData']);
    const answer = document.getElementById('answer');
    
    // Check for existing block
    if (blockData?.endTime && Date.now() < blockData.endTime) {
        document.getElementById('domainSelect').classList.add('hidden');
        document.getElementById('analysisResult').classList.remove('hidden');
        const resultDiv = document.getElementById('result');
        resultDiv.textContent = `Block active for ${sessionData?.domain || 'current task'} - ${Math.round((blockData.endTime - Date.now()) / 60000)} minutes remaining`;
        resultDiv.className = 'result not-productive';
        return;
    }

    // Add event listeners
    document.getElementById('startContext').addEventListener('click', initializeSession);
    document.getElementById('nextQuestion').addEventListener('click', handleNextQuestion);
    
    // Handle Enter key in answer input
    answer.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('nextQuestion').click();
        }
    });

    // Handle Enter key on domain select
    document.getElementById('domain').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            initializeSession();
        }
    });

    // Call setupMatrix on DOMContentLoaded
    setupMatrix();
});

// Add this new function to handle next question clicks
async function handleNextQuestion() {
    const answer = document.getElementById('answer').value.trim();
    if (!answer) return;

    const question = document.getElementById('question').textContent;
    context[question] = answer;
    document.getElementById('answer').value = '';
    
    await getNextQuestion();
}

// Add a function to handle matrix code rendering
function setupMatrix() {
    const canvas = document.getElementById('matrix-canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Matrix characters
    const chars = '日ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ123456789';
    const charArray = chars.split('');
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = new Array(Math.floor(columns)).fill(0);

    // Drawing function
    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0F0';
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
            const char = charArray[Math.floor(Math.random() * charArray.length)];
            const x = i * fontSize;
            const y = drops[i] * fontSize;

            ctx.fillStyle = `rgba(0, 255, 0, ${Math.random()})`;
            ctx.fillText(char, x, y);

            if (y > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
        requestAnimationFrame(draw);
    }

    // Start animation
    draw();
}

// Add a function to handle custom cursor movement
function moveCursor(e) {
    const cursor = document.getElementById('custom-cursor');
    const x = e.clientX;
    const y = e.clientY;
    if (cursor) {
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
    }
}

// Add event listeners for mousemove and mouseenter to call moveCursor
document.addEventListener('mousemove', moveCursor);
document.addEventListener('mouseenter', moveCursor);
