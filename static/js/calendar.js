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
            // Input validation
            if (!dateStr || typeof dateStr !== 'string') {
                console.warn('Invalid or missing date string:', dateStr);
                return null;
            }

            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
            const dateMatch = dateStr.match(dateRegex);
            if (!dateMatch) {
                console.warn(`Invalid date format: ${dateStr}`);
                return null;
            }

            // Extract and validate date components
            const [_, yearStr, monthStr, dayStr] = dateMatch;
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10) - 1; // JS months are 0-based
            const day = parseInt(dayStr, 10);

            // Validate date range
            if (year < 1900 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) {
                console.warn('Date components out of valid range:', { year, month: month + 1, day });
                return null;
            }

            if (timeStr) {
                // Validate time string
                if (typeof timeStr !== 'string') {
                    console.warn('Invalid time string type:', typeof timeStr);
                    return null;
                }

                // Validate time format (HH:mm:ss)
                const timeRegex = /^(\d{2}):(\d{2}):(\d{2})$/;
                const timeMatch = timeStr.match(timeRegex);
                if (!timeMatch) {
                    console.warn(`Invalid time format: ${timeStr}`);
                    return null;
                }

                // Extract and validate time components
                const [__, hoursStr, minutesStr, secondsStr] = timeMatch;
                const hours = parseInt(hoursStr, 10);
                const minutes = parseInt(minutesStr, 10);
                const seconds = parseInt(secondsStr, 10);

                // Validate time range
                if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
                    console.warn('Time components out of valid range:', { hours, minutes, seconds });
                    return null;
                }

                try {
                    // Create date in local timezone
                    const date = new Date(year, month, day, hours, minutes, seconds);
                    if (isNaN(date.getTime())) {
                        console.warn('Invalid date created from components');
                        return null;
                    }
                    return date;
                } catch (dateError) {
                    console.error('Error creating date object:', dateError);
                    return null;
                }
            }

            // For all-day events, create date in local timezone
            try {
                const date = new Date(year, month, day);
                if (isNaN(date.getTime())) {
                    console.warn('Invalid all-day date created');
                    return null;
                }
                return date;
            } catch (allDayError) {
                console.error('Error creating all-day date:', allDayError);
                return null;
            }
        } catch (error) {
            console.error('Error in safeParseDateString:', error);
            return null;
        }
    }

    compareEvents(a, b) {
        try {
            // Input validation with detailed type checking
            if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
                console.warn('Invalid event objects provided for comparison:', {
                    eventA: typeof a,
                    eventB: typeof b
                });
                return 0;
            }

            // Validate required date properties with detailed logging
            const validateEventDate = (event, eventName) => {
                if (!event.start_date) {
                    console.warn(`${eventName} missing start_date:`, event);
                    return false;
                }
                if (typeof event.start_date !== 'string') {
                    console.warn(`${eventName} start_date is not a string:`, {
                        type: typeof event.start_date,
                        value: event.start_date
                    });
                    return false;
                }
                if (!/^\d{4}-\d{2}-\d{2}$/.test(event.start_date)) {
                    console.warn(`${eventName} has invalid date format:`, event.start_date);
                    return false;
                }
                return true;
            };

            if (!validateEventDate(a, 'Event A') || !validateEventDate(b, 'Event B')) {
                return 0;
            }

            // Determine if events are all-day with proper type checking
            const isAllDayA = a.is_all_day === true || (!a.start_time && a.start_time !== '00:00:00');
            const isAllDayB = b.is_all_day === true || (!b.start_time && b.start_time !== '00:00:00');

            // Compare all-day events
            if (isAllDayA && isAllDayB) {
                try {
                    const dateA = this.safeParseDateString(a.start_date);
                    const dateB = this.safeParseDateString(b.start_date);
                    
                    if (!dateA || !dateB || isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
                        console.warn('Invalid parsed dates for all-day events:', {
                            dateA: dateA,
                            dateB: dateB
                        });
                        return 0;
                    }
                    
                    return dateA.getTime() - dateB.getTime();
                } catch (parseError) {
                    console.error('Error parsing all-day event dates:', {
                        error: parseError,
                        eventA: a.start_date,
                        eventB: b.start_date
                    });
                    return 0;
                }
            }

            // Prioritize all-day events
            if (isAllDayA) return -1;
            if (isAllDayB) return 1;

            // Compare events with specific times
            try {
                // Validate time format
                const validateEventTime = (event, eventName) => {
                    if (!event.start_time || typeof event.start_time !== 'string') {
                        console.warn(`${eventName} missing or invalid start_time:`, event);
                        return false;
                    }
                    if (!/^\d{2}:\d{2}:\d{2}$/.test(event.start_time)) {
                        console.warn(`${eventName} has invalid time format:`, event.start_time);
                        return false;
                    }
                    return true;
                };

                if (!validateEventTime(a, 'Event A') || !validateEventTime(b, 'Event B')) {
                    return 0;
                }

                const timeA = this.safeParseDateString(a.start_date, a.start_time);
                const timeB = this.safeParseDateString(b.start_date, b.start_time);

                if (!timeA || !timeB || isNaN(timeA.getTime()) || isNaN(timeB.getTime())) {
                    console.warn('Invalid parsed timestamps:', {
                        timeA: timeA?.getTime(),
                        timeB: timeB?.getTime()
                    });
                    return 0;
                }

                return timeA.getTime() - timeB.getTime();
            } catch (timeError) {
                console.error('Error comparing event times:', {
                    error: timeError,
                    eventA: { date: a.start_date, time: a.start_time },
                    eventB: { date: b.start_date, time: b.start_time }
                });
                return 0;
            }
        } catch (error) {
            console.error('Error in compareEvents:', {
                error: error,
                stackTrace: error.stack
            });
            return 0;
        }
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
            
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response data structure');
            }

            if (data.error) {
                console.error('Calendar error:', data.error);
                return;
            }

            if (!Array.isArray(data.events)) {
                console.error('Events data is not an array:', data);
                throw new Error('Invalid events data structure');
            }

            // Clear existing events
            this.events.clear();

            // Process and group events by date
            data.events.forEach((event, index) => {
                // Validate event structure
                if (!event || typeof event !== 'object') {
                    console.warn(`Invalid event at index ${index}:`, event);
                    return;
                }

                // Validate required fields
                const date = event.date || event.start_date;
                if (!date || typeof date !== 'string') {
                    console.warn(`Event missing valid date at index ${index}:`, event);
                    return;
                }

                // Add detailed debug logging
                console.log(`Processing event ${index + 1}/${data.events.length}:`, {
                    summary: event.summary || 'No summary',
                    date: date,
                    start_time: event.start_time || 'No time',
                    is_all_day: !!event.is_all_day
                });

                try {
                    // Validate date format
                    if (!this.safeParseDateString || !this.safeParseDateString(date)) {
                        console.warn(`Invalid date format for event ${index}:`, date);
                        return;
                    }

                    // Group events by date
                    const dateEvents = this.events.get(date) || [];
                    dateEvents.push({
                        ...event,
                        summary: event.summary || 'Untitled Event',
                        description: event.description || '',
                        location: event.location || '',
                        is_all_day: !!event.is_all_day,
                        status: event.status || 'confirmed',
                        classification: event.classification || 'public'
                    });

                    // Sort events for this date
                    try {
                        dateEvents.sort(this.compareEvents.bind(this));
                    } catch (sortError) {
                        console.error(`Error sorting events for date ${date}:`, sortError);
                    }

                    this.events.set(date, dateEvents);
                } catch (processError) {
                    console.error(`Error processing event at index ${index}:`, {
                        error: processError,
                        event: event
                    });
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
        try {
            // Input validation
            if (!events) {
                console.warn('No events provided to generateEventSummary');
                return '';
            }

            // Ensure we have an array to work with
            const eventArray = Array.isArray(events) ? events : [events];
            if (!eventArray.length) {
                console.warn('Empty events array');
                return '';
            }

            return eventArray.map((event, index) => {
                try {
                    // Validate event object
                    if (!event || typeof event !== 'object') {
                        console.warn(`Invalid event object at index ${index}:`, event);
                        return '';
                    }

                    // Initialize time string with fallback
                    let time = '';
                    
                    // Handle start time with detailed validation
                    if (!event.is_all_day && event.start_time && event.start_date) {
                        try {
                            // Validate date and time formats
                            const dateFormatValid = /^\d{4}-\d{2}-\d{2}$/.test(event.start_date);
                            const timeFormatValid = /^\d{2}:\d{2}:\d{2}$/.test(event.start_time);

                            if (!dateFormatValid || !timeFormatValid) {
                                console.warn('Invalid date/time format:', {
                                    date: event.start_date,
                                    time: event.start_time,
                                    dateValid: dateFormatValid,
                                    timeValid: timeFormatValid
                                });
                                return this.createEventHtml(event); // Use default formatting
                            }

                            const dateTime = this.safeParseDateString(
                                event.start_date,
                                event.start_time
                            );
                            
                            if (dateTime && !isNaN(dateTime.getTime())) {
                                try {
                                    time = dateTime.toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    });
                                } catch (formatError) {
                                    console.error('Time formatting error:', formatError);
                                    time = event.start_time.substring(0, 5); // Fallback to HH:mm
                                }
                            } else {
                                console.warn(`Failed to parse date/time for event:`, {
                                    summary: event.summary,
                                    date: event.start_date,
                                    time: event.start_time
                                });
                            }
                        } catch (timeError) {
                            console.error('Time processing error:', {
                                error: timeError,
                                event: event.summary,
                                date: event.start_date,
                                time: event.start_time
                            });
                        }
                    }
                    
                    // Handle end time
                    if (event.end_time && event.end_date) {
                        try {
                            const endDateTime = this.safeParseDateString(
                                event.end_date,
                                event.end_time,
                                event.timezone_offset
                            );
                            
                            if (endDateTime) {
                                endTime = endDateTime.toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit'
                                });
                            }
                        } catch (endTimeError) {
                            console.error('Error formatting end time:', endTimeError);
                        }
                    }
                    
                    // Safely handle event properties
                    const summary = event.summary || 'Untitled Event';
                    const location = event.location ? `📍 ${event.location}` : '';
                    const status = event.status ? `[${event.status}]` : '';
                    const recurrence = event.recurrence ? '🔄' : '';
                    const description = event.description || '';
                    
                    // Create full title with fallbacks
                    const fullTitle = [
                        summary,
                        location,
                        description,
                        status
                    ].filter(Boolean).join('\n');
                    
                    // Determine CSS classes
                    const eventClasses = [
                        'event-content',
                        event.is_all_day ? 'all-day' : '',
                        event.classification ? event.classification.toLowerCase() : 'public'
                    ].filter(Boolean).join(' ');
                    
                    return `
                        <div class="${eventClasses}"
                             data-status="${(event.status || 'confirmed').toLowerCase()}"
                             title="${this.escapeHtml(fullTitle)}">
                            <div class="event-info">
                                <span class="event-text">• ${this.escapeHtml(summary)} ${recurrence}</span>
                                ${location ? `<span class="event-location">${this.escapeHtml(location)}</span>` : ''}
                            </div>
                            <div class="event-time-container">
                                ${time ? 
                                    `<span class="event-time">${this.escapeHtml(time)}</span>` : 
                                    '<span class="all-day-indicator">All Day</span>'}
                            </div>
                        </div>
                    `;
                } catch (eventError) {
                    console.error('Error processing individual event:', eventError);
                    return '';
                }
            }).filter(Boolean).join('');
        } catch (error) {
            console.error('Error in generateEventSummary:', error);
            return '';
        }
    }

    // Helper method to escape HTML special characters
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
