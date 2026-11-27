#!/usr/bin/env bash
set -euo pipefail
umask 077

output=$(realpath -m "${1:?informe o diretório de saída}")
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
config=wrangler.production.jsonc

node --input-type=module - "$config" <<'JS'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(config.name, 'neopep-connect-ai-production');
assert.equal(config.main, 'src/production-entry.mjs');
assert.equal(config.vars.NEO_CONNECT_AI_ENABLED, '0');
assert.equal(config.vars.NEO_CONNECT_AI_READ_APP, '0');
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert.equal(config.hyperdrive.length, 1);
assert.equal(config.hyperdrive[0].binding, 'NEO_CONNECT_AI_DB');
assert.equal(config.hyperdrive[0].id, 'bf92ff5e07f8494c8a6c300b80d55b0c');
JS

temporary=$(mktemp -d)
trap 'rm -rf -- "$temporary"' EXIT
WRANGLER_SEND_METRICS=false npm exec --yes --package=wrangler@4.54.0 -- \
  wrangler deploy --dry-run --config "$config" --outdir "$temporary"
mkdir -- "$output"
install -m 600 "$temporary/production-entry.js" "$output/"
# The emitted bundle sits beside the config. Point the packaged config to it.
node --input-type=module - "$config" "$output/$config" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
config.main = 'production-entry.js';
writeFileSync(process.argv[3], JSON.stringify(config, null, 2) + '\n');
JS
cd -- "$output"
sha256sum production-entry.js "$config" > SHA256SUMS
sha256sum -c SHA256SUMS
zip -q -X neopep-connect-ai-production.zip production-entry.js "$config" SHA256SUMS
unzip -t neopep-connect-ai-production.zip
sha256sum neopep-connect-ai-production.zip
