import os
import cv2
import numpy as np
from flask_socketio import SocketIO, emit
import base64
from threading import Thread
import time

import uuid
import logging
import ssl
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import base64
from threading import Thread
import time

# Initialize SocketIO
socketio = SocketIO()
import time
import os
import requests
import logging
from datetime import datetime, date
from flask import Flask, render_template, jsonify, request
from werkzeug.utils import secure_filename

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Weather API configuration
WEATHER_API_KEY = os.environ.get('OPENWEATHERMAP_API_KEY')
WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather'
LAT = '37.7749'  # San Francisco latitude
LON = '-122.4194'  # San Francisco longitude
from datetime import datetime, date
from functools import wraps
from urllib.parse import urlparse, unquote, urlunparse, quote
from werkzeug.utils import secure_filename
from PIL import Image
import certifi
import requests
import pytz
from icalendar import Calendar, Event, vDDDTypes
from flask import Flask, render_template, jsonify, request, flash, redirect, url_for
from flask_socketio import SocketIO, emit
import json
import threading
import time
from requests.exceptions import SSLError, RequestException, ConnectionError

logger = logging.getLogger(__name__)
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

# Initialize Flask app with static folder
static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
if not os.path.exists(static_folder):
    os.makedirs(static_folder)

# Create images folder with proper permissions for Raspberry Pi
images_folder = os.path.join(static_folder, 'images')
try:
    if not os.path.exists(images_folder):
        os.makedirs(images_folder, mode=0o755, exist_ok=True)
    # Ensure proper permissions even if directory already exists
    os.chmod(images_folder, 0o755)
    logger.info(f"Successfully created/verified images folder: {images_folder}")
except Exception as e:
    logger.error(f"Error setting up images folder: {str(e)}")
    raise

# Initialize Flask app
app = Flask(__name__, static_folder=static_folder)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max request size
app.secret_key = os.urandom(24)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Store active WebSocket connections
ws_connections = set()

def get_protect_api():
    """Get UniFi API connection"""
    try:
        from pyunifi.controller import Controller
        import urllib3
        import requests
        from requests.adapters import HTTPAdapter
        from urllib3.poolmanager import PoolManager
        import ssl
        
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        host = os.environ.get('UNIFI_HOST')
        username = os.environ.get('UNIFI_USERNAME')
        password = os.environ.get('UNIFI_PASSWORD')
        port = int(os.environ.get('UNIFI_PORT', '443'))
        
        if not all([host, username, password]):
            logger.error("Missing UniFi credentials in environment variables")
            return None

        class TLSAdapter(HTTPAdapter):
            def init_poolmanager(self, connections, maxsize, block=False):
                ctx = ssl.create_default_context()
                # Support legacy TLS versions
                ctx.options &= ~ssl.OP_NO_TLSv1
                ctx.options &= ~ssl.OP_NO_TLSv1_1
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                self.poolmanager = PoolManager(
                    num_pools=connections,
                    maxsize=maxsize,
                    block=block,
                    ssl_context=ctx
                )

        session = requests.Session()
        adapter = TLSAdapter()
        session.mount('https://', adapter)
        session.verify = False
        
        # Create controller with custom session
        controller = Controller(
            host=host,
            username=username,
            password=password,
            port=port,
            version='UDMP-unifiOS',
            ssl_verify=False
        )
        
        # Update controller session
        controller._session = session
        controller._session.timeout = 30
        
        # Test connection
        sites = controller.get_sites()
        logger.info(f"Successfully connected to UniFi controller, found {len(sites)} sites")
        return controller
    except ImportError as e:
        logger.error(f"Missing required package: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error connecting to UniFi API: {str(e)}")
        return None

