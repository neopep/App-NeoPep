const esbuild=require('esbuild');require('./check-config.cjs');require('./package-pdf-reader.cjs');
(async()=>{await esbuild.build({entryPoints:['src/cloud.js'],bundle:true,format:'iife',target:['safari16.4'],minify:true,outfile:'dist/cloud.js',legalComments:'eof'});console.log('SDK oficial Supabase empacotado localmente.');})().catch(e=>{console.error(e);process.exit(1)});
