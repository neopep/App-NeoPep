const fs = require('node:fs');
const esbuild = require('esbuild');
require('./check-config.cjs');
require('./package-pdf-reader.cjs');

(async () => {
  const result = await esbuild.build({
    entryPoints: ['src/cloud.js'],
    bundle: true,
    format: 'iife',
    target: ['safari16.4'],
    minify: true,
    legalComments: 'eof',
    outfile: 'dist/cloud.js',
    write: false
  });
  const output = result.outputFiles[0];
  // The bundled Auth SDK uses a template literal for its whitespace alphabet.
  // Escape its initial space and tab so Git's whitespace check accepts rebuilds.
  fs.writeFileSync(output.path, output.text.replace('=` \t\n', '=`\\x20\\t\n'));
  fs.copyFileSync('src/app.js', 'dist/app.js');
  console.log('SDK oficial Supabase empacotado localmente.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
