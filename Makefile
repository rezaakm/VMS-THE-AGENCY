.PHONY: dev setup db migrate

up:
	docker-compose up -d

down:
	docker-compose down

dev:
	@echo "Starting backend and frontend..."
	cd packages/backend && npm run dev &
	cd packages/frontend && npm run dev &

setup:
	npm install
	cd packages/backend && cp .env.example .env
	cd packages/frontend && cp .env.local.example .env.local
	@echo "Edit packages/backend/.env with your database URL"

db:
	createdb cis_db 2>/dev/null || true
	cd packages/backend && npx prisma migrate dev --name init
	cd packages/backend && psql $${DATABASE_URL} < prisma/migrations/custom_search.sql

migrate:
	cd packages/backend && npx prisma migrate dev

import-init:
	curl -X POST http://localhost:3001/api/import/initialize

import-all: import-init
	@echo "Use the web UI at http://localhost:3000/import to upload cost sheets"
