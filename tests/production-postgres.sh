#!/usr/bin/env bash
# Ensaio PostgreSQL 17 com dados sintéticos e sem rede no contêiner.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
evidence=$(mktemp -d)
printf 'Evidências sintéticas em %s\n' "$evidence"
baseline=$(git rev-parse origin/main)
printf '%s\n' "$baseline" > "$evidence/baseline-head.txt"
git ls-tree -r --name-only "$baseline" supabase/migrations > "$evidence/baseline.txt"
test -s "$evidence/baseline.txt"
image=postgres:17-alpine@sha256:526f86d93c6ea08fd3f1fe5605650cacc781b2c6013169a0ad8f42c7d3d84f32
container=$(docker run --rm --detach --network none -e POSTGRES_HOST_AUTH_METHOD=trust "$image")
trap 'docker stop "$container" >/dev/null' EXIT
psql=(docker exec -i "$container" psql -XqAt -U postgres -v ON_ERROR_STOP=1)
for attempt in $(seq 1 45); do
  if docker exec "$container" pg_isready -q -U postgres -h 127.0.0.1; then break; fi
  sleep 1
done
"${psql[@]}" -d postgres -c 'create database neopep_release_rehearsal'
db=("${psql[@]}" -d neopep_release_rehearsal)
"${db[@]}" < tests/fixtures/production/base.sql
while IFS= read -r file; do
  git show "$baseline:$file" | "${db[@]}"
done < "$evidence/baseline.txt"
"${db[@]}" -c "alter table neo_private.community_preferences alter column push_enabled set default true;
grant select,insert,update,delete on public.neo_photos,public.neo_records,public.neo_consents,public.neo_profiles,public.neo_consent_events,public.neo_message_events,public.neo_migration_receipts to service_role;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','fixture@example.invalid');"
docker exec "$container" pg_dump -U postgres -Fc -d neopep_release_rehearsal > "$evidence/base.dump"
"${psql[@]}" -d postgres -c 'create database recovery_check'
docker exec -i "$container" pg_restore -U postgres --exit-on-error -d recovery_check < "$evidence/base.dump"
db_copy=("${psql[@]}" -d recovery_check)
"${db[@]}" < release/production/catalog.sql > "$evidence/before.jsonl"
"${db_copy[@]}" < release/production/catalog.sql > "$evidence/restored.jsonl"
python3 release/production/compare-catalog.py "$evidence/before.jsonl" "$evidence/restored.jsonl" > "$evidence/restore-delta.json"
python3 - "$evidence/restore-delta.json" <<'PYTHON'
import json
from pathlib import Path
import sys

# pg_restore omite ACLs explícitas que equivalem ao default do proprietário.
# Três CHECKs do baseline também são reserializados com AND associativo.
constraints = {
    'neo_private.community_files.community_files_name_check',
    'neo_private.library_uploads.library_uploads_name_check',
    'neo_private.support_attachments.support_attachments_name_check',
}
defaults = {'r': 'arwdDxtm', 'S': 'rwU', 'schema': 'UC'}
for entry in json.loads(Path(sys.argv[1]).read_text())['diferencas']:
    before, after = entry['producao'], entry['teste']
    if before is not None and after is not None:
        if entry['tipo'] in {'relation', 'schema'}:
            bits = defaults.get(before.get('kind', entry['tipo']))
            owner = before.get('owner')
            if bits and owner and before.get('acl') == [f'{owner}={bits}/{owner}'] and after.get('acl') is None:
                if {**before, 'acl': None} == after:
                    continue
        if entry['tipo'] == 'constraint' and entry['objeto'] in constraints:
            if before.get('definition_hash') == '078631b443cfe90b039d2d3480fd3a65' and after.get('definition_hash') == '5bc60ceb97f3eb434ff2a4eaa1b12ce4':
                if {**before, 'definition_hash': after['definition_hash']} == after:
                    continue
    raise SystemExit(f'Divergência de restauração inesperada: {entry["objeto"]}')
PYTHON
test "$("${db_copy[@]}" -c 'select email from auth.users')" = fixture@example.invalid
printf 'Restauração sintética — catálogo validado e registro Auth preservado\n'
python3 -c 'import json; print(*json.load(open("release/production/batches/manifest.json")),sep="\n")' > "$evidence/lotes.txt"
while IFS= read -r lot; do
  "${db[@]}" < release/production/catalog.sql > "$evidence/$lot-before.jsonl"
  python3 release/production/batches/render.py "$lot" --rollback > "$evidence/$lot-rollback.sql"
  "${db[@]}" < "$evidence/$lot-rollback.sql"
  "${db[@]}" < release/production/catalog.sql > "$evidence/$lot-rollback.jsonl"
  cmp "$evidence/$lot-before.jsonl" "$evidence/$lot-rollback.jsonl"
  python3 release/production/batches/render.py "$lot" > "$evidence/$lot.sql"
  "${db[@]}" < "$evidence/$lot.sql"
  printf 'PostgreSQL 17 isolado — %s: rollback e commit OK\n' "$lot"
done < "$evidence/lotes.txt"
"${db[@]}" < release/production/catalog.sql > "$evidence/after.jsonl"
python3 release/production/verify-invariants.py "$evidence/before.jsonl" "$evidence/after.jsonl"
(cd "$evidence" && sha256sum -- base.dump ./*.sql ./*.jsonl > SHA256SUMS)
