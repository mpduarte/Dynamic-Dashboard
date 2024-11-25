# Dynamic Dashboard Application

A modern, responsive web-based dashboard featuring widget-based components with glass morphism effects and automated deployment capabilities for Raspberry Pi environments.

## Project Overview

This dynamic dashboard application provides a sleek, modern interface with real-time widgets displaying essential information. The application features a glass morphism UI design, creating a sophisticated, translucent appearance that enhances visual appeal while maintaining functionality.

### Key Features
- Widget-based component architecture
- Glass morphism UI effects
- Automated refresh intervals
- Responsive design
- Automated Raspberry Pi deployment
- Error handling and retry mechanisms

## Features

### Digital Clock Widget
- 12-hour format display
- Real-time updates
- Glass morphism styling
- Clean, modern typography using Inter font

### Weather Widget
- Current temperature display (Fahrenheit)
- Weather conditions description
- Humidity and wind speed information
- 30-minute refresh interval
- Automatic error recovery with exponential backoff

### Calendar Widget
- Three-day event preview
- Chronological event sorting
- 1-hour refresh interval
- Event time display with truncation
- Hover functionality for full text display

### Image Carousel
- Dynamic image loading from static directory
- Smooth transitions (10-second intervals)
- Fallback handling
- Background overlay effects

### Glass Morphism Effects
- Translucent widget backgrounds
- Blur effects
- Modern design aesthetics
- Consistent styling across components

## Tech Stack

### Backend
- Python 3.11
- Flask web framework
- Gevent WSGI server
- Systemd service management

### Frontend
- HTML5/CSS3
- JavaScript (ES6+)
- Bootstrap 5.3
- Font Awesome 6.0

### Server
- Nginx reverse proxy
- Systemd process management

## Installation

### Requirements
- Python 3.11 or higher
- Pip package manager
- Nginx web server
- System dependencies (build-essential)

### Environment Setup
1. Clone the repository:
```bash
git clone [repository-url]
cd dynamic-dashboard
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

### Configuration
1. Create a `.env` file based on `.env.template`:
```bash
cp .env.template .env
```

2. Configure the following environment variables:
```bash
OPENWEATHERMAP_API_KEY=your_api_key_here
ICAL_FEED_URL=your_calendar_url_here
```

## Deployment

### Raspberry Pi Deployment
The application includes an automated deployment script (`deploy_raspberry.sh`) that handles:
- System dependency installation
- Python virtual environment setup
- Application file configuration
- Systemd service setup
- Nginx configuration

To deploy on Raspberry Pi:
1. Copy the deployment files to your Raspberry Pi
2. Make the deployment script executable:
```bash
chmod +x deploy_raspberry.sh
```

3. Run the deployment script with sudo:
```bash
sudo ./deploy_raspberry.sh
```

### Environment Variables
Required environment variables:
- `OPENWEATHERMAP_API_KEY`: API key for weather data
- `ICAL_FEED_URL`: URL for iCloud calendar feed

### Nginx Configuration
The deployment script automatically configures Nginx with:
- Reverse proxy to Flask application
- Static file serving
- SSL configuration (if enabled)
- Cache control headers
- Security headers

## API Integration

### OpenWeatherMap API
- Provides real-time weather data
- Configurable location coordinates
- Imperial unit system (Fahrenheit)
- Rate limiting with exponential backoff

### iCloud Calendar Integration
- Supports webcal:// and https:// protocols
- SSL certificate validation
- Automatic URL encoding
- Error handling for connection issues
- Timezone conversion to America/Los_Angeles

## Usage

### Widget Descriptions

#### Clock Widget
- Displays current time in 12-hour format
- Updates every second
- Maintains consistent display during updates

#### Weather Widget
- Shows temperature, conditions, humidity, and wind speed
- Updates every 30 minutes
- Provides visual feedback during updates
- Displays error states with retry options

#### Calendar Widget
- Shows next three days of events
- Updates hourly
- Chronologically sorts events within each day
- Truncates long event names with ellipsis
- Shows full text on hover

### Refresh Rates
- Clock: Real-time (1-second updates)
- Weather: 30-minute intervals
- Calendar: 1-hour intervals
- Image Carousel: 10-second transitions

### Error Handling
- Automatic retry with exponential backoff
- Visual error state indication
- Fallback content for failed requests
- Detailed error logging
- SSL certificate validation
- Timeout handling for API requests

## Development

### Local Development Setup
1. Clone the repository
2. Install dependencies:
```bash
pip install -r requirements.txt
```
3. Set up environment variables in `.env` file
4. Run the development server:
```bash
python main.py
```

### Code Structure
- `app.py`: Main Flask application with route handlers
- `main.py`: Server initialization and configuration
- `static/`: Static assets (CSS, JavaScript, images)
- `templates/`: HTML templates
- `deploy_raspberry.sh`: Raspberry Pi deployment script

### Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Security
- Rate limiting on API endpoints
- Input validation for file uploads
- Secure file handling
- Environment variable protection
- SSL certificate validation

## Known Issues
- Weather API may experience occasional timeouts
- Calendar sync might be delayed during server maintenance
- Image uploads limited to PNG format

## Support
For questions, bug reports, or feature requests, please open an issue in the repository.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
