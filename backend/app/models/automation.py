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
    description = Column(String, nullable=True)
    
    # Multiple triggers (OR logic - any trigger can start the automation)
    triggers = Column(JSON, nullable=False)  # List of trigger dicts
    
    # Optional conditions (AND logic - all must be true for actions to run)
    conditions = Column(JSON, default=list)  # List of condition dicts
    
    # Sequential actions (control flow supported: choose, if-then, delay, etc.)
    actions = Column(JSON, nullable=False)   # List of action dicts
    
    enabled = Column(Boolean, default=True)

    # Relationships
    hub = relationship("Hub", back_populates="automations")
