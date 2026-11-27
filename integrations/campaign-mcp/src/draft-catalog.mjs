import {guideVersion} from './publication-guide.mjs';
// Write tools are advertised only to Teste connections with an explicit drafts grant.
const id={type:'string',format:'uuid'},channel={enum:['app','whatsapp']},text={type:'string',minLength:1,maxLength:2000},title={type:'string',minLength:1,maxLength:120};
const obj=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const item=properties=>({type:'array',minItems:1,maxItems:6,items:obj(properties)});
const batch=items=>({type:'array',minItems:1,maxItems:6,items});
const result=obj({publicationId:id,status:{enum:['draft_saved_or_reused','not_confirmed']},revision:{type:'integer'},error:{type:'string'}},['publicationId','status']);
const outputs=obj({campaignId:id,channel,results:{type:'array',items:result}});
const receiptField={type:'string',maxLength:78,description:'Comprovante temporário guide_receipt de get_publication_guide, vinculado à conexão.'};
const guideField={type:'string',const:guideVersion,description:'Versão retornada por get_publication_guide; consulte antes de escrever.'};
const revision={type:'integer',minimum:1};
const caption=obj({blockId:id,mode:{enum:['caption','separate','none']},text:{type:'string',maxLength:2000},separateBlockId:id},['blockId','mode']);
const revisionItem={publicationId:id,requestId:id,revision};
const albumEdit=obj({albumId:id,items:{type:'array',minItems:2,maxItems:4,items:obj({id,text:{type:'string',maxLength:1000}})}});
const updateItem={oneOf:[obj({...revisionItem,edits:item({id,text})}),obj({...revisionItem,mediaCaption:caption}),obj({...revisionItem,albumEdit})]};
const annotations={readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false};
export const draftTools=[
 {name:'create_campaign_draft',description:'Cria campanha em rascunho exclusivamente no Teste. Não envia nem agenda. Reutilize requestId em tentativas.',inputSchema:obj({channel,title,requestId:id,guideVersion:guideField,guideReceipt:receiptField}),outputSchema:obj({campaignId:id,channel,status:{const:'draft_created_or_reused'}}),annotations},
 {name:'add_publications',description:'Adiciona até seis publicações textuais em rascunho. plannedLocal é sugestão de horário, não agenda. Retorna resultado individual; reutilize IDs em tentativas.',inputSchema:obj({channel,campaignId:id,guideVersion:guideField,guideReceipt:receiptField,items:batch(obj({publicationId:id,requestId:id,title,blocks:item({id,text}),plannedLocal:{type:'string',maxLength:16}},['publicationId','requestId','title','blocks']))}),outputSchema:outputs,annotations},
 {name:'update_publications',description:'Edita texto ou, no WhatsApp, mantém legenda, remove legenda ou cria mensagem de texto separada em rascunho. Exige revisão atual e ID de bloco; preserva outros campos. Conflitos exigem nova leitura.',inputSchema:obj({channel,campaignId:id,guideVersion:guideField,guideReceipt:receiptField,items:batch(updateItem)}),outputSchema:outputs,annotations}
];
