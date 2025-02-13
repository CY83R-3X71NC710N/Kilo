document.addEventListener('DOMContentLoaded', () => {
    const frame = document.getElementById('popup-frame');
    const loading = document.getElementById('loading');
    let retryCount = 0;
    const MAX_RETRIES = 3;

    // Function to handle loading state
    function handleFrameLoad() {
        console.log('Frame load event triggered');
        setTimeout(() => {
            frame.classList.add('iframe-loaded');
            frame.style.opacity = '1';
            loading.style.opacity = '0';
            setTimeout(() => {
                loading.style.display = 'none';
            }, 300);
        }, 500);
    }

    // Function to handle loading error
    function handleFrameError(error) {
        console.log('Handling error:', error, 'Retry count:', retryCount);
        
        if (retryCount < MAX_RETRIES) {
            loading.innerHTML = `Connection error. Retrying... (${retryCount + 1}/${MAX_RETRIES})<br>
                               <small>Make sure Flask server is running on port 5000</small>`;
            loading.style.color = '#ff9900';
            retryCount++;
            
            setTimeout(initializeFrame, 2000);
        } else {
            loading.innerHTML = `Failed to connect to server.<br>
                               <small>Please check if Flask server is running on port 5000</small>`;
            loading.style.color = '#ff0000';
        }
    }

    // Initialize frame
    function initializeFrame() {
        try {
            frame.src = `http://localhost:5000/ext-popup?t=${Date.now()}`;
        } catch (error) {
            handleFrameError('Failed to initialize frame');
        }
    }

    // Add event listeners
    frame.addEventListener('load', handleFrameLoad);
    frame.addEventListener('error', () => handleFrameError('Frame failed to load'));

    // Initialize the frame
    initializeFrame();

    // Safety timeout
    setTimeout(() => {
        if (loading.style.display !== 'none') {
            handleFrameError('Connection timeout');
        }
    }, 10000);
});
