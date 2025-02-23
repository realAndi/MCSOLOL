import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MINECRAFT_DIR = BASE_DIR / "minecraft"
SERVER_DIR = MINECRAFT_DIR / "servers"
TEMPLATE_DIR = MINECRAFT_DIR / "templates"
BACKUP_DIR = MINECRAFT_DIR / "backups"
LOG_DIR = BASE_DIR / "logs"

# Server settings
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 5033))
WS_PORT = int(os.getenv("WS_PORT", 8765))

# CORS settings
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
]

# Minecraft server defaults
DEFAULT_SERVER_MEMORY = "2G"
MAX_SERVERS = 5
BACKUP_RETENTION_DAYS = 7

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s" 