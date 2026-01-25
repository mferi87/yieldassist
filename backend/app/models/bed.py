import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Bed(Base):
    __tablename__ = "beds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id = Column(UUID(as_uuid=True), ForeignKey("gardens.id"), nullable=False)
    name = Column(String, nullable=False)
    width_cells = Column(Integer, nullable=False, default=4)  # in 25cm units
    height_cells = Column(Integer, nullable=False, default=8)  # in 25cm units
    position_x = Column(Integer, nullable=False, default=0)  # in garden grid (1m)
    position_y = Column(Integer, nullable=False, default=0)  # in garden grid (1m)
    
    # Relationships
    garden = relationship("Garden", back_populates="beds")
    zones = relationship("Zone", back_populates="bed", cascade="all, delete-orphan")
    crop_placements = relationship("CropPlacement", back_populates="bed", cascade="all, delete-orphan")


class Zone(Base):
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bed_id = Column(UUID(as_uuid=True), ForeignKey("beds.id"), nullable=False)
    name = Column(String, nullable=False)
    cells = Column(JSON, default=list)  # Deprecated: keeping for backward compatibility
    color = Column(String, default="#4CAF50")
    
    # Relationships
    bed = relationship("Bed", back_populates="zones")
    sensors = relationship("Sensor", back_populates="zone", cascade="all, delete-orphan")
    valves = relationship("Valve", back_populates="zone", cascade="all, delete-orphan")
    crop_placements = relationship("CropPlacement", back_populates="zone")

