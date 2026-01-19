from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


def verify_global_admin(current_user: User = Depends(get_current_user)):
    """Dependency to check if the current user is a global admin."""
    if not current_user.is_global_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to perform this action"
        )
    return current_user


@router.get("/", response_model=List[UserResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_user: User = Depends(verify_global_admin)
):
    """
    List all users. Restricted to global admins.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.put("/{user_id}/admin", response_model=UserResponse)
def toggle_user_admin_status(
    user_id: UUID,
    is_global_admin: bool,
    db: Session = Depends(get_db),
    admin_user: User = Depends(verify_global_admin)
):
    """
    Toggle a user's global admin status. Restricted to global admins.
    Cannot remove admin status from self to prevent lockout.
    """
    if str(user_id) == str(admin_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own admin status"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.is_global_admin = is_global_admin
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(verify_global_admin)
):
    """
    Delete a user. Restricted to global admins.
    Cannot delete yourself.
    """
    if str(user_id) == str(admin_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    db.delete(user)
    db.commit()
    return None
