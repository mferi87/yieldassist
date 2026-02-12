import asyncio
import aiohttp
from config import logger, SERVER_URL, USER_EMAIL, CHIP_ID


async def register_hub():
    """
    Register the hub with the backend.
    Retries until the hub is approved and a token is received.

    Returns:
        tuple: (hub_id, access_token)
    """
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                payload = {
                    "server_address": "http://localhost",
                    "user_email": USER_EMAIL,
                    "chip_id": CHIP_ID
                }
                async with session.post(f"{SERVER_URL}/hubs/register", json=payload) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        status = data.get("status")
                        hub_id = data.get("hub_id")
                        token = data.get("access_token")

                        logger.info(f"Registration status: {status}")

                        if status == "approved" and token:
                            logger.info("Hub Approved! Token received.")
                            return hub_id, token
                        elif status == "pending":
                            logger.info("Hub is Pending approval. Retrying in 10s...")
                        else:
                            logger.warning(f"Hub status is {status}. Retrying in 30s...")
                            await asyncio.sleep(20)

            except Exception as e:
                logger.error(f"Registration failed: {e}. Retrying in 10s...")

            await asyncio.sleep(10)
