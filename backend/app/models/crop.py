import uuid
from datetime import date
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Integer, Boolean, Date, ForeignKey, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class CropStatus(str, PyEnum):
    PLANNED = "planned"
    PLANTED = "planted"
    GROWING = "growing"
    HARVESTED = "harvested"


class Crop(Base):
    __tablename__ = "crops"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    icon = Column(String, nullable=True) # Emoji or Base64 encoded image
    cells_width = Column(Integer, nullable=False, default=1)  # Default cells width for placement
    cells_height = Column(Integer, nullable=False, default=1)  # Default cells height for placement
    per_cell = Column(Integer, nullable=False, default=1)  # Number of plants per cell
    spacing_cm = Column(Integer, nullable=False, default=25)  # In-row spacing (between plants)
    row_spacing_cm = Column(Integer, nullable=False, default=25)  # Between-row spacing
    care_schedule = Column(JSON, default=dict)  # Planting, care, harvest info
    
    # Timeline months (0 = January, 11 = December)
    plant_month_start = Column(Integer, nullable=True, default=3)  # April
    plant_month_end = Column(Integer, nullable=True, default=4)    # May
    care_month_start = Column(Integer, nullable=True, default=4)   # May
    care_month_end = Column(Integer, nullable=True, default=7)     # August
    harvest_month_start = Column(Integer, nullable=True, default=7) # August
    harvest_month_end = Column(Integer, nullable=True, default=9)   # October
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_public = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)
    
    # Relationships
    created_by_user = relationship("User", back_populates="created_crops")
    placements = relationship("CropPlacement", back_populates="crop")


class CropPlacement(Base):
    __tablename__ = "crop_placements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bed_id = Column(UUID(as_uuid=True), ForeignKey("beds.id"), nullable=False)
    crop_id = Column(UUID(as_uuid=True), ForeignKey("crops.id"), nullable=False)
    position_x = Column(Integer, nullable=False)  # Top-left cell X
    position_y = Column(Integer, nullable=False)  # Top-left cell Y
    width_cells = Column(Integer, nullable=False, default=1)  # Area width in cells
    height_cells = Column(Integer, nullable=False, default=1)  # Area height in cells
    custom_spacing_cm = Column(Integer, nullable=True)  # User override for in-row spacing
    custom_row_spacing_cm = Column(Integer, nullable=True)  # User override for row spacing
    planted_date = Column(Date, nullable=True)
    status = Column(Enum(CropStatus), default=CropStatus.PLANNED)
    
    # Relationships
    bed = relationship("Bed", back_populates="crop_placements")
    crop = relationship("Crop", back_populates="placements")
