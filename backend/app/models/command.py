import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, DateTime, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class CommandStatus(str, PyEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class DeviceCommand(Base):
    __tablename__ = "device_commands"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String, nullable=False, index=True)
    command = Column(String, nullable=False) # e.g. "SET_VALVE"
    payload = Column(JSON, default=dict)
    status = Column(Enum(CommandStatus), default=CommandStatus.PENDING, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
