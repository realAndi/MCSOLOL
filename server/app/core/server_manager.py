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
        self.console_history: List[Dict[str, Any]] = []  # Keep track of all console output
        self.is_running = False
        self.start_time: Optional[float] = None
        self.status = "stopped"
        self.last_error: Optional[str] = None
        self.output_thread: Optional[threading.Thread] = None
        self.monitor_thread: Optional[threading.Thread] = None
        self.version: Optional[str] = None
        
        # Performance metrics
        self.cpu_usage = 0.0
        self.memory_usage = 0
        self.max_memory = 2048  # Default max memory (2GB)
        self.tps = 20.0  # Default TPS
        self.world_size = 0
        self.player_count = 0
        self.player_list: List[str] = []
        
        # Load version from config if it exists
        self._load_version()
        
        # Server properties
        self.properties = self.get_server_properties()
        
        # RCON configuration from server.properties
        self.rcon_password = self.properties.get('rcon.password', '')
        self.rcon_port = int(self.properties.get('rcon.port', '25575'))
        self.rcon_client: Optional[mcrcon.MCRcon] = None

    def _load_version(self):
        """Load server version from config file"""
        try:
            config_file = self.server_path / 'server_config.json'
            if config_file.exists():
                with open(config_file, 'r') as f:
                    config = json.load(f)
                    self.version = config.get('version')
        except Exception as e:
            self.logger.error(f"Failed to load server config: {e}")

    def _save_version(self):
        """Save server version to config file"""
        try:
            config_file = self.server_path / 'server_config.json'
            config = {}
            if config_file.exists():
                with open(config_file, 'r') as f:
                    config = json.load(f)
            
            config['version'] = self.version
            
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save server config: {e}")

    def _detect_version_from_jar(self) -> Optional[str]:
        """Try to detect version from server.jar file"""
        try:
            jar_path = self.server_path / 'server.jar'
            if not jar_path.exists():
                return None

            # Try to get version from jar manifest
            with subprocess.Popen(
                ['jar', 'xf', str(jar_path), 'META-INF/MANIFEST.MF'],
                cwd=str(self.server_path),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            ) as process:
                process.wait()

            manifest_path = self.server_path / 'META-INF' / 'MANIFEST.MF'
            if manifest_path.exists():
                with open(manifest_path, 'r') as f:
                    manifest_content = f.read()
                    # Clean up extracted files
                    import shutil
                    shutil.rmtree(self.server_path / 'META-INF')
                    
                    # Look for version in manifest
                    for line in manifest_content.split('\n'):
                        if line.startswith('Implementation-Version:'):
                            return line.split(':', 1)[1].strip()
            
            return None
        except Exception as e:
            self.logger.error(f"Failed to detect version from jar: {e}")
            return None

    def _process_console_output(self):
        """Process and categorize console output"""
        self.logger.info("Starting console output processing")
        
        while self.is_running:
            if self.process and self.process.stdout:
                try:
                    # Check if process is still running
                    if self.process.poll() is not None:
                        self.logger.error(f"Server process terminated with code {self.process.poll()}")
                        self.is_running = False
                        break

                    line = self.process.stdout.readline().strip()
                    if not line:  # EOF
                        if not self.is_running:
                            break
                        time.sleep(0.1)  # Small delay to prevent CPU spinning
                        continue
                        
                    timestamp = datetime.now().isoformat()
                    self.logger.debug(f"Raw console output: {line}")
                    
                    # Update server status based on output
                    if "Done" in line and "For help, type" in line:
                        self.status = "running"
                        self.logger.info("Server is now running")
                    elif "Stopping server" in line:
                        self.status = "stopping"
                        self.logger.info("Server is stopping")
                    elif "Starting minecraft server" in line:
                        self.status = "starting"
                        self.logger.info("Server is starting")
                    
                    # Categorize message
                    message_type = "info"
                    if "[ERROR]" in line or "FAILED" in line:
                        message_type = "error"
                        self.last_error = line
                        self.logger.error(f"Server error: {line}")
                    elif "[WARN]" in line:
                        message_type = "warning"
                        self.logger.warning(f"Server warning: {line}")
                    
                    # Parse player events
                    if "joined the game" in line:
                        player = re.search(r'(\w+) joined the game', line)
                        if player and player.group(1) not in self.player_list:
                            self.player_list.append(player.group(1))
                            self.player_count = len(self.player_list)
                            self.logger.info(f"Player {player.group(1)} joined. Total players: {self.player_count}")
                    elif "left the game" in line:
                        player = re.search(r'(\w+) left the game', line)
                        if player and player.group(1) in self.player_list:
                            self.player_list.remove(player.group(1))
                            self.player_count = len(self.player_list)
                            self.logger.info(f"Player {player.group(1)} left. Total players: {self.player_count}")
                    
                    # Parse TPS information (if available in console output)
                    tps_match = re.search(r'TPS: (\d+\.?\d*)', line)
                    if tps_match:
                        self.tps = float(tps_match.group(1))
                        self.logger.debug(f"TPS updated: {self.tps}")
                    
                    # Create console entry
                    entry = {
                        "timestamp": timestamp,
                        "type": message_type,
                        "message": line
                    }
                    
                    # Add to both queue and history
                    try:
                        self.console_output.put_nowait(entry)
                        self.console_history.append(entry)
                        self.logger.debug(f"Added console entry: {entry['message'][:100]}")
                        
                        # Keep history size manageable (last 1000 messages)
                        if len(self.console_history) > 1000:
                            self.console_history = self.console_history[-1000:]
                            
                    except queue.Full:
                        self.logger.warning("Console output queue is full, dropping message")
                    
                except Exception as e:
                    self.logger.error(f"Error processing console output: {e}")
                    if not self.is_running:
                        break
                    time.sleep(0.1)  # Add small delay on error
            else:
                if not self.is_running:
                    break
                time.sleep(0.1)  # Small delay if process or stdout is not available
                    
        self.logger.info("Console output processing stopped")
        
        # Add final message to console
        if self.console_history:
            final_entry = {
                "timestamp": datetime.now().isoformat(),
                "type": "info",
                "message": "Server process terminated"
            }
            self.console_history.append(final_entry)
            try:
                self.console_output.put_nowait(final_entry)
            except queue.Full:
                pass

    def _monitor_performance(self):
        """Monitor server performance metrics"""
        self.logger.info("Starting performance monitoring")
        last_status = None
        
        while self.is_running and self.process:
            try:
                # Get process metrics
                process = psutil.Process(self.process.pid)
                if not process.is_running():
                    self.status = "crashed"
                    self.is_running = False
                    self.last_error = "Server process terminated unexpectedly"
                    break
                
                # Only update status if it has changed
                if self.status != last_status:
                    self.logger.info(f"Server status changed: {self.status}")
                    last_status = self.status
                    
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
                
                time.sleep(1)  # Update every second
                
            except psutil.NoSuchProcess:
                self.status = "stopped"
                self.is_running = False
                self.logger.info("Server process no longer exists")
                break
            except Exception as e:
                self.logger.error(f"Error monitoring server performance: {e}")
                time.sleep(1)
                
        self.logger.info("Performance monitoring stopped")

    def start(self) -> Dict[str, Any]:
        """Start the Minecraft server"""
        if self.is_running:
            return {"status": "error", "message": "Server is already running"}
        
        try:
            # Clear previous console history when starting
            self.console_history = []
            self.console_output = queue.Queue()
            
            # Start server process with line buffering
            self.process = subprocess.Popen(
                ['java', '-Xms1G', '-Xmx2G', '-jar', 'server.jar', 'nogui'],
                cwd=str(self.server_path),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
                bufsize=1,  # Line buffered
                universal_newlines=True,  # Text mode with universal newlines
                start_new_session=True  # Detach from parent process
            )
            
            self.is_running = True
            self.status = "starting"
            self.start_time = time.time()
            self.logger.info(f"Started Minecraft server process with PID {self.process.pid}")
            
            # Add initial startup message to console
            startup_entry = {
                "timestamp": datetime.now().isoformat(),
                "type": "info",
                "message": f"Starting Minecraft server with PID {self.process.pid}"
            }
            self.console_history.append(startup_entry)
            self.console_output.put_nowait(startup_entry)
            
            # Start monitoring threads
            self.output_thread = threading.Thread(target=self._process_console_output, daemon=True)
            self.monitor_thread = threading.Thread(target=self._monitor_performance, daemon=True)
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
                    self.logger.info("RCON connection established")
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
            self.logger.error(f"Failed to start server: {e}")
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
                try:
                    # Try graceful termination first
                    self.process.terminate()
                    for _ in range(10):  # Wait up to 10 seconds
                        if self.process.poll() is not None:
                            break
                        time.sleep(1)
                    
                    # If still running, force kill
                    if self.process.poll() is None:
                        self.process.kill()
                        self.process.wait(timeout=5)  # Wait up to 5 seconds for kill
                except Exception as e:
                    self.logger.error(f"Error stopping process: {e}")
                    # Try one last time with kill
                    try:
                        self.process.kill()
                    except:
                        pass
            
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
            
            # Add final message to console
            final_entry = {
                "timestamp": datetime.now().isoformat(),
                "type": "info",
                "message": "Server stopped"
            }
            self.console_history.append(final_entry)
            try:
                self.console_output.put_nowait(final_entry)
            except queue.Full:
                pass
            
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
                # Since we're using universal_newlines=True, we don't need to encode
                self.process.stdin.write(f"{command}\n")
                self.process.stdin.flush()
                return {"status": "success", "message": "Command sent"}
            else:
                return {"status": "error", "message": "No way to send command"}
        except Exception as e:
            self.last_error = str(e)
            return {"status": "error", "message": str(e)}

    def get_console_output(self, limit: int = 100, message_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get recent console output"""
        try:
            # Filter and limit the output from history
            filtered_output = self.console_history
            if message_type:
                filtered_output = [msg for msg in filtered_output if msg["type"] == message_type]
            
            # Make sure we return a copy to avoid modification issues
            result = filtered_output[-limit:]
            self.logger.debug(f"Returning {len(result)} console entries")
            return result
            
        except Exception as e:
            self.logger.error(f"Error getting console output: {e}")
            return []

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
        
        # Try to detect version if not set
        if not self.version:
            self.version = self._detect_version_from_jar()
            if self.version:
                self._save_version()
        
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
            "last_error": self.last_error,
            "version": self.version
        }

class ServerManager:
    def __init__(self, base_path: Path, logger: logging.Logger, load_existing: bool = False):
        self.base_path = base_path
        self.logger = logger
        self.servers: Dict[str, ServerProcess] = {}
        if load_existing:
            self._load_existing_servers()

    def _load_existing_servers(self):
        """Load existing server instances from the base path"""
        try:
            servers_dir = self.base_path / 'servers'
            if not servers_dir.exists():
                servers_dir.mkdir(parents=True, exist_ok=True)
                return

            for server_dir in servers_dir.iterdir():
                if server_dir.is_dir() and (server_dir / 'server.jar').exists():
                    server_id = server_dir.name
                    self.logger.info(f"Loading existing server: {server_id}")
                    self.servers[server_id] = ServerProcess(server_dir, server_id, self.logger)
                    self.logger.info(f"Successfully loaded server: {server_id}")
        except Exception as e:
            self.logger.error(f"Error loading existing servers: {e}")

    def create_server(self, server_id: str) -> ServerProcess:
        """Create a new server instance"""
        if server_id in self.servers:
            raise ValueError(f"Server {server_id} already exists")
        
        # Create server directory
        server_path = self.base_path / 'servers' / server_id
        server_path.mkdir(parents=True, exist_ok=True)
        
        # Create default server.properties
        properties_file = server_path / 'server.properties'
        with open(properties_file, 'w') as f:
            f.write("""# Minecraft server properties
motd=A Minecraft Server
server-port=25565
max-players=20
difficulty=normal
enable-rcon=true
rcon.port=25575
rcon.password=
server-ip=localhost
version=unknown
""")
        
        # Create eula.txt
        eula_file = server_path / 'eula.txt'
        with open(eula_file, 'w') as f:
            f.write('eula=true\n')
        
        # Create server instance
        server = ServerProcess(server_path, server_id, self.logger)
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
        self.logger.debug(f"Listing servers. Found {len(self.servers)} servers.")
        servers_list = [{
            "name": name,
            "status": server.status,
            "is_running": server.is_running,
            "player_count": server.player_count
        } for name, server in self.servers.items()]
        self.logger.debug(f"Server list: {servers_list}")
        return servers_list 