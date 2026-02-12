from typing import Optional, List, Dict, Any
from pydantic import BaseModel, UUID4


class AutomationBase(BaseModel):
    name: str
    description: Optional[str] = None
    triggers: List[Dict[str, Any]]       # Multiple triggers (OR logic)
    conditions: List[Dict[str, Any]] = []  # Optional conditions (AND logic)
    actions: List[Dict[str, Any]]        # Sequential actions
    enabled: bool = True


class AutomationCreate(AutomationBase):
    hub_id: UUID4


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    triggers: Optional[List[Dict[str, Any]]] = None
    conditions: Optional[List[Dict[str, Any]]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    enabled: Optional[bool] = None


class AutomationResponse(AutomationBase):
    id: UUID4
    hub_id: UUID4

    class Config:
        from_attributes = True
