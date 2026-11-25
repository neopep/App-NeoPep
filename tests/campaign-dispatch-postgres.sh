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
node -e 'const s=require("fs").readFileSync("tests/shop.test.cjs","utf8");
const fixture=s.match(/db\.exec\(`(create role service_role;[^\x60]+)`\)/);
if (!fixture) process.exit(1);
console.log(fixture[1]);' | "${db[@]}"
for sql in supabase/migrations/*.sql; do
  "${db[@]}" < "$sql"
done
"${db[@]}" < tests/fixtures/connect/whatsapp-grupos.sql
"${db[@]}" < release/campaign-editor/20261124233000_campaign_editor_versions.sql
dispatch=release/campaign-dispatch
"${db[@]}" < "$dispatch/preflight.sql" >/dev/null
"${db[@]}" < "$dispatch/20261124234500_campaign_dispatch.sql"
"${db[@]}" -f - < tests/campaign-dispatch.sql
claim="set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
  select neo_campaign_dispatch_device_v1('claim','00000000-0000-0000-0000-000000000010',repeat('a',64),'{}')->>'id';"
"${db[@]}" -c "$claim" >"$scratch/a" &
a=$!
"${db[@]}" -c "$claim" >"$scratch/b" &
b=$!
wait "$a"
wait "$b"
test "$(cat "$scratch/a" "$scratch/b"|grep -c -E '^[a-f0-9-]{36}$')" = 3
test "$("${db[@]}" -c "select count(*) from neo_private.campaign_wa_publications where dispatch_state='leased'")" = 1
"${db[@]}" -f - < tests/campaign-dispatch-lifecycle.sql
homologation=release/campaign-homologation
"${db[@]}" < "$homologation/20261125020000_campaign_homologation.sql"
"${db[@]}" -f - < tests/campaign-homologation.sql
"${db[@]}" < "$homologation/rollback.sql"
test "$("${db[@]}" -c "select has_function_privilege('authenticated','public.neo_campaign_test_visit_v1(text,uuid)','execute')")" = f
"${db[@]}" < "$dispatch/rollback.sql"
test "$("${db[@]}" -c "select has_function_privilege('authenticated','public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)','execute')")" = f
test "$("${db[@]}" -c "select count(*) from neo_private.campaign_push_delivery")" = 0
echo 'OK: claim concorrente, isolamento, horários, leases, cancelamento e rollback sem envio'
