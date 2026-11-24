#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container=$(docker run --rm -d --network none -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17-alpine@sha256:526f86d93c6ea08fd3f1fe5605650cacc781b2c6013169a0ad8f42c7d3d84f32)
scratch=$(mktemp -d)
trap 'docker stop "$container" >/dev/null; rm -rf "$scratch"' EXIT
db=(docker exec -i "$container" psql -XqAt -U postgres -v ON_ERROR_STOP=1)
for _ in {1..60}; do
  if docker exec "$container" pg_isready -q -h 127.0.0.1 -U postgres; then break; fi
  sleep 1
done

# Reuse the Supabase catalog stub used by the existing Shop SQL regression tests.
node -e 'const s=require("fs").readFileSync("tests/shop.test.cjs","utf8");
const fixture=s.match(/db\.exec\(`(create role service_role;[^\x60]+)`\)/);
if (!fixture) process.exit(1);
console.log(fixture[1]);' | "${db[@]}"
migration=supabase/migrations/20261124160000_shop_cost_foundation.sql
for sql in supabase/migrations/*.sql; do
  [[ "$sql" < "$migration" ]] || break
  "${db[@]}" < "$sql"
done
legacy_catalog="select md5(string_agg(pg_get_functiondef(p.oid), E'\\n' order by p.oid))
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','neo_private') and (p.proname like 'neo_shop%' or p.proname like 'shop_%')
and p.proname not in ('shop_cost_append_only','shop_validate_sale_cost_snapshot','shop_record_stock_adjustment')"
before=$("${db[@]}" -c "$legacy_catalog")

"${db[@]}" <<'SQL'
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into neo_private.admin_members(user_id) values ('00000000-0000-0000-0000-000000000001');
insert into neo_private.shop_products(id,name,description,category,price_cents,stock)
values ('00000000-0000-0000-0000-000000000010','Produto teste','','Teste',1000,3);
insert into neo_private.shop_orders(id,request_key,items,address,subtotal_cents,shipping_cents,total_cents,status,environment)
values ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000021',
  '[{"product_id":"00000000-0000-0000-0000-000000000010","quantity":3,"unit_price_cents":1000}]','{}',3000,0,3000,'paid','production'),
  ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000031',
  '[{"product_id":"00000000-0000-0000-0000-000000000010","quantity":3,"unit_price_cents":1000}]','{}',3000,0,3000,'test_paid','test');
-- The Shop environment trigger intentionally derives environment on insert.
update neo_private.shop_orders set environment = 'production' where id = '00000000-0000-0000-0000-000000000020';
SQL
catalog_rows="select md5(string_agg(to_jsonb(o)::text,'' order by id)) from neo_private.shop_orders o"
orders_before=$("${db[@]}" -c "$catalog_rows")
"${db[@]}" < "$migration"
"${db[@]}" < release/shop-costs/rollback-010-03a.sql
test "$("${db[@]}" -c "$legacy_catalog")" = "$before"
test "$("${db[@]}" -c "$catalog_rows")" = "$orders_before"
"${db[@]}" < "$migration"
test "$("${db[@]}" -c "$legacy_catalog")" = "$before"
test "$("${db[@]}" -c "$catalog_rows")" = "$orders_before"
test "$("${db[@]}" -c 'select stock from neo_private.shop_products')" = 3
echo 'OK: aplicação, reversão vazia, reaplicação e contratos/linhas legados preservados'

admin="select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)"
product=00000000-0000-0000-0000-000000000010
first=00000000-0000-0000-0000-000000000011
second=00000000-0000-0000-0000-000000000012
adjust="select neo_private.shop_record_stock_adjustment('$product','$first',3,-2,'inventário', '$product')"
# Hold the exact lock used by the legacy checkout so three sessions queue behind it.
docker exec -i -e PGAPPNAME=shop-cost-holder "$container" psql -XqAt -U postgres -v ON_ERROR_STOP=1 \
  -c 'begin; select pg_advisory_xact_lock(642917200); select pg_sleep(60); commit' >"$scratch/holder" 2>&1 &
holder=$!
for _ in {1..100}; do
  if [[ "$("${db[@]}" -c "select count(*) from pg_stat_activity where application_name='shop-cost-holder' and wait_event='PgSleep'")" == 1 ]]; then break; fi
  sleep .1
done
"${db[@]}" -c "$admin; $adjust" >"$scratch/first" 2>&1 &
a=$!
"${db[@]}" -c "$admin; $adjust" >"$scratch/replay" 2>&1 &
b=$!
# Wait until both original and replay are queued, then queue stale competing mutation last.
for _ in {1..100}; do
  if [[ "$("${db[@]}" -c "select count(*) from pg_locks where locktype='advisory' and objid=642917200 and not granted")" == 2 ]]; then break; fi
  sleep .1
done
test "$("${db[@]}" -c "select count(*) from pg_locks where locktype='advisory' and objid=642917200 and not granted")" = 2
"${db[@]}" -c "$admin; select neo_private.shop_record_stock_adjustment('$product','$second',3,-2,'outro')" >"$scratch/stale" 2>&1 &
c=$!
for _ in {1..100}; do
  if [[ "$("${db[@]}" -c "select count(*) from pg_locks where locktype='advisory' and objid=642917200 and not granted")" == 3 ]]; then break; fi
  sleep .1
done
test "$("${db[@]}" -c "select count(*) from pg_locks where locktype='advisory' and objid=642917200 and not granted")" = 3
"${db[@]}" -c "select pg_cancel_backend(pid) from pg_stat_activity where application_name='shop-cost-holder'" >/dev/null
wait "$holder" || true
wait "$a"
wait "$b"
cmp "$scratch/first" "$scratch/replay"
if wait "$c"; then exit 1; fi
grep -q shop_stock_balance_changed "$scratch/stale"
test "$("${db[@]}" -c 'select stock from neo_private.shop_products')" = 1
test "$("${db[@]}" -c 'select count(*) from neo_private.shop_stock_movements')" = 1
echo 'OK: concorrência em sessões reais, retentativa paralela e rejeição de saldo obsoleto'

"${db[@]}" -f - < tests/shop-cost-foundation.sql
if "${db[@]}" < release/shop-costs/rollback-010-03a.sql >"$scratch/rollback" 2>&1; then exit 1; fi
grep -q shop_cost_rollback_requires_preserving_financial_history "$scratch/rollback"
test "$("${db[@]}" -c 'select stock from neo_private.shop_products')" = 3
test "$("${db[@]}" -c 'select count(*) from neo_private.shop_stock_movements')" = 2
test "$("${db[@]}" -c "$catalog_rows")" = "$orders_before"
echo 'OK: reversão de esquema recusada com histórico, saldo e pedidos preservados'
