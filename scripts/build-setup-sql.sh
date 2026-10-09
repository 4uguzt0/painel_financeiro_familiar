#!/usr/bin/env bash
# Junta todas as migrations em um único arquivo para colar no SQL Editor do Supabase.
# Rode sempre que criar uma migration nova:  npm run setup-sql
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=supabase/setup-completo.sql
{
  echo "-- ============================================================================"
  echo "-- Caderneta — instalação completa do banco (gerado por scripts/build-setup-sql.sh)"
  echo "-- Cole TUDO no Supabase → SQL Editor → New query → Run. Rode uma única vez."
  echo "-- ============================================================================"
  for f in supabase/migrations/*.sql; do
    echo; echo "-- >>> $(basename "$f")"; cat "$f"
  done
} > "$OUT"
echo "gerado: $OUT"
