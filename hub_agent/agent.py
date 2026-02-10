import asyncio
import json
import logging
import os
import sys
import aiohttp
import paho.mqtt.client as mqtt
from enum import Enum
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000/api")
WS_URL = os.getenv("WS_URL", "ws://localhost:8000/api") # Base WS URL 
USER_EMAIL = os.getenv("USER_EMAIL", "user@example.com")
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
CHIP_ID = os.getenv("CHIP_ID", "hub-" + str(int(time.time()))) # Generate random ID if not set

# Globals
hub_id = None
access_token = None
mqtt_client = None
ws_connection = None
device_map = {}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("HubAgent")

class AgentState(Enum):
    REGISTERING = 0
    CONNECTING_WS = 1
    RUNNING = 2

current_state = AgentState.REGISTERING

# MQTT Callbacks
def on_connect(client, userdata, flags, rc):
    logger.info(f"Connected to MQTT Broker with result code {rc}")
    client.subscribe("zigbee2mqtt/bridge/devices")
    client.subscribe("zigbee2mqtt/#") # Subscribe to all device updates

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload = msg.payload.decode()
        logger.info(f"MQTT Received: {topic} | {payload[:100]}...")
        
        if topic == "zigbee2mqtt/bridge/devices":
            # Device Discovery
            devices = json.loads(payload)
            # Transform to our backend format
            backend_devices = []
            for d in devices:
                if d.get("type") == "Coordinator": continue # Skip coordinator
                backend_devices.append({
                    "ieee_address": d.get("ieee_address"),
                    "friendly_name": d.get("friendly_name"),
                    "model": d.get("definition", {}).get("model"),
                    "vendor": d.get("definition", {}).get("vendor"),
                    "description": d.get("definition", {}).get("description"),
                    "exposes": d.get("definition", {}).get("exposes", [])
                })
            
            # Cache mapping
            global device_map
            device_map = {}
            for d in devices:
                fname = d.get("friendly_name")
                ieee = d.get("ieee_address")
                if fname and ieee:
                    device_map[fname] = ieee

            # Send to Backend via WS if connected
            if ws_connection and not ws_connection.closed:
                asyncio.run_coroutine_threadsafe(
                    send_ws_message("device_discovery", backend_devices),
                    loop
                )

        else:
            # Topic: zigbee2mqtt/<friendly_name>
            parts = topic.split('/')
            if len(parts) >= 2 and parts[1] != "bridge":
                friendly_name = parts[1]
                # Check if it is a set command confirmation or something else?
                # Z2M sends state to <friendly_name>.
                
                # Retrieve IEEE
                ieee = device_map.get(friendly_name)
                if not ieee:
                    # Fallback: if friendly_name looks like IEEE, use it
                    if friendly_name.startswith("0x"):
                         ieee = friendly_name
                    else:
                        # Try to find in existing map if not found (maybe reload?)
                        logger.warning(f"Unknown device: {friendly_name}")
                        return

                try:
                    state_payload = json.loads(payload)
                except json.JSONDecodeError:
                    # Ignore non-json payloads
                    return

                # Send to backend
                # Msg: { type: "device_state", payload: { ieee_address: ..., state: ... } }
                if ws_connection and not ws_connection.closed:
                     msg = {
                         "ieee_address": ieee,
                         "state": state_payload
                     }
                     asyncio.run_coroutine_threadsafe(
                        send_ws_message("device_state_update", msg),
                        loop
                     )

    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")

async def send_ws_message(msg_type, payload):
    if ws_connection:
        msg = {"type": msg_type, "payload": payload}
        await ws_connection.send_json(msg)

async def register_hub():
    global hub_id, access_token
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                payload = {
                    "server_address": "http://localhost", # Placeholder
                    "user_email": USER_EMAIL,
                    "chip_id": CHIP_ID
                }
                async with session.post(f"{SERVER_URL}/hubs/register", json=payload) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        status = data.get("status")
                        hub_id = data.get("hub_id")
                        token = data.get("access_token")
                        
                        logger.info(f"Registration status: {status}")
                        
                        if status == "approved" and token:
                            access_token = token
                            logger.info("Hub Approved! Token received.")
                            return True
                        elif status == "pending":
                            logger.info("Hub is Pending approval. Retrying in 10s...")
                        else:
                            logger.warning(f"Hub status is {status}. Retrying in 30s...")
                            await asyncio.sleep(20)
                            
            except Exception as e:
                logger.error(f"Registration failed: {e}. Retrying in 10s...")
            
            await asyncio.sleep(10)

async def ws_loop():
    global ws_connection
    url = f"{WS_URL}/hubs/{hub_id}/ws?token={access_token}"
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(url) as ws:
            ws_connection = ws
            logger.info("WebSocket Connected!")
            
            # Send initial heartbeat
            await send_ws_message("heartbeat", {})
            
            async for msg in ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    logger.info(f"Received WS message: {data}")
                    
                    msg_type = data.get("type")
                    if msg_type == "device_command":
                        payload = data.get("payload", {})
                        friendly_name = payload.get("friendly_name")
                        cmd = payload.get("command")
                        mode = payload.get("mode", "set")
                        
                        if friendly_name and (cmd or mode == "get"):
                            topic = f"zigbee2mqtt/{friendly_name}/{mode}"
                            
                            if mode == "get" and not cmd:
                                cmd = {"state": ""}

                            logger.info(f"Publishing command to {topic}: {cmd}")
                            mqtt_client.publish(topic, json.dumps(cmd))
                        else:
                            logger.warning(f"Invalid device_command payload: {payload}")
                        
                    # Handle incoming commands
                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    logger.warning("WebSocket Closed")
                    break
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error("WebSocket Error")
                    break

async def main():
    global loop
    loop = asyncio.get_running_loop()
    
    # Start MQTT Client
    global mqtt_client
    mqtt_client = mqtt.Client()
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    
    try:
        if MQTT_USERNAME and MQTT_PASSWORD:
            mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
            
        # Connect to MQTT non-blocking? Paho connect is blocking.
        # But loop_start starts a thread.
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
    except Exception as e:
        logger.error(f"Failed to connect to MQTT: {e}")

    # Register
    await register_hub()
    
    # WS Loop
    while True:
        try:
            await ws_loop()
        except Exception as e:
            logger.error(f"WS connection failed: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
