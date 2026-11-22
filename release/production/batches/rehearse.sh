#!/usr/bin/env bash
# Executa um lote e registra evidências exclusivamente no destino isolado.
set -euo pipefail
umask 077
if [[ $# -lt 2 || $# -gt 3 ]] || [[ ${3:---rollback} != --rollback && ${3:---rollback} != --apply-isolated ]]; then
  printf 'Uso: PGSERVICE=perfil_isolado bash %s LOTE DIRETORIO_NOVO [--rollback|--apply-isolated]\n' "$0" >&2
  exit 2
fi
: "${PGSERVICE:?Selecione o perfil PostgreSQL isolado}"
lot=$1
evidence=$2
mode=${3:---rollback}
here=$(cd -- "$(dirname -- "$0")" && pwd)
psql_cmd=(psql -XqAt --no-password -v ON_ERROR_STOP=1)
target=$("${psql_cmd[@]}" -c 'select current_database()')
if [[ $target != neopep_release_rehearsal ]]; then
  printf 'Banco fora do ensaio.\n' >&2
  exit 1
fi
mkdir -- "$evidence"
args=()
[[ $mode != --rollback ]] || args+=(--rollback)
python3 "$here/render.py" "$lot" "${args[@]}" > "$evidence/lote.sql"
"${psql_cmd[@]}" -f "$here/../catalog.sql" > "$evidence/antes.jsonl"
if [[ $lot == 07-financeiro ]]; then
  "${psql_cmd[@]}" -f "$here/../finance-preflight.sql" > "$evidence/financeiro-antes.txt"
fi
"${psql_cmd[@]}" -f "$evidence/lote.sql" > "$evidence/execucao.log" 2>&1
"${psql_cmd[@]}" -f "$here/../catalog.sql" > "$evidence/depois.jsonl"
if [[ $lot == 07-financeiro ]]; then
  "${psql_cmd[@]}" -f "$here/../finance-preflight.sql" > "$evidence/financeiro-depois.txt"
fi
(
  cd -- "$evidence"
  sha256sum -- lote.sql antes.jsonl depois.jsonl > SHA256SUMS
)
if [[ $mode == --rollback ]]; then
  cmp -- "$evidence/antes.jsonl" "$evidence/depois.jsonl"
else
  python3 "$here/../compare-catalog.py" "$evidence/antes.jsonl" "$evidence/depois.jsonl" > "$evidence/delta.json"
fi
