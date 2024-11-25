# Add Nginx upload size configuration
echo "client_max_body_size 50M;" > /etc/nginx/conf.d/upload_size.conf
sudo systemctl restart nginx

#!/bin/bash

# Exit on any error
set -e

# Function to print colored messages
print_message() {
    echo -e "\e[1;34m>>> $1\e[0m"
}

print_error() {
    echo -e "\e[1;31m>>> Error: $1\e[0m"
}

print_success() {
    echo -e "\e[1;32m>>> Success: $1\e[0m"
}

# Check if script is run with sudo
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script with sudo"
    exit 1
fi

# Function to prompt for environment variables
setup_environment() {
    print_message "Setting up environment variables..."
    
    read -p "Enter OpenWeatherMap API Key: " WEATHER_API_KEY
    read -p "Enter iCloud Calendar Feed URL: " CALENDAR_URL
    
    # Create .env file
    cat > /opt/dashboard/.env << EOL
OPENWEATHERMAP_API_KEY=${WEATHER_API_KEY}
ICAL_FEED_URL=${CALENDAR_URL}
EOL

    chmod 600 /opt/dashboard/.env
    print_success "Environment variables configured"
}

# Install system dependencies
install_dependencies() {
    print_message "Installing system dependencies..."
    
    apt-get update
    apt-get install -y python3-pip python3-venv python3-dev nginx build-essential
    
    print_success "System dependencies installed"
}

# Set up the application
setup_application() {
    print_message "Setting up application..."
    
    # Create application directory
    mkdir -p /opt/dashboard

    # Check if required files exist
    if [ ! -f "app.py" ] || [ ! -f "requirements.txt" ]; then
        print_error "Application files not found. Please run this script from the application root directory."
        exit 1
    fi

    # Create and activate virtual environment
    python3 -m venv /opt/dashboard/venv

    # Copy application files
    cp -r ./* /opt/dashboard/

    # Install Python dependencies in virtual environment
    /opt/dashboard/venv/bin/pip install -r /opt/dashboard/requirements.txt

    # Set proper permissions
    chown -R www-data:www-data /opt/dashboard
    chmod -R 755 /opt/dashboard
    
    # Set proper permissions for static folder and its subdirectories
    mkdir -p /opt/dashboard/static/images
    mkdir -p /opt/dashboard/static/js
    mkdir -p /opt/dashboard/static/css
    
    # Set ownership to www-data
    chown -R www-data:www-data /opt/dashboard/static
    
    # Set directory permissions (755 for browsing)
    find /opt/dashboard/static -type d -exec chmod 755 {} \;
    
    # Set file permissions (644 for files)
    find /opt/dashboard/static -type f -exec chmod 644 {} \;
    
    # Set specific permissions for upload directory
    chmod 775 /opt/dashboard/static/images
    
    # Verify permissions
    ls -la /opt/dashboard/static
    
    print_success "Application setup completed"
}

# Configure systemd service
setup_systemd() {
    print_message "Configuring systemd service..."
    
    # Create systemd service file
    cat > /etc/systemd/system/dashboard.service << EOL
[Unit]
Description=Dashboard Application
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/dashboard
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=/opt/dashboard/.env
ExecStart=/opt/dashboard/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable dashboard
    systemctl start dashboard
    
    print_success "Systemd service configured"
}

# Configure Nginx
setup_nginx() {
    print_message "Configuring Nginx..."
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/dashboard << EOL
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /static {
        alias /opt/dashboard/static;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOL

    # Enable the site
    ln -sf /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    nginx -t
    
    # Restart Nginx
    systemctl restart nginx
    
    print_success "Nginx configured"
}

# Main deployment process
main() {
    print_message "Starting deployment process..."
    
    install_dependencies
    setup_application
    setup_environment
    setup_systemd
    setup_nginx
    
    print_success "Deployment completed successfully!"
    print_message "You can now access the dashboard at http://localhost"
}

# Run main function
main
