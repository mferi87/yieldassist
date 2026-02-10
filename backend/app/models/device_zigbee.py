import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class ZigbeeDevice(Base):
    __tablename__ = "zigbee_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hub_id = Column(UUID(as_uuid=True), ForeignKey("hubs.id"), nullable=False)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)
    ieee_address = Column(String, nullable=False, unique=True)
    friendly_name = Column(String, nullable=True)
    model = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    description = Column(String, nullable=True)
    exposes = Column(JSON, default=list)
    is_online = Column(Boolean, default=False)
    is_tracked = Column(Boolean, default=False)
    state = Column(JSON, default={})
    last_seen = Column(DateTime, nullable=True)

    # Relationships
    hub = relationship("Hub", back_populates="zigbee_devices")
    zone = relationship("Zone", back_populates="zigbee_devices")
    history = relationship("DeviceStateHistory", back_populates="device", cascade="all, delete-orphan")


class DeviceStateHistory(Base):
    __tablename__ = "device_state_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("zigbee_devices.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    state = Column(JSON, nullable=False)  # Store the full state payload or specific changes

    device = relationship("ZigbeeDevice", back_populates="history")
