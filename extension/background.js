chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
});
