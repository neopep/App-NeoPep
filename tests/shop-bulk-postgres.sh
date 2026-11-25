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

bulk=release/shop-bulk
"${db[@]}" < "$bulk/preflight.sql" >"$scratch/bulk-before"
"${db[@]}" < "$bulk/20261124230000_shop_bulk.sql"
"${db[@]}" -f - < tests/shop-reconciliation.sql
"${db[@]}" -f - < tests/shop-bulk.sql

apply() {
  "${db[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); select neo_shop_bulk_v1('apply',jsonb_build_object('id','$1'))->>'status';"
}
for run in a b; do
  id=$("${db[@]}" -c "select id from shop_bulk_test_batches where label='$run'")
  apply "$id" >"$scratch/$run" &
  if [[ "$run" == a ]]; then a=$!; else b=$!; fi
done
wait "$a"
wait "$b"
test "$(cat "$scratch/a" "$scratch/b" | awk '/^applied$/{n++} END{print n+0}')" = 1
test "$(cat "$scratch/a" "$scratch/b" | awk '/^conflict$/{n++} END{print n+0}')" = 1

# A valid checkout holds the same advisory lock while the batch attempts a reduction.
sale=$("${db[@]}" -c "select id from shop_bulk_test_batches where label='sale'")
docker exec -i -e PGAPPNAME=neo011-checkout "$container" psql -XqAt -U postgres -v ON_ERROR_STOP=1   -c "begin; select shop_fixture_buy(2,'00000000-0000-0000-0000-000000000010'); select pg_sleep(5); commit;" >"$scratch/checkout" 2>&1 &
# A second transaction must queue behind a checkout which holds the product.
holder=$!
for _ in {1..100}; do
  if [[ "$("${db[@]}" -c "select count(*) from pg_stat_activity where application_name='neo011-checkout' and wait_event='PgSleep'")" == 1 ]]; then break; fi
  if ! kill -0 "$holder" 2>/dev/null; then cat "$scratch/checkout"; exit 1; fi
  sleep .1
done
test "$("${db[@]}" -c "select count(*) from pg_stat_activity where application_name='neo011-checkout' and wait_event='PgSleep'")" = 1
apply "$sale" >"$scratch/sale"
wait "$holder"
grep -qx conflict "$scratch/sale"
test "$("${db[@]}" -c "select stock from neo_private.shop_products where id='00000000-0000-0000-0000-000000000010'")" = 0
test "$("${db[@]}" -c "select count(*) from neo_private.shop_orders")" = 1

"${db[@]}" < "$bulk/preflight.sql" >"$scratch/unexpected" 2>&1 && exit 1
"${db[@]}" < "$bulk/rollback.sql"
test "$("${db[@]}" -c "select has_function_privilege('authenticated','public.neo_shop_bulk_v1(text,jsonb)','execute')")" = f
test "$("${db[@]}" -c "select count(*) from neo_private.shop_bulk_batches where applied_at is not null")" -ge 3
"${db[@]}" -c "select p.oid::regprocedure,md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','neo_private') and p.proname in ('neo_shop','shop_expire','neo_shop_payment_event_v2','neo_shop_payment_event_v22') order by 1" >"$scratch/bulk-after"
cmp "$scratch/bulk-before" "$scratch/bulk-after"
echo 'OK: concorrência entre lotes e checkout, rollback, histórico e funções legadas preservadas'
