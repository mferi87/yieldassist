from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, computed_field
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
    uptime: Optional[int] = None
    wifi_rssi: Optional[int] = None
    sensors: List["SensorReadingResponse"] = []
    valves: List["ValveResponse"] = []
    peripherals: List[PeripheralResponse] = []
    
    @computed_field
    @property
    def is_online(self) -> bool:
        if not self.last_seen:
            return False
        return datetime.utcnow() - self.last_seen < timedelta(minutes=3)
    
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
