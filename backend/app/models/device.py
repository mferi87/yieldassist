import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base



class Hub(Base):
    __tablename__ = "hubs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)
    api_key = Column(String, unique=True, nullable=True)
    is_approved = Column(Boolean, default=False)
    last_seen = Column(DateTime, nullable=True)
    uptime = Column(Integer, nullable=True)
    wifi_rssi = Column(Integer, nullable=True)
    
    # User relationship (Owner)
    # The email provided during setup will link to a user.
    # User relationship (Owner)
    # The email provided during setup will link to a user.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="hubs")

    # Relationships
    sensors = relationship("Sensor", back_populates="hub")
    valves = relationship("Valve", back_populates="hub")
    peripherals = relationship("Peripheral", back_populates="hub")


class Peripheral(Base):
    __tablename__ = "peripherals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hub_id = Column(UUID(as_uuid=True), ForeignKey("hubs.id"), nullable=False)
    device_id = Column(String, nullable=False) # e.g. "unit_1"
    name = Column(String, nullable=True) # User defined name for the whole unit
    updated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    hub = relationship("Hub", back_populates="peripherals")
    sensors = relationship("Sensor", back_populates="peripheral")
    valves = relationship("Valve", back_populates="peripheral")



class SensorType(str, PyEnum):
    SOIL_MOISTURE = "soil_moisture"
    TEMPERATURE = "temperature"
    LIGHT = "light"
    HUMIDITY = "humidity"


class Sensor(Base):
    __tablename__ = "sensors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True) # Changed to nullable
    hub_id = Column(UUID(as_uuid=True), ForeignKey("hubs.id"), nullable=True)   # Added hub link
    peripheral_id = Column(UUID(as_uuid=True), ForeignKey("peripherals.id"), nullable=True)
    device_id = Column(String, nullable=False)
    name = Column(String, nullable=True)
    sensor_type = Column(Enum(SensorType), nullable=False)
    last_reading = Column(JSON, default=dict)
    last_seen = Column(DateTime, nullable=True)
    
    # Relationships
    zone = relationship("Zone", back_populates="sensors")
    hub = relationship("Hub", back_populates="sensors")
    peripheral = relationship("Peripheral", back_populates="sensors")



class Valve(Base):
    __tablename__ = "valves"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True) # Changed to Optional
    hub_id = Column(UUID(as_uuid=True), ForeignKey("hubs.id"), nullable=True)   # Added hub link
    peripheral_id = Column(UUID(as_uuid=True), ForeignKey("peripherals.id"), nullable=True)
    device_id = Column(String, nullable=False)
    name = Column(String, nullable=True)
    is_open = Column(Boolean, default=False)
    target_is_open = Column(Boolean, nullable=True) # Desired state
    last_activated = Column(DateTime, nullable=True)
    
    # Relationships
    zone = relationship("Zone", back_populates="valves")
    hub = relationship("Hub", back_populates="valves")
    peripheral = relationship("Peripheral", back_populates="valves")

