#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# The foundation stays in PR #50, and is installed only in this disposable fixture.
foundation=$(mktemp)
if ! git show 07fd5134457e861886be4383065d0cb80638e167:supabase/migrations/20261124160000_shop_cost_foundation.sql >"$foundation"; then
  rm "$foundation"
  echo 'Fetch PR #50 before running this test: git fetch origin refs/pull/50/head' >&2
  exit 1
fi
trap 'rm -f "$foundation"' EXIT
container=$(docker run --rm -d --network none -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17-alpine@sha256:526f86d93c6ea08fd3f1fe5605650cacc781b2c6013169a0ad8f42c7d3d84f32)
scratch=$(mktemp -d)
trap 'docker stop "$container" >/dev/null; rm -rf "$scratch"; rm -f "$foundation"' EXIT
db=(docker exec -i "$container" psql -XqAt -U postgres -v ON_ERROR_STOP=1)
for _ in {1..60}; do
  if docker exec "$container" pg_isready -q -h 127.0.0.1 -U postgres; then break; fi
  sleep 1
done
node -e 'const s=require("fs").readFileSync("tests/shop.test.cjs","utf8");
const fixture=s.match(/db\.exec\(`(create role service_role;[^\x60]+)`\)/);
if (!fixture) process.exit(1);
console.log(fixture[1]);' | "${db[@]}"
migration=release/shop-finance/20261124200000_shop_financial_dashboard.sql
for sql in supabase/migrations/*.sql; do
  "${db[@]}" < "$sql"
done
"${db[@]}" < "$foundation"
"${db[@]}" < "$migration"
"${db[@]}" -f - < tests/shop-financial-dashboard.sql

read_dashboard="begin read only; set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.neo_shop_financial_dashboard_v1('{\"from\":\"2026-02-01\",\"to\":\"2026-02-25\"}'); commit;"
"${db[@]}" -c "$read_dashboard" > "$scratch/session-a" &
a=$!
"${db[@]}" -c "$read_dashboard" > "$scratch/session-b" &
b=$!
wait "$a"
wait "$b"
cmp "$scratch/session-a" "$scratch/session-b"
echo 'OK: duas sessões de leitura simultâneas retornaram a mesma apuração'
