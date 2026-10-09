#!/usr/bin/env bash
# Roda as migrations + testes em um banco descartável de um Postgres 15+ local.
# Uso: ./scripts/test-db.sh            (usa PGHOST/PGPORT/PGUSER do ambiente)
set -euo pipefail
cd "$(dirname "$0")/.."

DB="pff_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }

run supabase/tests/00_supabase_mock.sql
for f in supabase/migrations/*.sql; do run "$f"; done
for f in supabase/tests/*_test.sql; do run "$f"; done
