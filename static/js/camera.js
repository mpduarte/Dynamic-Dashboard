// UniFi Doorbell Camera Widget
let socket;
let canvas;
let ctx;

// Drawing tools for motion detection visualization
const drawTools = {
    init: function() {
        try {
            // Wait for DOM to be ready
            if (!document.getElementById('detection-overlay')) {
                console.error('Detection overlay canvas not found - waiting for DOM');
                return false;
            }

            canvas = document.getElementById('detection-overlay');
            ctx = canvas.getContext('2d');
            
            if (!ctx) {
                console.error('Failed to get canvas context');
                return false;
            }
            
            // Set canvas size to match video feed
            this.resizeCanvas();
            return true;
        } catch (error) {
            console.error('Error initializing drawTools:', error);
            return false;
        }
    },
    
    drawDetectionBox: function(box, label) {
        try {
            if (!ctx || !canvas) {
                console.error('Canvas or context not initialized');
                return;
            }
            
            const { x, y, width, height } = box;
            const isPersonDetection = label.includes('Person');
            
            // Set colors based on detection type
            ctx.strokeStyle = isPersonDetection ? '#00ff00' : '#ff0000';
            ctx.lineWidth = 2;
            
            // Calculate scaled coordinates based on canvas size
            const scaleX = canvas.width / box.originalWidth;
            const scaleY = canvas.height / box.originalHeight;
            
            const scaledX = x * scaleX;
            const scaledY = y * scaleY;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;
            
            // Draw detection box
            ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
            
            // Draw label with background
            ctx.font = '14px Arial';
            const textWidth = ctx.measureText(label).width;
            
            // Draw label background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(scaledX, scaledY - 20, textWidth + 10, 20);
            
            // Draw label text
            ctx.fillStyle = isPersonDetection ? '#00ff00' : '#ff0000';
            ctx.fillText(label, scaledX + 5, scaledY - 5);
        } catch (error) {
            console.error('Error drawing detection box:', error);
        }
    },
    
    clearCanvas: function() {
        try {
            if (!ctx || !canvas) {
                console.error('Canvas or context not initialized');
                return;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } catch (error) {
            console.error('Error clearing canvas:', error);
        }
    },
    
    resizeCanvas: function() {
        try {
            if (!canvas) {
                console.error('Canvas not initialized');
                return;
            }
            const videoFeed = document.getElementById('doorbell-feed');
            if (videoFeed) {
                canvas.width = videoFeed.offsetWidth;
                canvas.height = videoFeed.offsetHeight;
            }
        } catch (error) {
            console.error('Error resizing canvas:', error);
        }
    }
};

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
    
    socket = io(socketUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    });

    socket.on('connect', () => {
        try {
            console.log('Connected to doorbell events');
            document.getElementById('doorbell-widget').style.display = 'none';
            // Initialize canvas after connection
            if (!drawTools.init()) {
                console.warn('DrawTools initialization failed, retrying...');
                setTimeout(() => drawTools.init(), 1000);
            }
            // Start camera stream
            socket.emit('start_stream');
        } catch (error) {
            console.error('Error in connect handler:', error);
        }
    });

    // Handle incoming camera frames with detection
    socket.on('camera_frame', (data) => {
        try {
            // Update video feed
            const videoFeed = document.getElementById('doorbell-feed');
            if (videoFeed && data.frame) {
                videoFeed.src = `data:image/jpeg;base64,${data.frame}`;
            }

            // Clear previous detection overlay
            drawTools.clearCanvas();

            // Draw new detections if any
            if (data.detection && data.detection.detected) {
                // Clear previous detection overlay
                drawTools.clearCanvas();
                
                // Process detection coordinates
                const detectionData = {
                    x: data.detection.x || 0,
                    y: data.detection.y || 0,
                    width: data.detection.width || 100,
                    height: data.detection.height || 100,
                    originalWidth: data.detection.originalWidth || canvas.width,
                    originalHeight: data.detection.originalHeight || canvas.height
                };
                
                // Draw detection box with appropriate label and color based on detection type
                const label = data.detection.message || 'Motion Detected';
                drawTools.drawDetectionBox(detectionData, label);
                
                // Add detection event to event list
                if (label.includes('Person')) {
                    handleDoorbellEvent({
                        timestamp: Date.now(),
                        type: 'Person Detected',
                        message: label
                    });
                }
            }
        } catch (error) {
            console.error('Error handling camera frame:', error);
        }
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
document.addEventListener('DOMContentLoaded', () => {
    // Initialize doorbell widget
    initializeDoorbellWidget();
    
    // Handle window resize
    const resizeHandler = () => {
        if (drawTools) {
            drawTools.resizeCanvas();
        }
    };
    
    window.addEventListener('resize', resizeHandler);
    
    // Handle video feed load event
    const videoFeed = document.getElementById('doorbell-feed');
    if (videoFeed) {
        videoFeed.addEventListener('load', () => {
            // Reinitialize canvas when video feed loads
            drawTools.init();
        });
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.doorbellSocket) {
        window.doorbellSocket.disconnect();
    }
});
