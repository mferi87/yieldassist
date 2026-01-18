from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.garden import GardenMember, MemberRole
from app.models.bed import Bed, Zone
from app.schemas.bed import (
    BedCreate,
    BedUpdate,
    BedResponse,
    ZoneCreate,
    ZoneUpdate,
    ZoneResponse,
)
from app.api.gardens import require_garden_access

router = APIRouter(prefix="/beds", tags=["Beds"])


@router.get("/garden/{garden_id}", response_model=List[BedResponse])
async def list_beds(
    garden_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all beds in a garden."""
    require_garden_access(db, garden_id, current_user.id)
    beds = db.query(Bed).filter(Bed.garden_id == garden_id).all()
    return beds


@router.post("/", response_model=BedResponse, status_code=status.HTTP_201_CREATED)
async def create_bed(
    bed_data: BedCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new bed. Requires editor role."""
    require_garden_access(db, bed_data.garden_id, current_user.id, MemberRole.EDITOR)
    
    bed = Bed(**bed_data.model_dump())
    db.add(bed)
    db.commit()
    db.refresh(bed)
    
    return bed


@router.get("/{bed_id}", response_model=BedResponse)
async def get_bed(
    bed_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get bed details."""
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    require_garden_access(db, bed.garden_id, current_user.id)
    return bed


@router.patch("/{bed_id}", response_model=BedResponse)
async def update_bed(
    bed_id: UUID,
    bed_data: BedUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update bed. Requires editor role."""
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    require_garden_access(db, bed.garden_id, current_user.id, MemberRole.EDITOR)
    
    update_data = bed_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bed, field, value)
    
    db.commit()
    db.refresh(bed)
    
    return bed


@router.delete("/{bed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bed(
    bed_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete bed. Requires editor role."""
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    require_garden_access(db, bed.garden_id, current_user.id, MemberRole.EDITOR)
    
    db.delete(bed)
    db.commit()


# Zone endpoints
@router.get("/{bed_id}/zones", response_model=List[ZoneResponse])
async def list_zones(
    bed_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all zones in a bed."""
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    require_garden_access(db, bed.garden_id, current_user.id)
    zones = db.query(Zone).filter(Zone.bed_id == bed_id).all()
    return zones


@router.post("/zones", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    zone_data: ZoneCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new zone. Requires editor role."""
    bed = db.query(Bed).filter(Bed.id == zone_data.bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    require_garden_access(db, bed.garden_id, current_user.id, MemberRole.EDITOR)
    
    zone = Zone(**zone_data.model_dump())
    db.add(zone)
    db.commit()
    db.refresh(zone)
    
    return zone


@router.patch("/zones/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    zone_id: UUID,
    zone_data: ZoneUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update zone. Requires editor role."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    
    bed = db.query(Bed).filter(Bed.id == zone.bed_id).first()
    require_garden_access(db, bed.garden_id, current_user.id, MemberRole.EDITOR)
    
    update_data = zone_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(zone, field, value)
    
    db.commit()
    db.refresh(zone)
    
    return zone


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    zone_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete zone. Requires editor role."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    
    bed = db.query(Bed).filter(Bed.id == zone.bed_id).first()
    require_garden_access(db, bed.garden_id, current_user.id, MemberRole.EDITOR)
    
    db.delete(zone)
    db.commit()
