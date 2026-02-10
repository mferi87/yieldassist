from typing import Dict, List
import uuid
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[uuid.UUID, WebSocket] = {}

    async def connect(self, hub_id: uuid.UUID, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[hub_id] = websocket
        logger.info(f"Hub {hub_id} connected via WebSocket")

    def disconnect(self, hub_id: uuid.UUID):
        if hub_id in self.active_connections:
            del self.active_connections[hub_id]
            logger.info(f"Hub {hub_id} disconnected")

    async def send_personal_message(self, message: str, hub_id: uuid.UUID):
        if hub_id in self.active_connections:
            await self.active_connections[hub_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()
