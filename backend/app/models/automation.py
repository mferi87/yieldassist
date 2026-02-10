import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Automation(Base):
    __tablename__ = "automations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hub_id = Column(UUID(as_uuid=True), ForeignKey("hubs.id"), nullable=False)
    name = Column(String, nullable=False)
    trigger = Column(JSON, nullable=False)  # {device_id, entity, operator, value}
    action = Column(JSON, nullable=False)   # {device_id, entity, value}
    enabled = Column(Boolean, default=True)

    # Relationships
    hub = relationship("Hub", back_populates="automations")
