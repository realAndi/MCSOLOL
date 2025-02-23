from flask import Flask, request, jsonify
import os
import subprocess
import json
from pathlib import Path
import shutil
import requests
import re
from flask_cors import CORS
import logging
import sys
from datetime import datetime
from server_manager import ServerManager

# Set up colorful logging
class ColorFormatter(logging.Formatter):
    """Custom formatter with colors"""
    grey = "\x1b[38;21m"
    blue = "\x1b[38;5;39m"
    yellow = "\x1b[38;5;226m"
    red = "\x1b[38;5;196m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"

    def __init__(self):
        super().__init__(
            fmt='%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

    def format(self, record):
        # Save the original format
        format_orig = self._style._fmt

        # Apply colors based on the level
        if record.levelno == logging.DEBUG:
            self._style._fmt = self.grey + format_orig + self.reset
        elif record.levelno == logging.INFO:
            self._style._fmt = self.blue + format_orig + self.reset
        elif record.levelno == logging.WARNING:
            self._style._fmt = self.yellow + format_orig + self.reset
        elif record.levelno == logging.ERROR:
            self._style._fmt = self.red + format_orig + self.reset
        elif record.levelno == logging.CRITICAL:
            self._style._fmt = self.bold_red + format_orig + self.reset

        # Call the original formatter class to do the grunt work
        result = logging.Formatter.format(self, record)

        # Restore the original format
        self._style._fmt = format_orig

        return result

# Set up logging
logger = logging.getLogger('minecraft_server')
logger.setLevel(logging.DEBUG)

# Create console handler with custom formatter
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(ColorFormatter())
logger.addHandler(console_handler)

app = Flask(__name__)
logger.info("Starting Minecraft Server Manager")

# Enable CORS for development
CORS(app, 
     resources={r"/api/*": {
         "origins": ["http://localhost:3003"],
         "methods": ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
         "allow_headers": "*",
         "expose_headers": "*",
         "supports_credentials": True,
         "max_age": 600
     }},
     supports_credentials=True
)

@app.before_request
def log_request_info():
    """Log details of every request"""
    logger.info("=" * 50)
    logger.info(f"Request Path: {request.path}")
    logger.info(f"Request Method: {request.method}")
    logger.debug("Request Headers:")
    for header, value in request.headers.items():
        logger.debug(f"  {header}: {value}")
    if request.data:
        logger.debug("Request Body:")
        logger.debug(f"  {request.get_data(as_text=True)}")

@app.before_request
def handle_preflight():
    """Handle preflight requests and add CORS headers"""
    if request.method == "OPTIONS":
        logger.info("Handling OPTIONS preflight request")
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3003")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        response.headers.add("Access-Control-Allow-Credentials", "true")
        response.headers.add("Access-Control-Max-Age", "600")
        logger.debug("Response Headers for OPTIONS:")
        for header, value in response.headers.items():
            logger.debug(f"  {header}: {value}")
        return response

@app.after_request
def after_request(response):
    """Log and add CORS headers to all responses"""
    # Skip adding CORS headers for OPTIONS requests since they're already added
    if request.method != "OPTIONS":
        logger.info("Adding CORS headers to response")
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3003")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        response.headers.add("Access-Control-Allow-Credentials", "true")
        response.headers.add("Access-Control-Max-Age", "600")
    
    logger.debug("Final Response Headers:")
    for header, value in response.headers.items():
        logger.debug(f"  {header}: {value}")
    
    # Log response status and body for non-200 responses
    if response.status_code != 200:
        logger.warning(f"Response Status: {response.status}")
        logger.warning(f"Response Body: {response.get_data(as_text=True)}")
    
    return response

# Environment variables with defaults for testing
MCSERVER_ROOT = os.getenv('MCSERVER_ROOT', '/opt/mcserver/servers')
MCSERVER_DOWNLOAD_DIR = os.getenv('MCSERVER_DOWNLOAD_DIR', '/opt/mcserver/servers/downloads')
MCSERVER_BACKUP_DIR = os.getenv('MCSERVER_BACKUP_DIR', '/opt/mcserver/backups')
MCSERVER_JAR_DIR = os.getenv('MCSERVER_JAR_DIR', '/opt/mcserver/servers/downloads/jar')

def ensure_directories():
    """Ensure all required directories exist with proper permissions"""
    for directory in [MCSERVER_ROOT, MCSERVER_DOWNLOAD_DIR, MCSERVER_BACKUP_DIR, MCSERVER_JAR_DIR]:
        Path(directory).mkdir(parents=True, exist_ok=True)
        os.chmod(directory, 0o755)

def generate_unique_name(base_name):
    """Generate a unique folder name based on the server name"""
    # Replace spaces with dashes and remove special characters
    safe_name = re.sub(r'[^a-zA-Z0-9-]', '', base_name.replace(' ', '-')).lower()
    
    # Check if the base name exists
    target_dir = Path(MCSERVER_ROOT) / safe_name
    if not target_dir.exists():
        return safe_name
    
    # If it exists, try adding numbers until we find a unique name
    counter = 1
    while True:
        new_name = f"{safe_name}-{counter}"
        if not (Path(MCSERVER_ROOT) / new_name).exists():
            return new_name
        counter += 1

# Initialize server manager
server_manager = ServerManager(Path(MCSERVER_ROOT), logger)

@app.route('/api/server/download', methods=['POST'])
def download_server():
    """Download a specific Minecraft server version"""
    data = request.json
    version = data.get('version')
    url = data.get('url')
    server_name = data.get('name', f'minecraft-{version}')
    
    if not version or not url:
        return jsonify({'error': 'Version and URL are required'}), 400
    
    try:
        # Check for server in dashboard download location
        dashboard_server_path = Path(MCSERVER_ROOT).parent.parent / 'dashboard' / 'servers' / f'vanilla-{version}' / 'server.jar'
        
        if dashboard_server_path.exists():
            # Generate unique folder name
            folder_name = generate_unique_name(server_name)
            server_dir = Path(MCSERVER_ROOT) / folder_name
            server_dir.mkdir(parents=True, exist_ok=True)
            
            # Copy from dashboard location to server directory
            shutil.copy2(dashboard_server_path, server_dir / 'server.jar')
        else:
            # If not in dashboard location, download directly
            # Download the server jar to the jar directory first
            jar_path = Path(MCSERVER_JAR_DIR) / f'minecraft_server.{version}.jar'
            
            # Download the server jar
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            with open(jar_path, 'wb') as f:
                shutil.copyfileobj(response.raw, f)
            
            # Generate unique folder name
            folder_name = generate_unique_name(server_name)
            server_dir = Path(MCSERVER_ROOT) / folder_name
            server_dir.mkdir(parents=True, exist_ok=True)
            
            # Copy the jar to the server directory
            shutil.copy2(jar_path, server_dir / 'server.jar')
        
        # Create eula.txt
        with open(server_dir / 'eula.txt', 'w') as f:
            f.write('eula=true\n')
        
        # Create default server.properties
        with open(Path(MCSERVER_ROOT) / 'server.properties.template') as f:
            template = f.read()
            
        with open(server_dir / 'server.properties', 'w') as f:
            f.write(template.replace('{{port}}', '25565')
                          .replace('{{enable_rcon}}', 'true')
                          .replace('{{rcon_port}}', '25575')
                          .replace('{{rcon_password}}', os.urandom(12).hex())
                          .replace('{{view_distance}}', '10')
                          .replace('{{max_players}}', '20')
                          .replace('{{difficulty}}', 'normal')
                          .replace('{{spawn_protection}}', '16')
                          .replace('{{motd}}', f'A Minecraft Server - {folder_name}'))
            
        return jsonify({
            'status': 'success',
            'message': f'Server version {version} downloaded and set up successfully',
            'server_name': folder_name,
            'path': str(server_dir)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/server/create', methods=['POST'])
def create_server():
    """Create a new server instance"""
    data = request.get_json()
    
    # Required fields
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Server name is required'}), 400
    
    # Optional fields with defaults
    version = data.get('version', 'latest')
    settings = data.get('settings', {})
    
    try:
        # Create server instance
        server = server_manager.create_server(name)
        
        # Apply settings if provided
        if settings:
            # Update server.properties with provided settings
            current_props = server.get_server_properties()
            current_props.update(settings)
            
            # Special handling for whitelist players if provided
            if 'whitelist_players' in settings:
                whitelist_data = [
                    {'name': player['name'], 'uuid': player.get('uuid', '')}
                    for player in settings['whitelist_players']
                ]
                # TODO: Implement whitelist handling in ServerProcess class
        
        return jsonify({
            'success': True,
            'serverId': name,
            'message': 'Server created successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/server/<server_id>/control', methods=['POST'])
def control_server(server_id):
    """Control server (start/stop/restart/force-stop)"""
    server = server_manager.get_server(server_id)
    if not server:
        return jsonify({'error': f'Server {server_id} not found'}), 404
    
    data = request.get_json()
    action = data.get('action')
    
    if not action or action not in ['start', 'stop', 'restart', 'force-stop']:
        return jsonify({'error': 'Invalid action'}), 400
    
    try:
        if action == 'start':
            server.start()
        elif action == 'stop':
            server.stop(force=False)
        elif action == 'restart':
            server.stop(force=False)
            server.start()
        elif action == 'force-stop':
            server.stop(force=True)
        
        return jsonify({
            'success': True,
            'message': f'Server {action} command sent successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/api/server/<server_id>/status', methods=['GET'])
def get_server_status(server_id):
    """Get server status"""
    server = server_manager.get_server(server_id)
    if not server:
        return jsonify({'error': f'Server {server_id} not found'}), 404
    
    status = server.get_status()
    server_properties = server.get_server_properties()
    
    # Format response to match frontend expectations
    return jsonify({
        "status": status["status"],  # "running" | "stopped" | "starting" | "stopping"
        "players": {
            "online": status["players"]["count"],
            "max": int(server_properties.get("max-players", 20))
        },
        "performance": {
            "cpu": f"{status['performance']['cpu_usage']:.1f}%",
            "ram": {
                "used": f"{status['performance']['memory_usage']} MB",
                "total": f"{status['performance']['max_memory']} MB"
            }
        },
        "network": {
            "ip": server_properties.get("server-ip", "localhost"),
            "port": server_properties.get("server-port", "25565")
        },
        "settings": {
            "name": server_id,
            "motd": server_properties.get("motd", "A Minecraft Server"),
            "version": server_properties.get("version", "unknown")
        }
    })

@app.route('/api/server/<server_id>/console', methods=['GET'])
def get_console(server_id):
    """Get console output"""
    server = server_manager.get_server(server_id)
    if not server:
        return jsonify({'error': f'Server {server_id} not found'}), 404
    
    # Get query parameters
    since = request.args.get('since')
    limit = int(request.args.get('limit', 100))
    
    # Get console output
    logs = server.get_console_output(limit=limit)
    
    # Format logs to match frontend expectations
    formatted_logs = [{
        'timestamp': log['timestamp'],
        'type': log['type'],  # "info" | "warning" | "error" | "command"
        'content': log['message']
    } for log in logs]
    
    return jsonify({
        'logs': formatted_logs,
        'lastTimestamp': formatted_logs[-1]['timestamp'] if formatted_logs else None
    })

@app.route('/api/server/<server_id>/console', methods=['POST'])
def send_console_command(server_id):
    """Send console command"""
    server = server_manager.get_server(server_id)
    if not server:
        return jsonify({'error': f'Server {server_id} not found'}), 404
    
    data = request.get_json()
    command = data.get('command')
    if not command:
        return jsonify({'error': 'Command is required'}), 400
    
    result = server.send_command(command)
    return jsonify({
        'success': result['status'] == 'success',
        'error': result['message'] if result['status'] == 'error' else None
    })

@app.route('/api/servers', methods=['GET'])
def list_servers():
    """List all servers with their basic status"""
    servers = server_manager.list_servers()
    
    # Format response to match frontend expectations
    server_list = []
    for server_info in servers:
        server = server_manager.get_server(server_info['name'])
        if server:
            status = server.get_status()
            properties = server.get_server_properties()
            server_list.append({
                'id': server_info['name'],
                'name': properties.get('motd', 'A Minecraft Server'),
                'status': status['status'],
                'players': {
                    'online': status['players']['count'],
                    'max': int(properties.get('max-players', 20))
                },
                'version': properties.get('version', 'unknown')
            })
    
    return jsonify({
        'success': True,
        'servers': server_list
    })

if __name__ == '__main__':
    ensure_directories()
    app.run(host='0.0.0.0', port=5033) 