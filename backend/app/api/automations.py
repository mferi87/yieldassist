from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.models.automation import Automation
from app.schemas.automation import AutomationCreate, AutomationUpdate, AutomationResponse
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/automations", tags=["Automations"])

@router.post("", response_model=AutomationResponse)
def create_automation(
    automation: AutomationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify hub ownership
    from app.models.device import Hub
    hub = db.query(Hub).filter(Hub.id == automation.hub_id, Hub.user_id == current_user.id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found or not owned by you")
        
    db_automation = Automation(**automation.dict())
    db.add(db_automation)
    db.commit()
    db.refresh(db_automation)
    return db_automation

@router.get("", response_model=List[AutomationResponse])
def list_my_automations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.device import Hub
    return db.query(Automation).join(Hub).filter(Hub.user_id == current_user.id).all()

@router.get("/hub/{hub_id}", response_model=List[AutomationResponse])
def list_hub_automations(
    hub_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.device import Hub
    hub = db.query(Hub).filter(Hub.id == hub_id, Hub.user_id == current_user.id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
        
    return db.query(Automation).filter(Automation.hub_id == hub_id).all()

@router.patch("/{id}", response_model=AutomationResponse)
def update_automation(
    id: UUID,
    automation_update: AutomationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_automation = db.query(Automation).filter(Automation.id == id).first()
    if not db_automation:
        raise HTTPException(status_code=404, detail="Automation not found")
        
    # Check ownership via hub
    if db_automation.hub.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    update_data = automation_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_automation, key, value)
        
    db.commit()
    db.refresh(db_automation)
    return db_automation

@router.delete("/{id}")
def delete_automation(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    automation = db.query(Automation).filter(Automation.id == id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
        
    # Check ownership via hub
    if automation.hub.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db.delete(automation)
    db.commit()
    return {"status": "ok"}
