class BackgroundCarousel {
    constructor() {
        this.container = document.querySelector('.background-carousel');
        this.currentIndex = 0;
        this.transitionTime = 10000; // 10 seconds between transitions
        this.fadeTime = 1000; // 1 second fade duration
        this.localImages = [];
        this.loadedImages = new Map();
        this.fallbackGradient = 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)';

        if (!this.container) {
            this.setFallbackBackground();
            return;
        }

        this.fetchImageList().then(() => {
            if (this.localImages.length > 0) {
                this.preloadImages();
                this.initialize();
            } else {
                this.setFallbackBackground();
            }
        });
    }

    setFallbackBackground() {
        if (this.container) {
            this.container.style.background = this.fallbackGradient;
        }
    }

    preloadImages() {
        this.localImages.forEach(src => {
            const img = new Image();
            img.onload = () => this.loadedImages.set(src, true);
            img.onerror = () => this.loadedImages.set(src, false);
            img.src = src;
        });
    }

    getBackgroundImage(src) {
        return this.loadedImages.get(src) ? `url(${src})` : this.fallbackGradient;
    }

    async fetchImageList() {
        try {
            const response = await fetch('/api/images');
            const data = await response.json();
            
            if (!data.error && data.images && Array.isArray(data.images)) {
                const newImages = data.images.map(img => `/static/images/${img}`);
                
                // Check if image list has changed
                const hasNewImages = newImages.length !== this.localImages.length ||
                    newImages.some(img => !this.localImages.includes(img));
                
                if (hasNewImages) {
                    this.localImages = newImages;
                    // Reinitialize carousel if new images are found
                    this.preloadImages();
                    if (this.bg1) {
                        this.currentIndex = 0;
                        this.bg1.style.backgroundImage = this.getBackgroundImage(this.localImages[0]);
                        this.bg1.style.opacity = 1;
                        this.bg2.style.opacity = 0;
                    } else {
                        this.initialize();
                    }
                }
            } else {
                this.setFallbackBackground();
            }
        } catch (error) {
            this.setFallbackBackground();
        }
    }

    initialize() {
        // Create two background elements for cross-fade
        this.bg1 = document.createElement('div');
        this.bg2 = document.createElement('div');

        const commonStyle = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: `opacity ${this.fadeTime}ms ease-in-out`
        };

        Object.assign(this.bg1.style, commonStyle);
        Object.assign(this.bg2.style, commonStyle);

        this.container.appendChild(this.bg1);
        this.container.appendChild(this.bg2);

        // Set initial background
        if (this.localImages.length > 0) {
            this.bg1.style.backgroundImage = this.getBackgroundImage(this.localImages[0]);
            this.bg1.style.opacity = 1;
            this.bg2.style.opacity = 0;
            this.startCarousel();
        } else {
            this.bg1.style.backgroundImage = this.fallbackGradient;
            this.bg1.style.opacity = 1;
        }
    }

    startCarousel() {
        if (this.localImages.length <= 1) return;
        
        setInterval(() => {
            this.transition();
        }, this.transitionTime);
    }

    transition() {
        if (this.localImages.length <= 1) return;
        
        const nextIndex = (this.currentIndex + 1) % this.localImages.length;
        const activeElement = this.bg1.style.opacity === '1' ? this.bg1 : this.bg2;
        const inactiveElement = this.bg1.style.opacity === '0' ? this.bg1 : this.bg2;

        // Set the new background image
        inactiveElement.style.backgroundImage = this.getBackgroundImage(this.localImages[nextIndex]);
        
        // Perform the cross-fade
        activeElement.style.opacity = 0;
        inactiveElement.style.opacity = 1;

        this.currentIndex = nextIndex;
    }
}

// Initialize carousel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BackgroundCarousel();
});
