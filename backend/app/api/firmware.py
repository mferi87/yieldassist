import os
import subprocess
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/firmware", tags=["Firmware"])

FIRMWARE_DIR = "/app/firmware/esp8266_mock"
BUILD_DIR = os.path.join(FIRMWARE_DIR, ".pio/build/esp8266")
FIRMWARE_BIN = os.path.join(BUILD_DIR, "firmware.bin")

@router.get("/download/esp8266")
async def download_esp8266_firmware(
    current_user: User = Depends(get_current_user)
):
    """
    Builds (if needed) and downloads the ESP8266 mock firmware.
    """
    if not os.path.exists(FIRMWARE_DIR):
        raise HTTPException(status_code=500, detail="Firmware source directory not found")

    # Check if we need to build
    # Logic: If bin doesn't exist, build.
    # ideally we would check timestamps, but for now let's just build if missing or always build?
    # Building takes time. Let's try to build if missing.
    
    if not os.path.exists(FIRMWARE_BIN):
        try:
            # Change directory to firmware dir and run pio run
            # Note: We need to make sure pio is in path or use full path
            # In docker it should be in path.
            # We specifically target the 'esp8266' environment defined in platformio.ini
            
            result = subprocess.run(
                ["pio", "run", "-e", "esp8266"], 
                cwd=FIRMWARE_DIR,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                print(f"Build failed: {result.stderr}")
                raise HTTPException(status_code=500, detail=f"Firmware build failed: {result.stderr}")
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to execute build command: {str(e)}")

    if not os.path.exists(FIRMWARE_BIN):
        raise HTTPException(status_code=404, detail="Firmware binary not found after build attempt")

    return FileResponse(
        FIRMWARE_BIN, 
        media_type="application/octet-stream", 
        filename="yieldassist-esp8266-mock.bin"
    )