def doorbell_event_monitor():
    """Monitor doorbell events in background thread"""
    last_event_time = datetime.now()
    retry_interval = 1
    max_retry_interval = 30
    
    while True:
        try:
            controller = get_protect_api()
            if not controller:
                logger.error("Failed to connect to UniFi controller")
                time.sleep(retry_interval)
                continue
            
            # Get all devices
            try:
                devices = controller.get_devices()
                if not devices:
                    logger.warning("No devices found")
                    time.sleep(retry_interval)
                    continue
                
                # Find the doorbell camera
                doorbell = next((dev for dev in devices if 'G4 Doorbell' in str(dev.get('model', ''))), None)
                
                if not doorbell:
                    logger.warning("No doorbell camera found")
                    time.sleep(retry_interval)
                    continue
            except Exception as e:
                logger.error(f"Error getting devices: {str(e)}")
                time.sleep(retry_interval)
                continue
            
            # Get device events
            try:
                # Get events using the proper API endpoint
                events = controller.get_events(
                    mac=doorbell.get('mac'),
                    limit=10,
                    eventType=['ring', 'motion']
                )
                events_response = {'data': events} if events else None
                current_time = datetime.now()
                
                if events_response and 'data' in events_response:
                    for event in events_response['data']:
                        event_time = datetime.fromtimestamp(event.get('time', 0) / 1000)
                        if event_time > last_event_time:
                            event_type = event.get('type', '').lower()
                            if event_type in ['ring', 'motion']:
                                # Get snapshot using API
                                snapshot_url = None
                                try:
                                    snapshot_response = controller._api_request(
                                        'get', 
                                        f"protect/cameras/{doorbell['id']}/snapshot",
                                        params={'force': 'true'}
                                    )
                                    if snapshot_response:
                                        snapshot_url = f"data:image/jpeg;base64,{snapshot_response}"
                                except Exception as snap_err:
                                    logger.error(f"Error getting snapshot: {snap_err}")
                            
                                event_data = {
                                    'type': event_type,
                                    'timestamp': event_time.isoformat(),
                                    'thumbnail': snapshot_url,
                                    'camera_name': doorbell.get('name', 'Doorbell')
                                }
                                
                                if ws_connections:
                                    socketio.emit('doorbell_event', event_data, broadcast=True)
                                    logger.info(f"Doorbell event emitted: {event_type} from {event_data['camera_name']}")
                
                last_event_time = current_time
                retry_interval = 1  # Reset retry interval on success
            except Exception as e:
                logger.error(f"Error processing doorbell events: {str(e)}")
                retry_interval = min(retry_interval * 2, max_retry_interval)
            
            time.sleep(1)  # Check for events every second
            
        except Exception as e:
            logger.error(f"Error in doorbell event monitor: {str(e)}")
            retry_interval = min(retry_interval * 2, max_retry_interval)  # Exponential backoff
            time.sleep(retry_interval)

