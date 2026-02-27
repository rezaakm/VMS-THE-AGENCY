.PHONY: dev setup db migrate seed import

# Start everything with Docker
up:
	docker-compose up -d

down:
	docker-compose down

# Development (manual)
dev:
	@echo "Starting backend and frontend..."
	cd packages/backend && npm run dev &
	cd packages/frontend && npm run dev &

# Initial setup
setup:
	npm install
	cd packages/backend && cp .env.example .env
	cd packages/frontend && cp .env.local.example .env.local
	@echo "Edit packages/backend/.env with your database URL"

# Database
db:
	createdb cis_db 2>/dev/null || true
	cd packages/backend && npx prisma migrate dev --name init
	cd packages/backend && psql $${DATABASE_URL} < prisma/migrations/custom_search.sql

migrate:
	cd packages/backend && npx prisma migrate dev

# Import cost sheets
import-init:
	curl -X POST http://localhost:3001/api/import/initialize

import-2023:
	curl -X POST http://localhost:3001/api/import/bulk -H "Content-Type: application/json" -d '{"path": "./data/2023", "year": 2023}'

import-2024:
	curl -X POST http://localhost:3001/api/import/bulk -H "Content-Type: application/json" -d '{"path": "./data/2024", "year": 2024}'

import-2025:
	curl -X POST http://localhost:3001/api/import/bulk -H "Content-Type: application/json" -d '{"path": "./data/2025", "year": 2025}'

import-2026:
	curl -X POST http://localhost:3001/api/import/bulk -H "Content-Type: application/json" -d '{"path": "./data/2026", "year": 2026}'

import-all: import-init import-2023 import-2024 import-2025 import-2026
	@echo "All cost sheets imported!"
