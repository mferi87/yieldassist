from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.device import Sensor, SensorType
from app.models.user import User
from app.schemas.sensor import SensorReadingCreate, SensorReadingResponse

router = APIRouter(prefix="/sensors", tags=["Sensors"])

@router.post("/reading", response_model=SensorReadingResponse)
async def record_reading(
    reading_data: SensorReadingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Record a sensor reading.
    The sensor must already exist (registered in a zone).
    """
    # Find the sensor by device_id and type
    sensor = db.query(Sensor).filter(
        Sensor.device_id == reading_data.device_id,
        Sensor.sensor_type == reading_data.sensor_type
    ).first()

    if not sensor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sensor not found. Please register device '{reading_data.device_id}' with type '{reading_data.sensor_type}' in a zone first."
        )

    # Update sensor data
    sensor.last_reading = reading_data.last_reading
    sensor.last_seen = datetime.utcnow()
    
    db.commit()
    db.refresh(sensor)
    
    return sensor
