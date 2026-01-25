from datetime import datetime
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.device import Valve
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

    valve.target_is_open = not valve.is_open # Toggle desire based on current state? Or current desire?
    # Logic: If I want to toggle, I invert the CURRENT state and set that as TARGET.
    # If the user clicks toggle while target is pending?
    # Simpler: If target is set, invert target. If not, invert current.
    current_target = valve.target_is_open if valve.target_is_open is not None else valve.is_open
    valve.target_is_open = not current_target
    
    # We do NOT update is_open immediately. We wait for the device to report back.
    # But for UI responsiveness, we might want to return the 'target' state?
    # The UI should show "Pending" or the target state.
    
    db.commit()
    db.refresh(valve)
    return valve
