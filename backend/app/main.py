from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.database import engine, Base
from app.api import auth_router, gardens_router, beds_router, crops_router, users_router, hubs, devices, automations
from app.seed_crops import seed_database

# Import all models to ensure they're registered with Base before create_all
from app.models import User, Garden, GardenMember, Bed, Zone, Crop, CropPlacement, Hub, ZigbeeDevice, Automation

settings = get_settings()

# Create database tables
Base.metadata.create_all(bind=engine)

# Seed database with admin user and default crops
seed_database()

app = FastAPI(
    title="YieldAssist API",
    description="Raised bed gardening planner and IoT assistant API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(gardens_router, prefix="/api")
app.include_router(beds_router, prefix="/api")
app.include_router(crops_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(hubs.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(automations.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Welcome to YieldAssist API", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
