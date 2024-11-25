class DigitalClock {
    constructor() {
        this.clockElement = document.getElementById('digital-clock');
        if (!this.clockElement) {
            console.error('Digital clock element not found');
            return;
        }
        
        // Set initial styles
        this.clockElement.style.fontSize = '2.5rem';
        this.clockElement.style.fontWeight = '500';
        this.clockElement.style.letterSpacing = '2px';
        this.clockElement.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        this.clockElement.style.fontFamily = 'Inter, sans-serif';
        
        // Start the clock
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
    }
    
    updateClock() {
        if (!this.clockElement) return;
        
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12
        
        // Format time string with leading zeros for minutes
        const timeString = `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        
        this.clockElement.textContent = timeString;
    }
}

// Initialize clock when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DigitalClock();
});