@socketio.on('connect')
def handle_connect():
    """Handle new WebSocket connections"""
    ws_connections.add(request.sid)
    logger.info(f"New WebSocket connection: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnections"""
    if request.sid in ws_connections:
        ws_connections.remove(request.sid)
    logger.info(f"WebSocket disconnected: {request.sid}")

# Start doorbell event monitor in background thread
doorbell_thread = threading.Thread(target=doorbell_event_monitor, daemon=True)
doorbell_thread.start()

# Set default umask for new files
os.umask(0o022)

# Ensure static directory exists with proper permissions
def ensure_static_directory():
    """Ensure static directory exists with proper permissions"""
    try:
        # Create base static directory if it doesn't exist
        if not os.path.exists(static_folder):
            os.makedirs(static_folder, mode=0o755)
            logger.info(f"Created static folder: {static_folder}")
        
        # Create images directory if it doesn't exist
        images_dir = os.path.join(static_folder, 'images')
        if not os.path.exists(images_dir):
            os.makedirs(images_dir, mode=0o775)
            logger.info(f"Created images folder: {images_dir}")
        
        # Set proper permissions
        os.chmod(static_folder, 0o755)
        os.chmod(images_dir, 0o775)
        
        logger.info("Static directory permissions verified")
    except Exception as e:
        logger.error(f"Error setting up static directory: {str(e)}")
        raise

# Initialize static directory
ensure_static_directory()
@app.errorhandler(413)
def request_entity_too_large(error):
    flash('File too large! Maximum total upload size is 50MB', 'danger')
    return redirect(url_for('upload_photo'))

logger.info(f"Initialized Flask app with static folder: {static_folder}")

# Configure default SSL context
default_ssl_context = ssl.create_default_context(cafile=certifi.where())

# Weather API configuration
WEATHER_API_KEY = os.environ.get('OPENWEATHERMAP_API_KEY', '').strip()
WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather"
# Coordinates for Minden, NV 89423
LAT = 39.050621476386205
LON = -119.7448038956499

# iCal Feed configuration
ICAL_FEED_URL = os.environ.get('ICAL_FEED_URL', '').strip()

@app.after_request
def after_request(response):
    """Add CORS headers to all responses"""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

@app.route('/health')
def health_check():
    """Enhanced health check endpoint"""
    try:
        weather_response = requests.get(
            WEATHER_API_URL,
            params={'lat': LAT, 'lon': LON, 'appid': WEATHER_API_KEY},
            timeout=5
        )
        weather_response.raise_for_status()
        logger.info("Health check performed")
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'apis': {
                'weather': 'connected',
                'calendar': ICAL_FEED_URL is not None
            }
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 503

def convert_webcal_to_https(url):
    """Convert webcal:// URLs to https:// with proper URL encoding"""
    try:
        if not url:
            logger.error("Empty URL provided")
            return None

        parsed = urlparse(unquote(url))
        if not parsed.scheme or parsed.scheme not in ['webcal', 'http', 'https']:
            logger.error(f"Invalid URL scheme: {parsed.scheme}")
            return None

        new_scheme = 'https' if parsed.scheme == 'webcal' else parsed.scheme
        encoded_path = '/' + '/'.join([quote(p, safe='@/') for p in parsed.path.split('/') if p])
        encoded_query = '&'.join([quote(k) + '=' + quote(v) for k, v in (q.split('=') for q in parsed.query.split('&'))]) if parsed.query else ''

        return urlunparse(parsed._replace(scheme=new_scheme, path=encoded_path, query=encoded_query))
    except Exception as e:
        logger.error(f"Error converting URL: {str(e)}")
        return None

def rate_limit_decorator(min_interval=1):
    """Ensure minimum interval between API calls"""
    last_call_time = {}
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            current_time = time.time()
            if func.__name__ in last_call_time:
                elapsed = current_time - last_call_time[func.__name__]
                if elapsed < min_interval:
                    return jsonify({
                        'error': 'Too many requests. Please wait before retrying.',
                        'retry_after': min_interval - elapsed
                    }), 429
            last_call_time[func.__name__] = current_time
            return func(*args, **kwargs)
        return wrapper
    return decorator

@app.route('/api/images')
def get_images():
    """Return a list of all images in the static/images directory"""
    try:
        image_dir = os.path.join(str(app.static_folder), 'images')
        images = [f for f in os.listdir(image_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        return jsonify({'images': sorted(images)})
    except Exception as e:
        logger.error(f"Error listing images: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['GET', 'POST'])
def upload_photo():
    if request.method == 'POST':
        if 'photos' not in request.files:
            flash('No files selected', 'danger')
            return redirect(request.url)
        
        photos = request.files.getlist('photos')
        if not photos:
            flash('No files selected', 'danger')
            return redirect(request.url)
        
        success_count = 0
        error_count = 0
        
        for photo in photos:
            if not photo.filename:
                continue
            
            filepath = None
            try:
                if not photo.filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    error_count += 1
                    flash(f"Skipped {photo.filename}: Only JPEG/JPG/PNG files are allowed", "warning")
                    continue
                
                # Generate unique filename preserving original extension
                ext = os.path.splitext(photo.filename)[1].lower()
                filename = secure_filename(f"{uuid.uuid4().hex}{ext}")
                filepath = os.path.join(images_folder, filename)
                
                # Ensure the images directory exists with proper permissions
                ensure_static_directory()
                
                # Save the original image without modifications
                photo.save(filepath)
                
                # Set proper file permissions (readable by web server)
                try:
                    os.chmod(filepath, 0o644)
                    logger.info(f"Set permissions for {filepath}")
                except Exception as e:
                    logger.error(f"Error setting permissions for {filepath}: {str(e)}")
                    raise PermissionError(f"Failed to set proper permissions for {filepath}")
                
                # Verify the saved file
                with Image.open(filepath) as img:
                    img.verify()
                
                success_count += 1
                logger.info(f"Successfully uploaded and verified: {filename}")
            except IOError as e:
                error_count += 1
                logger.error(f"IO Error processing {photo.filename}: {str(e)}")
                if "Permission denied" in str(e):
                    flash(f"Error uploading {photo.filename}: Permission denied. Please check folder permissions", "danger")
                else:
                    flash(f"Error uploading {photo.filename}: Storage error", "danger")
                if filepath and os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                    except OSError as rm_err:
                        logger.error(f"Error removing invalid file {filepath}: {str(rm_err)}")
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing {photo.filename}: {str(e)}")
                if isinstance(e, PermissionError):
                    flash(f"Error uploading {photo.filename}: Permission denied. Please check folder permissions", "danger")
                else:
                    flash(f"Error uploading {photo.filename}: {str(e)}", "danger")
                if filepath and os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                    except OSError as rm_err:
                        logger.error(f"Error removing invalid file {filepath}: {str(rm_err)}")
        
        if success_count > 0:
            flash(f"Successfully uploaded {success_count} image{'s' if success_count != 1 else ''}", "success")
        if error_count > 0:
            flash(f"Failed to upload {error_count} file{'s' if error_count != 1 else ''}", "danger")
            
    return render_template('upload.html')

@app.route('/config', methods=['GET', 'POST'])
def config():
    """Handle configuration settings"""
    if request.method == 'POST':
        try:
            # Handle UniFi credentials
            unifi_host = request.form.get('unifi_host', '').strip()
            unifi_username = request.form.get('unifi_username', '').strip()
            unifi_password = request.form.get('unifi_password', '').strip()
            unifi_port = request.form.get('unifi_port', '443').strip()
            
            # Validate UniFi credentials
            if any([unifi_host, unifi_username, unifi_password]):
                if not all([unifi_host, unifi_username, unifi_password]):
                    flash('All UniFi credentials are required', 'danger')
                else:
                    try:
                        # Try to convert port to integer
                        port = int(unifi_port)
                        if port <= 0 or port > 65535:
                            raise ValueError("Port must be between 1 and 65535")
                        
                        # Update environment variables
                        os.environ['UNIFI_HOST'] = unifi_host
                        os.environ['UNIFI_USERNAME'] = unifi_username
                        os.environ['UNIFI_PASSWORD'] = unifi_password
                        os.environ['UNIFI_PORT'] = str(port)
                        
                        # Test connection with new credentials
                        controller = get_protect_api()
                        if controller:
                            flash('UniFi credentials updated successfully', 'success')
                        else:
                            flash('Failed to connect to UniFi controller with provided credentials', 'danger')
                    except ValueError as ve:
                        flash(f'Invalid port number: {str(ve)}', 'danger')
                    except Exception as e:
                        logger.error(f"Error testing UniFi credentials: {str(e)}")
                        flash('Error connecting to UniFi controller', 'danger')
            
            # Handle other configuration settings
            weather_api_key = request.form.get('weather_api_key', '').strip()
            calendar_url = request.form.get('calendar_url', '').strip()
            
            if weather_api_key:
                os.environ['OPENWEATHERMAP_API_KEY'] = weather_api_key
                flash('Weather API key updated', 'success')
            
            if calendar_url:
                os.environ['ICAL_FEED_URL'] = calendar_url
                flash('Calendar URL updated', 'success')
            
            return redirect(url_for('config'))
        except Exception as e:
            logger.error(f"Error updating configuration: {str(e)}")
            flash('Error updating configuration', 'danger')
            return redirect(url_for('config'))
    
    # GET request - show current configuration
    return render_template('config.html',
        weather_api_key=bool(os.environ.get('OPENWEATHERMAP_API_KEY')),
        calendar_url=os.environ.get('ICAL_FEED_URL'),
        unifi_host=bool(os.environ.get('UNIFI_HOST')),
        unifi_username=bool(os.environ.get('UNIFI_USERNAME')),
        unifi_password=bool(os.environ.get('UNIFI_PASSWORD')),
        unifi_port=os.environ.get('UNIFI_PORT', '443')
    )
    if request.method == 'POST':
        try:
            # Get form data
            weather_api_key = request.form.get('weather_api_key', '').strip()
            calendar_url = request.form.get('calendar_url', '').strip()
            unifi_host = request.form.get('unifi_host', '').strip()
            unifi_username = request.form.get('unifi_username', '').strip()
            unifi_password = request.form.get('unifi_password', '').strip()
            unifi_port = request.form.get('unifi_port', '').strip()

            # Validate UniFi credentials
            if any([unifi_host, unifi_username, unifi_password, unifi_port]):
                if not all([unifi_host, unifi_username, unifi_password, unifi_port]):
                    flash('All UniFi fields are required if any are provided', 'danger')
                    return redirect(url_for('config'))

                try:
                    port = int(unifi_port)
                    if port <= 0 or port > 65535:
                        raise ValueError("Port must be between 1 and 65535")
                except ValueError:
                    flash('Invalid port number', 'danger')
                    return redirect(url_for('config'))

            # Save to environment variables
            if weather_api_key:
                os.environ['OPENWEATHERMAP_API_KEY'] = weather_api_key
            if calendar_url:
                os.environ['ICAL_FEED_URL'] = calendar_url
            if all([unifi_host, unifi_username, unifi_password, unifi_port]):
                os.environ['UNIFI_HOST'] = unifi_host
                os.environ['UNIFI_USERNAME'] = unifi_username
                os.environ['UNIFI_PASSWORD'] = unifi_password
                os.environ['UNIFI_PORT'] = unifi_port

            flash('Configuration saved successfully', 'success')
            return redirect(url_for('config'))
        except Exception as e:
            logger.error(f"Error saving configuration: {str(e)}")
            flash('Error saving configuration', 'danger')
            return redirect(url_for('config'))

    # Get existing values (masked)
    return render_template('config.html',
                         weather_api_key=bool(os.environ.get('OPENWEATHERMAP_API_KEY')),
                         calendar_url=os.environ.get('ICAL_FEED_URL', ''),
                         unifi_host=bool(os.environ.get('UNIFI_HOST')),
                         unifi_username=bool(os.environ.get('UNIFI_USERNAME')),
                         unifi_password=bool(os.environ.get('UNIFI_PASSWORD')),
                         unifi_port=bool(os.environ.get('UNIFI_PORT')))

@app.route('/api/calendar')
@rate_limit_decorator(min_interval=1)
def get_calendar_events():
    try:
        if not ICAL_FEED_URL:
            logger.info("No calendar feed URL configured")
            return jsonify({'events': [], 'warning': 'Calendar feed not configured'})
        
        feed_url = convert_webcal_to_https(ICAL_FEED_URL)
        if not feed_url:
            logger.info("Invalid calendar feed URL")
            return jsonify({'events': [], 'warning': 'Invalid calendar feed URL'})
        
        logger.info(f"Fetching calendar events from feed")
        response = requests.get(feed_url, timeout=10)
        response.raise_for_status()
        
        calendar = Calendar.from_ical(response.text)
        logger.info("Successfully parsed calendar feed")
        
        events = []
        for component in calendar.walk():
            if component.name == "VEVENT":
                event = parse_ical_event(component, pytz.timezone('America/Los_Angeles'))
                if event:
                    events.append(event)
                    logger.info(f"Parsed event: {event['summary']} on {event['start_date']}")
        
        logger.info(f"Total events parsed: {len(events)}")
        return jsonify({'events': events})
    except Exception as e:
        logger.error(f"Error in calendar endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Import required modules for camera functionality
from utils.motion_detection import MotionDetector, process_frame_for_detection

# Initialize motion detector
motion_detector = MotionDetector()
import base64
import cv2
from threading import Thread
import time
from flask_socketio import SocketIO, emit

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

async def get_protect_api():
    """Get UniFi Protect API connection with proper error handling"""
    required_env_vars = ['UNIFI_HOST', 'UNIFI_USERNAME', 'UNIFI_PASSWORD']
    
    try:
        # Check for required environment variables
        missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
        if missing_vars:
            logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
            return None

        from pyunifiprotect import ProtectApiClient
        from pyunifiprotect.data import WSSubscriptionMessage
        from aiohttp import ClientError
        
        try:
            # Initialize UniFi Protect API client
            nvr = await ProtectApiClient.login(
                host=os.environ['UNIFI_HOST'],
                port=int(os.environ.get('UNIFI_PORT', '443')),
                username=os.environ['UNIFI_USERNAME'],
                password=os.environ['UNIFI_PASSWORD'],
                verify_ssl=False
            )
            
            # Test connection by getting NVR info
            await nvr.update()
            return nvr
            
        except ClientError as ce:
            logger.error(f"Network error connecting to UniFi Protect: {str(ce)}")
            return None
        except Exception as e:
            logger.error(f"Error initializing UniFi Protect client: {str(e)}")
            return None
            
    except ImportError as ie:
        logger.error(f"Required module not found: {str(ie)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in get_protect_api: {str(e)}")
        return None

def get_protect_api_sync():
    """Synchronous wrapper for get_protect_api"""
    import asyncio
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(get_protect_api())
    except Exception as e:
        logger.error(f"Error in get_protect_api_sync: {str(e)}")
        return None
    finally:
        loop.close()

# UniFi Doorbell Camera Routes and WebSocket Events
def get_camera_frame(camera):
    """Get a frame from the camera stream"""
    try:
        ret, frame = camera.read()
        if ret:
            # Encode frame to JPEG
            _, buffer = cv2.imencode('.jpg', frame)
            # Convert to base64 for sending over WebSocket
            frame_data = base64.b64encode(buffer).decode('utf-8')
            return frame_data
        return None
    except Exception as e:
        logger.error(f"Error capturing frame: {str(e)}")
        return None

async def stream_camera(doorbell, socket_id):
    """Stream camera frames over WebSocket using UniFi Protect API"""
    try:
        async for frame in doorbell.get_camera_stream():
            try:
                # Process frame for motion and person detection
                detection_result, message = process_frame_for_detection(frame, motion_detector)
                
                # Convert frame to JPEG
                _, buffer = cv2.imencode('.jpg', frame)
                # Convert to base64
                frame_data = base64.b64encode(buffer).decode('utf-8')
                
                # Create response data
                response_data = {
                    'frame': frame_data,
                    'detection': {
                        'detected': detection_result,
                        'message': message
                    }
                }
                
                # Emit frame and detection results to specific client
                socketio.emit('camera_frame', response_data, room=socket_id)
                
                # If person detected, send additional alert
                if detection_result and 'Person detected' in message:
                    socketio.emit('person_detected', {
                        'timestamp': time.time(),
                        'message': 'Person detected at doorbell camera'
                    }, room=socket_id)
                
                # Control frame rate
                await asyncio.sleep(1/30)  # 30 FPS
                
            except Exception as frame_error:
                logger.error(f"Error processing frame: {str(frame_error)}")
                continue
                
    except Exception as e:
        logger.error(f"Error in camera stream: {str(e)}")
    finally:
        # Cleanup
        try:
            await doorbell.close_camera_stream()
        except Exception as cleanup_error:
            logger.error(f"Error cleaning up camera stream: {str(cleanup_error)}")

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    logger.info("Client connected to camera stream")

@socketio.on('start_stream')
async def handle_start_stream():
    """Start camera stream when requested"""
    try:
        nvr = await get_protect_api()
        if not nvr:
            emit('stream_error', {'message': 'Failed to connect to UniFi controller'})
            return

        # Get doorbell cameras
        doorbells = [cam for cam in nvr.cameras if 'G4 Doorbell' in cam.model]
        if not doorbells:
            emit('stream_error', {'message': 'No doorbell camera found'})
            return

        doorbell = doorbells[0]
        
        # Get socket ID for room-specific streaming
        socket_id = request.sid
        
        # Start streaming in a background task
        asyncio.create_task(stream_camera(doorbell, socket_id))
        emit('stream_started', {'message': 'Camera stream started'})
        
    except Exception as e:
        logger.error(f"Error starting camera stream: {str(e)}")
        emit('stream_error', {'message': str(e)})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    try:
        logger.info("Client disconnected from camera stream")
    except Exception as e:
        logger.error(f"Error in disconnect handler: {str(e)}")

# UniFi Doorbell Camera Routes
@app.route('/api/doorbell/stream')
def get_doorbell_stream():
    """Get the current doorbell camera stream"""
    try:
        controller = get_protect_api()
        if not controller:
            return jsonify({'error': 'Failed to connect to UniFi controller'}), 500
        
        # Get all devices
        devices = controller.get_devices()
        doorbell = next((dev for dev in devices if 'G4 Doorbell' in dev.get('model', '')), None)
        
        if not doorbell:
            logger.error("No doorbell camera found")
            return jsonify({'error': 'No doorbell camera found'}), 404
            
        try:
            # Get RTSP stream URL for the doorbell camera
            # Use controller's port for RTSP stream
            rtsp_port = int(os.environ.get('UNIFI_PORT', 7447))
            stream_url = f"rtsp://{os.environ['UNIFI_USERNAME']}:{os.environ['UNIFI_PASSWORD']}@{os.environ['UNIFI_HOST']}:{rtsp_port}/video/{doorbell['mac']}"
            return jsonify({'stream_url': stream_url})
        except Exception as e:
            logger.error(f"Error getting stream URL: {str(e)}")
            return jsonify({'error': 'Failed to get stream URL'}), 500

    except Exception as e:
        logger.error(f"Error accessing doorbell camera: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/doorbell/answer', methods=['POST'])
async def answer_doorbell():
    """Answer the doorbell ring"""
    try:
        nvr = await get_protect_api()
        if not nvr:
            return jsonify({'error': 'Failed to connect to UniFi controller'}), 500
        
        # Get doorbell camera
        doorbells = [cam for cam in nvr.cameras if 'G4 Doorbell' in cam.model]
        if not doorbells:
            logger.error("No doorbell camera found")
            return jsonify({'error': 'No doorbell camera found'}), 404
            
        doorbell = doorbells[0]
        
        try:
            # Configure doorbell for two-way audio
            await doorbell.set_status_light(True)
            await doorbell.set_mic_volume(100)
            await doorbell.set_speaker_volume(100)
            
            # Start two-way audio session
            await doorbell.start_audio_call()
            
            return jsonify({'status': 'success'})
            
        except Exception as e:
            logger.error(f"Error configuring doorbell: {str(e)}")
            return jsonify({'error': 'Failed to configure doorbell'}), 500
        
    except Exception as e:
        logger.error(f"Error answering doorbell: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        # Ensure proper cleanup
        if 'doorbell' in locals():
            try:
                await doorbell.stop_audio_call()
                await doorbell.set_status_light(False)
            except Exception as cleanup_error:
                logger.error(f"Error in doorbell cleanup: {str(cleanup_error)}")

@app.route('/api/weather')
@rate_limit_decorator(min_interval=1)
def get_weather():
    """Get current weather data for configured location"""
    try:
        if not WEATHER_API_KEY:
            logger.error("No weather API key configured")
            return jsonify({'error': 'Weather API not configured'}), 503

        params = {
            'lat': LAT,
            'lon': LON,
            'appid': WEATHER_API_KEY,
            'units': 'imperial'  # Use Fahrenheit for temperature
        }

        logger.info("Fetching weather data from OpenWeatherMap API")
        response = requests.get(WEATHER_API_URL, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if 'main' not in data or 'weather' not in data:
            logger.error("Incomplete weather data received")
            return jsonify({'error': 'Invalid weather data received'}), 500
            
        weather_data = {
            'temp': data['main']['temp'],
            'humidity': data['main']['humidity'],
            'description': data['weather'][0]['description'],
            'speed': data['wind']['speed']
        }
        
        logger.info("Successfully fetched weather data")
        return jsonify(weather_data)
        
    except requests.Timeout:
        logger.error("Weather API request timed out")
        return jsonify({'error': 'Request timed out'}), 504
    except requests.RequestException as e:
        logger.error(f"Weather API request failed: {str(e)}")
        return jsonify({'error': 'Failed to fetch weather data'}), 503
    except Exception as e:
        logger.error(f"Unexpected error in weather endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

def parse_ical_event(event, timezone):
    """Parse an iCal event and convert to our format with enhanced WebDAV properties and recurring event support"""
    from dateutil.rrule import rrulestr
    from dateutil.relativedelta import relativedelta
    try:
        start = event.get('dtstart')
        if not start or not hasattr(start, 'dt'):
            logger.error(f"Event missing start date or invalid format: {event.get('summary', 'No Title')}")
            return None

        # Get event summary for logging
        summary = event.get('summary', 'No Title')
        logger.info(f"Processing event: {summary} with start: {start.dt}")
        logger.info(f"Event timezone info: {getattr(start.dt, 'tzinfo', 'No timezone')}")

        # Handle all-day events (don't apply timezone conversion)
        if isinstance(start.dt, date) and not isinstance(start.dt, datetime):
            start_date = start.dt.strftime('%Y-%m-%d')
            logger.info(f"All-day event: {summary} on {start_date}")
            start_time = None
            is_all_day = True
        # Handle events with specific times
        else:
            try:
                # Convert to UTC first if needed
                if hasattr(start.dt, 'tzinfo') and start.dt.tzinfo:
                    # Already has timezone info
                    utc_dt = start.dt.astimezone(pytz.UTC)
                else:
                    # Naive datetime - assume UTC
                    utc_dt = pytz.UTC.localize(start.dt)

                # Convert to target timezone
                local_dt = utc_dt.astimezone(timezone)
                start_date = local_dt.strftime('%Y-%m-%d')
                start_time = local_dt.strftime('%H:%M:%S')
                is_all_day = False

                # Store timezone offset for client-side handling
                tz_offset = local_dt.utcoffset().total_seconds() / 3600

                # Validate parsed date
                parsed_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                today = datetime.now(timezone).date()
                logger.info(f"Comparing event date {parsed_date} with today {today}")

                # Include timezone information in the response
                return {
                    'summary': summary,
                    'start_date': start_date,
                    'start_time': start_time,
                    'is_all_day': is_all_day,
                    'timezone_offset': tz_offset,
                    'location': str(event.get('location', '')),
                    'description': str(event.get('description', '')),
                    'status': str(event.get('status', 'confirmed')),
                    'classification': str(event.get('class', 'public')),
                    'recurrence': bool(event.get('rrule'))
                }

            except Exception as e:
                logger.error(f"Error parsing datetime for event {summary}: {str(e)}")
                return None
            
        # Process end datetime
        end = event.get('dtend')
        end_date, end_time = None, None
        if isinstance(end, vDDDTypes):
            end_dt = end.dt
            if isinstance(end_dt, datetime):
                localized_end = end_dt.astimezone(timezone)
                end_date = localized_end.date().strftime('%Y-%m-%d')
                end_time = localized_end.strftime('%H:%M:%S')
            elif isinstance(end_dt, date):
                end_date = end_dt.strftime('%Y-%m-%d')

        # Get additional WebDAV properties
        location = str(event.get('location', ''))
        status = str(event.get('status', '')).upper()
        classification = str(event.get('class', 'PUBLIC')).upper()
        sequence = str(event.get('sequence', '0'))
        created = event.get('created')
        last_modified = event.get('last-modified')
        
        # Process timestamps
        if created and isinstance(created.dt, datetime):
            created = created.dt.astimezone(timezone).isoformat()
        if last_modified and isinstance(last_modified.dt, datetime):
            last_modified = last_modified.dt.astimezone(timezone).isoformat()

        # Handle recurrence rules if present
        rrule = event.get('rrule')
        recurrence = None
        recurring_instances = []

        # Initialize the parsed_event dictionary first
        parsed_event = {
            'date': start_date,  # Add explicit date field for calendar.js
            'summary': str(event.get('summary', 'No Title')),
            'start_date': start_date,
            'start_time': start_time,
            'end_date': end_date,
            'end_time': end_time,
            'description': str(event.get('description', '')),
            'location': location,
            'status': status,
            'classification': classification,
            'sequence': sequence,
            'created': created,
            'last_modified': last_modified,
            'recurrence': None,
            'type': 'external',
            'all_day': isinstance(start.dt, date) if start else False
        }

        if rrule:
            logger.info(f"Processing recurring event: {event.get('summary')} with rule: {rrule}")
            try:
                # Convert RRULE to dateutil format
                rrule_str = f"RRULE:{rrule}"
                rule = rrulestr(rrule_str, dtstart=start.dt)
                
                # Get the next 3 days range
                today = datetime.now(timezone).date()
                until_date = today + relativedelta(days=3)
                
                # Generate instances within the range
                instances = rule.between(
                    datetime.combine(today, datetime.min.time(), tzinfo=timezone),
                    datetime.combine(until_date, datetime.max.time(), tzinfo=timezone),
                    inc=True
                )
                
                # Create event instances
                for instance_dt in instances:
                    instance_start = instance_dt.astimezone(timezone)
                    instance_event = parsed_event.copy()
                    instance_event['start_date'] = instance_start.date().strftime('%Y-%m-%d')
                    if not isinstance(start.dt, date):
                        instance_event['start_time'] = instance_start.strftime('%H:%M:%S')
                    recurring_instances.append(instance_event)
                    logger.info(f"Generated recurring instance for {event.get('summary')} on {instance_event['start_date']}")
            except Exception as e:
                logger.error(f"Error processing recurrence rule for {event.get('summary')}: {str(e)}")

            recurrence = str(rrule)
            parsed_event['recurrence'] = recurrence

        logger.info(f"Successfully parsed event: {parsed_event['summary']}")
        return parsed_event
    except Exception as e:
        logger.error(f"Error parsing event: {str(e)}")
        return None

@app.route('/')
def index():
    return render_template('index.html', current_time=datetime.now().strftime('%H:%M:%S'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
