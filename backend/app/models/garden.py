import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class MemberRole(str, PyEnum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class Garden(Base):
    __tablename__ = "gardens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    width_meters = Column(Integer, nullable=False, default=10)
    height_meters = Column(Integer, nullable=False, default=10)
    preview_image = Column(String, nullable=True)  # Base64 or URL for garden preview
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    members = relationship("GardenMember", back_populates="garden", cascade="all, delete-orphan")
    beds = relationship("Bed", back_populates="garden", cascade="all, delete-orphan")


class GardenMember(Base):
    __tablename__ = "garden_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id = Column(UUID(as_uuid=True), ForeignKey("gardens.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(Enum(MemberRole), default=MemberRole.EDITOR)
    invited_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)
    
    # Relationships
    garden = relationship("Garden", back_populates="members")
    user = relationship("User", back_populates="garden_memberships")
