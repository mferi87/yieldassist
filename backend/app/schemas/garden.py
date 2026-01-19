from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from app.models.garden import MemberRole


class GardenBase(BaseModel):
    name: str
    width_meters: int = 10
    height_meters: int = 10
    preview_image: Optional[str] = None


class GardenCreate(GardenBase):
    pass


class GardenUpdate(BaseModel):
    name: Optional[str] = None
    width_meters: Optional[int] = None
    height_meters: Optional[int] = None
    preview_image: Optional[str] = None


class GardenMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    user_email: str
    role: MemberRole
    invited_at: datetime
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GardenResponse(GardenBase):
    id: UUID
    created_by: UUID
    created_at: datetime
    members: List[GardenMemberResponse] = []

    class Config:
        from_attributes = True


class GardenListItem(GardenBase):
    id: UUID
    created_at: datetime
    role: MemberRole  # User's role in this garden

    class Config:
        from_attributes = True
