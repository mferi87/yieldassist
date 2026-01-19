# API module exports
from app.api.auth import router as auth_router
from app.api.gardens import router as gardens_router
from app.api.beds import router as beds_router
from app.api.crops import router as crops_router
from app.api.users import router as users_router

__all__ = [
    "auth_router",
    "gardens_router",
    "beds_router",
    "crops_router",
    "users_router",
]
