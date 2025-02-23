#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print status messages
print_status() {
    echo -e "${GREEN}➜${NC} $1"
}

# Function to print section headers
print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Function to print warnings
print_warning() {
    echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
}

# Welcome message
echo -e "${BLUE}MCSOLOL Reset Tool${NC}"
echo -e "This will reset the project to its initial state\n"

# Confirm with user
read -p "Are you sure you want to reset everything? This will delete all servers, logs, and temporary files. (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}Reset cancelled${NC}"
    exit 1
fi

# Kill any running processes
print_section "Stopping Running Processes"
print_status "Checking for running processes..."

# Find and kill Python processes
pkill -f "python3 -m server.app.main" 2>/dev/null
if [ $? -eq 0 ]; then
    print_status "Stopped Python API server"
fi

# Find and kill Node.js processes for the panel
pkill -f "next dev" 2>/dev/null
if [ $? -eq 0 ]; then
    print_status "Stopped Next.js development server"
fi

# Clean up directories
print_section "Cleaning Up Directories"

# Remove generated directories
print_status "Removing minecraft directory..."
rm -rf minecraft

print_status "Removing logs directory..."
rm -rf logs

print_status "Removing backups directory..."
rm -rf backups

print_status "Removing tests directory..."
rm -rf tests

# Clean up panel
print_section "Cleaning Panel"
if [ -d "panel" ]; then
    print_status "Removing panel build files..."
    rm -rf panel/.next
    rm -rf panel/node_modules
    print_status "Panel cleaned"
fi

# Clean up Python
print_section "Cleaning Python"
print_status "Removing Python cache files..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -type f -name "*.pyc" -delete 2>/dev/null
find . -type f -name "*.pyo" -delete 2>/dev/null
find . -type f -name "*.pyd" -delete 2>/dev/null
find . -type f -name ".pytest_cache" -delete 2>/dev/null
find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null
find . -type f -name ".coverage" -delete 2>/dev/null
find . -type d -name ".tox" -exec rm -rf {} + 2>/dev/null
find . -type d -name "build" -exec rm -rf {} + 2>/dev/null
find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null

print_section "Reset Complete"
echo -e "${GREEN}The project has been reset to its initial state${NC}"
echo -e "You can now run ${YELLOW}./dev.sh${NC} to start fresh" 