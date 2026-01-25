from datetime import datetime
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.device import Valve
from app.models.command import DeviceCommand, CommandStatus
from app.models.user import User
from app.schemas.valve import ValveResponse, ValveUpdate

router = APIRouter(prefix="/valves", tags=["Valves"])

@router.post("/{valve_id}/toggle", response_model=ValveResponse)
async def toggle_valve(
    valve_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Toggle a valve open/close.
    """
    # Find the valve. We need to join Hub/Zone to ensure ownership?
    # For now, simplistic approach: find valve, check if related hub belongs to user.
    valve = db.query(Valve).filter(Valve.id == valve_id).first()
    
    if not valve:
        raise HTTPException(status_code=404, detail="Valve not found")
        
    # Check ownership via Hub
    if valve.hub and valve.hub.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    # Also check zone if hub is None (legacy)? but new valves have hub.

    # Create Command
    new_state = not valve.is_open
    
    # Check if there is already a pending command?
    # For now, just queue new one.
    
    cmd = DeviceCommand(
        device_id=valve.device_id,
        command="SET_VALVE",
        payload={"is_open": new_state},
        status=CommandStatus.PENDING
    )
    db.add(cmd)
    
    # Optimistically update target for UI? 
    # Or rely on command? 
    # Let's keep target_is_open for easy UI state reflection if we want.
    valve.target_is_open = new_state
    
    db.commit()
    return valve
