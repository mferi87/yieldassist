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
    is_enabled = Column(Boolean, default=True)
    
    # Logic blocks
    triggers = Column(JSON, default=list)    # "When"
    conditions = Column(JSON, default=list)  # "And if"
    actions = Column(JSON, default=list)     # "Then do"
    
    version = Column(JSON, default=1) # To help ESP know if it needs to re-sync

    # Relationships
    hub = relationship("Hub", backref="automations")

    @property
    def hub_name(self):
        return self.hub.name if self.hub else None
