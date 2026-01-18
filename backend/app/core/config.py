from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://yieldassist:yieldassist_dev@localhost:5432/yieldassist"
    
    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    # CORS
    cors_origins: str = "http://localhost:5173"
    
    # Default Admin (created on first run)
    admin_email: str = "admin@yieldassist.local"
    admin_password: str = "admin123"
    admin_name: str = "Admin"
    
    # Email Settings
    require_email_verification: bool = False
    
    # Mail Server (optional)
    mail_server: Optional[str] = None
    mail_port: int = 587
    mail_username: Optional[str] = None
    mail_password: Optional[str] = None
    mail_from: Optional[str] = None
    mail_tls: bool = True
    mail_ssl: bool = False
    
    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()

