from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.core.database import get_db
from app.models.automation import Automation
from app.models.hub import Hub
from app.schemas.automation import AutomationCreate, AutomationUpdate, AutomationResponse

router = APIRouter()

@router.get("/automations", response_model=List[AutomationResponse])
def get_automations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    automations = db.query(Automation).offset(skip).limit(limit).all()
    return automations

@router.post("/automations", response_model=AutomationResponse)
def create_automation(automation: AutomationCreate, db: Session = Depends(get_db)):
    # Verify hub exists
    hub = db.query(Hub).filter(Hub.id == automation.hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")

    db_automation = Automation(**automation.dict())
    db.add(db_automation)
    db.commit()
    db.refresh(db_automation)
    return db_automation

@router.get("/automations/{automation_id}", response_model=AutomationResponse)
def get_automation(automation_id: uuid.UUID, db: Session = Depends(get_db)):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation

@router.put("/automations/{automation_id}", response_model=AutomationResponse)
def update_automation(automation_id: uuid.UUID, automation_update: AutomationUpdate, db: Session = Depends(get_db)):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    update_data = automation_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(automation, key, value)

    db.commit()
    db.refresh(automation)
    return automation

@router.delete("/automations/{automation_id}", response_model=AutomationResponse)
def delete_automation(automation_id: uuid.UUID, db: Session = Depends(get_db)):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    db.delete(automation)
    db.commit()
    return automation
