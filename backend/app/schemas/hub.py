from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from app.schemas.sensor import SensorReadingResponse
from app.schemas.valve import ValveResponse

class HubCreate(BaseModel):
    device_id: str
    email: str

class PeripheralResponse(BaseModel):
    id: UUID
    device_id: str
    name: Optional[str]
    sensors: List["SensorReadingResponse"] = []
    valves: List["ValveResponse"] = []

    class Config:
        from_attributes = True

class HubResponse(BaseModel):
    id: UUID
    device_id: str
    name: Optional[str]
    is_approved: bool
    last_seen: Optional[datetime]
    sensors: List["SensorReadingResponse"] = []
    valves: List["ValveResponse"] = []
    peripherals: List[PeripheralResponse] = []
    
    class Config:
        from_attributes = True

class HubApproval(BaseModel):
    hub_id: UUID
    name: str

class HubCheckLimit(BaseModel):
    device_id: str

class HubApiKeyResponse(BaseModel):
    api_key: Optional[str]
    is_approved: bool
