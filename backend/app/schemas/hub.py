from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, UUID4, EmailStr
from app.models.hub import HubStatus


class HubBase(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    user_email: Optional[str] = None


class HubCreate(HubBase):
    pass


class HubRegister(BaseModel):
    server_address: str
    user_email: str
    chip_id: str  # Used as unique identifier/name initially


class HubUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[HubStatus] = None


class HubResponse(HubBase):
    id: UUID4
    status: HubStatus
    last_seen: Optional[datetime]
    is_online: bool

    class Config:
        from_attributes = True


class HubTokenResponse(BaseModel):
    hub_id: UUID4
    status: HubStatus
    access_token: Optional[str] = None
