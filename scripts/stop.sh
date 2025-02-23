#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Killing Python server on port 5033...${NC}"
if sudo lsof -ti:5033; then
    sudo lsof -ti:5033 | xargs kill -9
    echo -e "${GREEN}✓ Python server killed${NC}"
else
    echo -e "${RED}No Python server found on port 5033${NC}"
fi

echo -e "${YELLOW}Killing Next.js server on port 3003...${NC}"
if sudo lsof -ti:3003; then
    sudo lsof -ti:3003 | xargs kill -9
    echo -e "${GREEN}✓ Next.js server killed${NC}"
else
    echo -e "${RED}No Next.js server found on port 3003${NC}"
fi 

echo -e "${YELLOW}Killing Minecraft server on port 25565...${NC}"
if sudo lsof -ti:25565; then
    sudo lsof -ti:25565 | xargs kill -9
    echo -e "${GREEN}✓ Minecraft server killed${NC}"
else
    echo -e "${RED}No Minecraft server found on port 25565${NC}"
fi