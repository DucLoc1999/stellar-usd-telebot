.PHONY: help build up down restart logs shell migrate-up migrate-down migrate-status clean rebuild

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build Docker image
	docker-compose build

up: ## Start the application
	docker-compose up -d

down: ## Stop the application
	docker-compose down

restart: ## Restart the application
	docker-compose restart

logs: ## View application logs
	docker-compose logs -f app

shell: ## Open shell in the container
	docker-compose exec app sh

migrate-up: ## Run database migrations
	docker-compose exec app npm run migrate:latest

migrate-down: ## Rollback last migration
	docker-compose exec app npm run migrate:rollback

migrate-status: ## Check migration status
	docker-compose exec app npm run migrate:status

clean: ## Remove containers, networks, and volumes
	docker-compose down -v

rebuild: ## Rebuild and restart the application
	docker-compose up -d --build

ps: ## Show container status
	docker-compose ps

stats: ## Show container resource usage
	docker stats usdt247-app

health: ## Check application health
	@curl -s http://localhost:8001/health | jq . || curl -s http://localhost:8001/health

