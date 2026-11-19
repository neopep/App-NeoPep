// Self-contained source for the Supabase dashboard editor. No credentials are embedded.
const esbuild=require('esbuild'),fs=require('node:fs');
for(const name of ['delete-account','auth-settings','ai-reply','agent-integrations','platform-integrations','mercadopago-create','mercadopago-webhook','shop-integrations']){const result=esbuild.buildSync({entryPoints:['supabase/functions/'+name+'/index.ts'],bundle:true,write:false,format:'esm',platform:'neutral',external:['npm:*']});fs.writeFileSync('/workspace/NeoPeptideos-'+name+'.ts',result.outputFiles[0].text);}
console.log('Funções autocontidas preparadas para revisão; nenhuma implantação remota executada.');
