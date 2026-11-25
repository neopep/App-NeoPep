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
dir=release/campaign-editor
"${db[@]}" < "$dir/preflight.sql"
"${db[@]}" < "$dir/20261124233000_campaign_editor_versions.sql"
"${db[@]}" -f - < tests/campaign-editor.sql
"${db[@]}" < "$dir/rollback.sql"
test "$("${db[@]}" -c "select has_function_privilege('authenticated','public.neo_campaign_editor_v1(text,jsonb)','execute')")" = f
test "$("${db[@]}" -c "select count(*) from neo_private.campaign_editor_versions")" = 3
test "$("${db[@]}" -c "select count(*) from neo_private.campaign_wa_publications")" = 0
test "$("${db[@]}" -c "select count(*) from neo_private.campaign_push_delivery")" = 0
echo 'OK: rollback preserva versões e nenhuma operação externa foi enfileirada'
