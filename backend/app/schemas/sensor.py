from typing import Dict, Any, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from app.models.device import SensorType

class SensorReadingBase(BaseModel):
    sensor_type: SensorType
    last_reading: Dict[str, Any]
    timestamp: Optional[datetime] = None

class SensorReadingCreate(SensorReadingBase):
    device_id: str

class SensorReadingResponse(SensorReadingBase):
    id: UUID
    zone_id: Optional[UUID]
    device_id: str
    last_seen: Optional[datetime]

    class Config:
        from_attributes = True
