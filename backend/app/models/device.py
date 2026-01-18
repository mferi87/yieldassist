import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class SensorType(str, PyEnum):
    SOIL_MOISTURE = "soil_moisture"
    TEMPERATURE = "temperature"
    LIGHT = "light"
    HUMIDITY = "humidity"


class Sensor(Base):
    __tablename__ = "sensors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False)
    device_id = Column(String, nullable=False)
    sensor_type = Column(Enum(SensorType), nullable=False)
    last_reading = Column(JSON, default=dict)
    last_seen = Column(DateTime, nullable=True)
    
    # Relationships
    zone = relationship("Zone", back_populates="sensors")


class Valve(Base):
    __tablename__ = "valves"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False)
    device_id = Column(String, nullable=False)
    is_open = Column(Boolean, default=False)
    last_activated = Column(DateTime, nullable=True)
    
    # Relationships
    zone = relationship("Zone", back_populates="valves")
