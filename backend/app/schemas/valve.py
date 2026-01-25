from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

class ValveBase(BaseModel):
    is_open: bool
    device_id: str

class ValveCreate(ValveBase):
    pass

class ValveUpdate(BaseModel):
    is_open: bool

class ValveResponse(ValveBase):
    id: UUID
    zone_id: Optional[UUID]
    hub_id: Optional[UUID]
    last_activated: Optional[datetime]

    class Config:
        from_attributes = True
