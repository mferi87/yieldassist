from datetime import datetime
import secrets
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.device import Hub, Sensor, SensorType, Valve, Peripheral
from app.models.command import DeviceCommand, CommandStatus
from app.models.automation import Automation
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
        target_device_id = f"{hub.device_id}:{reading.sensor_id}"
        
        # Handle Peripheral grouping if ID contains ":"
        peripheral = None
        if ":" in reading.sensor_id:
            p_id, s_id = reading.sensor_id.split(":", 1)
            p_device_id = f"{hub.device_id}:{p_id}"
            peripheral = db.query(Peripheral).filter(Peripheral.device_id == p_device_id).first()
            if not peripheral:
                peripheral = Peripheral(hub_id=hub.id, device_id=p_device_id, name=p_id)
                db.add(peripheral)
                db.flush()

        sensor = db.query(Sensor).filter(Sensor.device_id == target_device_id).first()
        
        if sensor:
            sensor.last_reading = {"value": reading.value}
            sensor.last_seen = datetime.utcnow()
            sensor.sensor_type = reading.sensor_type
            sensor.hub_id = hub.id
            if peripheral:
                sensor.peripheral_id = peripheral.id
        else:
            sensor = Sensor(
                device_id=target_device_id,
                sensor_type=reading.sensor_type,
                name=reading.sensor_id.split(":")[-1],
                zone_id=None,
                hub_id=hub.id,
                peripheral_id=peripheral.id if peripheral else None,
                last_reading={"value": reading.value},
                last_seen=datetime.utcnow()
            )
            db.add(sensor)

    # Process valves
    for valve_data in payload.valves:
        target_device_id = f"{hub.device_id}:{valve_data.valve_id}"
        
        peripheral = None
        if ":" in valve_data.valve_id:
            p_id, v_id = valve_data.valve_id.split(":", 1)
            p_device_id = f"{hub.device_id}:{p_id}"
            peripheral = db.query(Peripheral).filter(Peripheral.device_id == p_device_id).first()
            if not peripheral:
                peripheral = Peripheral(hub_id=hub.id, device_id=p_device_id, name=p_id)
                db.add(peripheral)
                db.flush()

        valve = db.query(Valve).filter(Valve.device_id == target_device_id).first()
        
        if valve:
            valve.is_open = valve_data.is_open
            if valve_data.is_open and not valve.is_open:
                valve.last_activated = datetime.utcnow()
            valve.hub_id = hub.id
            if peripheral:
                valve.peripheral_id = peripheral.id
        else:
            valve = Valve(
                device_id=target_device_id,
                name=valve_data.valve_id.split(":")[-1],
                is_open=valve_data.is_open,
                zone_id=None,
                hub_id=hub.id,
                peripheral_id=peripheral.id if peripheral else None,
                last_activated=datetime.utcnow() if valve_data.is_open else None
            )
            db.add(valve)

    db.commit()
    
    db.commit()
    
    # Process Command Queue
    sync_commands = {}
    
    # Fetch active commands for this hub (PENDING or SENT)
    active_commands = db.query(DeviceCommand).filter(
        DeviceCommand.device_id.like(f"{hub.device_id}:%"),
        DeviceCommand.status.in_([CommandStatus.PENDING, CommandStatus.SENT])
    ).all()
    
    for cmd in active_commands:
        target_valve = db.query(Valve).filter(Valve.device_id == cmd.device_id).first()
        
        if target_valve:
            desired_state = cmd.payload.get("is_open")
            # Check completion (if reported state matches desired state)
            if desired_state is not None and target_valve.is_open == desired_state:
                cmd.status = CommandStatus.COMPLETED
                cmd.completed_at = datetime.utcnow()
                
                # Also clear target_is_open on valve if it matches command
                if target_valve.target_is_open == desired_state:
                     target_valve.target_is_open = None
                
                db.add(cmd)
                continue

        # If we are here, command is not completed. Send it.
        if cmd.status == CommandStatus.PENDING:
            cmd.status = CommandStatus.SENT
            cmd.sent_at = datetime.utcnow()
            db.add(cmd)
        
        # Add to sync payload
        valve_local_id = cmd.device_id.split(":")[-1]
        
        if "valves" not in sync_commands:
            sync_commands["valves"] = []
            
        sync_commands["valves"].append({
            "valve_id": valve_local_id,
            "is_open": cmd.payload.get("is_open")
        })

    # Fetch Automations for this hub
    automations = db.query(Automation).filter(Automation.hub_id == hub.id, Automation.is_enabled == True).all()
    sync_automations = []
    for auto in automations:
        sync_automations.append({
            "id": str(auto.id),
            "name": auto.name,
            "triggers": auto.triggers,
            "conditions": auto.conditions,
            "actions": auto.actions
        })

    db.commit()
    return {
        "status": "ok", 
        "sync": sync_commands,
        "automations": sync_automations
    }

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
    
@router.patch("/peripherals/{peripheral_id}/name")
async def rename_peripheral(
    peripheral_id: str,
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Rename a peripheral (Zigbee device)."""
    peripheral = db.query(Peripheral).join(Hub).filter(
        Peripheral.id == peripheral_id,
        Hub.user_id == current_user.id
    ).first()
    
    if not peripheral:
        raise HTTPException(status_code=404, detail="Peripheral not found")
        
    peripheral.name = name
    db.commit()
    return {"status": "ok"}


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
    
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
        
    db.delete(hub)
    db.commit()
    return None
