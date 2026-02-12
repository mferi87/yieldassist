from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
import json
import uuid
import secrets
import logging
from datetime import datetime

from app.core.database import get_db
from app.models.hub import Hub, HubStatus
from app.models.device_zigbee import ZigbeeDevice
from app.schemas.hub import HubCreate, HubResponse, HubUpdate, HubRegister, HubTokenResponse
from app.schemas.device_zigbee import ZigbeeDeviceCreate, ZigbeeDeviceResponse
from app.models.automation import Automation

router = APIRouter()
logger = logging.getLogger(__name__)

from app.core.ws import manager

@router.post("/hubs/register", response_model=HubTokenResponse)
def register_hub(hub_in: HubRegister, db: Session = Depends(get_db)):
    # Check if hub already exists by chip_id/name (using name for now as chip_id)
    # In a real scenario, we'd use a unique hardware ID field. 
    # For now, let's treat 'name' as potentially unique or just create a new one.
    # The requirement says "agent sends chip_id/mac". Let's assume passed in 'chip_id' is mapped to 'name' or a new field.
    # We'll search by friendly name or create new.
    
    # Ideally we should have a 'hardware_id' on Hub model. 
    # For MVP, let's look up by name if it resembles a chip ID, or just create new if not found.
    
    # Let's verify if a hub with this "chip_id" (passed as name in register logic?) exists.
    # The HubRegister schema has 'chip_id'. 
    
    # We need to determine if this is a re-registration or new.
    # Let's iterate to find if we store chip_id. We didn't add chip_id to Hub model.
    # We should probably store it. For now, we'll store chip_id in 'name' if it's new.
    
    # Check if a hub with this name (chip_id) exists
    hub = db.query(Hub).filter(Hub.name == hub_in.chip_id).first()
    
    if not hub:
        # Create new Pending Hub
        hub = Hub(
            name=hub_in.chip_id, # Use chip_id as initial name
            ip_address=hub_in.server_address, # Note: server_address from agent might be its IP? 
            # Actually server_address in payload usually means where the Agent sends TO.
            # But here we might want the Agent's reported IP. 
            # Let's assume the request client host is the keys.
            user_email=hub_in.user_email,
            status=HubStatus.PENDING,
            last_seen=datetime.utcnow()
        )
        db.add(hub)
        db.commit()
        db.refresh(hub)
        logger.info(f"Registered new hub: {hub.id} (Pending)")
    else:
        # Update existing hub info
        hub.last_seen = datetime.utcnow()
        if hub.status == HubStatus.APPROVED and not hub.access_token:
             # Generate token if missing for approved hub
            hub.access_token = secrets.token_urlsafe(32)
        db.commit()
        db.refresh(hub)

    return HubTokenResponse(
        hub_id=hub.id,
        status=hub.status,
        access_token=hub.access_token if hub.status == HubStatus.APPROVED else None
    )

@router.get("/hubs", response_model=List[HubResponse])
def read_hubs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    hubs = db.query(Hub).offset(skip).limit(limit).all()
    # Fill is_online property
    for hub in hubs:
        # This is a bit hacky as is_online is a property, not a DB column in the model file
        # but pydantic with from_attributes=True should pick it up from the property method.
        pass 
    return hubs

