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

"${db[@]}" < release/shop-costs/20261124180000_shop_cost_editor.sql
release=release/shop-reconciliation
"${db[@]}" < "$release/preflight.sql" >"$scratch/before"
"${db[@]}" < "$release/20261124220000_shop_reconciliation.sql"
"${db[@]}" -f - < tests/shop-reconciliation.sql
for customer in 2 3; do
  "${db[@]}" -c "select shop_fixture_buy($customer)" >"$scratch/buy-$customer" 2>&1 &
  if [[ "$customer" == 2 ]]; then a=$!; else b=$!; fi
done
successful=0
if wait "$a"; then successful=$((successful+1)); fi
if wait "$b"; then successful=$((successful+1)); fi
if [[ "$successful" != 1 ]]; then cat "$scratch"/buy-*; exit 1; fi
grep -qiE 'estoque|disponível' "$scratch/buy-2" "$scratch/buy-3" || { cat "$scratch"/buy-*; exit 1; }
"${db[@]}" -f - < tests/shop-reconciliation-lifecycle.sql
"${db[@]}" < "$release/rollback.sql"
test "$("${db[@]}" -c "select has_function_privilege('authenticated','public.neo_shop_reconciliation_v1(text,jsonb)','execute')")" = f
test "$("${db[@]}" -c "select count(*) from neo_private.shop_sale_cost_snapshots")" = 3
test "$("${db[@]}" -c "select count(*) from neo_private.shop_physical_returns")" = 1
"${db[@]}" -c "select p.oid::regprocedure,md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','neo_private') and p.proname in ('neo_shop','shop_expire','neo_shop_payment_event_v2','neo_shop_payment_event_v22') order by 1" >"$scratch/after"
cmp "$scratch/before" "$scratch/after"
echo 'OK: concurrent checkout, payment lifecycle, ACL, history-preserving rollback and unchanged legacy function hashes'
