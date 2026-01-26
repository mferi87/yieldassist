from typing import List, Optional, Union
from pydantic import BaseModel, Field
from uuid import UUID

class LogicBlock(BaseModel):
    type: str # 'sensor', 'time', 'state'
    device_id: Optional[str] = None
    attribute: Optional[str] = None
    operator: Optional[str] = None # <, >, ==, !=
    value: Optional[Union[float, int, str, bool]] = None
    
    # For time
    after: Optional[str] = None
    before: Optional[str] = None
    
    # For actions
    action: Optional[str] = None
    duration: Optional[int] = None

class AutomationBase(BaseModel):
    name: str
    hub_id: UUID
    is_enabled: bool = True
    triggers: List[LogicBlock] = []
    conditions: List[LogicBlock] = []
    actions: List[LogicBlock] = []

class AutomationCreate(AutomationBase):
    pass

class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    is_enabled: Optional[bool] = None
    triggers: Optional[List[LogicBlock]] = None
    conditions: Optional[List[LogicBlock]] = None
    actions: Optional[List[LogicBlock]] = None

class AutomationResponse(AutomationBase):
    id: UUID
    hub_name: Optional[str] = None

    class Config:
        from_attributes = True
