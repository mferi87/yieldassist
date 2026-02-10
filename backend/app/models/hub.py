import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class HubStatus(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    IGNORED = "ignored"
    BLOCKED = "blocked"


class Hub(Base):
    __tablename__ = "hubs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    status = Column(Enum(HubStatus), default=HubStatus.PENDING, nullable=False)
    last_seen = Column(DateTime, nullable=True)
    user_email = Column(String, nullable=True)
    access_token = Column(String, nullable=True)  # Store generated token for validation
    
    # Relationships
    zigbee_devices = relationship("ZigbeeDevice", back_populates="hub", cascade="all, delete-orphan")
    automations = relationship("Automation", back_populates="hub", cascade="all, delete-orphan")

    @property
    def is_online(self):
        if not self.last_seen:
            return False
        # Consider online if seen within last 2 minutes
        delta = datetime.utcnow() - self.last_seen
        return delta.total_seconds() < 120
