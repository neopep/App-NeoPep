import {writeFileSync,readFileSync} from 'node:fs';
import {campaignTools,tools,version,scopeByTool} from './catalog.mjs';
const destination=new URL('../../../docs/NEOPEP-CONNECT-AI-FERRAMENTAS.md',import.meta.url);
const document=[
 '# NeoPep Connect AI — ferramentas do protótipo local',
 '',
 'Arquivo gerado pelo catálogo. Versão `'+version+'`. O acesso depende de autorização a cada requisição.',
 'As operações de campanha só aparecem em Teste com adaptador explicitamente configurado.','',
 '',
 ...[...tools,...campaignTools].flatMap(tool=>[
  '## '+tool.name,'',tool.description,'','Escopo `'+(scopeByTool.get(tool.name)||'campaigns:read')+'`.','',
  '```json',JSON.stringify({input:tool.inputSchema,output:tool.outputSchema},null,2),'```',''
 ])
].join('\n')+'\n';
if(process.argv.includes('--check')){
 if(readFileSync(destination,'utf8')!==document)throw Error('Regere o manual do Connect AI.');
}else writeFileSync(destination,document);
