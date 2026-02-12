import logging
import os
import time
from enum import Enum
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000/api")
WS_URL = os.getenv("WS_URL", "ws://localhost:8000/api")
USER_EMAIL = os.getenv("USER_EMAIL", "user@example.com")
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
CHIP_ID = os.getenv("CHIP_ID", "hub-" + str(int(time.time())))


class AgentState(Enum):
    REGISTERING = 0
    CONNECTING_WS = 1
    RUNNING = 2


# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("HubAgent")
