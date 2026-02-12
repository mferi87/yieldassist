import asyncio
import json
import paho.mqtt.client as mqtt
from config import logger, MQTT_BROKER, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD

# Module-level state
device_map = {}
_ws_send_callback = None
_event_loop = None
_automation_engine = None
_mqtt_client_ref = None


def set_event_loop(loop):
    """Set the asyncio event loop for scheduling coroutines from MQTT threads."""
    global _event_loop
    _event_loop = loop


def set_ws_send_callback(callback):
    """Set the async callback used to send messages over WebSocket."""
    global _ws_send_callback
    _ws_send_callback = callback


def set_automation_engine(engine):
    """Set the automation engine for evaluating rules on state changes."""
    global _automation_engine
    _automation_engine = engine


def _schedule_ws_send(msg_type, payload):
    """Schedule an async WS send from the MQTT thread."""
    if _ws_send_callback and _event_loop:
        asyncio.run_coroutine_threadsafe(
            _ws_send_callback(msg_type, payload),
            _event_loop
        )


def on_connect(client, userdata, flags, rc):
    logger.info(f"Connected to MQTT Broker with result code {rc}")
    client.subscribe("zigbee2mqtt/bridge/devices")
    client.subscribe("zigbee2mqtt/#")


def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload = msg.payload.decode()
        logger.info(f"MQTT Received: {topic} | {payload[:100]}...")

        if topic == "zigbee2mqtt/bridge/devices":
            _handle_device_discovery(payload)
        else:
            _handle_device_state(topic, payload)

    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")


def _handle_device_discovery(payload):
    """Process device list from zigbee2mqtt bridge."""
    global device_map
    devices = json.loads(payload)

    # Transform to backend format
    backend_devices = []
    for d in devices:
        if d.get("type") == "Coordinator":
            continue
        backend_devices.append({
            "ieee_address": d.get("ieee_address"),
            "friendly_name": d.get("friendly_name"),
            "model": d.get("definition", {}).get("model"),
            "vendor": d.get("definition", {}).get("vendor"),
            "description": d.get("definition", {}).get("description"),
            "exposes": d.get("definition", {}).get("exposes", [])
        })

    # Cache friendly_name → ieee_address mapping
    device_map = {}
    for d in devices:
        fname = d.get("friendly_name")
        ieee = d.get("ieee_address")
        if fname and ieee:
            device_map[fname] = ieee

    _schedule_ws_send("device_discovery", backend_devices)


def _handle_device_state(topic, payload):
    """Process state updates from individual devices."""
    parts = topic.split('/')
    if len(parts) < 2 or parts[1] == "bridge":
        return

    friendly_name = parts[1]

    # Resolve IEEE address
    ieee = device_map.get(friendly_name)
    if not ieee:
        if friendly_name.startswith("0x"):
            ieee = friendly_name
        else:
            logger.warning(f"Unknown device: {friendly_name}")
            return

    try:
        state_payload = json.loads(payload)
    except json.JSONDecodeError:
        return

    # Forward state to backend
    msg = {"ieee_address": ieee, "state": state_payload}
    _schedule_ws_send("device_state_update", msg)

    # Evaluate automations (engine caches state and returns MQTT actions)
    if _automation_engine and _mqtt_client_ref:
        actions = _automation_engine.update_device_state(ieee, state_payload)
        for action in actions:
            act_friendly = action.get("friendly_name")
            act_command = action.get("command")
            if act_friendly and act_command:
                act_topic = f"zigbee2mqtt/{act_friendly}/set"
                logger.info(f"Automation action → {act_topic}: {act_command}")
                _mqtt_client_ref.publish(act_topic, json.dumps(act_command))


def create_mqtt_client(automation_engine=None):
    """Create, configure, and return an MQTT client. Call loop_start() after."""
    global _automation_engine, _mqtt_client_ref

    _automation_engine = automation_engine

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    client.connect(MQTT_BROKER, MQTT_PORT, 60)

    _mqtt_client_ref = client
    return client
