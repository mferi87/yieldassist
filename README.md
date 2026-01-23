# YieldAssist 🌱

A comprehensive raised bed gardening planner and IoT-integrated assistant.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Development with Docker

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs


## Project Structure

```
yieldassist/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Python + FastAPI
├── simulator/         # Mock IoT data generator
├── firmware/          # ESP32 firmware (Phase 5)
└── docker-compose.yml
```

## Documentation

- [Implementation Plan](docs/implementation_plan.md)

## License

MIT
