# SMHUB Bridge Script

Python bridge that runs on SMHUB Nano / Home Assistant host to forward
Zigbee2MQTT data to YieldAssist cloud and route commands back.

## Setup

```bash
pip install -r requirements.txt
cp config.example.yaml config.yaml
# Edit config.yaml with your settings
python bridge.py
```

## Configuration

Edit `config.yaml`:
- `cloud.url`: YieldAssist backend URL
- `cloud.api_key`: Hub API key from YieldAssist
- `mqtt.host`: MQTT broker address
- `mqtt.topic_prefix`: Zigbee2MQTT prefix (default: `zigbee2mqtt`)

## Running as Service

```bash
# Install as systemd service
sudo cp yieldassist-bridge.service /etc/systemd/system/
sudo systemctl enable yieldassist-bridge
sudo systemctl start yieldassist-bridge
```
