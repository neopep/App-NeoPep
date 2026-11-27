import {guideVersion} from './publication-guide.mjs';
import {draftTools} from './draft-catalog.mjs';
const id={type:'string',format:'uuid'},channel={enum:['app','whatsapp']};
const guide={guideVersion:{const:guideVersion},guideReceipt:{type:'string',maxLength:78}};
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const items=draftTools.find(t=>t.name==='add_publications').inputSchema.properties.items;
const assembly=obj({jobId:id,state:{enum:['assembling','sealed','abandoned']},received:{type:'integer'},expected:{type:'integer'}});
const status=obj({id,state:{enum:['active','paused','cancelled']},items:{type:'array',items:obj({ordinal:{type:'integer'},publicationId:id,state:{type:'string'},attempts:{type:'integer'},revision:{type:['integer','null']}})}});
const run=obj({jobId:id,results:{type:'array',items:{type:'object',properties:{publicationId:id,state:{enum:['saved','uncertain']},recorded:{type:'boolean'},revision:{type:'integer'}},required:['publicationId','state','recorded'],additionalProperties:false}}});
const tool=(name,description,properties,outputSchema,readOnly=false)=>({name,description,inputSchema:obj({...properties,...guide}),outputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:false,idempotentHint:false,openWorldHint:false}});
export const jobTools=[
 tool('create_draft_job','Inicia montagem de 1 a 60 rascunhos; não grava publicações até selar e executar. Preserve jobId.',{jobId:id,channel,campaignId:id,expected:{type:'integer',minimum:1,maximum:60}},assembly),
 tool('append_draft_job_items','Acrescenta até seis itens por chamada na posição offset (zero-based). Limite total da requisição 16 KiB; reduza o bloco se necessário. Repetição idêntica é segura.',{jobId:id,channel,campaignId:id,offset:{type:'integer',minimum:0,maximum:59},items},assembly),
 tool('seal_draft_job','Confirma lote completo e congela conteúdo. Não envia nem agenda.',{jobId:id},assembly),
 tool('get_draft_job_assembly','Consulta progresso da montagem antes de selar.',{jobId:id},assembly,true),
 tool('get_draft_job','Consulta estados do lote selado; leases expiradas passam a incertas.',{jobId:id},status),
 tool('run_draft_job_chunk','Grava até seis rascunhos do lote selado; chamada explícita por bloco, nunca envio. Não repetir itens incertos.',{jobId:id},run),
 tool('control_draft_job','Pausa, retoma ou cancela lote selado; abandon descarta apenas montagem não selada. Não exclui rascunhos salvos.',{jobId:id,action:{enum:['pause','resume','cancel','abandon']}},{oneOf:[status,assembly]})
];
