from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.garden import Garden, GardenMember, MemberRole
from app.schemas.garden import (
    GardenCreate,
    GardenUpdate,
    GardenResponse,
    GardenListItem,
    GardenMemberResponse,
)

router = APIRouter(prefix="/gardens", tags=["Gardens"])


def get_user_garden_role(db: Session, garden_id: UUID, user_id: UUID) -> MemberRole | None:
    """Get user's role in a garden, or None if not a member."""
    member = db.query(GardenMember).filter(
        GardenMember.garden_id == garden_id,
        GardenMember.user_id == user_id
    ).first()
    return member.role if member else None


def require_garden_access(db: Session, garden_id: UUID, user_id: UUID, min_role: MemberRole = MemberRole.VIEWER) -> Garden:
    """Require user has at least min_role access to garden."""
    garden = db.query(Garden).filter(Garden.id == garden_id).first()
    if not garden:
        raise HTTPException(status_code=404, detail="Garden not found")
    
    role = get_user_garden_role(db, garden_id, user_id)
    if role is None:
        raise HTTPException(status_code=403, detail="Not a member of this garden")
    
    role_hierarchy = {MemberRole.VIEWER: 0, MemberRole.EDITOR: 1, MemberRole.ADMIN: 2}
    if role_hierarchy[role] < role_hierarchy[min_role]:
        raise HTTPException(status_code=403, detail=f"Requires {min_role.value} role")
    
    return garden


@router.get("/", response_model=List[GardenListItem])
async def list_gardens(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all gardens the user is a member of."""
    memberships = db.query(GardenMember).filter(
        GardenMember.user_id == current_user.id
    ).all()
    
    result = []
    for membership in memberships:
        garden = membership.garden
        result.append(GardenListItem(
            id=garden.id,
            name=garden.name,
            width_meters=garden.width_meters,
            height_meters=garden.height_meters,
            preview_image=garden.preview_image,
            created_at=garden.created_at,
            role=membership.role
        ))
    
    return result


@router.post("/", response_model=GardenResponse, status_code=status.HTTP_201_CREATED)
async def create_garden(
    garden_data: GardenCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new garden. Creator becomes admin."""
    garden = Garden(
        name=garden_data.name,
        width_meters=garden_data.width_meters,
        height_meters=garden_data.height_meters,
        created_by=current_user.id
    )
    db.add(garden)
    db.flush()
    
    # Add creator as admin member
    member = GardenMember(
        garden_id=garden.id,
        user_id=current_user.id,
        role=MemberRole.ADMIN
    )
    db.add(member)
    db.commit()
    db.refresh(garden)
    
    return _garden_to_response(garden, db)


@router.get("/{garden_id}", response_model=GardenResponse)
async def get_garden(
    garden_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get garden details."""
    garden = require_garden_access(db, garden_id, current_user.id)
    return _garden_to_response(garden, db)


@router.patch("/{garden_id}", response_model=GardenResponse)
async def update_garden(
    garden_id: UUID,
    garden_data: GardenUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update garden. Requires editor or admin role."""
    garden = require_garden_access(db, garden_id, current_user.id, MemberRole.EDITOR)
    
    update_data = garden_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(garden, field, value)
    
    db.commit()
    db.refresh(garden)
    
    return _garden_to_response(garden, db)


@router.delete("/{garden_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_garden(
    garden_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete garden. Requires admin role."""
    garden = require_garden_access(db, garden_id, current_user.id, MemberRole.ADMIN)
    db.delete(garden)
    db.commit()


def _garden_to_response(garden: Garden, db: Session) -> GardenResponse:
    """Convert garden model to response with member details."""
    members = []
    for member in garden.members:
        user = db.query(User).filter(User.id == member.user_id).first()
        members.append(GardenMemberResponse(
            id=member.id,
            user_id=member.user_id,
            user_name=user.name if user else "Unknown",
            user_email=user.email if user else "",
            role=member.role,
            invited_at=member.invited_at,
            accepted_at=member.accepted_at
        ))
    
    return GardenResponse(
        id=garden.id,
        name=garden.name,
        width_meters=garden.width_meters,
        height_meters=garden.height_meters,
        preview_image=garden.preview_image,
        created_by=garden.created_by,
        created_at=garden.created_at,
        members=members
    )
