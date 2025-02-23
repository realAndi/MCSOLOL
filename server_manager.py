import os
import subprocess
import psutil
import time
import threading
import queue
import re
import json
from datetime import datetime
from pathlib import Path
import logging
from typing import Optional, Dict, List, Any
import mcrcon

class ServerProcess:
    def __init__(self, server_path: Path, server_name: str, logger: logging.Logger):
        self.server_path = server_path
        self.server_name = server_name
        self.logger = logger
        self.process: Optional[subprocess.Popen] = None
        self.console_output: queue.Queue = queue.Queue()
        self.is_running = False
        self.start_time: Optional[float] = None
        self.status = "stopped"
        self.last_error: Optional[str] = None
        self.output_thread: Optional[threading.Thread] = None
        self.monitor_thread: Optional[threading.Thread] = None
        
        # Performance metrics
        self.cpu_usage = 0.0
        self.memory_usage = 0
        self.max_memory = 2048  # Default max memory (2GB)
        self.tps = 20.0  # Default TPS
        self.world_size = 0
        self.player_count = 0
        self.player_list: List[str] = []
        
        # Server properties
        self.properties = self.get_server_properties()
        
        # RCON configuration from server.properties
        self.rcon_password = self.properties.get('rcon.password', '')
        self.rcon_port = int(self.properties.get('rcon.port', '25575'))
        self.rcon_client: Optional[mcrcon.MCRcon] = None

    def _process_console_output(self):
        """Process and categorize console output"""
        while self.is_running:
            if self.process and self.process.stdout:
                line = self.process.stdout.readline()
                if line:
                    timestamp = datetime.now().isoformat()
                    decoded_line = line.decode('utf-8').strip()
                    
                    # Categorize message
                    message_type = "info"
                    if "[ERROR]" in decoded_line or "FAILED" in decoded_line:
                        message_type = "error"
                        self.last_error = decoded_line
                    elif "[WARN]" in decoded_line:
                        message_type = "warning"
                    
                    # Parse player events
                    if "joined the game" in decoded_line:
                        player = re.search(r'(\w+) joined the game', decoded_line)
                        if player and player.group(1) not in self.player_list:
                            self.player_list.append(player.group(1))
                            self.player_count = len(self.player_list)
                    elif "left the game" in decoded_line:
                        player = re.search(r'(\w+) left the game', decoded_line)
                        if player and player.group(1) in self.player_list:
                            self.player_list.remove(player.group(1))
                            self.player_count = len(self.player_list)
                    
                    # Parse TPS information (if available in console output)
                    tps_match = re.search(r'TPS: (\d+\.?\d*)', decoded_line)
                    if tps_match:
                        self.tps = float(tps_match.group(1))
                    
                    # Add to console output queue
                    self.console_output.put({
                        "timestamp": timestamp,
                        "type": message_type,
                        "message": decoded_line
                    })

    def _monitor_performance(self):
        """Monitor server performance metrics"""
        while self.is_running and self.process:
            try:
                # Get process metrics
                process = psutil.Process(self.process.pid)
                self.cpu_usage = process.cpu_percent()
                memory_info = process.memory_info()
                self.memory_usage = memory_info.rss // 1024 // 1024  # Convert to MB
                
                # Calculate world size
                world_path = self.server_path / "world"
                if world_path.exists():
                    total_size = 0
                    for path in world_path.rglob('*'):
                        if path.is_file():
                            total_size += path.stat().st_size
                    self.world_size = total_size // 1024 // 1024  # Convert to MB
                
                # Update server status
                if not process.is_running():
                    self.status = "crashed"
                    self.is_running = False
                    self.last_error = "Server process terminated unexpectedly"
                
                time.sleep(1)  # Update every second
                
            except Exception as e:
                self.logger.error(f"Error monitoring server performance: {e}")
                time.sleep(1)

    def start(self) -> Dict[str, Any]:
        """Start the Minecraft server"""
        if self.is_running:
            return {"status": "error", "message": "Server is already running"}
        
        try:
            # Start server process
            self.process = subprocess.Popen(
                ['java', '-Xms1G', '-Xmx2G', '-jar', 'server.jar', 'nogui'],
                cwd=str(self.server_path),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE
            )
            
            self.is_running = True
            self.status = "starting"
            self.start_time = time.time()
            
            # Start monitoring threads
            self.output_thread = threading.Thread(target=self._process_console_output)
            self.monitor_thread = threading.Thread(target=self._monitor_performance)
            self.output_thread.start()
            self.monitor_thread.start()
            
            # Initialize RCON connection
            if self.rcon_password:
                try:
                    self.rcon_client = mcrcon.MCRcon(
                        host="localhost",
                        password=self.rcon_password,
                        port=self.rcon_port
                    )
                    self.rcon_client.connect()
                except Exception as e:
                    self.logger.error(f"Failed to establish RCON connection: {e}")
            
            return {
                "status": "success",
                "message": "Server started successfully",
                "pid": self.process.pid
            }
            
        except Exception as e:
            self.last_error = str(e)
            self.status = "error"
            return {"status": "error", "message": str(e)}

    def stop(self, force: bool = False) -> Dict[str, Any]:
        """Stop the Minecraft server"""
        if not self.is_running:
            return {"status": "error", "message": "Server is not running"}
        
        try:
            if not force and self.rcon_client:
                # Try graceful shutdown through RCON
                try:
                    self.rcon_client.command("stop")
                    time.sleep(5)  # Give the server time to shut down
                except Exception as e:
                    self.logger.warning(f"Failed to stop server through RCON: {e}")
            
            if self.process and self.process.poll() is None:
                self.process.terminate()
                time.sleep(2)
                if self.process.poll() is None:
                    self.process.kill()
            
            self.is_running = False
            self.status = "stopped"
            self.process = None
            self.start_time = None
            
            if self.rcon_client:
                try:
                    self.rcon_client.disconnect()
                except:
                    pass
                self.rcon_client = None
            
            return {"status": "success", "message": "Server stopped successfully"}
            
        except Exception as e:
            self.last_error = str(e)
            return {"status": "error", "message": str(e)}

    def restart(self) -> Dict[str, Any]:
        """Restart the Minecraft server"""
        stop_result = self.stop()
        if stop_result["status"] == "error":
            return stop_result
        
        time.sleep(2)  # Wait for complete shutdown
        return self.start()

    def send_command(self, command: str) -> Dict[str, Any]:
        """Send a command to the server"""
        if not self.is_running:
            return {"status": "error", "message": "Server is not running"}
        
        try:
            if self.rcon_client:
                response = self.rcon_client.command(command)
                return {"status": "success", "message": response}
            elif self.process and self.process.stdin:
                self.process.stdin.write(f"{command}\n".encode())
                self.process.stdin.flush()
                return {"status": "success", "message": "Command sent"}
            else:
                return {"status": "error", "message": "No way to send command"}
        except Exception as e:
            self.last_error = str(e)
            return {"status": "error", "message": str(e)}

    def get_console_output(self, limit: int = 100, message_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get recent console output"""
        output = []
        try:
            # Create a temporary list from the queue without removing items
            temp_list = list(self.console_output.queue)
            
            # Filter and limit the output
            filtered_output = temp_list
            if message_type:
                filtered_output = [msg for msg in temp_list if msg["type"] == message_type]
            
            output = filtered_output[-limit:]
            
        except Exception as e:
            self.logger.error(f"Error getting console output: {e}")
        
        return output

    def get_server_properties(self) -> Dict[str, str]:
        """Get server properties"""
        properties = {
            'motd': 'A Minecraft Server',
            'server-port': '25565',
            'max-players': '20',
            'difficulty': 'normal',
            'enable-rcon': 'true',
            'rcon.port': '25575',
            'rcon.password': '',
            'server-ip': 'localhost',
            'version': 'unknown'
        }
        try:
            props_file = self.server_path / "server.properties"
            if props_file.exists():
                with open(props_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#'):
                            key, value = line.split('=', 1)
                            properties[key.strip()] = value.strip()
        except Exception as e:
            self.logger.error(f"Failed to read server properties: {e}")
        return properties

    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive server status"""
        uptime = time.time() - self.start_time if self.start_time else 0
        
        # Map internal status to frontend status
        status_map = {
            "stopped": "stopped",
            "starting": "starting",
            "running": "running",
            "stopping": "stopping",
            "crashed": "stopped",
            "error": "stopped"
        }
        
        return {
            "status": status_map.get(self.status, "stopped"),
            "is_running": self.is_running,
            "uptime": int(uptime),
            "performance": {
                "cpu_usage": self.cpu_usage,
                "memory_usage": self.memory_usage,
                "max_memory": self.max_memory,
                "tps": self.tps,
                "world_size": self.world_size
            },
            "players": {
                "count": self.player_count,
                "list": self.player_list
            },
            "last_error": self.last_error
        }

class ServerManager:
    def __init__(self, base_path: Path, logger: logging.Logger):
        self.base_path = base_path
        self.logger = logger
        self.servers: Dict[str, ServerProcess] = {}
        self._load_existing_servers()

    def _load_existing_servers(self):
        """Load existing server instances from the base path"""
        try:
            for server_dir in self.base_path.iterdir():
                if server_dir.is_dir() and (server_dir / 'server.jar').exists():
                    server_id = server_dir.name
                    self.servers[server_id] = ServerProcess(server_dir, server_id, self.logger)
        except Exception as e:
            self.logger.error(f"Error loading existing servers: {e}")

    def create_server(self, server_id: str) -> ServerProcess:
        """Create a new server instance"""
        if server_id in self.servers:
            raise ValueError(f"Server {server_id} already exists")
        
        server = ServerProcess(self.base_path / server_id, server_id, self.logger)
        self.servers[server_id] = server
        return server

    def get_server(self, server_id: str) -> Optional[ServerProcess]:
        """Get a server instance by ID"""
        return self.servers.get(server_id)

    def remove_server(self, server_id: str) -> bool:
        """Remove a server instance"""
        if server_id in self.servers:
            server = self.servers[server_id]
            if server.is_running:
                server.stop(force=True)
            del self.servers[server_id]
            return True
        return False

    def list_servers(self) -> List[Dict[str, Any]]:
        """List all servers and their basic status"""
        return [{
            "name": name,
            "status": server.status,
            "is_running": server.is_running,
            "player_count": server.player_count
        } for name, server in self.servers.items()] 