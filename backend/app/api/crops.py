from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.garden import MemberRole
from app.models.bed import Bed
from app.models.crop import Crop, CropPlacement
from app.schemas.crop import (
    CropCreate,
    CropUpdate,
    CropResponse,
    CropPlacementCreate,
    CropPlacementUpdate,
    CropPlacementResponse,
)
from app.api.gardens import require_garden_access

router = APIRouter(prefix="/crops", tags=["Crops"])


@router.get("/", response_model=List[CropResponse])
async def list_crops(
    include_private: bool = Query(False, description="Include user's private crops"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all public crops, optionally including user's private crops."""
    query = db.query(Crop).filter(
        (Crop.is_public == True) | (Crop.created_by == current_user.id)
    )
    
    if not include_private:
        query = db.query(Crop).filter(Crop.is_public == True)
    
    return query.all()


@router.post("/", response_model=CropResponse, status_code=status.HTTP_201_CREATED)
async def create_crop(
    crop_data: CropCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new crop. New crops are private until approved by global admin."""
    crop = Crop(
        **crop_data.model_dump(),
        created_by=current_user.id,
        is_public=False,
        is_approved=False
    )
    db.add(crop)
    db.commit()
    db.refresh(crop)
    
    return crop


@router.get("/{crop_id}", response_model=CropResponse)
async def get_crop(
    crop_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get crop details."""
    crop = db.query(Crop).filter(Crop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    # Check access: public crops or user's own crops
    if not crop.is_public and crop.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this crop")
    
    return crop


@router.patch("/{crop_id}", response_model=CropResponse)
async def update_crop(
    crop_id: UUID,
    crop_data: CropUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update crop. Only owner or global admin can update."""
    crop = db.query(Crop).filter(Crop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    # Only owner or global admin can update
    if crop.created_by != current_user.id and not current_user.is_global_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this crop")
    
    update_data = crop_data.model_dump(exclude_unset=True)
    
    # Only global admin can set is_public and is_approved
    if not current_user.is_global_admin:
        update_data.pop("is_public", None)
        update_data.pop("is_approved", None)
    
    for field, value in update_data.items():
        setattr(crop, field, value)
    
    db.commit()
    db.refresh(crop)
    
    return crop

@router.delete("/{crop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_crop(
    crop_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a crop. Only owner or global admin can delete."""
    crop = db.query(Crop).filter(Crop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    # Only owner or global admin can delete
    if crop.created_by != current_user.id and not current_user.is_global_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this crop")
    
    db.delete(crop)
    db.commit()
# Crop Placement endpoints
@router.get("/placements/bed/{bed_id}", response_model=List[CropPlacementResponse])
async def list_crop_placements(
    bed_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all crop placements in a bed."""
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    require_garden_access(db, bed.garden_id, current_user.id)
    
    placements = db.query(CropPlacement).filter(CropPlacement.bed_id == bed_id).all()
    return placements


@router.get("/placements/garden/{garden_id}", response_model=List[CropPlacementResponse])
async def list_garden_placements(
    garden_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all crop placements across all beds in a garden."""
    require_garden_access(db, garden_id, current_user.id)
    
    # Get all beds in the garden, then all placements in those beds
    bed_ids = db.query(Bed.id).filter(Bed.garden_id == garden_id).all()
    bed_id_list = [b.id for b in bed_ids]
    
    placements = db.query(CropPlacement).filter(CropPlacement.bed_id.in_(bed_id_list)).all()
    return placements

@router.post("/placements", response_model=CropPlacementResponse, status_code=status.HTTP_201_CREATED)
async def create_crop_placement(
    placement_data: CropPlacementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Place a crop in a bed. Requires editor role."""
    bed = db.query(Bed).filter(Bed.id == placement_data.bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    require_garden_access(db, bed.garden_id, current_user.id, MemberRole.EDITOR)
    
    # Verify crop exists
    crop = db.query(Crop).filter(Crop.id == placement_data.crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    placement = CropPlacement(**placement_data.model_dump())
    db.add(placement)
    db.commit()
    db.refresh(placement)
    
    return placement


@router.patch("/placements/{placement_id}", response_model=CropPlacementResponse)
async def update_crop_placement(
    placement_id: UUID,
    placement_data: CropPlacementUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update crop placement. Requires editor role."""
    placement = db.query(CropPlacement).filter(CropPlacement.id == placement_id).first()
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found")
    
    bed = db.query(Bed).filter(Bed.id == placement.bed_id).first()
    require_garden_access(db, bed.garden_id, current_user.id, MemberRole.EDITOR)
    
    update_data = placement_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(placement, field, value)
    
    db.commit()
    db.refresh(placement)
    
    return placement


@router.delete("/placements/{placement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_crop_placement(
    placement_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete crop placement. Requires editor role."""
    placement = db.query(CropPlacement).filter(CropPlacement.id == placement_id).first()
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found")
    
    bed = db.query(Bed).filter(Bed.id == placement.bed_id).first()
    require_garden_access(db, bed.garden_id, current_user.id, MemberRole.EDITOR)
    
    db.delete(placement)
    db.commit()
