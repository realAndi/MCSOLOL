#!/bin/bash

# MCSOLOL - Development Environment
# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default values
PANEL_PORT=3000
API_PORT=5033
WS_PORT=8765

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to find next available port
find_next_port() {
    local port=$1
    while check_port $port; do
        print_warning "Port $port is in use, trying next port..." >&2
        port=$((port + 1))
    done
    echo -n $port
}

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

# Function to cleanup background processes on script exit
cleanup() {
    print_section "Cleaning Up"
    print_status "Stopping all services..."
    
    if [ -n "$DASHBOARD_PID" ]; then
        kill $DASHBOARD_PID 2>/dev/null
        print_status "Dashboard stopped"
    fi
    if [ -n "$API_SERVER_PID" ]; then
        kill $API_SERVER_PID 2>/dev/null
        print_status "API server stopped"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

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
echo -e "${BLUE}Minecraft Server One Line Of Linux${NC} - Development Environment"
echo -e "${GREEN}Starting setup...${NC}\n"

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    print_error "This script is designed for macOS."
    exit 1
fi

# Get the directory where the script is being run from
SCRIPT_DIR="$(pwd)"

# Create required directories
print_section "Creating Directories"
mkdir -p "$SCRIPT_DIR"/{minecraft,minecraft/servers,backups,logs}

# Check for required tools
print_section "Checking Dependencies"

# Check for Node.js
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    brew install node
    check_command "Failed to install Node.js"
else
    print_status "Node.js found: $(node --version)"
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    print_status "Installing Python..."
    brew install python
    check_command "Failed to install Python"
else
    print_status "Python found: $(python3 --version)"
fi

# Check for Java and correct version
if ! command -v java &> /dev/null; then
    print_status "Installing Java 21..."
    brew install openjdk@21
    sudo ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk
    echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.bash_profile
    source ~/.bash_profile
    check_command "Failed to install Java"
else
    # Check Java version
    JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | awk -F. '{print $1}')
    if [ "$JAVA_VERSION" -lt "21" ]; then
        print_warning "Java version $JAVA_VERSION detected. Minecraft 1.20.2+ requires Java 21"
        print_status "Installing Java 21..."
        brew install openjdk@21
        sudo ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk
        echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.bash_profile
        source ~/.bash_profile
        check_command "Failed to install Java 21"
    else
        print_status "Java found: version $JAVA_VERSION"
    fi
fi

# Install Python dependencies
print_status "Installing Python dependencies..."
pip3 install -e .
check_command "Failed to install Python dependencies"

# Set up Python path
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Install panel dependencies
print_section "Setting up Web Panel"
cd "$SCRIPT_DIR/panel"
if [ -f "package.json" ]; then
    print_status "Installing panel dependencies..."
    npm install --no-audit
    check_command "Failed to install panel dependencies"
else
    print_error "No package.json found in panel directory"
    exit 1
fi

# Check and assign ports
print_section "Checking Ports"
API_PORT=$(find_next_port $API_PORT)
WS_PORT=$(find_next_port $WS_PORT)
PANEL_PORT=$(find_next_port $PANEL_PORT)

print_status "Using ports: API=$API_PORT, WS=$WS_PORT, Panel=$PANEL_PORT"

# Export environment variables
export API_PORT="$API_PORT"
export WS_PORT="$WS_PORT"
export PANEL_PORT="$PANEL_PORT"

# Start Python API server
print_section "Starting API Server"
cd "$SCRIPT_DIR"
print_status "Starting API server on port $API_PORT..."
PYTHONPATH="$SCRIPT_DIR" python3 -m server.app.main > "$SCRIPT_DIR/logs/api.log" 2>&1 &
API_SERVER_PID=$!

# Verify API server started
sleep 2
if ! kill -0 $API_SERVER_PID 2>/dev/null; then
    print_error "API server failed to start. Check logs at $SCRIPT_DIR/logs/api.log"
    exit 1
fi

# Start panel in development mode
print_section "Starting Web Panel"
cd "$SCRIPT_DIR/panel"
print_status "Starting web panel on port $PANEL_PORT..."
PORT=$PANEL_PORT npm run dev > "$SCRIPT_DIR/logs/panel.log" 2>&1 &
DASHBOARD_PID=$!

# Verify panel started
sleep 2
if ! kill -0 $DASHBOARD_PID 2>/dev/null; then
    print_error "Web panel failed to start. Check logs at $SCRIPT_DIR/logs/panel.log"
    exit 1
fi

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

echo -e "\n${BLUE}🚀 Development Environment Started!${NC}"

echo -e "\n${GREEN}Access Information:${NC}"
echo -e "📊 Dashboard: ${YELLOW}http://localhost:${PANEL_PORT}${NC}"
echo -e "🔌 API Server: ${YELLOW}http://localhost:${API_PORT}${NC}"
echo -e "🔄 WebSocket: ${YELLOW}ws://localhost:${WS_PORT}${NC}"

echo -e "\n${GREEN}Log Files:${NC}"
echo -e "📝 API Log: ${YELLOW}$SCRIPT_DIR/logs/api.log${NC}"
echo -e "📝 Panel Log: ${YELLOW}$SCRIPT_DIR/logs/panel.log${NC}"

echo -e "\n${RED}⚠️  IMPORTANT:${NC}"
echo -e "1. All services will stop when you press Ctrl+C"
echo -e "2. Logs are available in the logs directory"
echo -e "3. Minecraft servers will be created in: $SCRIPT_DIR/minecraft/servers"

echo -e "\n${BLUE}Press Ctrl+C to stop all services${NC}"

# Wait for all background processes
while kill -0 $API_SERVER_PID $DASHBOARD_PID 2>/dev/null; do
    sleep 1
done 