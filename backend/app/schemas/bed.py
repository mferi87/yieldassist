from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class BedBase(BaseModel):
    name: str
    width_cells: int = 4  # in 25cm units (default 1m)
    height_cells: int = 8  # in 25cm units (default 2m)
    position_x: int = 0
    position_y: int = 0


class BedCreate(BedBase):
    garden_id: UUID


class BedUpdate(BaseModel):
    name: Optional[str] = None
    width_cells: Optional[int] = None
    height_cells: Optional[int] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None


class BedResponse(BedBase):
    id: UUID
    garden_id: UUID

    class Config:
        from_attributes = True


class ZoneBase(BaseModel):
    name: str
    cells: List[List[int]] = []  # Array of [x, y] coordinates
    color: str = "#4CAF50"


class ZoneCreate(ZoneBase):
    bed_id: UUID


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    cells: Optional[List[List[int]]] = None
    color: Optional[str] = None


class ZoneResponse(ZoneBase):
    id: UUID
    bed_id: UUID

    class Config:
        from_attributes = True
