import os
import asyncio
import logging
from pathlib import Path
from flask import Flask, redirect, url_for
from flask_cors import CORS
import websockets
from logging.handlers import RotatingFileHandler
import threading
from fastapi import FastAPI, WebSocket, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
import json
from datetime import datetime
from typing import Optional
from .api.websocket import WebSocketServer
from .core.server_manager import ServerManager
from .api.sse import EventSourceResponse

from server.config.settings import (
    API_HOST,
    API_PORT,
    WS_PORT,
    CORS_ORIGINS,
    LOG_DIR,
    LOG_LEVEL,
    LOG_FORMAT
)

# Set up logging first
def setup_logging():
    """Configure logging for the application"""
    log_file = Path(LOG_DIR) / 'server.log'
    log_file.parent.mkdir(parents=True, exist_ok=True)
    
    formatter = logging.Formatter(LOG_FORMAT)
    
    # File handler
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    file_handler.setFormatter(formatter)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(LOG_LEVEL)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    return root_logger

# Setup logging before importing routes
logger = setup_logging()
logger.info("Starting Minecraft Server Manager")

# Import routes after logging is configured
from server.app.api.routes import api
from server.app.api.websocket import ws_server

# Initialize Flask app
def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__)
    
    # Configure CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": CORS_ORIGINS,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type"],
            "supports_credentials": True
        }
    })
    
    # Root route redirect to API docs
    @app.route('/')
    def root():
        return redirect('/api/')
    
    # Register blueprints
    app.register_blueprint(api, url_prefix='/api')
    
    return app

async def start_websocket_server():
    """Start the WebSocket server"""
    async def handle_websocket(websocket, path):
        try:
            # Handle CORS headers for WebSocket upgrade
            origin = websocket.request_headers.get('Origin')
            if origin and origin in ['http://localhost:3000', 'http://127.0.0.1:3000']:
                response_headers = [
                    ('Access-Control-Allow-Origin', origin),
                    ('Access-Control-Allow-Methods', 'GET, POST'),
                    ('Access-Control-Allow-Headers', 'content-type'),
                    ('Access-Control-Allow-Credentials', 'true'),
                ]
                for key, value in response_headers:
                    websocket.response_headers.append((key.encode(), value.encode()))
            
            # Handle the WebSocket connection
            await ws_server.handle_client(websocket, path)
            
        except Exception as e:
            logger.error(f"Error in WebSocket connection: {e}")

    async with websockets.serve(handle_websocket, API_HOST, WS_PORT) as websocket_server:
        logger.info(f"WebSocket server started on ws://{API_HOST}:{WS_PORT}")
        await asyncio.Future()  # run forever

def run_flask_app():
    """Run the Flask application"""
    app = create_app()
    logger.info(f"REST API starting on http://{API_HOST}:{API_PORT}")
    app.run(host=API_HOST, port=API_PORT)

async def main_async():
    """Async main function to run both servers"""
    # Start Flask app in a separate thread
    flask_thread = threading.Thread(target=run_flask_app)
    flask_thread.daemon = True
    flask_thread.start()
    
    # Start WebSocket server in the main thread
    await start_websocket_server()

def main():
    """Main application entry point"""
    try:
        # Run both servers using asyncio
        asyncio.run(main_async())
    except KeyboardInterrupt:
        logger.info("Shutting down servers...")
    except Exception as e:
        logger.error(f"Error running servers: {e}")

if __name__ == '__main__':
    main()

app = FastAPI()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize server manager
server_manager = ServerManager()

# Initialize WebSocket server
ws_server = WebSocketServer(server_manager)

@app.get("/api/server/{server_name}/console/stream")
async def stream_console(
    server_name: str,
    response: Response,
    since: Optional[str] = Query(None)
):
    response.headers["Content-Type"] = "text/event-stream"
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Connection"] = "keep-alive"
    response.headers["X-Accel-Buffering"] = "no"

    server = server_manager.get_server(server_name)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    async def event_generator():
        last_size = len(server.console_history)
        last_timestamp = since

        while True:
            current_size = len(server.console_history)
            if current_size > last_size:
                # Get new logs since last check
                new_logs = server.console_history[last_size:current_size]
                if last_timestamp:
                    # Filter logs after the timestamp
                    new_logs = [
                        log for log in new_logs 
                        if log["timestamp"] > last_timestamp
                    ]

                if new_logs:
                    # Send new logs
                    yield f"data: {json.dumps({'logs': new_logs})}\n\n"
                    last_size = current_size
                    last_timestamp = new_logs[-1]["timestamp"]

            await asyncio.sleep(0.1)  # Small delay to prevent busy waiting

    return EventSourceResponse(event_generator()) 