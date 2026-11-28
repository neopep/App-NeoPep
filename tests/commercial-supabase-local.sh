#!/usr/bin/env bash
# Disposable Auth, PostgREST and PostgreSQL. No remote project credentials.
set -euo pipefail
cd "$(dirname "$0")/.."
for dependency in docker node curl grep; do
 if ! command -v "$dependency" >/dev/null 2>&1; then
  echo "Dependência local ausente: $dependency" >&2; exit 1
 fi
done
# Never run this disposable test against a remote Docker daemon.
if [[ -n "${DOCKER_CONTEXT:-}" ]]; then
 docker_host="$(docker context inspect "$DOCKER_CONTEXT" --format '{{.Endpoints.docker.Host}}')"
else
 docker_host="${DOCKER_HOST:-$(docker context inspect --format '{{.Endpoints.docker.Host}}')}"
fi
case "$docker_host" in
 unix://*|npipe://*) ;;
 *) echo 'Ensaio cancelado: Docker deve usar um daemon local (unix/npipe).' >&2; exit 1 ;;
esac
if ! docker info >/dev/null 2>&1; then
 echo 'Docker local indisponível; inicie o daemon antes de executar o ensaio.' >&2; exit 1
fi
images=(postgres:17.7 axllent/mailpit:v1.27.0 supabase/gotrue:v2.185.0 postgrest/postgrest:v13.0.7)
# Fail before creating any network or containers if an image cannot be extracted.
for image in "${images[@]}"; do
 if ! docker image inspect "$image" >/dev/null 2>&1; then
  if ! docker pull "$image"; then
   echo "Falha ao preparar $image. Confira o espaço do daemon Docker (docker system df). Nenhuma limpeza automática será feita." >&2
   docker system df >&2 || true
   exit 1
  fi
 fi
done
suffix="neopep-commercial-$$$(node -p "require('node:crypto').randomInt(100000000,999999999)")"
db="$suffix-db"
auth="$suffix-auth"
rest="$suffix-rest"
mail="$suffix-mail"
label="com.neopep.disposable-commercial=$suffix"
cleanup() {
 local id
 while IFS= read -r id; do
  [[ -n "$id" ]] && docker rm -fv "$id" >/dev/null 2>&1 || true
 done < <(docker ps -aq --filter "label=$label" 2>/dev/null || true)
 while IFS= read -r id; do
  [[ -n "$id" ]] && docker network rm "$id" >/dev/null 2>&1 || true
 done < <(docker network ls -q --filter "label=$label" 2>/dev/null || true)
}
trap cleanup EXIT
secret=$(node -p "require('node:crypto').randomBytes(48).toString('hex')")
password=$(node -p "require('node:crypto').randomBytes(20).toString('hex')")
database="postgres://postgres:$password@$db:5432/postgres"
docker network create --label "$label" "$suffix" >/dev/null
docker run --label "$label" --name "$db" --network "$suffix" -e "POSTGRES_PASSWORD=$password" -d postgres:17.7 >/dev/null
psql() { docker exec -i "$db" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
ready=false
for attempt in {1..60}; do
 if psql -qAtc 'select 1' >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
if [[ "$ready" != true ]]; then echo 'PostgreSQL local indisponível'; exit 1; fi
psql -q <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login;
grant anon, authenticated, service_role to authenticator;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
 select (nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub')::uuid
$$;
SQL
psql -q -c "alter role authenticator password '$password'; grant usage on schema auth to authenticated;"
docker run --label "$label" --name "$mail" --network "$suffix" -p 127.0.0.1::8025 -d axllent/mailpit:v1.27.0 >/dev/null
mail_url="http://$(docker port "$mail" 8025/tcp)"
docker run --label "$label" --name "$auth" --network "$suffix" -p 127.0.0.1::9999 -d \
 -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://127.0.0.1:9999 \
 -e GOTRUE_SITE_URL=http://127.0.0.1:4173 -e GOTRUE_DB_DRIVER=postgres \
 -e "GOTRUE_DB_DATABASE_URL=$database?search_path=auth" -e GOTRUE_DB_NAMESPACE=auth \
 -e "GOTRUE_JWT_SECRET=$secret" -e GOTRUE_JWT_AUD=authenticated \
 -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
 -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false -e "GOTRUE_SMTP_HOST=$mail" -e GOTRUE_SMTP_PORT=1025 \
 -e GOTRUE_SMTP_ADMIN_EMAIL=neopep@example.test -e GOTRUE_SMTP_MAX_FREQUENCY=1s -e GOTRUE_RATE_LIMIT_EMAIL_SENT=100 \
 -e 'GOTRUE_URI_ALLOW_LIST=http://127.0.0.1:4173/**' \
 supabase/gotrue:v2.185.0 >/dev/null
auth_url="http://$(docker port "$auth" 9999/tcp)"
wait_http() {
 for attempt in {1..45}; do
  if curl -fsS --max-time 2 "$1" >/dev/null 2>&1; then return; fi
  sleep 1
 done
 return 1
}
wait_http "$auth_url/health" || { docker logs --tail 12 "$auth"; exit 1; }
psql -q <<'SQL'
create schema vault;
create view vault.decrypted_secrets as select null::uuid id,null::text name,null::text description,null::text secret,null::text decrypted_secret,null::uuid key_id,null::bytea nonce,null::timestamptz created_at,null::timestamptz updated_at where false;
grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets to service_role;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,name text,bucket_id text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
SQL
cat supabase/migrations/*.sql | psql -q > /dev/null
docker run --label "$label" --name "$rest" --network "$suffix" -p 127.0.0.1::3000 -d \
 -e "PGRST_DB_URI=postgres://authenticator:$password@$db:5432/postgres" \
 -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public -e "PGRST_JWT_SECRET=$secret" \
 postgrest/postgrest:v13.0.7 >/dev/null
rest_url="http://$(docker port "$rest" 3000/tcp)"
wait_http "$rest_url/" || { docker logs --tail 12 "$rest"; exit 1; }
NEOPEP_MAIL_URL="$mail_url" NEOPEP_AUTH_URL="$auth_url" NEOPEP_REST_URL="$rest_url" NEOPEP_DB_CONTAINER="$db" node tests/commercial-supabase-local.cjs

rollback=release/production/rollback/20261128174500_shop_commercial_accounts.sql
psql -q < "$rollback" >/dev/null
psql -qAtc "select to_regclass('neo_private.shop_commercial_accounts') is null and to_regprocedure('public.neo_commercial_account()') is null and to_regprocedure('public.neo_shop(text,jsonb)') is not null and (select count(*) from auth.users)=3" | grep -qx t
psql -q < supabase/migrations/20261128174500_shop_commercial_accounts.sql >/dev/null
psql -qAtc "select to_regprocedure('public.neo_commercial_account()') is not null" | grep -qx t
echo 'Rollback e reaplicação locais concluídos.'
