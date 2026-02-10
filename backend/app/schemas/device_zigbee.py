from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, UUID4


class ZigbeeDeviceBase(BaseModel):
    ieee_address: str
    friendly_name: Optional[str] = None
    model: Optional[str] = None
    vendor: Optional[str] = None
    description: Optional[str] = None
    exposes: List[Any] = []
    exposes: List[Any] = []
    is_online: bool = False
    is_tracked: bool = False
    state: Optional[dict] = {}


class ZigbeeDeviceCreate(ZigbeeDeviceBase):
    hub_id: UUID4


class ZigbeeDeviceUpdate(BaseModel):
    friendly_name: Optional[str] = None
    is_online: Optional[bool] = None
    is_tracked: Optional[bool] = None
    last_seen: Optional[datetime] = None
    zone_id: Optional[UUID4] = None


class ZigbeeDeviceResponse(ZigbeeDeviceBase):
    id: UUID4
    hub_id: UUID4
    zone_id: Optional[UUID4]
    last_seen: Optional[datetime]

    class Config:
        from_attributes = True
