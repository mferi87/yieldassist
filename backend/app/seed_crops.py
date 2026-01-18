"""
Seed data for common vegetables and crops.
Run with: python -m app.seed_crops
"""
from app.core.database import SessionLocal
from app.models.crop import Crop

SEED_CROPS = [
    {
        "name": "Tomato",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 3,
            "harvest_months": [7, 8, 9],
            "days_to_harvest": 80,
            "watering": "daily",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Lettuce",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 4,
        "care_schedule": {
            "plant_month": 3,
            "harvest_months": [5, 6],
            "days_to_harvest": 45,
            "watering": "daily",
            "sun": "partial"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Carrot",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 16,
        "care_schedule": {
            "plant_month": 4,
            "harvest_months": [7, 8],
            "days_to_harvest": 75,
            "watering": "regular",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Bell Pepper",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 4,
            "harvest_months": [7, 8, 9],
            "days_to_harvest": 90,
            "watering": "regular",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Cucumber",
        "cells_width": 2,
        "cells_height": 1,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 5,
            "harvest_months": [7, 8],
            "days_to_harvest": 60,
            "watering": "daily",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Zucchini",
        "cells_width": 2,
        "cells_height": 2,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 5,
            "harvest_months": [7, 8, 9],
            "days_to_harvest": 50,
            "watering": "regular",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Pumpkin",
        "cells_width": 3,
        "cells_height": 1,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 5,
            "harvest_months": [9, 10],
            "days_to_harvest": 120,
            "watering": "regular",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Radish",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 16,
        "care_schedule": {
            "plant_month": 3,
            "harvest_months": [4, 5],
            "days_to_harvest": 25,
            "watering": "regular",
            "sun": "partial"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Spinach",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 9,
        "care_schedule": {
            "plant_month": 3,
            "harvest_months": [5, 6],
            "days_to_harvest": 40,
            "watering": "regular",
            "sun": "partial"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Green Bean",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 4,
        "care_schedule": {
            "plant_month": 5,
            "harvest_months": [7, 8],
            "days_to_harvest": 55,
            "watering": "regular",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Onion",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 9,
        "care_schedule": {
            "plant_month": 3,
            "harvest_months": [7, 8],
            "days_to_harvest": 100,
            "watering": "regular",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Garlic",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 9,
        "care_schedule": {
            "plant_month": 10,
            "harvest_months": [6, 7],
            "days_to_harvest": 240,
            "watering": "low",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Broccoli",
        "cells_width": 2,
        "cells_height": 2,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 4,
            "harvest_months": [6, 7],
            "days_to_harvest": 80,
            "watering": "regular",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Cabbage",
        "cells_width": 2,
        "cells_height": 2,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 4,
            "harvest_months": [7, 8],
            "days_to_harvest": 90,
            "watering": "regular",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Kale",
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 3,
            "harvest_months": [5, 6, 7, 8, 9, 10],
            "days_to_harvest": 55,
            "watering": "regular",
            "sun": "partial"
        },
        "is_public": True,
        "is_approved": True
    },
]


def seed_database():
    """Initialize database with tables, admin user, and seed crops."""
    # Import all models and create tables first
    from app.core.database import engine, Base
    from app.core.config import get_settings
    from app.core.security import get_password_hash
    from app.models import User, Garden, GardenMember, Bed, Zone, Crop, CropPlacement, Sensor, Valve
    
    settings = get_settings()
    
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")
    
    db = SessionLocal()
    try:
        # Create admin user if doesn't exist
        admin = db.query(User).filter(User.email == settings.admin_email).first()
        if not admin:
            print(f"Creating admin user: {settings.admin_email}")
            admin = User(
                email=settings.admin_email,
                name=settings.admin_name,
                password_hash=get_password_hash(settings.admin_password),
                is_global_admin=True
            )
            db.add(admin)
            db.commit()
            print(f"Admin user created successfully!")
            print(f"  Email: {settings.admin_email}")
            print(f"  Password: {settings.admin_password}")
        else:
            print(f"Admin user already exists: {settings.admin_email}")
        
        # Check if crops already exist
        existing = db.query(Crop).filter(Crop.is_public == True).count()
        if existing > 0:
            print(f"Crops already seeded ({existing} public crops exist)")
            return

        for crop_data in SEED_CROPS:
            crop = Crop(**crop_data)
            db.add(crop)

        db.commit()
        print(f"Successfully seeded {len(SEED_CROPS)} crops")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()

