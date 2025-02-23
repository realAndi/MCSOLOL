import re
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

def validate_server_name(name: str) -> bool:
    """Validate server name format"""
    return bool(re.match(r'^[a-zA-Z0-9_-]{3,32}$', name))

def get_server_properties(server_path: Path) -> Dict[str, Any]:
    """Read server.properties file"""
    properties = {}
    properties_file = server_path / 'server.properties'
    
    if properties_file.exists():
        with open(properties_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    properties[key.strip()] = value.strip()
    
    return properties

def save_server_properties(server_path: Path, properties: Dict[str, Any]) -> None:
    """Save server.properties file"""
    properties_file = server_path / 'server.properties'
    
    with open(properties_file, 'w') as f:
        for key, value in sorted(properties.items()):
            f.write(f'{key}={value}\n')

def calculate_directory_size(path: Path) -> int:
    """Calculate total size of a directory in bytes"""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for filename in filenames:
            file_path = Path(dirpath) / filename
            total_size += file_path.stat().st_size
    return total_size

def format_bytes(size: int) -> str:
    """Format bytes to human readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"

def load_server_config(server_path: Path) -> Optional[Dict[str, Any]]:
    """Load server configuration from JSON file"""
    config_file = server_path / 'server_config.json'
    if config_file.exists():
        with open(config_file, 'r') as f:
            return json.load(f)
    return None

def save_server_config(server_path: Path, config: Dict[str, Any]) -> None:
    """Save server configuration to JSON file"""
    config_file = server_path / 'server_config.json'
    with open(config_file, 'w') as f:
        json.dump(config, f, indent=2)

def get_backup_filename(server_name: str) -> str:
    """Generate backup filename with timestamp"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return f"{server_name}_backup_{timestamp}.zip" 