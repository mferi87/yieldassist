import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.device_zigbee import ZigbeeDevice
from app.schemas.device_zigbee import ZigbeeDeviceResponse, ZigbeeDeviceUpdate

router = APIRouter()

@router.get("/devices", response_model=List[ZigbeeDeviceResponse])
def get_all_devices(db: Session = Depends(get_db)):
    """List all Zigbee devices across all hubs"""
    devices = db.query(ZigbeeDevice).all()
    return devices

@router.put("/devices/{device_id}", response_model=ZigbeeDeviceResponse)
def update_device(device_id: uuid.UUID, device_update: ZigbeeDeviceUpdate, db: Session = Depends(get_db)):
    """Update a Zigbee device (e.g. assign to zone, rename)"""
    device = db.query(ZigbeeDevice).filter(ZigbeeDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if device_update.friendly_name is not None:
        device.friendly_name = device_update.friendly_name
    
    if device_update.zone_id is not None:
        device.zone_id = device_update.zone_id
        
    # Handle unassignment if zone_id is explicitly passed as None? 
    # Pydantic Optional defaults to None, which means "do not update" usually. 
    # But here we might want to clear it. 
    # Let's check ZigbeeDeviceUpdate schema. zone_id is Optional[UUID4] = None.
    # To support clearing, we might need a flag or specific logic, but for now 
    # let's assume if it is in the request dict it should be updated.
    # However, FastAPI/Pydantic with exclude_unset=True is the way.
    
    update_data = device_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(device, key, value)

    db.commit()
    db.refresh(device)
    return device
