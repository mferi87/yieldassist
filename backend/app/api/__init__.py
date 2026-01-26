# API module exports
from app.api.auth import router as auth_router
from app.api.gardens import router as gardens_router
from app.api.beds import router as beds_router
from app.api.crops import router as crops_router
from app.api.users import router as users_router
from app.api.sensors import router as sensors_router
from app.api.hubs import router as hubs_router
from app.api.firmware import router as firmware_router
from app.api.valves import router as valves_router
from app.api.automations import router as automations_router

__all__ = [
    "auth_router",
    "gardens_router",
    "beds_router",
    "crops_router",
    "users_router",
    "sensors_router",
    "hubs_router",
    "firmware_router",
    "valves_router",
    "automations_router",
]
