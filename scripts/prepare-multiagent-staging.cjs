const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const core = require('../dist/core.js');

const repo = path.resolve(__dirname, '..');
const reference = 'c770682c9688a6c7734477597286a899e7db9d72';
const { staging, verifyStagingKey, writeConfig } = require('../release/multiagent-staging/configure-frontend.cjs');
const production = 'https://cpslafpzjtbpmoxxysaa.supabase.co';
const templates = path.join(repo, 'release/multiagent-staging');

function fromReference(name) {
  return execFileSync('git', ['show', `${reference}:${name}`], { cwd: repo, encoding: 'utf8' });
}

function writeSQL(output) {
  const names = execFileSync('git', ['ls-tree', '-r', '--name-only', reference, 'supabase/migrations'], {
    cwd: repo, encoding: 'utf8'
  }).trim().split('\n').sort();
  if (names.length !== 47) throw new Error('Esperadas 47 migrações na referência.');
  fs.mkdirSync(path.join(output, 'migrations'));
  const replaced = [];
  for (const name of names) {
    const original = fromReference(name);
    const copy = original.replaceAll(production, staging);
    if (copy.includes('cpslafpzjtbpmoxxysaa')) throw new Error('Referência operacional remanescente na migração.');
    if (copy !== original) replaced.push(path.basename(name));
    fs.writeFileSync(path.join(output, 'migrations', path.basename(name)), copy);
  }
  const expected = ['202611160038_push_instant_messages.sql', '202611160039_library_shop_push.sql'];
  if (JSON.stringify(replaced) !== JSON.stringify(expected)) throw new Error('Revisão obrigatória de URLs das migrações.');
  fs.copyFileSync(path.join(templates, 'preflight.sql'), path.join(output, '00-preflight.sql'));
  fs.copyFileSync(path.join(templates, 'postflight.sql'), path.join(output, '99-postflight.sql'));
  const order = ['00-preflight.sql', ...names.map(name => 'migrations/' + path.basename(name)), '99-postflight.sql'];
  fs.writeFileSync(path.join(output, 'ORDEM.txt'), order.join('\n') + '\n');
  fs.writeFileSync(path.join(output, 'aplicar-psql.sql'), '\\set ON_ERROR_STOP on\n' +
    order.map(name => '\\ir ' + name).join('\n') + '\n');
  const fixture = fs.readFileSync(path.join(templates, 'fixtures.sql'), 'utf8')
    .replace('__SYNTHETIC_SETTINGS__', `$fixture$${JSON.stringify(core.blank().settings)}$fixture$::jsonb`)
    .replace('__SYNTHETIC_PROFILE__', `$fixture$${JSON.stringify({
      ...core.defaultProfile(), height: 170, initialWeight: 70, goal: 69, consent: true
    })}$fixture$::jsonb`);
  fs.writeFileSync(path.join(output, 'fixture-opcional.sql'), fixture);
  fs.copyFileSync(path.join(repo, 'release/auditoria-multiagentes.sql'), path.join(output, 'auditoria-somente-leitura.sql'));
  const guide = fs.readFileSync(path.join(repo, 'docs/processos/HOMOLOGACAO-MULTIAGENTE.md'), 'utf8')
    .replace('(PUBLICACAO-MULTIAGENTE.md)',
      `(https://github.com/neopep/App-NeoPep/blob/${reference}/docs/processos/PUBLICACAO-MULTIAGENTE.md)`);
  fs.writeFileSync(path.join(output, 'LEIA-ME.md'), guide);
}

function writeEdge(output) {
  const dir = path.join(output, 'edge');
  fs.mkdirSync(dir);
  for (const name of ['ai-reply', 'agent-integrations']) {
    esbuild.buildSync({
      absWorkingDir: repo, entryPoints: [`supabase/functions/${name}/index.ts`],
      outfile: path.join(dir, name + '.ts'), bundle: true, format: 'esm', platform: 'neutral', external: ['npm:*']
    });
  }
}

function writeFrontend(output, key) {
  const frontend = path.join(output, 'frontend');
  fs.mkdirSync(frontend);
  // Add each file from the pinned tree, excluding the operational config before extraction.
  const names = execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', reference, 'dist'], { cwd: repo })
    .toString().split('\0').filter(name => name && name !== 'dist/config.js');
  // Extract one tar to avoid spawning Git once per asset.
  const archive = execFileSync('git', ['archive', reference, ...names], { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
  execFileSync('tar', ['-xf', '-', '-C', frontend], { input: archive });
  writeConfig(path.join(frontend, 'dist'), key);
  execFileSync(process.execPath, [path.join(repo, 'scripts/check-config.cjs')], { cwd: frontend, stdio: 'inherit' });
  const dist = path.join(frontend, 'dist');
  for (const file of ['index.html', 'admin/index.html', 'excluir-conta/index.html']) {
    const target = path.join(dist, file);
    const html = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, html.replaceAll('https://*.supabase.co', staging)
      .replaceAll('wss://*.supabase.co', staging.replace('https:', 'wss:')));
  }
  const items = fs.readdirSync(dist);
  const legacy = path.join(dist, 'neo');
  fs.mkdirSync(legacy);
  for (const item of items) fs.cpSync(path.join(dist, item), path.join(legacy, item), { recursive: true });
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('Informe um diretório novo para o pacote.');
  const output = path.resolve(dir);
  const key = (process.env.NEO_STAGING_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (key) {
    if (fromReference('dist/config.js').includes(key)) throw new Error('Chave operacional recusada.');
    await verifyStagingKey(key);
  }
  fs.mkdirSync(output);
  writeSQL(output);
  writeEdge(output);
  writeFrontend(output, key);
  fs.copyFileSync(path.join(templates, 'configure-frontend.cjs'), path.join(output, 'configurar-frontend.cjs'));
  console.log(key ? 'SQL, Edge e frontend isolados preparados.' : 'Pacote preparado. A nuvem no frontend fica desabilitada até verificar a chave publishable do staging.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
