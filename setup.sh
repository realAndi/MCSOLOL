#!/bin/bash

# OneLineMCDeploy - Minecraft Server Deployment Script
# https://github.com/realandi/OneLineMCDeploy

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}OneLineMCDeploy${NC} - Minecraft Server Setup"
echo -e "${GREEN}Starting installation...${NC}"

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
    PKG_UPDATE="apt-get update"
    INSTALL_CMD="apt-get install -y"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    PKG_UPDATE="yum update -y"
    INSTALL_CMD="yum install -y"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    PKG_UPDATE="dnf update -y"
    INSTALL_CMD="dnf install -y"
else
    echo -e "${RED}No supported package manager found. This script supports apt, yum, and dnf.${NC}"
    exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Check system memory
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
if [ $TOTAL_MEM -lt 2048 ]; then
    echo -e "${YELLOW}Warning: Your system has less than 2GB RAM. The Minecraft server may not perform optimally.${NC}"
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install required packages
echo -e "${GREEN}Installing required packages...${NC}"
$PKG_UPDATE

# Install Java based on distribution
if [ "$PKG_MANAGER" = "apt-get" ]; then
    $INSTALL_CMD default-jre python3 python3-pip nginx ufw git curl
elif [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
    $INSTALL_CMD java-11-openjdk python3 python3-pip nginx firewalld git curl
fi

# Create directory structure
echo -e "${GREEN}Creating directory structure...${NC}"
mkdir -p /opt/mcserver
mkdir -p /opt/mcserver/web
mkdir -p /opt/mcserver/minecraft
mkdir -p /opt/mcserver/backups

# Clone the web dashboard repository
echo -e "${GREEN}Downloading web dashboard...${NC}"
git clone https://github.com/realandi/OneLineMCDeploy.git /opt/mcserver/web

# Install Python dependencies
echo -e "${GREEN}Installing Python dependencies...${NC}"
pip3 install flask flask-login werkzeug requests

# Configure firewall based on system
echo -e "${GREEN}Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 25565/tcp  # Minecraft server port
    ufw allow 80/tcp     # HTTP
    ufw allow 443/tcp    # HTTPS
    ufw --force enable
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=25565/tcp
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --reload
fi

# Download latest Minecraft server
echo -e "${GREEN}Downloading latest Minecraft server...${NC}"
cd /opt/mcserver/minecraft
LATEST_VERSION=$(curl -s https://launchermeta.mojang.com/mc/game/version_manifest.json | python3 -c "import sys, json; print(json.load(sys.stdin)['latest']['release'])")
echo -e "Latest Minecraft version: ${YELLOW}$LATEST_VERSION${NC}"
VERSION_MANIFEST=$(curl -s https://launchermeta.mojang.com/mc/game/version_manifest.json)
SERVER_URL=$(echo $VERSION_MANIFEST | python3 -c "import sys, json; latest_version='$LATEST_VERSION'; data=json.load(sys.stdin); version_url = next(v['url'] for v in data['versions'] if v['id'] == latest_version); version_data=json.loads(__import__('urllib.request').request.urlopen(version_url).read()); print(version_data['downloads']['server']['url'])")
curl -O $SERVER_URL

# Create server properties with optimized settings
echo -e "${GREEN}Configuring server properties...${NC}"
cat > server.properties << EOL
server-port=25565
enable-rcon=true
rcon.port=25575
rcon.password=$(openssl rand -hex 12)
view-distance=10
max-players=20
difficulty=normal
spawn-protection=16
max-world-size=29999984
network-compression-threshold=256
EOL

# Create start script with optimized JVM settings
echo -e "${GREEN}Creating startup script...${NC}"
cat > start.sh << EOL
#!/bin/bash
java -Xms1G -Xmx${TOTAL_MEM}M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -jar server.jar nogui
EOL
chmod +x start.sh

# Accept EULA
echo "eula=true" > eula.txt

# Generate secure password and save it
ADMIN_PASSWORD=$(openssl rand -hex 8)
echo $ADMIN_PASSWORD > /tmp/mc_admin_pass.txt

# Start web dashboard
echo -e "${GREEN}Starting web dashboard...${NC}"
cd /opt/mcserver/web
python3 app.py &

# Get public IP
PUBLIC_IP=$(curl -s https://api.ipify.org)

echo -e "\n${GREEN}✅ Installation Complete!${NC}"
echo -e "\n${BLUE}OneLineMCDeploy${NC} - Your Minecraft server is ready!"
echo -e "\n📊 Dashboard: ${YELLOW}http://$PUBLIC_IP${NC}"
echo -e "🔑 Login Credentials:"
echo -e "   Username: ${YELLOW}admin${NC}"
echo -e "   Password: ${YELLOW}$ADMIN_PASSWORD${NC}"
echo -e "\n${RED}⚠️  IMPORTANT: Save these credentials and change the password after first login!${NC}"
echo -e "\n${GREEN}Need help? Visit: https://github.com/realandi/OneLineMCDeploy/wiki${NC}" 