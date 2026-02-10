from typing import Optional, List, Dict, Any
from pydantic import BaseModel, UUID4


class AutomationBase(BaseModel):
    name: str
    trigger: Dict[str, Any]
    action: Dict[str, Any]
    enabled: bool = True


class AutomationCreate(AutomationBase):
    hub_id: UUID4


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    trigger: Optional[Dict[str, Any]] = None
    action: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None


class AutomationResponse(AutomationBase):
    id: UUID4
    hub_id: UUID4

    class Config:
        from_attributes = True
