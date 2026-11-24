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
migration=release/shop-costs/20261124180000_shop_cost_editor.sql
for sql in supabase/migrations/*.sql; do
  "${db[@]}" < "$sql"
done
"${db[@]}" < "$foundation"
"${db[@]}" < "$migration"
"${db[@]}" -f - < tests/shop-cost-editor.sql

# Start two actual connections with the same revision and request.
call="set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.neo_shop_costs_v1('register','{\"product_id\":\"00000000-0000-0000-0000-000000000010\",\"request_key\":\"00000000-0000-0000-0000-000000000088\",\"revision\":\"REVISION\",\"expected_stock\":3,\"entry_kind\":\"acquisition\",\"currency\":\"USD\",\"unit_cost\":\"1.00123456\",\"quantity\":2,\"acquired_on\":\"2026-01-01\",\"fx_rate\":\"5.1234567891\",\"fx_source\":\"Fixture\",\"fx_on\":\"2026-01-01\"}')"
revision=$("${db[@]}" -c "select id from neo_private.shop_acquisitions where entry_kind='cost_only'")
call=${call/REVISION/$revision}
"${db[@]}" -c "$call" >"$scratch/a" &
a=$!
"${db[@]}" -c "$call" >"$scratch/b" &
b=$!
wait "$a"
wait "$b"
cmp "$scratch/a" "$scratch/b"
grep -q '"brl_total": "10.259564007827102592"' "$scratch/a"
stale=${call/000000000088/000000000089}
if "${db[@]}" -c "$stale" >"$scratch/stale" 2>&1; then exit 1; fi
grep -q shop_cost_product_changed "$scratch/stale"
test "$("${db[@]}" -c "select stock from neo_private.shop_products where id='00000000-0000-0000-0000-000000000010'")" = 5
test "$("${db[@]}" -c "select count(*) from neo_private.shop_stock_movements where kind='acquisition' and delta=2")" = 1
test "$("${db[@]}" -c 'select count(*) from neo_private.shop_fx_rates')" = 1
test "$("${db[@]}" -c 'select count(*) from neo_private.shop_acquisitions')" = 2
test "$("${db[@]}" -c 'select total_cents from neo_private.shop_orders')" = 3000
test "$("${db[@]}" -c 'select unit_cost_brl_cents from neo_private.shop_sale_cost_snapshots')" = 20
echo 'OK: concurrent replay writes one USD acquisition, stale revision is rejected, legacy sale and snapshot unchanged'
