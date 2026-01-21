"""
Seed data for common vegetables and crops.
Run with: python -m app.seed_crops
"""
from app.core.database import SessionLocal
from app.models.crop import Crop

# Spacing values: spacing_cm = in-row (between plants), row_spacing_cm = between rows
SEED_CROPS = [
    {
        "name": "Tomato",
        "spacing_cm": 50,
        "row_spacing_cm": 80,
        "cells_width": 2,
        "cells_height": 2,
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
        "spacing_cm": 20,
        "row_spacing_cm": 30,
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
        "spacing_cm": 5,
        "row_spacing_cm": 20,
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
        "spacing_cm": 45,
        "row_spacing_cm": 60,
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
        "spacing_cm": 40,
        "row_spacing_cm": 100,
        "cells_width": 1,
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
        "spacing_cm": 60,
        "row_spacing_cm": 100,
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
        "spacing_cm": 100,
        "row_spacing_cm": 200,
        "cells_width": 3,
        "cells_height": 3,
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
        "spacing_cm": 5,
        "row_spacing_cm": 15,
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
        "spacing_cm": 10,
        "row_spacing_cm": 30,
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
        "spacing_cm": 10,
        "row_spacing_cm": 45,
        "cells_width": 1,
        "cells_height": 1,
        "per_cell": 9,
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
        "spacing_cm": 10,
        "row_spacing_cm": 25,
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
        "spacing_cm": 10,
        "row_spacing_cm": 25,
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
        "spacing_cm": 45,
        "row_spacing_cm": 60,
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
        "spacing_cm": 45,
        "row_spacing_cm": 60,
        "cells_width": 2,
        "cells_height": 2,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 4,
            "harvest_months": [7, 8],
            "days_to_harvest": 90,
            "watering": "regular",
            "sun": "partial"
        },
        "is_public": True,
        "is_approved": True
    },
    {
        "name": "Eggplant",
        "spacing_cm": 50,
        "row_spacing_cm": 75,
        "cells_width": 2,
        "cells_height": 2,
        "per_cell": 1,
        "care_schedule": {
            "plant_month": 5,
            "harvest_months": [8, 9],
            "days_to_harvest": 85,
            "watering": "regular",
            "sun": "full"
        },
        "is_public": True,
        "is_approved": True
    },
]


def seed_database():
    """Seed the database with default admin user and initial crops."""
    from app.core.config import get_settings
    from app.models.user import User
    from app.core.security import get_password_hash
    
    settings = get_settings()
    
    db = SessionLocal()
    try:
        # Create admin user if not exists
        existing_admin = db.query(User).filter(User.email == settings.admin_email).first()
        if not existing_admin and settings.admin_email and settings.admin_password:
            admin_user = User(
                email=settings.admin_email,
                password_hash=get_password_hash(settings.admin_password),
                name=settings.admin_name or "Admin",
                is_global_admin=True
            )
            db.add(admin_user)
            db.commit()
            print(f"✅ Created admin user: {settings.admin_email}")
        else:
            print(f"ℹ️  Admin user already exists or not configured: {settings.admin_email}")
        
        # Seed crops
        for crop_data in SEED_CROPS:
            existing = db.query(Crop).filter(Crop.name == crop_data["name"]).first()
            if not existing:
                crop = Crop(**crop_data)
                db.add(crop)
                print(f"✅ Added crop: {crop_data['name']}")
            else:
                # Update existing crop with new fields
                for key, value in crop_data.items():
                    setattr(existing, key, value)
                print(f"↻  Updated crop: {crop_data['name']}")
        
        db.commit()
        print("✅ Database seeding complete!")
        
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
