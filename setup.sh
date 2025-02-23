#!/bin/bash

# MCSOLOL - Minecraft Server One Line Of Linux
# https://github.com/realandi/MCSOLOL

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default values
INSTALL_DIR="/opt/mcserver"
MINECRAFT_PORT=25565
PANEL_PORT=3000
PANEL_DEV_PORT=3001
API_PORT=5000
WS_PORT=8765
RCON_PORT=25575
NODE_VERSION="20.11.1"

# Function to print section headers
print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Function to print status messages
print_status() {
    echo -e "${GREEN}➜${NC} $1"
}

# Function to print warnings
print_warning() {
    echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
}

# Function to print errors
print_error() {
    echo -e "${RED}❌ ERROR:${NC} $1"
}

# Function to check command success
check_command() {
    if [ $? -ne 0 ]; then
        print_error "$1"
        exit 1
    fi
}

# Function to get external IP
get_external_ip() {
    curl -s https://api.ipify.org
}

# Function to generate secure password
generate_password() {
    openssl rand -base64 12 | tr -d '/+=' | cut -c1-12
}

# Welcome message
clear
echo -e "${CYAN}"
cat << "EOF"
 __  __  _____ _____ ____  _      ____  _     
|  \/  |/ ____/ ____/ __ \| |    / __ \| |    
| \  / | |   | (___| |  | | |   | |  | | |    
| |\/| | |    \___ \ |  | | |   | |  | | |    
| |  | | |________) | |__| | |___| |__| | |____
|_|  |_|\_____|____/ \____/|______\____/|______|

EOF
echo -e "${NC}"
echo -e "${BLUE}Minecraft Server One Line Of Linux${NC} - Complete Server Deployment"
echo -e "${GREEN}Starting installation...${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Detect package manager and OS
print_section "System Detection"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$NAME
    OS_VERSION=$VERSION_ID
    print_status "Detected OS: $OS_NAME $OS_VERSION"
fi

if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
    PKG_UPDATE="apt-get update"
    INSTALL_CMD="apt-get install -y"
    print_status "Using apt package manager"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    PKG_UPDATE="yum update -y"
    INSTALL_CMD="yum install -y"
    print_status "Using yum package manager"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    PKG_UPDATE="dnf update -y"
    INSTALL_CMD="dnf install -y"
    print_status "Using dnf package manager"
else
    print_error "No supported package manager found. This script supports apt, yum, and dnf."
    exit 1
fi

# Check system requirements
print_section "System Requirements Check"
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
CPU_CORES=$(nproc)
DISK_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')

print_status "Memory: ${TOTAL_MEM}MB"
print_status "CPU Cores: ${CPU_CORES}"
print_status "Free Disk Space: ${DISK_SPACE}GB"

if [ $TOTAL_MEM -lt 2048 ]; then
    print_warning "Your system has less than 2GB RAM. The Minecraft server may not perform optimally."
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

if [ $DISK_SPACE -lt 10 ]; then
    print_warning "Less than 10GB free disk space available. This might not be sufficient."
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update system and install dependencies
print_section "Installing Dependencies"
print_status "Updating package lists..."
$PKG_UPDATE
check_command "Failed to update package lists"

# Install common dependencies
print_status "Installing common dependencies..."
$INSTALL_CMD curl wget git unzip tar python3 python3-pip python3-venv nginx certbot python3-certbot-nginx
check_command "Failed to install common dependencies"

# Install Java based on distribution
print_status "Installing Java..."
if [ "$PKG_MANAGER" = "apt-get" ]; then
    $INSTALL_CMD default-jre
