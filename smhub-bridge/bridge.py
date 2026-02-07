#!/usr/bin/env python3
"""
YieldAssist SMHUB Bridge

Bridges Zigbee2MQTT (MQTT) to YieldAssist Cloud (REST API).

Features:
- Auto-registers with YieldAssist and polls for approval
- Subscribes to zigbee2mqtt/# for sensor data
- Batches readings and POSTs to /api/hubs/data
- Polls for commands and publishes to zigbee2mqtt/{device}/set
- Handles ZS-304Z soil moisture sensors and SONOFF SWV valves
"""

import asyncio
import json
import logging
import signal
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
import yaml
from paho.mqtt import client as mqtt_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("yieldassist-bridge")


class Config:
    """Configuration loader with persistent API key storage"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = Path(config_path)
        self._config: Dict[str, Any] = {}
        self.load()
    
    def load(self):
        if not self.config_path.exists():
            raise FileNotFoundError(
                f"Config file not found: {self.config_path}\n"
                f"Copy config.example.yaml to config.yaml and edit it."
            )
        
        with open(self.config_path) as f:
            self._config = yaml.safe_load(f)
        
        logger.info(f"Loaded config from {self.config_path}")
    
    def save(self):
        """Save config back to file (used for storing API key after approval)"""
        with open(self.config_path, 'w') as f:
            yaml.dump(self._config, f, default_flow_style=False)
        logger.info(f"Saved config to {self.config_path}")
    
    @property
    def cloud_url(self) -> str:
        return self._config["cloud"]["url"].rstrip("/")
    
    @property
    def api_key(self) -> Optional[str]:
        key = self._config["cloud"].get("api_key", "")
        # Return None if placeholder or empty
        if not key or key == "your-hub-api-key-here" or key.startswith("your-"):
            return None
        return key
    
    @api_key.setter
    def api_key(self, value: str):
        self._config["cloud"]["api_key"] = value
        self.save()
    
    @property
    def device_id(self) -> str:
        return self._config["cloud"].get("device_id", "smhub-bridge-01")
    
    @property
    def user_email(self) -> str:
        return self._config["cloud"].get("email", "")
    
    @property
    def batch_interval(self) -> int:
        return self._config["cloud"].get("batch_interval", 10)
    
    @property
    def mqtt_host(self) -> str:
        return self._config["mqtt"]["host"]
    
    @property
    def mqtt_port(self) -> int:
        return self._config["mqtt"].get("port", 1883)
    
    @property
    def mqtt_username(self) -> Optional[str]:
        return self._config["mqtt"].get("username") or None
    
    @property
    def mqtt_password(self) -> Optional[str]:
        return self._config["mqtt"].get("password") or None
    
    @property
    def topic_prefix(self) -> str:
        return self._config["mqtt"].get("topic_prefix", "zigbee2mqtt")
    
    @property
    def device_map(self) -> Dict[str, str]:
        return self._config.get("devices", {})
    
    @property
    def log_level(self) -> str:
        return self._config.get("logging", {}).get("level", "INFO")


class SensorDataBuffer:
    """Buffers sensor readings for batch upload"""
    
    def __init__(self):
        self.readings: List[Dict[str, Any]] = []
        self.valves: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()
    
    async def add_sensor_reading(self, device_id: str, sensor_type: str, value: Any, name: Optional[str] = None):
        async with self._lock:
            self.readings.append({
                "sensor_id": device_id,
                "sensor_type": sensor_type,
                "value": value,
                "name": name
            })
    
    async def add_valve_state(self, device_id: str, is_open: bool, name: Optional[str] = None):
        async with self._lock:
            # Update existing or add new
            for v in self.valves:
                if v["valve_id"] == device_id:
                    v["is_open"] = is_open
                    return
            self.valves.append({
                "valve_id": device_id,
                "is_open": is_open,
                "name": name
            })
    
    async def flush(self) -> Dict[str, Any]:
        """Get and clear buffered data"""
        async with self._lock:
            data = {
                "readings": self.readings.copy(),
                "valves": self.valves.copy()
            }
            self.readings.clear()
            # Don't clear valves - we want to report current state each time
            return data


class YieldAssistClient:
    """HTTP client for YieldAssist API with registration support"""
    
    def __init__(self, config: Config):
        self.config = config
        self._api_key: Optional[str] = config.api_key
        self.client: Optional[httpx.AsyncClient] = None
        self._init_client()
    
    def _init_client(self):
        """Initialize or reinitialize the HTTP client"""
        headers = {}
        if self._api_key:
            headers["X-Hub-API-Key"] = self._api_key
        
        self.client = httpx.AsyncClient(
            base_url=self.config.cloud_url,
            headers=headers,
            timeout=30.0
        )
    
    def set_api_key(self, api_key: str):
        """Set API key and reinitialize client"""
        self._api_key = api_key
        self.config.api_key = api_key  # Persist to config file
        self._init_client()
        logger.info("API key set and saved")
    
    @property
    def is_registered(self) -> bool:
        return self._api_key is not None
    
    async def register(self) -> bool:
        """Register the hub with YieldAssist"""
        try:
            response = await self.client.post("/api/hubs/register", json={
                "device_id": self.config.device_id,
                "email": self.config.user_email
            })
            if response.status_code == 200:
                logger.info(f"Hub registered: {self.config.device_id}")
                return True
            elif response.status_code == 404:
                logger.error(f"User not found: {self.config.user_email}")
            else:
                logger.error(f"Registration failed: {response.status_code} - {response.text}")
        except httpx.RequestError as e:
            logger.error(f"Registration request failed: {e}")
        return False
    
    async def check_approval(self) -> Optional[str]:
        """Check if hub is approved and get API key"""
        try:
            response = await self.client.post("/api/hubs/check-status", json={
                "device_id": self.config.device_id
            })
            if response.status_code == 200:
                data = response.json()
                if data.get("is_approved") and data.get("api_key"):
                    return data["api_key"]
            elif response.status_code == 404:
                # Hub not found, need to register
                return None
        except httpx.RequestError as e:
            logger.error(f"Check approval request failed: {e}")
        return None
    
    async def send_data(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Send sensor data and get sync commands back"""
        if not self.is_registered:
            logger.warning("Cannot send data: not registered")
            return None
        
        try:
            response = await self.client.post("/api/hubs/data", json=data)
            response.raise_for_status()
            result = response.json()
            logger.debug(f"Sent data, got response: {result}")
            return result
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error sending data: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"Request error sending data: {e}")
        return None
    
    async def close(self):
        if self.client:
            await self.client.aclose()


