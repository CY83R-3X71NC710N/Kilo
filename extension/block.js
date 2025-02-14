// Simplified cursor handling
document.addEventListener('DOMContentLoaded', () => {
    const cursor = document.querySelector('.custom-cursor');
    const ring = document.querySelector('.cursor-ring');
    const dot = document.querySelector('.cursor-dot');

    // Show cursor when mouse moves
    document.addEventListener('mousemove', (e) => {
        cursor.style.display = 'block';
        const x = e.pageX;
        const y = e.pageY;

        ring.style.left = x + 'px';
        ring.style.top = y + 'px';
        dot.style.left = x + 'px';
        dot.style.top = y + 'px';
    });

    // Hide system cursor
    document.body.style.cursor = 'none';
});

// Simplified Matrix rain effect
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('matrixCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const katakana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    const alphabet = katakana + latin + nums;

    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const rainDrops = [];

    for (let x = 0; x < columns; x++) {
        rainDrops[x] = 1;
    }

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0F0';
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < rainDrops.length; i++) {
            const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
            ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);

            if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                rainDrops[i] = 0;
            }
            rainDrops[i]++;
        }
    }

    setInterval(draw, 30);
});


async function updateCountdown() {
    try {
        const params = new URLSearchParams(window.location.search);
        const reason = params.get('reason');

        const { blockData } = await chrome.storage.local.get('blockData');
        const timerElement = document.getElementById('countdown');
        const messageElement = document.getElementById('block-message');
        const timerContainer = document.getElementById('timer-container');

        switch (reason) {
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
