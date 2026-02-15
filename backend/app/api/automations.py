from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import json
import uuid

from app.core.database import get_db
from app.core.ws import manager
from app.models.automation import Automation
from app.models.hub import Hub
from app.schemas.automation import AutomationCreate, AutomationUpdate, AutomationResponse

router = APIRouter()


async def _sync_automations_to_hub(hub_id: uuid.UUID, db: Session):
    """Push all automations for a hub to the connected hub agent via WebSocket."""
    if hub_id not in manager.active_connections:
        return  # Hub not connected, nothing to push

    automations = db.query(Automation).filter(Automation.hub_id == hub_id).all()
    payload = [
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
    msg = json.dumps({"type": "sync_automations", "payload": payload})
    await manager.send_personal_message(msg, hub_id)


@router.get("/automations", response_model=List[AutomationResponse])
def get_automations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    automations = db.query(Automation).offset(skip).limit(limit).all()
    return automations

@router.post("/automations", response_model=AutomationResponse)
async def create_automation(automation: AutomationCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Verify hub exists
    hub = db.query(Hub).filter(Hub.id == automation.hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")

    db_automation = Automation(**automation.dict())
    db.add(db_automation)
    db.commit()
    db.refresh(db_automation)

    # Sync to hub agent
    background_tasks.add_task(_sync_automations_to_hub, automation.hub_id, db)

    return db_automation

@router.get("/automations/{automation_id}", response_model=AutomationResponse)
def get_automation(automation_id: uuid.UUID, db: Session = Depends(get_db)):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation

@router.put("/automations/{automation_id}", response_model=AutomationResponse)
async def update_automation(automation_id: uuid.UUID, automation_update: AutomationUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    update_data = automation_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(automation, key, value)

    db.commit()
    db.refresh(automation)

    # Sync to hub agent
    background_tasks.add_task(_sync_automations_to_hub, automation.hub_id, db)

    return automation

@router.delete("/automations/{automation_id}", response_model=AutomationResponse)
async def delete_automation(automation_id: uuid.UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    hub_id = automation.hub_id
    db.delete(automation)
    db.commit()

    # Sync to hub agent
    background_tasks.add_task(_sync_automations_to_hub, hub_id, db)

    return automation