class MQTTBridge:
    """MQTT to REST API bridge"""
    
    # Sensor type mapping from Zigbee2MQTT attributes to YieldAssist types
    SENSOR_TYPE_MAP = {
        "soil_moisture": "soil_moisture",
        "temperature": "temperature",
        "humidity": "humidity",
        "illuminance": "light",
        "battery": "battery",
    }
    
    def __init__(self, config: Config):
        self.config = config
        self.buffer = SensorDataBuffer()
        self.api_client = YieldAssistClient(config)
        self.mqtt: Optional[mqtt_client.Client] = None
        self._running = False
        self._device_names: Dict[str, str] = {}  # Cache friendly names
        self._loop: Optional[asyncio.AbstractEventLoop] = None  # Store main event loop
    
    def _get_device_id(self, friendly_name: str) -> str:
        """Map Zigbee2MQTT friendly_name to YieldAssist device_id"""
        return self.config.device_map.get(friendly_name, friendly_name)
    
    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        """MQTT connect callback"""
        if reason_code == 0:
            logger.info("Connected to MQTT broker")
            # Subscribe to all Zigbee2MQTT device topics
            topic = f"{self.config.topic_prefix}/+"
            client.subscribe(topic)
            logger.info(f"Subscribed to {topic}")
        else:
            logger.error(f"MQTT connection failed: {reason_code}")
    
    def _on_message(self, client, userdata, msg):
        """MQTT message callback"""
        try:
            # Parse topic: zigbee2mqtt/{friendly_name}
            parts = msg.topic.split("/")
            if len(parts) < 2:
                return
            
            friendly_name = parts[1]
            
            # Skip bridge messages and /set /get topics
            if friendly_name in ("bridge", "coordinator") or len(parts) > 2:
                return
            
            # Parse payload
            try:
                payload = json.loads(msg.payload.decode())
            except json.JSONDecodeError:
                return
            
            if not isinstance(payload, dict):
                return
            
            # Get device ID
            device_id = self._get_device_id(friendly_name)
            self._device_names[device_id] = friendly_name
            
            # Schedule async processing in the main event loop (thread-safe)
            if self._loop:
                # Capture variables for the closure
                d_id, f_name, p = device_id, friendly_name, payload
                self._loop.call_soon_threadsafe(
                    lambda: self._loop.create_task(self._process_device_payload(d_id, f_name, p))
                )
            
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")
    
    async def _process_device_payload(self, device_id: str, friendly_name: str, payload: Dict[str, Any]):
        """Process a device payload and buffer readings"""
        
        # Check if it's a valve (has 'state' field)
        if "state" in payload:
            is_open = payload["state"].upper() == "ON"
            await self.buffer.add_valve_state(device_id, is_open, friendly_name)
            logger.debug(f"Valve {device_id}: {'OPEN' if is_open else 'CLOSED'}")
        
        # Process sensor readings
        for attr, sensor_type in self.SENSOR_TYPE_MAP.items():
            if attr in payload:
                value = payload[attr]
                await self.buffer.add_sensor_reading(
                    device_id=f"{device_id}:{attr}",
                    sensor_type=sensor_type,
                    value=value,
                    name=f"{friendly_name} {attr.replace('_', ' ').title()}"
                )
                logger.debug(f"Sensor {device_id}:{attr} = {value}")
    
    async def _process_sync_commands(self, sync_data: Dict[str, Any]):
        """Process commands from YieldAssist and publish to MQTT"""
        if not sync_data:
            return
        
        valves = sync_data.get("valves", [])
        for valve_cmd in valves:
            valve_id = valve_cmd.get("valve_id")
            is_open = valve_cmd.get("is_open")
            
            if valve_id is None or is_open is None:
                continue
            
            # Find the original friendly name
            friendly_name = None
            for name, mapped_id in self.config.device_map.items():
                if mapped_id == valve_id:
                    friendly_name = name
                    break
            if not friendly_name:
                friendly_name = valve_id
            
            # Publish valve command
            topic = f"{self.config.topic_prefix}/{friendly_name}/set"
            payload = json.dumps({"state": "ON" if is_open else "OFF"})
            
            logger.info(f"Sending command to {topic}: {payload}")
            self.mqtt.publish(topic, payload)
    
    async def _wait_for_approval(self):
        """Wait for hub approval, polling every 10 seconds"""
        logger.info("=" * 50)
        logger.info("Hub not yet approved.")
        logger.info(f"Device ID: {self.config.device_id}")
        logger.info(f"User email: {self.config.user_email}")
        logger.info("Please approve this hub in the YieldAssist frontend.")
        logger.info("=" * 50)
        
        # First, register (if not already)
        await self.api_client.register()
        
        while self._running:
            api_key = await self.api_client.check_approval()
            if api_key:
                self.api_client.set_api_key(api_key)
                logger.info("✅ Hub approved! API key received and saved.")
                return True
            
            logger.info("Waiting for approval... (checking every 10 seconds)")
            await asyncio.sleep(10)
        
        return False
    
    async def _batch_upload_loop(self):
        """Periodically upload buffered sensor data"""
        while self._running:
            await asyncio.sleep(self.config.batch_interval)
            
            # Skip if not registered
            if not self.api_client.is_registered:
                continue
            
            data = await self.buffer.flush()
            
            if not data["readings"] and not data["valves"]:
                logger.debug("No data to send")
                continue
            
            logger.info(f"Sending batch: {len(data['readings'])} readings, {len(data['valves'])} valves")
            
            response = await self.api_client.send_data(data)
            
            if response:
                # Process any sync commands
                sync = response.get("sync", {})
                await self._process_sync_commands(sync)
    
    async def start(self):
        """Start the bridge"""
        logger.info("Starting YieldAssist Bridge...")
        
        # Store the main event loop for thread-safe callbacks
        self._loop = asyncio.get_running_loop()
        self._running = True
        
        # Check if we need to wait for approval
        if not self.api_client.is_registered:
            if not self.config.user_email:
                logger.error("No email configured! Set 'email' in config.yaml under 'cloud' section.")
                return
            
            # Wait for approval in the background while starting MQTT
            asyncio.create_task(self._wait_for_approval())
        else:
            logger.info("Hub already registered with API key")
        
        # Configure MQTT client
        self.mqtt = mqtt_client.Client(
            callback_api_version=mqtt_client.CallbackAPIVersion.VERSION2,
            client_id=f"yieldassist-bridge-{datetime.now().timestamp()}"
        )
        
        if self.config.mqtt_username:
            self.mqtt.username_pw_set(self.config.mqtt_username, self.config.mqtt_password)
        
        self.mqtt.on_connect = self._on_connect
        self.mqtt.on_message = self._on_message
        
        # Connect to MQTT
        logger.info(f"Connecting to MQTT broker at {self.config.mqtt_host}:{self.config.mqtt_port}")
        self.mqtt.connect(self.config.mqtt_host, self.config.mqtt_port, 60)
        self.mqtt.loop_start()
        
        # Start batch upload loop
        await self._batch_upload_loop()
    
    async def stop(self):
        """Stop the bridge"""
        logger.info("Stopping YieldAssist Bridge...")
        self._running = False
        
        if self.mqtt:
            self.mqtt.loop_stop()
            self.mqtt.disconnect()
        
        await self.api_client.close()
        logger.info("Bridge stopped")


async def main():
    # Load configuration
    config_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"
    
    try:
        config = Config(config_path)
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)
    
    # Set log level
    logging.getLogger().setLevel(config.log_level)
    
    # Create bridge
    bridge = MQTTBridge(config)
    
    # Handle shutdown signals
    loop = asyncio.get_event_loop()
    
    def shutdown():
        logger.info("Shutdown signal received")
        asyncio.create_task(bridge.stop())
    
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown)
    
    # Run bridge
    try:
        await bridge.start()
    except KeyboardInterrupt:
        await bridge.stop()


if __name__ == "__main__":
    asyncio.run(main())
