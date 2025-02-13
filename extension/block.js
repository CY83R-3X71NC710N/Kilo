async function updateCountdown() {
    try {
        const params = new URLSearchParams(window.location.search);
        const reason = params.get('reason');
        
        const { blockData } = await chrome.storage.local.get('blockData');
        const timerElement = document.getElementById('countdown');
        const messageElement = document.getElementById('block-message');
        const timerContainer = document.getElementById('timer-container');

        switch(reason) {
            case 'analyzing':
                messageElement.textContent = 'Analyzing website productivity... Please wait.';
                timerContainer.style.display = 'none';
                document.querySelector('.block-message').style.backgroundColor = '#FFF3CD';
                // Auto-refresh analyzing page after 5 seconds to prevent getting stuck
                setTimeout(() => window.location.reload(), 5000);
                break;
            case 'blocked':
                if (blockData?.endTime) {
                    messageElement.textContent = 'This site has been blocked as it is not productive for your current task.';
                    timerContainer.style.display = 'block';
                    document.querySelector('.block-message').style.backgroundColor = '#FFB6C1';
                    
                    const remaining = Math.max(0, blockData.endTime - Date.now());
                    if (remaining <= 0) {
                        window.location.reload();
                        return;
                    }
                    
                    const hours = Math.floor(remaining / 3600000);
                    const minutes = Math.floor((remaining % 3600000) / 60000);
                    const seconds = Math.floor((remaining % 60000) / 1000);
                    
                    timerElement.textContent = 
                        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
                break;
            case 'no-session':
                messageElement.textContent = 'Please start a productivity session to use the browser';
                timerContainer.style.display = 'none';
                document.querySelector('.block-message').style.backgroundColor = '#F8F9FA';
                break;
        }
    } catch (error) {
        console.error('Error updating countdown:', error);
    }
}

setInterval(updateCountdown, 1000);
updateCountdown();
