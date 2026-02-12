import json
import aiohttp
from config import logger, WS_URL


async def send_ws_message(ws, msg_type, payload):
    """Send a JSON message over the WebSocket connection."""
    if ws and not ws.closed:
        msg = {"type": msg_type, "payload": payload}
        await ws.send_json(msg)


async def ws_loop(hub_id, access_token, mqtt_client, automation_engine=None):
    """
    Connect to the backend WebSocket and handle incoming messages.
    Runs until the connection drops, then returns so the caller can reconnect.
    """
    from mqtt_handler import set_ws_send_callback, set_event_loop
    import asyncio

    loop = asyncio.get_running_loop()
    set_event_loop(loop)

    url = f"{WS_URL}/hubs/{hub_id}/ws?token={access_token}"

    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(url) as ws:
            logger.info("WebSocket Connected!")

            # Wire up the WS send callback for the MQTT thread
            async def _ws_send(msg_type, payload):
                await send_ws_message(ws, msg_type, payload)

            set_ws_send_callback(_ws_send)

            # Send initial heartbeat
            await send_ws_message(ws, "heartbeat", {})

            # Fetch automations on connect
            if automation_engine:
                await _fetch_automations(hub_id, access_token, automation_engine)

            async for msg in ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    logger.info(f"Received WS message: {data}")
                    await _handle_ws_message(data, mqtt_client, automation_engine)

                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    logger.warning("WebSocket Closed")
                    break
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error("WebSocket Error")
                    break


async def _handle_ws_message(data, mqtt_client, automation_engine):
    """Route incoming WebSocket messages to the appropriate handler."""
    msg_type = data.get("type")
    payload = data.get("payload", {})

    if msg_type == "device_command":
        _handle_device_command(payload, mqtt_client)

    elif msg_type == "sync_automations":
        # Backend pushes updated automation rules
        if automation_engine and isinstance(payload, list):
            automation_engine.load(payload)
            logger.info(f"Automations synced: {len(payload)} rules loaded")

    else:
        logger.debug(f"Unhandled WS message type: {msg_type}")


def _handle_device_command(payload, mqtt_client):
    """Publish a device command to MQTT."""
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


async def _fetch_automations(hub_id, access_token, automation_engine):
    """Fetch enabled automations from the backend REST API on startup.
    Falls back to local file if backend is unreachable."""
    from config import SERVER_URL

    try:
        url = f"{SERVER_URL}/hubs/{hub_id}/automations"
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    automations = await resp.json()
                    automation_engine.load(automations)  # also saves to disk
                    logger.info(f"Fetched {len(automations)} automations from backend")
                    return
                else:
                    logger.warning(f"Failed to fetch automations: HTTP {resp.status}")
    except Exception as e:
        logger.error(f"Error fetching automations from backend: {e}")

    # Fallback: load from local disk
    logger.info("Falling back to locally cached automations")
    automation_engine.load_from_disk()
