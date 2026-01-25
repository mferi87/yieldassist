from datetime import datetime
import secrets
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.device import Hub, Sensor, SensorType, Valve
from app.models.user import User
from app.schemas.hub import HubCreate, HubResponse, HubApproval, HubCheckLimit, HubApiKeyResponse
from pydantic import BaseModel

router = APIRouter(prefix="/hubs", tags=["Hubs"])

class HubSensorReading(BaseModel):
    sensor_id: str  # Unique ID for the sub-device/sensor (e.g. Zigbee MAC or Index)
    sensor_type: SensorType
    value: Any

class HubValveState(BaseModel):
    valve_id: str
    is_open: bool

class HubDataPayload(BaseModel):
    readings: List[HubSensorReading] = []
    valves: List[HubValveState] = []

async def verify_hub_api_key(
    x_hub_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Hub:
    if not x_hub_api_key:
        raise HTTPException(status_code=401, detail="Missing Hub API Key")
    
    hub = db.query(Hub).filter(Hub.api_key == x_hub_api_key).first()
    if not hub:
        raise HTTPException(status_code=401, detail="Invalid Hub API Key")
        
    return hub

@router.post("/register", response_model=HubResponse)
async def register_hub(
    hub_data: HubCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new Hub.
    If the hub already exists, update its info.
    """
    # Find user by email
    user = db.query(User).filter(User.email == hub_data.email).first()
    # For security, we shouldn't reveal if email exists, but for this mock setup it's fine.
    # Actually, we should probably allow registering a hub even if user doesn't exist yet?
    # No, user must exist.
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email not found"
        )

    # Check if hub exists
    hub = db.query(Hub).filter(Hub.device_id == hub_data.device_id).first()
    
    if hub:
        # Update existing hub
        hub.user = user
        hub.last_seen = datetime.utcnow()
    else:
        # Create new hub
        hub = Hub(
            device_id=hub_data.device_id,
            user=user,
            is_approved=False,
            last_seen=datetime.utcnow()
        )
        db.add(hub)
    
    db.commit()
    db.refresh(hub)
    return hub

@router.get("/my-hubs", response_model=List[HubResponse])
async def get_my_hubs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all hubs for the current user."""
    return db.query(Hub).filter(Hub.user_id == current_user.id).all()

@router.get("/my-pending", response_model=List[HubResponse])
async def get_my_pending_hubs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get pending hubs for the current user."""
    return db.query(Hub).filter(
        Hub.user_id == current_user.id,
        Hub.is_approved == False
    ).all()

@router.post("/approve", response_model=HubResponse)
async def approve_hub(
    approval_data: HubApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve a hub and generate an API key."""
    hub = db.query(Hub).filter(
        Hub.id == approval_data.hub_id,
        Hub.user_id == current_user.id
    ).first()

    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")

    hub.is_approved = True
    hub.name = approval_data.name
    hub.api_key = secrets.token_urlsafe(32)
    
    db.commit()
    db.refresh(hub)
    return hub

@router.post("/check-status", response_model=HubApiKeyResponse)
async def check_hub_status(
    check_data: HubCheckLimit,
    db: Session = Depends(get_db)
):
    """
    Device polls this endpoint to check if it has been approved.
    If approved, returns the API key.
    """
    hub = db.query(Hub).filter(Hub.device_id == check_data.device_id).first()
    
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
        
    return {
        "is_approved": hub.is_approved,
        "api_key": hub.api_key if hub.is_approved else None
    }

@router.post("/data")
async def receive_hub_data(
    payload: HubDataPayload,
    hub: Hub = Depends(verify_hub_api_key),
    db: Session = Depends(get_db)
):
    """
    Receive data from a Hub.
    Updates or creates sensors AND valves associated with this Hub.
    For simplicity, we find sensors by `device_id` which acts as the unique identifier.
    The hub sends `sensor_id` which we prepend with `hub.device_id` or treat as global device_id?
    Let's assume `sensor_id` sent by hub is unique within the hub context, or globally unique (Zigbee MAC).
    """
    
    # Update hub last seen
    hub.last_seen = datetime.utcnow()
    
    # Process readings
    for reading in payload.readings:
        # Construct a unique device ID for this sensor.
        # If it's a sub-device of the hub, we might just use the reading.sensor_id directly if it's a MAC.
        # For the mock, we can use "HUB_ID:SENSOR_ID"
        target_device_id = f"{hub.device_id}:{reading.sensor_id}"
        
        # Check if this sensor exists in the database
        # Note: In a real app, sensors might need to be explicitly registered to a Zone first.
        # But maybe we can auto-discover?
        # The user's request: "The user should be able to pair zigbee devices" -> Suggests dynamic discovery.
        # But for now, we just want to update values if they exist.
        
        sensor = db.query(Sensor).filter(Sensor.device_id == target_device_id).first()
        
        if sensor:
            sensor.last_reading = {"value": reading.value}
            sensor.last_seen = datetime.utcnow()
            sensor.sensor_type = reading.sensor_type
            # Ensure linked to hub if not already
            if not sensor.hub_id:
                sensor.hub_id = hub.id
        else:
            # Create new unassigned sensor linked to this hub
            sensor = Sensor(
                device_id=target_device_id,
                sensor_type=reading.sensor_type,
                zone_id=None, # Unassigned
                hub_id=hub.id,
                last_reading={"value": reading.value},
                last_seen=datetime.utcnow()
            )
            db.add(sensor)

    # Process valves
    for valve_data in payload.valves:
        target_device_id = f"{hub.device_id}:{valve_data.valve_id}"
        
        valve = db.query(Valve).filter(Valve.device_id == target_device_id).first()
        
        if valve:
            valve.is_open = valve_data.is_open
            # Only update last_activated if opening
            if valve_data.is_open and not valve.is_open:
                valve.last_activated = datetime.utcnow()
            
            if not valve.hub_id:
                valve.hub_id = hub.id
        else:
            valve = Valve(
                device_id=target_device_id,
                is_open=valve_data.is_open,
                zone_id=None,
                hub_id=hub.id,
                last_activated=datetime.utcnow() if valve_data.is_open else None
            )
            db.add(valve)

    db.commit()
    
    # Generate sync commands
    sync_commands = {}
    
    for valve_data in payload.valves:
        target_device_id = f"{hub.device_id}:{valve_data.valve_id}"
        valve = db.query(Valve).filter(Valve.device_id == target_device_id).first()
        
        if valve and valve.target_is_open is not None:
            # If target differs from reported, send command
            if valve.target_is_open != valve_data.is_open:
                # Add to sync commands. We need a structure for this.
                if "valves" not in sync_commands:
                    sync_commands["valves"] = []
                sync_commands["valves"].append({
                    "valve_id": valve_data.valve_id,
                    "is_open": valve.target_is_open
                })
            else:
                # State matches target, clear target
                valve.target_is_open = None
                db.add(valve)
                db.commit()

    return {"status": "ok", "sync": sync_commands}

@router.delete("/{hub_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hub(
    hub_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a hub."""
    hub = db.query(Hub).filter(
        Hub.id == hub_id,
        Hub.user_id == current_user.id
    ).first()
    
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
        
    db.delete(hub)
    db.commit()
    return None
