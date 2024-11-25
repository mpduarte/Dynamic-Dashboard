class Calendar {
    constructor() {
        this.calendarElement = document.getElementById('calendar-widget');
        this.calendarGridElement = document.querySelector('.calendar-grid');
        this.events = new Map();
        
        this.updateCalendar();
        this.fetchEvents();
        setInterval(() => {
            this.updateCalendar();
            this.fetchEvents();
        }, 1000 * 60 * 60); // Update every hour
    }

    // Helper function to safely parse date string
    safeParseDateString(dateStr, timeStr = null) {
        try {
            // Validate date format (YYYY-MM-DD)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                console.warn(`Invalid date format: ${dateStr}`);
                return null;
            }

            // Split the date string and create a Date object using individual components
            const [year, month, day] = dateStr.split('-').map(Number);
            if (timeStr) {
                // If time is provided, validate time format (HH:mm:ss)
                if (!/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
                    console.warn(`Invalid time format: ${timeStr}`);
                    return null;
                }
                const [hours, minutes, seconds] = timeStr.split(':').map(Number);
                return new Date(year, month - 1, day, hours, minutes, seconds);
            }
            return new Date(year, month - 1, day);
        } catch (error) {
            console.error(`Error parsing date: ${dateStr}`, error);
            return null;
        }
    }

    compareEvents(a, b) {
        // If either event doesn't have a start_time (all-day event), prioritize it
        if (!a.start_time && !b.start_time) {
            // Compare dates for all-day events
            const dateA = this.safeParseDateString(a.start_date);
            const dateB = this.safeParseDateString(b.start_date);
            if (!dateA || !dateB) return 0;
            return dateA.getTime() - dateB.getTime();
        }
        if (!a.start_time) return -1;  // a is all-day, show it first
        if (!b.start_time) return 1;   // b is all-day, show it first

        // For events with specific times, parse date and time separately
        const timeA = this.safeParseDateString(a.start_date, a.start_time);
        const timeB = this.safeParseDateString(b.start_date, b.start_time);
        if (!timeA || !timeB) return 0;
        return timeA.getTime() - timeB.getTime();
    }

    setLoadingState() {
        if (this.calendarGridElement) {
            this.calendarGridElement.innerHTML = `
                <div class="calendar-loading">
                    <div class="loading-spinner"></div>
                    <p>Loading calendar events...</p>
                </div>`;
        }
    }

    async fetchWithRetry(retryCount = 0, maxRetries = 3) {
        const baseDelay = 1000; // 1 second
        const maxDelay = 10000; // 10 seconds
        
        try {
            console.log(`Attempting calendar fetch (attempt ${retryCount + 1}/${maxRetries + 1})`);
            const response = await fetch('/api/calendar');
            console.log(`Calendar API response status: ${response.status}`);
            
            if (response.status === 502) {
                throw new Error('Proxy error (502 Bad Gateway)');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Calendar fetch error (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < maxRetries) {
                const delay = Math.min(Math.pow(2, retryCount) * baseDelay + Math.random() * 1000, maxDelay);
                console.log(`Retrying in ${Math.round(delay/1000)} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetchWithRetry(retryCount + 1, maxRetries);
            }
            throw error;
        }
    }

    async fetchEvents() {
        this.setLoadingState();
        try {
            const data = await this.fetchWithRetry();
            
            if (data.error) {
                console.error('Calendar error:', data.error);
                return;
            }

            // Clear existing events
            this.events.clear();

            // Process and group events by date
            data.events.forEach(event => {
                // Skip invalid events
                if (!event) return;
                
                // Use start_date as fallback if date is not present
                const date = event.date || event.start_date;
                if (!date) {
                    console.warn('Event missing date:', event);
                    return;
                }
                
                // Add debug logging for event processing
                console.log('Processing event:', event.summary, 'for date:', date);

                try {
                    // Validate date format
                    if (!Date.parse(date)) {
                        console.warn('Invalid date format:', date, event);
                        return;
                    }

                    if (this.events.has(date)) {
                        const existingEvents = this.events.get(date);
                        existingEvents.push(event);
                        existingEvents.sort(this.compareEvents);
                    } else {
                        this.events.set(date, [event]);
                    }
                } catch (error) {
                    console.error('Error processing event:', error, event);
                }
            });

            this.updateCalendar();
        } catch (error) {
            console.error('Calendar fetch error:', error);
            this.events.clear();
            let errorMessage = 'Failed to load calendar events';
            let errorDetails = error.message;
            
            if (error.message.includes('502')) {
                errorMessage = 'Calendar server temporarily unavailable';
                errorDetails = 'The server is experiencing heavy load or maintenance. Please try again later.';
            } else if (error.message.includes('SSL')) {
                errorMessage = 'Security verification failed';
                errorDetails = 'There was a problem with the secure connection. Please try again later.';
            }
            
            console.error('Calendar error details:', {
                type: error.name,
                message: error.message,
                stack: error.stack
            });
            
            this.calendarGridElement.innerHTML = `
                <div class="calendar-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${errorMessage}</p>
                    <p class="error-details">${errorDetails}</p>
                    <button onclick="window.location.reload()" class="retry-button">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </div>`;
        }
    }

    getNextThreeDays(date) {
        const dates = [];
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0); // Reset time component
        
        // Add today and next 2 days
        for (let i = 0; i < 3; i++) {
            const nextDate = new Date(startDate);
            nextDate.setDate(startDate.getDate() + i);
            dates.push(nextDate);
        }
        
        return dates;
    }

    generateEventTitle(events) {
        if (!Array.isArray(events)) {
            events = [events];
        }
        return events.map(e => {
            let time = '';
            if (e.start_time) {
                const dateTime = this.safeParseDateString(e.start_date, e.start_time);
                if (dateTime) {
                    try {
                        time = dateTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit'
                        });
                    } catch (err) {
                        console.error('Error formatting time:', err);
                    }
                }
            }
            return `• ${time ? time + ' - ' : ''}${e.summary}`;
        }).join('\n');
    }

    getEventClass(events) {
        if (!Array.isArray(events)) {
            events = [events];
        }
        // If there are multiple events, prioritize 'current' type
        if (events.some(e => e.type === 'current')) return 'current';
        if (events.some(e => e.type === 'external')) return 'external';
        return 'event';
    }

    generateEventSummary(events) {
        if (!Array.isArray(events)) {
            events = [events];
        }
        return events.map(e => {
            let time = '';
            let endTime = '';
            
            if (e.start_time) {
                const dateTime = this.safeParseDateString(e.start_date, e.start_time);
                if (dateTime) {
                    try {
                        time = dateTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit'
                        });
                    } catch (err) {
                        console.error('Error formatting start time:', err);
                    }
                }
            }
            
            if (e.end_time && e.end_date) {
                const endDateTime = this.safeParseDateString(e.end_date, e.end_time);
                if (endDateTime) {
                    try {
                        endTime = endDateTime.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                        });
                    } catch (err) {
                        console.error('Error formatting end time:', err);
                    }
                }
            }
                
            const location = e.location ? `📍 ${e.location}` : '';
            const status = e.status ? `[${e.status}]` : '';
            const recurrence = e.recurrence ? '🔄' : '';
            
            const fullTitle = `${e.summary}\n${location}\n${e.description}${status}`;
            
            return `<div class="event-content ${e.all_day ? 'all-day' : ''} ${e.classification ? e.classification.toLowerCase() : 'public'}" 
                        data-status="${e.status ? e.status.toLowerCase() : 'confirmed'}"
                        title="${fullTitle}">
                <div class="event-info">
                    <span class="event-text">• ${e.summary} ${recurrence}</span>
                    ${location ? `<span class="event-location">${location}</span>` : ''}
                </div>
                <div class="event-time-container">
                    ${time ? `<span class="event-time">${time}</span>` : 
                            '<span class="all-day-indicator">All Day</span>'}
                </div>
            </div>`;
        }).join('');
    }

    generateCalendarGrid(currentDate) {
        const nextThreeDays = this.getNextThreeDays(currentDate);
        let html = '<div class="calendar-grid-body">';

        // Check if there are any events across all days
        const totalEvents = Array.from(this.events.values()).reduce((sum, events) => sum + events.length, 0);
        if (totalEvents === 0) {
            return `
                <div class="calendar-grid-body">
                    <div class="no-events-message">
                        <i class="fas fa-calendar-times"></i>
                        <p>No events scheduled</p>
                    </div>
                </div>`;
        }

        // Add cells for each day
        nextThreeDays.forEach(date => {
            const dateString = date.toISOString().split('T')[0];
            const events = this.events.get(dateString) || [];
            const isToday = date.toDateString() === currentDate.toDateString();
            
            let cellClass = 'grid-cell';
            if (isToday) cellClass += ' today';
            if (events.length > 0) {
                const eventClass = this.getEventClass(events);
                cellClass += ` has-event ${eventClass}`;
            }

            const title = events.length > 0 ? this.generateEventTitle(events) : '';
            const summaryText = events.length > 0 ? this.generateEventSummary(events) : '';
            
            html += `
                <div class="${cellClass}" title="${title}">
                    <div class="date-container">
                        <span class="date-number">
                            <span class="day-name">${date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            <span>${String(date.getDate()).padStart(2, '0')}</span>
                        </span>
                    </div>
                    ${events.length > 0 ? `
                        <div class="event-summary-container">
                            <div class="event-summary">${summaryText}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    updateCalendar() {
        const now = new Date();
        
        // Update month in header
        const monthDisplay = this.calendarElement.querySelector('.calendar-month');
        if (monthDisplay) {
            monthDisplay.textContent = now.toLocaleString('default', { month: 'long' });
        }

        // Update calendar grid
        if (this.calendarGridElement) {
            this.calendarGridElement.innerHTML = this.generateCalendarGrid(now);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Calendar();
});
