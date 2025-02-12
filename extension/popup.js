let context = {};
let currentDomain = '';

document.getElementById('startContext').addEventListener('click', async () => {
    currentDomain = document.getElementById('domain').value;
    document.getElementById('domainSelect').classList.add('hidden');
    document.getElementById('contextQuestions').classList.remove('hidden');
    await getNextQuestion();
});

document.getElementById('nextQuestion').addEventListener('click', async () => {
    const answer = document.getElementById('answer').value;
    if (!answer.trim()) return;

    const question = document.getElementById('question').textContent;
    context[question] = answer;
    document.getElementById('answer').value = '';
    
    await getNextQuestion();
});

async function getNextQuestion() {
    const response = await fetch('http://localhost:5000/get_question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            domain: currentDomain,
            context: context
        })
    });
    
    const data = await response.json();
    
    if (data.done) {
        // When questions are done, send final context and analyze
        await sendContext();
        return;
    }
    
    document.getElementById('question').textContent = data.question;
}

async function sendContext() {
    const response = await fetch('http://localhost:5000/contextualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            domain: currentDomain, 
            context: context 
        })
    });
    
    if (response.ok) {
        await analyzeCurrentTab();
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
