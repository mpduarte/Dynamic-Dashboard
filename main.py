import eventlet
eventlet.monkey_patch()

import os
import sys
from app import app, socketio

if __name__ == "__main__":
    try:
        port = int(os.environ.get('PORT', 3000))
        with app.app_context():
            socketio.run(app, 
                host='0.0.0.0',  # Allow external access
                port=port,
                debug=False,       # Disable debug in production
                use_reloader=False, # Disable reloader in production
                log_output=True    # Enable logging
            )
    except Exception as e:
        print(f"Error starting server: {e}", file=sys.stderr)
        sys.exit(1)
