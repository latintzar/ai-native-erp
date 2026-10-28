.PHONY: install install-ui dev dev-ui build build-operator check-ui test test-prototype test-collections test-setup test-backend vitals starter-proof testdata db-up db-url db-stop source-reference notices

ERP_VENV := $(CURDIR)/.venv
ERP_PYTHON = $(if $(wildcard $(ERP_VENV)/bin/python),$(ERP_VENV)/bin/python,python3)

install-ui:
	cd app && npm ci --no-fund
	node tools/dependency-notices.mjs

install: install-ui
	python3 -c 'import sys; assert sys.version_info[:2] == (3, 12), "Use Python 3.12 for this source beta"'
	python3 -m venv $(ERP_VENV)
	$(ERP_VENV)/bin/python -m pip install -q -r backend/requirements.txt -r tools/requirements-dev.txt -e 'mock-api[test]' playwright==1.58.0

dev:
	ROCOTO_RUNTIME_ENV="$(RUNTIME_ENV)" ROCOTO_RUNTIME_STATE="$(RUNTIME_STATE)" ROCOTO_UI_PORT="$(UI_PORT)" $(ERP_PYTHON) tools/dev.py

dev-ui:
	cd app && npm run dev

build:
	cd app && npm run build:app-en

build-operator:
	cd app && npx tsc --noEmit -p tsconfig.operator.json
	cd app && npx vite build --config vite.operator.config.ts

check-ui:
	cd app && npx tsc --noEmit -p tsconfig.app.json
	cd app && npx tsc --noEmit -p tsconfig.scenarios.json
	cd app && npx tsc --noEmit -p tsconfig.operator.json
	cd app && node tools/theme-gate.mjs
	cd app && npm test
	cd app && npm run build:kit

test: test-prototype test-collections test-setup

test-prototype:
	cd mock-api && ../.venv/bin/python ../tools/offline-python.py -m pytest -q

test-collections:
	$(ERP_PYTHON) tools/offline-python.py -m pytest -q app/src/prototypes/copper/tests

test-setup:
	$(ERP_PYTHON) -m unittest discover -s tools/tests -p test_provider_setup.py -q
	cd backend && ../.venv/bin/python ../tools/offline-python.py -m pytest -q tests/test_public_bootstrap.py

test-backend:
	$(ERP_PYTHON) tools/offline-python.py tools/test-database.py -q --ignore=tests/test_vitals.py

vitals:
	$(ERP_PYTHON) tools/offline-python.py tools/test-database.py -q tests/test_vitals.py tests/test_rls_wall.py

starter-proof:
	$(ERP_PYTHON) tools/starter-proof.py --receipt /tmp/erp-starter-proof.json

testdata:
	$(ERP_PYTHON) tools/vendor/testdata/testdata.py $(ARGS)

db-up:
	docker compose up --detach --wait db

db-url:
	@erp_db_address="$$(docker compose port db 5432)" && echo "postgresql://rocoto:rocoto@$$erp_db_address/rocoto"

db-stop:
	docker compose stop db

source-reference:
	$(ERP_PYTHON) tools/source-reference.py

notices:
	node tools/dependency-notices.mjs
