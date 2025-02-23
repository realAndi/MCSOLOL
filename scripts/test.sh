#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to cleanup background processes on script exit
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    if [ -n "$DASHBOARD_PID" ]; then
        kill $DASHBOARD_PID
    fi
    if [ -n "$PYTHON_SERVER_PID" ]; then
        kill $PYTHON_SERVER_PID
    fi
}

# Set up cleanup trap
trap cleanup EXIT

echo -e "${BLUE}MCSOLOL${NC} - Local Test Setup"

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}This test script is designed for macOS.${NC}"
    exit 1
fi

# Get the directory where the script is being run from
SCRIPT_DIR="$(pwd)"

# Create test directory
TEST_DIR="$SCRIPT_DIR/tests"
echo -e "${GREEN}Creating test directory at:${NC} $TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Check for required tools
echo -e "\n${GREEN}Checking required tools...${NC}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing via Homebrew...${NC}"
    if ! command -v brew &> /dev/null; then
        echo -e "${YELLOW}Homebrew not found. Installing Homebrew...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install node
else
    echo -e "✅ Node.js found: $(node --version)"
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Python not found. Installing via Homebrew...${NC}"
    brew install python
else
    echo -e "✅ Python found: $(python3 --version)"
fi

# Check for pip and install Flask dependencies
if ! command -v pip3 &> /dev/null; then
    echo -e "${YELLOW}pip not found. Installing...${NC}"
    python3 -m ensurepip --upgrade
fi

echo -e "${GREEN}Installing Python dependencies...${NC}"
pip3 install flask flask-cors requests

# Check for curl
if ! command -v curl &> /dev/null; then
    echo -e "${YELLOW}curl not found. Installing via Homebrew...${NC}"
    brew install curl
else
    echo -e "✅ curl found: $(curl --version | head -n 1)"
fi

echo -e "\n${GREEN}Setting up test environment...${NC}"

# Create server directory structure
mkdir -p {dashboard,servers,backups}
cd servers
mkdir -p downloads/jar

# Set up environment variables for testing
export MCSERVER_ROOT="$TEST_DIR/servers"
export MCSERVER_DOWNLOAD_DIR="$TEST_DIR/servers/downloads"
export MCSERVER_BACKUP_DIR="$TEST_DIR/backups"
export MCSERVER_JAR_DIR="$TEST_DIR/servers/downloads/jar"

# Create test server instance directories
mkdir -p instance1 instance2

# Create server properties template
cat > server.properties.template << EOL
server-port={{port}}
enable-rcon={{enable_rcon}}
rcon.port={{rcon_port}}
rcon.password={{rcon_password}}
view-distance={{view_distance}}
max-players={{max_players}}
difficulty={{difficulty}}
spawn-protection={{spawn_protection}}
motd={{motd}}
EOL

# Set proper permissions
chmod -R 755 "$TEST_DIR/servers"
chmod -R 755 "$TEST_DIR/backups"

# Copy dashboard template
cd "$TEST_DIR/dashboard"
echo -e "${GREEN}Copying dashboard template...${NC}"
cp -r ../../mc-dashboard-template/* .

# Clean install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
rm -rf node_modules package-lock.json

# Install Next.js and React dependencies
npm install next@latest react@latest react-dom@latest

# Install shadcn dependencies
echo -e "${GREEN}Installing shadcn dependencies...${NC}"
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install @radix-ui/react-slot
npm install @radix-ui/react-label
npm install @radix-ui/react-dialog
npm install @radix-ui/react-avatar
npm install @radix-ui/react-dropdown-menu
npm install @radix-ui/react-tabs
npm install @radix-ui/react-toast

# Install development dependencies
echo -e "${GREEN}Installing development dependencies...${NC}"
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest
npm install -D @types/node @types/react @types/react-dom typescript
npm install -D eslint eslint-config-next

# Initialize shadcn
echo -e "${GREEN}Initializing shadcn...${NC}"
npx shadcn@latest init

# Build the dashboard
echo -e "${GREEN}Building dashboard...${NC}"
npm run build

# Start Python backend server
echo -e "\n${GREEN}Starting Python backend server...${NC}"
cd "$SCRIPT_DIR"
python3 app.py 2>&1 | tee "$TEST_DIR/python-server.log" &
PYTHON_SERVER_PID=$!
echo -e "${GREEN}✓ Python backend started (PID: $PYTHON_SERVER_PID)${NC}"

# Start Next.js dashboard in development mode (redirect output to log file)
echo -e "\n${GREEN}Starting dashboard...${NC}"
cd "$TEST_DIR/dashboard"
npm run dev > "$TEST_DIR/nextjs.log" 2>&1 &
DASHBOARD_PID=$!
echo -e "${GREEN}✓ Dashboard started (PID: $DASHBOARD_PID)${NC}"
echo -e "${YELLOW}Dashboard logs are being written to:${NC} $TEST_DIR/nextjs.log"

# Get local IP address
LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

# Print connection information
echo -e "\n${BLUE}=== Connection Information ===${NC}"
echo -e "${GREEN}Dashboard:${NC}"
echo -e "• Local URL: ${YELLOW}http://localhost:3003${NC}"
echo -e "• Network URL: ${YELLOW}http://$LOCAL_IP:3003${NC}"
echo -e "• Logs: ${YELLOW}$TEST_DIR/nextjs.log${NC}"

echo -e "\n${GREEN}Backend Server:${NC}"
echo -e "• Local URL: ${YELLOW}http://localhost:5033${NC}"
echo -e "• Network URL: ${YELLOW}http://$LOCAL_IP:5033${NC}"
echo -e "• Logs: ${YELLOW}$TEST_DIR/python-server.log${NC}"

echo -e "\n${GREEN}Server Environment:${NC}"
echo -e "• Server Root: ${YELLOW}$MCSERVER_ROOT${NC}"
echo -e "• Download Directory: ${YELLOW}$MCSERVER_DOWNLOAD_DIR${NC}"
echo -e "• Backup Directory: ${YELLOW}$MCSERVER_BACKUP_DIR${NC}"
echo -e "• JAR Directory: ${YELLOW}$MCSERVER_JAR_DIR${NC}"

echo -e "\n${BLUE}=== Test Environment Ready ===${NC}"
echo -e "• Test Directory: ${YELLOW}$TEST_DIR${NC}"
echo -e "• Press Ctrl+C to stop all services"

# Wait for user interrupt
wait 