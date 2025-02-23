from flask import Blueprint, jsonify, request, Response, stream_with_context
import logging
from server.app.core.server_manager import ServerManager
from server.app.utils.helpers import validate_server_name
from server.config.settings import MINECRAFT_DIR
import requests
from pathlib import Path
import time
import json
import shutil

# Set up logger for server manager
logger = logging.getLogger('server_manager')

api = Blueprint('api', __name__)
server_manager = ServerManager(base_path=MINECRAFT_DIR, logger=logger, load_existing=True)

@api.route('/', methods=['GET'])
def api_root():
    """API root endpoint with documentation"""
    return jsonify({
        'name': 'MCSOLOL API',
        'version': '1.0.0',
        'description': 'Minecraft Server Manager API',
        'endpoints': {
            # Documentation
            'GET /api/': 'API documentation and endpoint listing',
            'GET /api/health': 'Health check endpoint for API status',
            
            # Server Management
            'GET /api/server': 'List all servers with their current status',
            'POST /api/server': 'Create a new vanilla server instance',
            'GET /api/server/<server_name>': 'Get detailed information about a specific server',
            'DELETE /api/server/<server_name>': 'Delete a server and all its files',
            
            # Server Control
            'GET /api/server/<server_name>/status': 'Get real-time server status (players, performance, etc.)',
            'POST /api/server/<server_name>/control': {
                'description': 'Control server state',
                'actions': ['start', 'stop', 'restart', 'force-stop']
            },
            
            # Console Management
            'GET /api/server/<server_name>/console': 'Get recent console output with optional limit',
            'POST /api/server/<server_name>/console': 'Send a command to the server console',
            'GET /api/server/<server_name>/console/stream': 'Stream console output in real-time (SSE)',
            
            # Server Configuration
            'POST /api/server/<server_name>/properties': 'Update server.properties configuration',
            
            # Server Installation
            'POST /api/server/download': {
                'description': 'Download and install a vanilla Minecraft server',
                'params': {
                    'url': 'Server JAR download URL',
                    'version': 'Minecraft version',
                    'name': 'Server name'
                }
            },
            'POST /api/server/upload': {
                'description': 'Upload custom server files',
                'params': {
                    'file': 'Server JAR or ZIP file',
                    'name': 'Server name',
                    'type': ['jar', 'zip']
                },
                'notes': [
                    'JAR files should be valid Minecraft server executables',
                    'ZIP files must contain a server.jar in their contents',
                    'Existing configuration files in ZIP will be preserved'
                ]
            },
            'POST /api/server/create': {
                'description': 'Create a new server instance with configuration',
                'params': {
                    'name': 'Server name',
                    'version': 'Minecraft version',
                    'settings': {
                        'server.properties': 'Server configuration options',
                        'whitelist': 'List of whitelisted players',
                        'ops': 'List of server operators'
                    }
                }
            }
        }
    })

@api.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'API server is running'
    })

@api.route('/server', methods=['GET'])
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
                'name': server_info['name'],  # Use actual server name
                'motd': properties.get('motd', 'A Minecraft Server'),  # Keep MOTD separate
                'status': status['status'],
                'players': {
                    'online': status['players']['count'],
                    'max': int(properties.get('max-players', 20))
                },
                'version': properties.get('version', 'unknown'),
                'port': properties.get('server-port', '25565')
            })
    
    return jsonify({
        'success': True,
        'servers': server_list
    })

@api.route('/server', methods=['POST'])
def create_server():
    """Create a new server"""
    data = request.json
    name = data.get('name')
    version = data.get('version')
    
    if not name or not validate_server_name(name):
        return jsonify({'error': 'Invalid server name'}), 400
        
    result = server_manager.create_server(name)
    return jsonify(result)

@api.route('/server/<server_name>', methods=['GET', 'DELETE'])
def get_server(server_name):
    """Get server details or delete server"""
    server = server_manager.get_server(server_name)
    if not server:
        return jsonify({'error': 'Server not found'}), 404
        
    if request.method == 'DELETE':
        # Stop the server if it's running
        if server.is_running:
            server.stop(force=True)
            
        try:
            # Remove server from manager
            server_manager.remove_server(server_name)
            
            # Delete server directory
            shutil.rmtree(server.server_path)
            
            return jsonify({
                'success': True,
                'message': f'Server {server_name} deleted successfully'
            })
        except Exception as e:
            logger.error(f"Failed to delete server {server_name}: {e}")
            return jsonify({
                'error': f'Failed to delete server: {str(e)}'
            }), 500
            
    # GET request
    return jsonify(server)

