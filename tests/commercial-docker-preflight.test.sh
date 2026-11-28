#!/usr/bin/env bash
# Regression: never call a real Docker daemon or touch real data.
set -euo pipefail
cd "$(dirname "$0")/.."
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
mkdir "$root/bin"
cat > "$root/bin/docker" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$MOCK_LOG"
case "$1 $2" in
 'context inspect') echo "$MOCK_HOST";;
 'info ') [[ "$MOCK_MODE" != unavailable ]];;
 'image inspect') [[ "$MOCK_MODE" != pullfail ]];;
 'pull '*) exit 1;;
 'system df') echo 'synthetic disk report';;
 'network create') [[ "$MOCK_MODE" != networkfail ]];;
 'run --label') exit 1;;
 'ps -aq') [[ "$MOCK_MODE" != empty ]] && echo 'fixture-owned-container';;
 'network ls') [[ "$MOCK_MODE" != empty ]] && echo 'fixture-owned-network';;
 'rm -fv'|'network rm') exit 0;;
 *) exit 2;;
esac
MOCK
chmod +x "$root/bin/docker"
bash -n tests/commercial-supabase-local.sh
for scenario in unavailable pullfail networkfail runfail remote context_remote empty; do
 export MOCK_LOG="$root/$scenario.log" MOCK_MODE="$scenario" MOCK_HOST=unix:///var/run/docker.sock
 : > "$MOCK_LOG"
 unset DOCKER_HOST DOCKER_CONTEXT
 if [[ "$scenario" == remote ]]; then export DOCKER_HOST=ssh://remote; fi
 if [[ "$scenario" == context_remote ]]; then
  export DOCKER_CONTEXT=fixture-remote DOCKER_HOST=unix:///var/run/docker.sock MOCK_HOST=ssh://remote
 fi
 if PATH="$root/bin:$PATH" bash tests/commercial-supabase-local.sh >"$root/$scenario.out" 2>&1; then
  echo "Unexpected success: $scenario" >&2; exit 1
 fi
 case "$scenario" in
  unavailable|pullfail|remote|context_remote)
   if grep -Eq '^network create|^rm |^network rm' "$MOCK_LOG"; then
    echo "Unexpected resource mutation: $scenario" >&2; exit 1
   fi;;
  networkfail|runfail)
   grep -q '^ps -aq --filter label=com.neopep.disposable-commercial=' "$MOCK_LOG"
   grep -q '^network ls -q --filter label=com.neopep.disposable-commercial=' "$MOCK_LOG"
   grep -qx 'rm -fv fixture-owned-container' "$MOCK_LOG"
   grep -qx 'network rm fixture-owned-network' "$MOCK_LOG";;
  empty)
   if grep -Eq '^rm |^network rm' "$MOCK_LOG"; then
    echo 'Unexpected deletion with no owned resources' >&2; exit 1
   fi;;
 esac
 if [[ "$scenario" == pullfail ]]; then
  grep -qx 'system df' "$MOCK_LOG"
  grep -q 'Nenhuma limpeza automática' "$root/$scenario.out"
 fi
 if [[ "$scenario" == remote || "$scenario" == context_remote ]]; then
  grep -q 'daemon local' "$root/$scenario.out"
 fi
 echo "PASS $scenario"
done
