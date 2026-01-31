from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from uuid import UUID
from pydantic import BaseModel, computed_field
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
    peripheral_id: Optional[UUID] = None
    device_id: str
    last_seen: Optional[datetime]
    
    @computed_field
    @property
    def is_online(self) -> bool:
        if not self.last_seen:
            return False
        # Sensors might report less often, so we allow 10 minutes
        return datetime.utcnow() - self.last_seen < timedelta(minutes=10)

    class Config:
        from_attributes = True