@api.route('/server/<server_name>/status', methods=['GET'])
def get_server_status(server_name):
    """Get server status"""
    server = server_manager.get_server(server_name)
    if not server:
        return jsonify({'error': f'Server {server_name} not found'}), 404
    
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
            "name": server_name,
            "motd": server_properties.get("motd", "A Minecraft Server"),
            "version": status.get("version", "unknown")
        }
    })

@api.route('/server/<server_name>/control', methods=['POST'])
def control_server(server_name):
    """Control server (start/stop/restart/force-stop)"""
    server = server_manager.get_server(server_name)
    if not server:
        return jsonify({'error': f'Server {server_name} not found'}), 404
    
    data = request.get_json()
    action = data.get('action')
    
    if not action or action not in ['start', 'stop', 'restart', 'force-stop']:
        return jsonify({'error': 'Invalid action'}), 400
    
    try:
        if action == 'start':
            result = server.start()
        elif action == 'stop':
            result = server.stop(force=False)
        elif action == 'restart':
            server.stop(force=False)
            result = server.start()
        elif action == 'force-stop':
            result = server.stop(force=True)
        
        return jsonify({
            'success': True,
            'message': f'Server {action} command sent successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@api.route('/server/<server_name>/console', methods=['GET'])
def get_console(server_name):
    """Get console output"""
    server = server_manager.get_server(server_name)
    if not server:
        return jsonify({'error': f'Server {server_name} not found'}), 404
    
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

@api.route('/server/<server_name>/console', methods=['POST'])
def send_console_command(server_name):
    """Send console command"""
    server = server_manager.get_server(server_name)
    if not server:
        return jsonify({'error': f'Server {server_name} not found'}), 404
    
    data = request.get_json()
    command = data.get('command')
    if not command:
        return jsonify({'error': 'Command is required'}), 400
    
    result = server.send_command(command)
    return jsonify({
        'success': result['status'] == 'success',
        'error': result['message'] if result['status'] == 'error' else None
    })

@api.route('/server/download', methods=['POST'])
def download_server():
    """Download a Minecraft server jar"""
    try:
        data = request.json
        url = data.get('url')
        version = data.get('version')
        name = data.get('name')
        
        if not all([url, version, name]):
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Create server directory
        server_dir = Path(MINECRAFT_DIR) / 'servers' / name
        server_dir.mkdir(parents=True, exist_ok=True)
        
        # Download the server jar
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        jar_path = server_dir / 'server.jar'
        with open(jar_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        return jsonify({
            'status': 'success',
            'message': f'Server jar downloaded successfully for version {version}',
            'path': str(jar_path)
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Failed to download server: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server download failed: {str(e)}'}), 500

@api.route('/server/create', methods=['POST'])
def create_server_instance():
    """Create a new server instance"""
    try:
        data = request.json
        name = data.get('name')
        version = data.get('version')
        settings = data.get('settings')
        
        if not name or not validate_server_name(name):
            return jsonify({'error': 'Invalid server name'}), 400
            
        # Create server instance
        server = server_manager.create_server(name)
        
        # Save server properties if provided
        if settings:
            server_dir = Path(MINECRAFT_DIR) / 'servers' / name
            
            # Write server.properties file
            properties_file = server_dir / 'server.properties'
            with open(properties_file, 'w') as f:
                # Filter out special settings that don't go in server.properties
                server_properties = {k: v for k, v in settings.items() 
                                  if k not in ['whitelist', 'ops', 'whitelist_players', 'operators']}
                
                for key, value in server_properties.items():
                    if isinstance(value, bool):
                        value = str(value).lower()
                    f.write(f"{key}={value}\n")
            
            # Create whitelist.json if whitelist players provided
            if settings.get('whitelist'):
                whitelist_file = server_dir / 'whitelist.json'
                with open(whitelist_file, 'w') as f:
                    json.dump(settings['whitelist'], f, indent=2)
            
            # Create ops.json if operators provided
            if settings.get('ops'):
                ops_file = server_dir / 'ops.json'
                with open(ops_file, 'w') as f:
                    json.dump(settings['ops'], f, indent=2)
            
            # Create eula.txt
            with open(server_dir / 'eula.txt', 'w') as f:
                f.write('eula=true\n')
                
        return jsonify({
            'status': 'success',
            'message': 'Server instance created successfully',
            'serverId': name
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to create server instance: {str(e)}'}), 500

@api.route('/server/<server_name>/console/stream', methods=['GET'])
def stream_console(server_name):
    """Stream console output as Server-Sent Events"""
    server = server_manager.get_server(server_name)
    if not server:
        return jsonify({'error': f'Server {server_name} not found'}), 404

    def generate():
        last_timestamp = request.args.get('since')
        
        while True:
            # Get new console entries
            logs = server.get_console_output(limit=1000)
            if logs:
                # Filter logs after the last timestamp
                new_logs = [
                    log for log in logs
                    if not last_timestamp or log['timestamp'] > last_timestamp
                ]
                
                if new_logs:
                    # Update last timestamp
                    last_timestamp = new_logs[-1]['timestamp']
                    
                    # Send new logs
                    data = {
                        'logs': [{
                            'timestamp': log['timestamp'],
                            'type': log['type'],
                            'content': log['message']
                        } for log in new_logs]
                    }
                    yield f"data: {json.dumps(data)}\n\n"
            
            time.sleep(0.1)  # Small delay to prevent CPU spinning

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no'  # Disable nginx buffering
        }
    )

@api.route('/server/<server_name>/properties', methods=['POST'])
def update_server_properties(server_name):
    """Update server properties"""
    server = server_manager.get_server(server_name)
    if not server:
        return jsonify({'error': f'Server {server_name} not found'}), 404
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No properties provided'}), 400
        
        # Get current properties
        properties = server.get_server_properties()
        
        # Update properties
        for key, value in data.items():
            properties[key] = str(value)  # Convert all values to strings
        
        # Save properties
        props_file = server.server_path / 'server.properties'
        with open(props_file, 'w') as f:
            for key, value in sorted(properties.items()):
                f.write(f"{key}={value}\n")
        
        return jsonify({
            'success': True,
            'message': 'Server properties updated successfully'
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to update server properties: {str(e)}'
        }), 500

@api.route('/server/upload', methods=['POST'])
def upload_server():
    """Handle custom JAR or ZIP file uploads"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['file']
        name = request.form.get('name')
        file_type = request.form.get('type')
        
        if not file or not name or not file_type:
            return jsonify({'error': 'Missing required fields'}), 400
            
        if file_type not in ['jar', 'zip']:
            return jsonify({'error': 'Invalid file type'}), 400
            
        # Create server directory
        server_dir = Path(MINECRAFT_DIR) / 'servers' / name
        server_dir.mkdir(parents=True, exist_ok=True)
        
        if file_type == 'jar':
            # Save the JAR file directly
            jar_path = server_dir / 'server.jar'
            file.save(str(jar_path))
        else:  # ZIP file
            # Save ZIP file temporarily
            temp_zip = server_dir / 'temp.zip'
            file.save(str(temp_zip))
            
            try:
                # Extract the ZIP file
                import zipfile
                with zipfile.ZipFile(temp_zip, 'r') as zip_ref:
                    zip_ref.extractall(server_dir)
                
                # Delete the temporary ZIP file
                temp_zip.unlink()
                
                # Check if server.jar exists in the extracted files
                if not (server_dir / 'server.jar').exists():
                    # Clean up the directory
                    import shutil
                    shutil.rmtree(server_dir)
                    return jsonify({'error': 'No server.jar found in the uploaded ZIP file'}), 400
                    
            except Exception as e:
                # Clean up on error
                if temp_zip.exists():
                    temp_zip.unlink()
                return jsonify({'error': f'Failed to process ZIP file: {str(e)}'}), 500
        
        # Create default server.properties if it doesn't exist
        props_file = server_dir / 'server.properties'
        if not props_file.exists():
            with open(props_file, 'w') as f:
                f.write("""server-port=25565
enable-rcon=true
rcon.port=25575
rcon.password=
view-distance=10
max-players=20
difficulty=normal
spawn-protection=16
max-world-size=29999984
network-compression-threshold=256
""")
        
        # Create eula.txt if it doesn't exist
        eula_file = server_dir / 'eula.txt'
        if not eula_file.exists():
            with open(eula_file, 'w') as f:
                f.write('eula=true\n')
                
        return jsonify({
            'status': 'success',
            'message': f'Server files processed successfully',
            'path': str(server_dir)
        })
        
    except Exception as e:
        return jsonify({'error': f'Server upload failed: {str(e)}'}), 500 