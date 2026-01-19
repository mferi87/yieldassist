from datetime import date
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel
from app.models.crop import CropStatus


class CropBase(BaseModel):
    name: str
    icon: Optional[str] = None
    cells_width: int = 1
    cells_height: int = 1
    per_cell: int = 1
    spacing_cm: int = 25  # In-row spacing (between plants)
    row_spacing_cm: int = 25  # Between-row spacing
    care_schedule: Dict[str, Any] = {}


class CropCreate(CropBase):
    is_public: bool = False
    is_approved: bool = False


class CropUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    cells_width: Optional[int] = None
    cells_height: Optional[int] = None
    per_cell: Optional[int] = None
    spacing_cm: Optional[int] = None
    row_spacing_cm: Optional[int] = None
    care_schedule: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None
    is_approved: Optional[bool] = None


class CropResponse(CropBase):
    id: UUID
    created_by: Optional[UUID] = None
    is_public: bool
    is_approved: bool

    class Config:
        from_attributes = True


class CropPlacementBase(BaseModel):
    position_x: int
    position_y: int
    width_cells: int = 1
    height_cells: int = 1
    custom_spacing_cm: Optional[int] = None  # User override for in-row spacing
    custom_row_spacing_cm: Optional[int] = None  # User override for row spacing
    planted_date: Optional[date] = None
    status: CropStatus = CropStatus.PLANNED


class CropPlacementCreate(CropPlacementBase):
    bed_id: UUID
    crop_id: UUID


class CropPlacementUpdate(BaseModel):
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    width_cells: Optional[int] = None
    height_cells: Optional[int] = None
    custom_spacing_cm: Optional[int] = None
    custom_row_spacing_cm: Optional[int] = None
    planted_date: Optional[date] = None
    status: Optional[CropStatus] = None


class CropPlacementResponse(CropPlacementBase):
    id: UUID
    bed_id: UUID
    crop_id: UUID
    crop: CropResponse

    class Config:
        from_attributes = True
