# Project-wide commands. Run these from the repository root with GNU make.
# On Windows, use Git Bash with GNU make installed; the commands work from PowerShell's cwd too.

ifneq ($(wildcard backend/.venv/Scripts/python.exe),)
PYTHON := backend/.venv/Scripts/python.exe
VENV_PYTHON := backend/.venv/Scripts/python.exe
else
ifneq ($(wildcard backend/.venv/bin/python),)
PYTHON := backend/.venv/bin/python
VENV_PYTHON := backend/.venv/bin/python
else
PYTHON := python
ifeq ($(OS),Windows_NT)
VENV_PYTHON := backend/.venv/Scripts/python.exe
else
VENV_PYTHON := backend/.venv/bin/python
endif
endif
endif

# Run any backend command against production settings (backend/.env.prod), e.g.
#   make superuser env=prod
ifeq ($(env),prod)
export DJANGO_ENV_FILE := .env.prod
endif

.PHONY: help run backend website migrate makemigrations showmigrations superuser seed_data shell check collectstatic \
	install install-backend install-website lint typecheck build

help: ## List available project commands.
	@node scripts/make-help.mjs

run: ## Start the Django API at http://127.0.0.1:8000.
	$(PYTHON) backend/manage.py runserver 127.0.0.1:8000

backend: run ## Alias for make run.

website: ## Start the Next.js website at http://localhost:3000.
	node scripts/run-website.mjs

migrate: ## Apply Django migrations (optional: app=<name> to=<migration>).
	$(PYTHON) backend/manage.py migrate $(app) $(to)

makemigrations: ## Create Django migrations (optional: app=<name>).
	$(PYTHON) backend/manage.py makemigrations $(app)

showmigrations: ## Show Django migration status (optional: app=<name>).
	$(PYTHON) backend/manage.py showmigrations $(app)

superuser: ## Create a Django admin user.
	$(PYTHON) backend/manage.py createsuperuser

seed_data: ## Add or refresh sample bookings in local SQLite for admin preview.
	$(PYTHON) backend/manage.py seed_data

shell: ## Open the Django shell.
	$(PYTHON) backend/manage.py shell

check: ## Run Django system and migration checks.
	$(PYTHON) backend/manage.py check
	$(PYTHON) backend/manage.py makemigrations --check --dry-run

collectstatic: ## Collect Django admin and static files.
	$(PYTHON) backend/manage.py collectstatic --noinput

install: install-backend install-website ## Install backend and website dependencies.

install-backend: ## Create backend virtualenv and install Python requirements.
	python -m venv backend/.venv
	$(VENV_PYTHON) -m pip install -r backend/requirements.txt

install-website: ## Install frontend dependencies with package-lock reproducibly.
	cd website && npm ci

lint: ## Run website ESLint.
	cd website && npm run lint

typecheck: ## Type-check the website.
	cd website && npm run typecheck

build: ## Build the static website for Cloudflare Pages.
	cd website && npm run build
