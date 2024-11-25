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

### Upload System
- Multiple file upload support (JPEG/PNG formats)
- Maximum total upload size: 50MB
- Per-file size limit: 10MB
- Client-side validation for file types and sizes
- Server-side error handling with informative messages
- Automatic file permission management (755 for directories, 644 for files)
- Secure filename handling
- Upload progress indication
- Batch upload processing
- Proper error states and user feedback

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

### Upload Endpoint Usage

#### Endpoint Details
- URL: `/upload`
- Method: POST
- Content-Type: multipart/form-data

#### File Requirements
- Supported formats: JPEG/JPG and PNG
- Maximum total upload size: 50MB
- Maximum individual file size: 10MB
- Multiple files can be uploaded simultaneously

#### Example Usage
```html
<form action="/upload" method="POST" enctype="multipart/form-data">
    <input type="file" name="photos" accept="image/jpeg,image/png" multiple>
    <button type="submit">Upload</button>
</form>
```

#### Response Handling
- Success: Redirects back to upload page with success message
- Error: Redirects back to upload page with error message

#### Common Error Cases
- File too large (>10MB per file)
- Total upload size exceeds 50MB
- Unsupported file type
- Permission errors
- Storage errors

#### Configuration Settings
- Environment Variables:
  - `MAX_CONTENT_LENGTH`: Maximum total request size (default: 50MB)
  - `UPLOAD_FOLDER`: Custom upload directory path (default: static/images)

- File Permissions:
  - Directories: 755 (rwxr-xr-x)
  - Files: 644 (rw-r--r--)
  - Owner: www-data (web server user)

- Nginx Settings:
  - client_max_body_size: 50M
  - Location block configuration for /upload

- Upload Restrictions:
  - Allowed formats: JPEG/JPG, PNG
  - Maximum individual file size: 10MB
  - Maximum total upload size: 50MB
  - Automatic file type validation
  - Secure filename generation

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
- Upload size restrictions (50MB total, 10MB per file)
- File type validation (JPEG/PNG only)
- Automatic permission management (755 for directories, 644 for files)
- Secure filename generation and handling
- Server-side file validation

## Known Issues
- Weather API may experience occasional timeouts
- Calendar sync might be delayed during server maintenance
- Image uploads limited to PNG and JPG formats

## Version History

Current Version: 1.0.0

### Changelog

#### Version 1.0.0 (2024-11-25)
Initial release with complete feature set:
- Core Features
  * Glass-morphism UI implementation with responsive design
  * Digital clock widget with real-time updates
  * Weather widget with OpenWeatherMap API integration
  * Calendar widget with iCloud WebDAV support
  * Background image carousel with 10-second transitions
  * Multiple image upload system (JPEG/PNG)

- Improvements and Optimizations
  * Enhanced calendar event parsing for WebDAV properties
  * Standardized container widths and styling
  * Implemented responsive breakpoints for all screen sizes
  * Added smooth container transition animations
  * Increased background darkening to 20% for better readability
  * Calendar widget now shows only start time for better clarity

- Upload System Enhancements
  * Support for both JPEG and PNG formats
  * Multiple file upload capability
  * Total upload size limit: 50MB
  * Individual file size limit: 10MB
  * Proper file permissions (755 directories, 644 files)

- Bug Fixes
  * Fixed Invalid Date display in calendar events
  * Resolved missing calendar events issue
  * Fixed upload functionality for Raspberry Pi deployment
  * Corrected calendar widget toLowerCase undefined error
  * Fixed /upload route 404 error
  * Resolved 413 Request Entity Too Large error
  * Fixed static folder permissions
  * Corrected weather widget 404 error
  * Fixed calendar event TypeError issues

- Documentation
  * Comprehensive README with feature documentation
  * Detailed deployment instructions
  * API integration guides
  * Security considerations
  * Configuration settings

## Support
For questions, bug reports, or feature requests, please open an issue in the repository.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
