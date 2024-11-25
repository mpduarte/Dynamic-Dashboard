// UniFi Doorbell Camera Widget
let ws;

function initializeDoorbellWidget() {
    const videoFeed = document.getElementById('doorbell-feed');
    const eventsList = document.getElementById('doorbell-events');
    
    // Initialize WebSocket connection for real-time events
    connectWebSocket();
    
    // Set up event listeners for doorbell events
    document.getElementById('doorbell-widget').addEventListener('click', (e) => {
        if (e.target.classList.contains('answer-btn')) {
            answerDoorbell();
        }
    });
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}`;
    
    try {
        const socket = io(socketUrl, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });
    
    socket.on('connect', () => {
        console.log('Connected to doorbell events');
        document.getElementById('doorbell-widget').style.display = 'none';
    });

    socket.on('doorbell_event', (data) => {
        handleDoorbellEvent(data);
        document.getElementById('doorbell-widget').style.display = 'block';
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from doorbell events');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });

    // Store socket reference for cleanup
    window.doorbellSocket = socket;
}

function handleDoorbellEvent(event) {
    const eventsList = document.getElementById('doorbell-events');
    const eventItem = document.createElement('div');
    eventItem.className = 'doorbell-event';
    
    // Add event to list with timestamp
    eventItem.innerHTML = `
        <div class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
        <div class="event-type">${event.type}</div>
        ${event.thumbnail ? `<img src="data:image/jpeg;base64,${event.thumbnail}" alt="Event Thumbnail">` : ''}
    `;
    
    eventsList.insertBefore(eventItem, eventsList.firstChild);
    
    // Keep only last 10 events
    while (eventsList.children.length > 10) {
        eventsList.removeChild(eventsList.lastChild);
    }
    
    // Show notification for new events
    if (event.type === 'ring') {
        showDoorbellNotification();
    }
}

function showDoorbellNotification() {
    const notification = document.createElement('div');
    notification.className = 'doorbell-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h3>Doorbell Ring!</h3>
            <button class="answer-btn">Answer</button>
            <button class="ignore-btn">Ignore</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 30 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 30000);
}

function answerDoorbell() {
    fetch('/api/doorbell/answer', {
        method: 'POST'
    }).then(response => {
        if (!response.ok) {
            throw new Error('Failed to answer doorbell');
        }
    }).catch(error => {
        console.error('Error:', error);
    });
}

// Initialize widget when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDoorbellWidget);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.doorbellSocket) {
        window.doorbellSocket.disconnect();
    }
});
