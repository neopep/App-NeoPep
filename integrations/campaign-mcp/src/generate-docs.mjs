import {draftTools} from './draft-catalog.mjs';
import {writeFileSync,readFileSync} from 'node:fs';
import {campaignTools,tools,version,scopeByTool} from './catalog.mjs';
const destination=new URL('../../../docs/NEOPEP-CONNECT-AI-FERRAMENTAS.md',import.meta.url);
const document=[
 '# NeoPep Connect AI — catálogo candidato de ferramentas',
 '',
 'Arquivo gerado pelo catálogo. Versão `'+version+'`. O acesso depende de autorização a cada requisição.',
 'O guia inclui métodos criativos próprios; referências externas não são executadas nem copiadas. Antes de preparar campanhas, consulte get_capabilities, get_publication_guide e get_brand_context. A escrita candidata exige guideVersion atual e guideReceipt assinado, válido por 10 minutos e vinculado à conexão. Comprova consulta técnica, não compreensão pelo modelo. O catálogo descreve o código candidato, não a implantação ativa. O acesso depende do ambiente e das capacidades publicadas. As ferramentas de escrita são candidatas exclusivas de Teste e exigem consentimento campaigns:drafts; não estão implantadas.','',
 '',
 ...[...tools,...campaignTools,...draftTools].flatMap(tool=>[
  '## '+tool.name,'',tool.description,'','Escopo `'+(draftTools.includes(tool)?'campaigns:read + campaigns:drafts':scopeByTool.get(tool.name)||'campaigns:read')+'`.','',
  '```json',JSON.stringify({input:tool.inputSchema,output:tool.outputSchema},null,2),'```',''
 ])
].join('\n')+'\n';
if(process.argv.includes('--check')){
 if(readFileSync(destination,'utf8')!==document)throw Error('Regere o manual do Connect AI.');
}else writeFileSync(destination,document);
