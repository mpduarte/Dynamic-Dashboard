class WeatherWidget {
    constructor() {
        this.widget = document.getElementById('weather-widget');
        if (!this.widget) {
            console.error('Weather widget element not found');
            return;
        }
        this.elements = {
            temp: this.widget.querySelector('.weather-temp'),
            desc: this.widget.querySelector('.weather-desc'),
            humidity: this.widget.querySelector('.weather-details span:first-child'),
            wind: this.widget.querySelector('.weather-details span:last-child')
        };
        
        if (!Object.values(this.elements).every(el => el)) {
            return;
        }
        
        this.updateInterval = 1800000; // Update every 30 minutes
        this.baseRetryDelay = 1000; // Start with 1 second
        this.maxRetryDelay = 30000; // Max retry delay of 30 seconds
        this.maxRetries = 5;
        this.retryCount = 0;
        
        this.setLoadingState();
        setTimeout(() => this.updateWeather(), 1000);
        setInterval(() => this.updateWeather(), this.updateInterval);
    }

    updateElement(element, text, iconClass) {
        if (!element) return;
        
        const icon = document.createElement('i');
        icon.className = `fas ${iconClass}`;
        
        element.textContent = text;
        element.insertAdjacentElement('afterbegin', icon);
    }

    setLoadingState() {
        if (!this.widget || !this.elements) return;
        
        this.elements.temp.textContent = '--°F';
        this.elements.desc.textContent = 'Updating...';
        this.updateElement(this.elements.humidity, ' --%', 'fa-tint');
        this.updateElement(this.elements.wind, ' -- mph', 'fa-wind');
        this.widget.classList.remove('error');
    }

    setErrorState(message) {
        if (!this.widget || !this.elements) return;
        
        this.elements.temp.textContent = '--°F';
        this.elements.desc.textContent = message || 'Weather unavailable';
        this.updateElement(this.elements.humidity, ' --%', 'fa-tint');
        this.updateElement(this.elements.wind, ' -- mph', 'fa-wind');
        this.widget.classList.add('error');
    }

    calculateRetryDelay() {
        return Math.min(
            this.baseRetryDelay * Math.pow(2, this.retryCount) + Math.random() * 1000,
            this.maxRetryDelay
        );
    }

    async updateWeather() {
        if (!this.widget || !this.elements) return;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch('/api/weather', {
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            const requiredFields = ['temp', 'humidity', 'description', 'speed'];
            if (!requiredFields.every(field => data[field] !== undefined)) {
                throw new Error('Incomplete weather data');
            }

            this.elements.temp.textContent = `${Math.round(data.temp)}°F`;
            this.elements.desc.textContent = data.description;
            this.updateElement(this.elements.humidity, ` ${data.humidity}%`, 'fa-tint');
            this.updateElement(this.elements.wind, ` ${Math.round(data.speed)} mph`, 'fa-wind');
            
            this.widget.classList.remove('error');
            this.retryCount = 0;
        } catch (error) {
            if (error.name === 'AbortError') {
                this.setErrorState('Request timeout');
            } else {
                this.setErrorState(error.message);
            }
            
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => this.updateWeather(), this.calculateRetryDelay());
            } else {
                this.retryCount = 0;
            }
        }
    }
}

// Initialize weather widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeatherWidget();
});