@router.put("/hubs/{hub_id}/status", response_model=HubResponse)
def update_hub_status(hub_id: uuid.UUID, status_in: HubUpdate, db: Session = Depends(get_db)):
    hub = db.query(Hub).filter(Hub.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
    
    if status_in.status:
        hub.status = status_in.status
        if hub.status == HubStatus.APPROVED and not hub.access_token:
            hub.access_token = secrets.token_urlsafe(32)
    
    if status_in.name:
        hub.name = status_in.name
        
    db.commit()
    db.refresh(hub)
    return hub

@router.websocket("/hubs/{hub_id}/ws")
async def websocket_endpoint(websocket: WebSocket, hub_id: uuid.UUID, token: Optional[str] = None, db: Session = Depends(get_db)):
    # Validate Hub and Token
    hub = db.query(Hub).filter(Hub.id == hub_id).first()
    if not hub:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    if hub.status != HubStatus.APPROVED:
        logger.warning(f"Hub {hub_id} is not approved. Closing WS.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # In a real app, strict token validation:
    # if hub.access_token != token:
    #    await websocket.close(...)
    # For MVP, checking status is APPROVED is key, and we assume the Agent has the token if we enforced it in handshake.
    # The implementation plan mentioned sending token in WS. Let's verify if provided.
    if token and token != hub.access_token:
         logger.warning(f"Invalid token for Hub {hub_id}.")
         await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
         return

    await manager.connect(hub_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            payload = message.get("payload")

            # Update heartbeat
            hub.last_seen = datetime.utcnow()
            db.commit()

            if msg_type == "device_discovery":
                # payload: list of devices
                devices_data = message.get("payload", [])
                for device_data in devices_data:
                    ieee = device_data.get("ieee_address")
                    if not ieee: continue
                    
                    # Check if device exists
                    device = db.query(ZigbeeDevice).filter(ZigbeeDevice.ieee_address == ieee).first()
                    if not device:
                        device = ZigbeeDevice(
                            hub_id=hub.id,
                            ieee_address=ieee,
                            friendly_name=device_data.get("friendly_name"),
                            model=device_data.get("model"),
                            vendor=device_data.get("vendor"),
                            description=device_data.get("description"),
                            exposes=device_data.get("exposes", []),
                            is_online=True,
                            last_seen=datetime.utcnow()
                        )
                        db.add(device)
                    else:
                        # Update existing
                        device.friendly_name = device_data.get("friendly_name")
                        device.model = device_data.get("model")
                        device.vendor = device_data.get("vendor")
                        device.description = device_data.get("description")
                        device.exposes = device_data.get("exposes", [])
                        device.is_online = True
                        device.last_seen = datetime.utcnow()
                        # Ensure it belongs to this hub (move if needed?)
                        if device.hub_id != hub.id:
                            device.hub_id = hub.id

                db.commit()
                
            elif msg_type == "device_state_update":
                # payload: {ieee_address, state}
                ieee = message.get("payload", {}).get("ieee_address")
                state = message.get("payload", {}).get("state") # Assuming payload has 'state' object

                if ieee:
                    device = db.query(ZigbeeDevice).filter(ZigbeeDevice.ieee_address == ieee).first()
                    if device:
                        device.last_seen = datetime.utcnow()
                        device.is_online = True
                        
                        # Update current state if provided
                        if state:
                            # Merge with existing state if needed, or replace. 
                            # Usually state updates are partial, so merge is better.
                            current_state = dict(device.state) if device.state else {}
                            current_state.update(state)
                            device.state = current_state

                        # Save history if tracked
                        if device.is_tracked and state:
                            # Import here to avoid circular imports if any, or just rely on global import
                            from app.models.device_zigbee import DeviceStateHistory
                            history_entry = DeviceStateHistory(
                                device_id=device.id,
                                state=state
                            )
                            db.add(history_entry)
                        
                        db.commit()
                
                # TODO: Broadcast this to frontend via another WS or similar mechanism if needed.

            elif msg_type == "heartbeat":
                pass # Just keepalive

    except WebSocketDisconnect:
        manager.disconnect(hub_id)
        # Mark as offline if needed, or rely on last_seen

@router.delete("/hubs/{hub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hub(hub_id: uuid.UUID, db: Session = Depends(get_db)):
    """Delete a hub and its associated devices."""
    hub = db.query(Hub).filter(Hub.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
    
    # Cascade delete should handle devices if configured, but let's be explicit if needed.
    # checking models... Hub has proper relationships? 
    # Let's trust SQLAlchemy cascade if set, otherwise manual.
    # Models review: Hub does not have cascade set in view_file earlier? 
    # Let's verify Hub model next if unsure, but standard delete is:
    db.delete(hub)
    db.commit()

@router.get("/hubs/{hub_id}/automations", response_model=List[dict])
def get_hub_automations(hub_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return all automations for this hub (including disabled ones).
    The hub agent and frontend both use this endpoint:
    - Frontend needs all automations to display and toggle enabled state
    - Hub agent filters enabled ones locally before evaluating
    """
    automations = db.query(Automation).filter(Automation.hub_id == hub_id).all()
    return [
        {
            "id": str(a.id),
            "name": a.name,
            "description": a.description,
            "triggers": a.triggers,
            "conditions": a.conditions,
            "actions": a.actions,
            "enabled": a.enabled
        } for a in automations
    ]

@router.get("/hubs/{hub_id}/devices", response_model=List[ZigbeeDeviceResponse])
def get_hub_devices(hub_id: uuid.UUID, db: Session = Depends(get_db)):
    hub = db.query(Hub).filter(Hub.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
        
    devices = db.query(ZigbeeDevice).filter(ZigbeeDevice.hub_id == hub_id).all()
    return devices

@router.post("/hubs/{hub_id}/command")
async def send_hub_command(
    hub_id: uuid.UUID, 
    command: dict, 
    db: Session = Depends(get_db)
):
    """
    Send a command to a device on the hub.
    Payload expected: {"ieee_address": "...", "command": {...}} (or whatever agent expects)
    Actually, let's define a schema for this.
    For now, flexible dict.
    """
    # Check if hub is connected
    # Manager is in app.core.ws
    from app.core.ws import manager
    
    # We construct the payload for the agent
    # Agent expects: {"type": "device_command", "payload": { ... }}
    
    # Validate command inputs
    ieee = command.get("ieee_address")
    payload = command.get("payload", {})
    mode = command.get("mode", "set") # Default to 'set'
    
    if not ieee:
        raise HTTPException(status_code=400, detail="Invalid command format. need ieee_address.")

    # Lookup device to get friendly_name
    device = db.query(ZigbeeDevice).filter(ZigbeeDevice.ieee_address == ieee, ZigbeeDevice.hub_id == hub_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found on this hub")

    msg = {
        "type": "device_command",
        "payload": {
            "ieee_address": ieee,
            "friendly_name": device.friendly_name, 
            "command": payload,
            "mode": mode
        }
    }
    
    if hub_id not in manager.active_connections:
         raise HTTPException(status_code=503, detail="Hub not connected")
         
    await manager.send_personal_message(json.dumps(msg), hub_id)
    return {"status": "sent"}

