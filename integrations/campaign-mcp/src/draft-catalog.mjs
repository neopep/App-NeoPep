// Write tools are advertised only to Teste connections with an explicit drafts grant.
const id={type:'string',format:'uuid'},channel={enum:['app','whatsapp']},text={type:'string',minLength:1,maxLength:2000},title={type:'string',minLength:1,maxLength:120};
const obj=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const item=properties=>({type:'array',minItems:1,maxItems:6,items:obj(properties)});
const batch=items=>({type:'array',minItems:1,maxItems:6,items});
const result=obj({publicationId:id,status:{enum:['draft_saved_or_reused','not_confirmed']},revision:{type:'integer'},error:{type:'string'}},['publicationId','status']);
const outputs=obj({campaignId:id,channel,results:{type:'array',items:result}});
const annotations={readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false};
export const draftTools=[
 {name:'create_campaign_draft',description:'Cria campanha em rascunho exclusivamente no Teste. Não envia nem agenda. Reutilize requestId em tentativas.',inputSchema:obj({channel,title,requestId:id}),outputSchema:obj({campaignId:id,channel,status:{const:'draft_created_or_reused'}}),annotations},
 {name:'add_publications',description:'Adiciona até seis publicações textuais em rascunho. plannedLocal é sugestão de horário, não agenda. Retorna resultado individual; reutilize IDs em tentativas.',inputSchema:obj({channel,campaignId:id,items:batch(obj({publicationId:id,requestId:id,title,blocks:item({id,text}),plannedLocal:{type:'string',maxLength:16}},['publicationId','requestId','title','blocks']))}),outputSchema:outputs,annotations},
 {name:'update_publications',description:'Edita texto de publicações ainda em rascunho. Exige revisão atual e ID de bloco; preserva outros campos. Conflitos exigem nova leitura.',inputSchema:obj({channel,campaignId:id,items:batch(obj({publicationId:id,requestId:id,revision:{type:'integer',minimum:1},edits:item({id,text})}))}),outputSchema:outputs,annotations}
];
