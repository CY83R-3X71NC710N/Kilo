let context = {};
let currentDomain = '';

document.getElementById('startContext').addEventListener('click', async () => {
    currentDomain = document.getElementById('domain').value;
    document.getElementById('domainSelect').classList.add('hidden');
    document.getElementById('contextQuestions').classList.remove('hidden');
    await startContextualization();
});

document.getElementById('nextQuestion').addEventListener('click', async () => {
    const answer = document.getElementById('answer').value;
    const question = document.getElementById('question').textContent;
    context[question] = answer;
    
    document.getElementById('answer').value = '';
    await sendContext();
});

async function startContextualization() {
    const response = await fetch('http://localhost:5000/contextualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: currentDomain, context })
    });
    
    if (response.ok) {
        analyzeCurrentTab();
    }
}

async function sendContext() {
    const response = await fetch('http://localhost:5000/contextualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: currentDomain, context })
    });
    
    if (response.ok) {
        analyzeCurrentTab();
    }
}

async function analyzeCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            url: tab.url,
            domain: currentDomain
        })
    });
    
    const data = await response.json();
    
    document.getElementById('contextQuestions').classList.add('hidden');
    document.getElementById('analysisResult').classList.remove('hidden');
    
    const resultDiv = document.getElementById('result');
    resultDiv.textContent = data.isProductive ? 'This website is productive!' : 'This website is not productive.';
    resultDiv.className = 'result ' + (data.isProductive ? 'productive' : 'not-productive');
}
