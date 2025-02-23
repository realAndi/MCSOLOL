import asyncio
import websockets
import json
import logging
from typing import Dict, Set
from ..core.server_manager import ServerManager
from server.config.settings import MINECRAFT_DIR
import queue

# Set up logger for websocket server
logger = logging.getLogger('websocket_server')

class WebSocketServer:
    def __init__(self):
        self.clients: Dict[str, Set[websockets.WebSocketServerProtocol]] = {}
        self.console_clients: Dict[str, Set[websockets.WebSocketServerProtocol]] = {}
        self.server_manager = ServerManager(base_path=MINECRAFT_DIR, logger=logger, load_existing=True)
        self.output_tasks: Dict[str, asyncio.Task] = {}

    async def register(self, websocket: websockets.WebSocketServerProtocol, server_name: str, message_type: str = "status"):
        """Register a client for a specific server's updates"""
        if message_type == "console":
            if server_name not in self.console_clients:
                self.console_clients[server_name] = set()
            self.console_clients[server_name].add(websocket)
            logger.info(f"Client registered for server {server_name} console updates")
        else:
            if server_name not in self.clients:
                self.clients[server_name] = set()
            self.clients[server_name].add(websocket)
            logger.info(f"Client registered for server {server_name} status updates")
            
        # Start monitoring this server's output
        self.start_output_monitor(server_name)

    async def unregister(self, websocket: websockets.WebSocketServerProtocol, server_name: str):
        """Unregister a client"""
        if server_name in self.clients and websocket in self.clients[server_name]:
            self.clients[server_name].remove(websocket)
            if not self.clients[server_name]:
                del self.clients[server_name]
                
        if server_name in self.console_clients and websocket in self.console_clients[server_name]:
            self.console_clients[server_name].remove(websocket)
            if not self.console_clients[server_name]:
                del self.console_clients[server_name]
                
        # Stop monitoring if no clients are connected
        if (server_name not in self.clients and 
            server_name not in self.console_clients):
            self.stop_output_monitor(server_name)

    def start_output_monitor(self, server_name: str):
        """Start monitoring a server's output"""
        if server_name not in self.output_tasks:
            task = asyncio.create_task(self.monitor_server_output(server_name))
            self.output_tasks[server_name] = task
            logger.info(f"Started output monitor for server {server_name}")

    def stop_output_monitor(self, server_name: str):
        """Stop monitoring a server's output"""
        if server_name in self.output_tasks:
            self.output_tasks[server_name].cancel()
            del self.output_tasks[server_name]
            logger.info(f"Stopped output monitor for server {server_name}")

    async def monitor_server_output(self, server_name: str):
        """Monitor server output and broadcast to clients"""
        try:
            server = self.server_manager.get_server(server_name)
            if not server:
                logger.error(f"Server {server_name} not found")
                return

            last_status = None
            last_timestamp = None
            
            logger.info(f"Starting console monitor for {server_name}")
            logger.info(f"Number of console clients: {len(self.console_clients.get(server_name, set()))}")
            
            # Send initial status
            status = server.get_status()
            await self.broadcast_server_status(server_name, status)
            last_status = status["status"]
            
            # Get initial console output
            console_output = server.get_console_output(limit=100)
            if console_output:
                last_timestamp = console_output[-1]["timestamp"]
                # Send initial console output to clients
                for entry in console_output:
                    await self.broadcast_console_output(server_name, entry)
                    logger.debug(f"Sent initial console entry: {entry['message'][:100]}")
            
            while True:
                # Get server status
                status = server.get_status()
                if status["status"] != last_status:
                    logger.info(f"Broadcasting status change for {server_name}: {status['status']}")
                    await self.broadcast_server_status(server_name, status)
                    last_status = status["status"]

                # Get console output
                console_output = server.get_console_output(limit=1000)  # Get more history to ensure we don't miss messages
                
                if console_output:
                    # Find new messages by timestamp
                    if last_timestamp:
                        new_entries = [
                            entry for entry in console_output 
                            if entry["timestamp"] > last_timestamp
                        ]
                    else:
                        new_entries = console_output
                    
                    if new_entries:
                        logger.info(f"Found {len(new_entries)} new console entries for {server_name}")
                        for entry in new_entries:
                            logger.info(f"Broadcasting console output for {server_name}: {entry['message'][:100]}")
                            await self.broadcast_console_output(server_name, entry)
                        last_timestamp = new_entries[-1]["timestamp"]
                
                # Check if server is still running
                if not server.is_running and status["status"] == "stopped":
                    logger.info(f"Server {server_name} has stopped, ending monitor")
                    # Send final status update
                    await self.broadcast_server_status(server_name, status)
                    break
                
                await asyncio.sleep(0.1)  # Check every 100ms
                
        except asyncio.CancelledError:
            logger.info(f"Output monitor cancelled for server {server_name}")
        except Exception as e:
            logger.error(f"Error monitoring server output: {e}")
            raise

    async def broadcast_server_status(self, server_name: str, data: dict):
        """Broadcast server status to all connected clients"""
        if server_name in self.clients:
            message = json.dumps({
                "type": "server_status",
                "server": server_name,
                "data": data
            })
            websockets_to_remove = set()
            
            for websocket in self.clients[server_name]:
                try:
                    await websocket.send(message)
                except websockets.exceptions.ConnectionClosed:
                    websockets_to_remove.add(websocket)
            
            # Clean up closed connections
            for websocket in websockets_to_remove:
                await self.unregister(websocket, server_name)

    async def broadcast_console_output(self, server_name: str, entry: dict):
        """Broadcast console output to all connected console clients"""
        if server_name in self.console_clients:
            message = json.dumps({
                "type": "console_output",
                "server": server_name,
                "data": {
                    "timestamp": entry["timestamp"],
                    "type": entry["type"],
                    "content": entry["message"]
                }
            })
            
            num_clients = len(self.console_clients[server_name])
            logger.debug(f"Broadcasting to {num_clients} console clients for {server_name}")
            websockets_to_remove = set()
            
            for websocket in self.console_clients[server_name]:
                try:
                    await websocket.send(message)
                    logger.debug(f"Successfully sent console message to client")
                except websockets.exceptions.ConnectionClosed:
                    logger.warning(f"Client connection closed while sending message")
                    websockets_to_remove.add(websocket)
                except Exception as e:
                    logger.error(f"Error sending console output: {e}")
                    websockets_to_remove.add(websocket)
            
            # Clean up closed connections
            for websocket in websockets_to_remove:
                await self.unregister(websocket, server_name)

    async def handle_client(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle WebSocket client connection"""
        try:
            # Extract server name from path
            parts = path.strip('/').split('/')
            server_name = parts[0]
            message_type = parts[1] if len(parts) > 1 else "status"
            
            if not server_name:
                logger.error("No server name provided in WebSocket path")
                return
            
            logger.info(f"New client connection for server {server_name} ({message_type})")
            
            # Register client
            await self.register(websocket, server_name, message_type)
            
            try:
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        logger.debug(f"Received message: {data}")
                        
                        if data['type'] == 'subscribe':
                            # Handle subscription to server updates
                            msg_type = data.get('message_type', 'status')
                            await self.register(websocket, data['server'], msg_type)
                        elif data['type'] == 'unsubscribe':
                            # Handle unsubscription from server updates
                            await self.unregister(websocket, data['server'])
                    except json.JSONDecodeError:
                        logger.error("Failed to decode message")
            finally:
                await self.unregister(websocket, server_name)
                
        except Exception as e:
            logger.error(f"Error handling client: {e}")

# Create WebSocket server instance
ws_server = WebSocketServer() 