import asyncio
from config import logger
from registration import register_hub
from mqtt_handler import create_mqtt_client
from ws_handler import ws_loop
from automation_engine import AutomationEngine


async def main():
    logger.info("Hub Agent starting...")

    # 1. Register with backend (retries until approved)
    hub_id, access_token = await register_hub()

    # 2. Initialize automation engine
    engine = AutomationEngine()

    # 3. Start MQTT client
    try:
        mqtt_client = create_mqtt_client(automation_engine=engine)
        mqtt_client.loop_start()
        logger.info("MQTT client started")
    except Exception as e:
        logger.error(f"Failed to connect to MQTT: {e}")
        mqtt_client = None

    # 4. WebSocket reconnect loop
    while True:
        try:
            await ws_loop(hub_id, access_token, mqtt_client, engine)
        except Exception as e:
            logger.error(f"WS connection failed: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