elif [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
    $INSTALL_CMD java-17-openjdk
fi
check_command "Failed to install Java"

# Install Node.js
print_section "Installing Node.js"
print_status "Installing Node.js ${NODE_VERSION}..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install $NODE_VERSION
nvm use $NODE_VERSION
check_command "Failed to install Node.js"

# Create directory structure
print_section "Creating Directory Structure"
print_status "Setting up directories..."
mkdir -p $INSTALL_DIR/{panel,server,minecraft,backups,logs,ssl,uploads,templates}
mkdir -p $INSTALL_DIR/minecraft/{servers,temp}
chmod 755 $INSTALL_DIR/minecraft/servers
chmod 700 $INSTALL_DIR/minecraft/temp  # Secure temp directory for uploads
check_command "Failed to create directories"

# Set up Python environment
print_section "Setting up Python Environment"
print_status "Creating virtual environment..."
python3 -m venv $INSTALL_DIR/venv
source $INSTALL_DIR/venv/bin/activate
print_status "Installing Python dependencies..."
pip3 install -r requirements.txt
check_command "Failed to install Python dependencies"

# Configure firewall
print_section "Configuring Firewall"
if command -v ufw &> /dev/null; then
    print_status "Configuring UFW firewall..."
    ufw allow $MINECRAFT_PORT/tcp  # Minecraft
    ufw allow 80/tcp               # HTTP
    ufw allow 443/tcp              # HTTPS
    ufw allow $PANEL_PORT/tcp      # Web Panel
    ufw allow $API_PORT/tcp        # API
    ufw allow $WS_PORT/tcp         # WebSocket
    ufw --force enable
elif command -v firewall-cmd &> /dev/null; then
    print_status "Configuring FirewallD..."
    firewall-cmd --permanent --add-port=$MINECRAFT_PORT/tcp
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --permanent --add-port=$PANEL_PORT/tcp
    firewall-cmd --permanent --add-port=$API_PORT/tcp
    firewall-cmd --permanent --add-port=$WS_PORT/tcp
    firewall-cmd --reload
fi

# Set up SSL
print_section "Setting up SSL"
PUBLIC_IP=$(get_external_ip)
DOMAIN=$PUBLIC_IP

# If domain is just an IP, we'll use self-signed certificates
if [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_status "Using self-signed certificate for IP address..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout $INSTALL_DIR/ssl/nginx-selfsigned.key \
        -out $INSTALL_DIR/ssl/nginx-selfsigned.crt \
        -subj "/CN=$PUBLIC_IP"
else
    print_status "Setting up Let's Encrypt SSL..."
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
fi

# Configure Nginx with upload settings
print_section "Configuring Nginx"
print_status "Setting up Nginx reverse proxy..."
cat > /etc/nginx/sites-available/minecraft-panel << EOL
server {
    listen 80;
    server_name \$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl;
    server_name \$DOMAIN;

    ssl_certificate ${INSTALL_DIR}/ssl/nginx-selfsigned.crt;
    ssl_certificate_key ${INSTALL_DIR}/ssl/nginx-selfsigned.key;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # Upload settings
    client_max_body_size 100M;  # Allow large file uploads
    
    # Panel frontend
    location / {
        proxy_pass http://localhost:\${PANEL_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # API backend
    location /api {
        proxy_pass http://localhost:\${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Upload settings
        client_body_temp_path ${INSTALL_DIR}/minecraft/temp;
        client_body_buffer_size 128k;
        client_max_body_size 100M;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:\${WS_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }
}
EOL

# Create systemd service with proper environment
cat > /etc/systemd/system/mcapi.service << EOL
[Unit]
Description=Minecraft Control Panel API
After=network.target

[Service]
WorkingDirectory=${INSTALL_DIR}/server
User=root
Group=root
Environment=PYTHONPATH=${INSTALL_DIR}
Environment=MCSERVER_ROOT=${INSTALL_DIR}/minecraft
Environment=MCSERVER_TEMPLATES=${INSTALL_DIR}/templates
Environment=MCSERVER_UPLOADS=${INSTALL_DIR}/uploads
Environment=MCSERVER_LOGS=${INSTALL_DIR}/logs
Type=simple
ExecStart=${INSTALL_DIR}/venv/bin/python3 app/main.py
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOL

# Set proper permissions
print_section "Setting Permissions"
print_status "Setting up secure permissions..."
chown -R root:root $INSTALL_DIR
chmod -R 755 $INSTALL_DIR/minecraft/servers
chmod -R 700 $INSTALL_DIR/minecraft/temp
chmod 600 $INSTALL_DIR/config/credentials.json
chmod -R 755 $INSTALL_DIR/panel
chmod -R 755 $INSTALL_DIR/server

# Create default configuration
print_section "Creating Configuration"
print_status "Setting up default configuration..."
cat > $INSTALL_DIR/config/server.conf << EOL
# Server configuration
MAX_UPLOAD_SIZE=100M
ALLOWED_EXTENSIONS=jar,zip
TEMP_UPLOAD_DIR=${INSTALL_DIR}/minecraft/temp
TEMPLATE_DIR=${INSTALL_DIR}/templates
MAX_SERVERS=10
BACKUP_RETENTION_DAYS=7
EOL

# Download and configure Minecraft server
print_section "Setting up Minecraft Server"
cd $INSTALL_DIR/minecraft

print_status "Downloading latest Minecraft server..."
LATEST_VERSION=$(curl -s https://launchermeta.mojang.com/mc/game/version_manifest.json | python3 -c "import sys, json; print(json.load(sys.stdin)['latest']['release'])")
VERSION_MANIFEST=$(curl -s https://launchermeta.mojang.com/mc/game/version_manifest.json)
SERVER_URL=$(echo $VERSION_MANIFEST | python3 -c "import sys, json; latest_version='$LATEST_VERSION'; data=json.load(sys.stdin); version_url = next(v['url'] for v in data['versions'] if v['id'] == latest_version); version_data=json.loads(__import__('urllib.request').request.urlopen(version_url).read()); print(version_data['downloads']['server']['url'])")
curl -o server.jar $SERVER_URL
check_command "Failed to download Minecraft server"

print_status "Configuring Minecraft server..."
# Generate RCON password
RCON_PASSWORD=$(generate_password)

# Create server.properties with optimized settings
cat > server.properties << EOL
server-port=${MINECRAFT_PORT}
enable-rcon=true
rcon.port=${RCON_PORT}
rcon.password=${RCON_PASSWORD}
view-distance=10
max-players=20
difficulty=normal
spawn-protection=16
max-world-size=29999984
network-compression-threshold=256
EOL

# Create optimized start script
cat > start.sh << EOL
#!/bin/bash
java -Xms1G -Xmx${TOTAL_MEM}M \\
    -XX:+UseG1GC \\
    -XX:+ParallelRefProcEnabled \\
    -XX:MaxGCPauseMillis=200 \\
    -XX:+UnlockExperimentalVMOptions \\
    -XX:+DisableExplicitGC \\
    -XX:+AlwaysPreTouch \\
    -XX:G1NewSizePercent=30 \\
    -XX:G1MaxNewSizePercent=40 \\
    -XX:G1HeapRegionSize=8M \\
    -XX:G1ReservePercent=20 \\
    -XX:G1HeapWastePercent=5 \\
    -XX:G1MixedGCCountTarget=4 \\
    -XX:InitiatingHeapOccupancyPercent=15 \\
    -XX:G1MixedGCLiveThresholdPercent=90 \\
    -XX:G1RSetUpdatingPauseTimePercent=5 \\
    -XX:SurvivorRatio=32 \\
    -XX:+PerfDisableSharedMem \\
    -XX:MaxTenuringThreshold=1 \\
    -jar server.jar nogui
EOL
chmod +x start.sh

# Accept EULA
echo "eula=true" > eula.txt

# Generate admin credentials
ADMIN_USERNAME="admin"
ADMIN_PASSWORD=$(generate_password)

# Save credentials securely
mkdir -p $INSTALL_DIR/config
cat > $INSTALL_DIR/config/credentials.json << EOL
{
    "admin_username": "${ADMIN_USERNAME}",
    "admin_password": "${ADMIN_PASSWORD}",
    "rcon_password": "${RCON_PASSWORD}"
}
EOL
chmod 600 $INSTALL_DIR/config/credentials.json

# Create systemd services
print_section "Creating System Services"

# Minecraft service
cat > /etc/systemd/system/minecraft.service << EOL
[Unit]
Description=Minecraft Server
After=network.target

[Service]
WorkingDirectory=${INSTALL_DIR}/minecraft
User=root
Group=root
Type=simple
ExecStart=/bin/bash start.sh
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOL

# Panel service
cat > /etc/systemd/system/mcpanel.service << EOL
[Unit]
Description=Minecraft Control Panel
After=network.target

[Service]
WorkingDirectory=${INSTALL_DIR}/panel
User=root
Group=root
Environment=NODE_ENV=production
Type=simple
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd and enable services
systemctl daemon-reload
systemctl enable minecraft mcpanel mcapi
systemctl start minecraft mcpanel mcapi

# Final setup
print_section "Final Setup"
print_status "Starting services..."

# Wait for services to start
sleep 5

# Success message
clear
echo -e "${GREEN}"
cat << "EOF"
 _____ _    _  _____ _____ _____ _____ _____ _ 
/  ___| |  | |/  __ \_   _/  ___/  ___/  ___| |
\ `--.| |  | || /  \/ | | \ `--.\ `--.\ `--.| |
 `--. \ |/\| || |     | |  `--. \`--. \`--. \ |
/\__/ /\  /\  / \__/\_| |_/\__/ /\__/ /\__/ / |
\____/  \/  \/ \____/\___/\____/\____/\____/|_|

EOF
echo -e "${NC}"

echo -e "\n${BLUE}🎮 Minecraft Server + Web Panel Successfully Installed!${NC}"
echo -e "\n${GREEN}Access Information:${NC}"
echo -e "📊 Dashboard URL: ${YELLOW}https://$DOMAIN${NC}"
echo -e "🎮 Minecraft Server: ${YELLOW}$DOMAIN:$MINECRAFT_PORT${NC}"
echo -e "\n${GREEN}Login Credentials:${NC}"
echo -e "👤 Username: ${YELLOW}$ADMIN_USERNAME${NC}"
echo -e "🔑 Password: ${YELLOW}$ADMIN_PASSWORD${NC}"

echo -e "\n${RED}⚠️  IMPORTANT:${NC}"
echo -e "1. Save these credentials and change the password after first login"
echo -e "2. Maximum upload size is set to 100MB"
echo -e "3. Server files are stored in: ${INSTALL_DIR}/minecraft/servers"
echo -e "4. Temporary uploads are automatically cleaned up"
echo -e "5. Check logs in ${INSTALL_DIR}/logs for any issues"

echo -e "\n${GREEN}Management Commands:${NC}"
echo -e "▶️  Start server:    ${YELLOW}systemctl start minecraft${NC}"
echo -e "⏹️  Stop server:     ${YELLOW}systemctl stop minecraft${NC}"
echo -e "🔄 Restart server:  ${YELLOW}systemctl restart minecraft${NC}"
echo -e "📊 Server status:   ${YELLOW}systemctl status minecraft${NC}"

echo -e "\n${BLUE}Need help? Visit: https://github.com/realandi/MCSOLOL/wiki${NC}"

# Add log rotation configuration
print_section "Configuring Log Rotation"
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/minecraft << EOL
${INSTALL_DIR}/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
EOL

# Add cleanup cron job
print_section "Setting up Maintenance Tasks"
print_status "Creating cleanup script..."
cat > ${INSTALL_DIR}/scripts/cleanup.sh << EOL
#!/bin/bash
# Cleanup temporary files
find ${INSTALL_DIR}/minecraft/temp -type f -mtime +1 -delete
# Cleanup old logs
find ${INSTALL_DIR}/logs -type f -name "*.log.*" -mtime +7 -delete
# Cleanup old backups
find ${INSTALL_DIR}/backups -type f -mtime +${BACKUP_RETENTION_DAYS} -delete
EOL
chmod +x ${INSTALL_DIR}/scripts/cleanup.sh

# Add backup script
print_status "Creating backup script..."
cat > ${INSTALL_DIR}/scripts/backup.sh << EOL
#!/bin/bash
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
cd ${INSTALL_DIR}/minecraft/servers
for server in */; do
    if [ -d "\$server" ]; then
        server=\${server%/}
        # Check if server is running
        if ! systemctl is-active --quiet minecraft@\$server; then
            tar -czf ${INSTALL_DIR}/backups/\${server}_\${TIMESTAMP}.tar.gz \$server
        else
            echo "Skipping \$server - server is running"
        fi
    fi
done
EOL
chmod +x ${INSTALL_DIR}/scripts/backup.sh

# Add cron jobs
print_status "Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 */6 * * * ${INSTALL_DIR}/scripts/cleanup.sh") | crontab -
(crontab -l 2>/dev/null; echo "0 3 * * * ${INSTALL_DIR}/scripts/backup.sh") | crontab -

# Update systemd service for production
cat > /etc/systemd/system/minecraft@.service << EOL
[Unit]
Description=Minecraft Server %i
After=network.target

[Service]
WorkingDirectory=${INSTALL_DIR}/minecraft/servers/%i
User=root
Group=root
Type=simple
ExecStart=/bin/bash start.sh
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOL

# Update API service for production
cat > /etc/systemd/system/mcapi.service << EOL
[Unit]
Description=Minecraft Control Panel API
After=network.target

[Service]
WorkingDirectory=${INSTALL_DIR}/server
User=root
Group=root
Environment=PYTHONPATH=${INSTALL_DIR}
Environment=MCSERVER_ROOT=${INSTALL_DIR}/minecraft
Environment=MCSERVER_TEMPLATES=${INSTALL_DIR}/templates
Environment=MCSERVER_UPLOADS=${INSTALL_DIR}/uploads
Environment=MCSERVER_LOGS=${INSTALL_DIR}/logs
Environment=NODE_ENV=production
Type=simple
ExecStart=${INSTALL_DIR}/venv/bin/python3 app/main.py
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOL

# Update panel service for production
cat > /etc/systemd/system/mcpanel.service << EOL
[Unit]
Description=Minecraft Control Panel
After=network.target

[Service]
WorkingDirectory=${INSTALL_DIR}/panel
User=root
Group=root
Environment=NODE_ENV=production
Environment=PORT=${PANEL_PORT}
Type=simple
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOL

# Add monitoring script
print_status "Setting up monitoring..."
cat > ${INSTALL_DIR}/scripts/monitor.sh << EOL
#!/bin/bash
# Check disk space
DISK_USAGE=\$(df ${INSTALL_DIR} | awk 'NR==2 {print \$5}' | sed 's/%//')
if [ \$DISK_USAGE -gt 90 ]; then
    echo "Warning: Disk usage is at \${DISK_USAGE}%" | mail -s "MCSOLOL: High Disk Usage" root
fi

# Check service status
for service in minecraft@* mcapi mcpanel; do
    if ! systemctl is-active --quiet \$service; then
        echo "Warning: \$service is not running" | mail -s "MCSOLOL: Service Down" root
    fi
done
EOL
chmod +x ${INSTALL_DIR}/scripts/monitor.sh

# Add monitor to cron
(crontab -l 2>/dev/null; echo "*/5 * * * * ${INSTALL_DIR}/scripts/monitor.sh") | crontab -

# Update success message for production
echo -e "\n${RED}⚠️  IMPORTANT:${NC}"
echo -e "1. Save these credentials and change the password after first login"
echo -e "2. Maximum upload size is set to 100MB"
echo -e "3. Server files are stored in: ${INSTALL_DIR}/minecraft/servers"
echo -e "4. Backups are created daily at 3 AM in ${INSTALL_DIR}/backups"
echo -e "5. Logs are rotated daily and kept for 7 days"
echo -e "6. System monitoring runs every 5 minutes"
echo -e "7. Temporary files are cleaned up every 6 hours"

echo -e "\n${GREEN}Management Commands:${NC}"
echo -e "▶️  Start server:    ${YELLOW}systemctl start minecraft@<server-name>${NC}"
echo -e "⏹️  Stop server:     ${YELLOW}systemctl stop minecraft@<server-name>${NC}"
echo -e "🔄 Restart server:  ${YELLOW}systemctl restart minecraft@<server-name>${NC}"
echo -e "📊 Server status:   ${YELLOW}systemctl status minecraft@<server-name>${NC}"
echo -e "💾 Manual backup:   ${YELLOW}${INSTALL_DIR}/scripts/backup.sh${NC}"

echo -e "\n${BLUE}Need help? Visit: https://github.com/realandi/MCSOLOL/wiki${NC}" 