import draft from '../contracts/tools.v1.draft.json' with {type:'json'};

const environment={type:'string',enum:['test','production']};
const strings={type:'array',items:{type:'string'}};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const version='1.0.0-preview.2';
const outputs={
 get_capabilities:object({environment,contract_version:{const:version},enabled_tools:strings,restrictions:strings}),
 get_brand_context:object({brand_version:{type:'string'},name:{const:'NeoPep'},editorial_rules:strings})
};
export const tools=draft.tools.filter(tool=>Object.hasOwn(outputs,tool.name)).map(tool=>({
 name:tool.name,description:tool.description,inputSchema:tool.inputSchema,outputSchema:outputs[tool.name],
 annotations:tool.annotations
}));
export const scopeByTool=new Map(tools.map(tool=>[tool.name,'campaigns:read']));

const state={enum:['archived','paused','needs_attention','scheduled','in_progress','draft','active','unknown']};
const channel={enum:['app','whatsapp']};
const nullableString={type:['string','null']};
const nullableInteger={type:['integer','null']};
const campaign=object({id:{type:'string'},title:{type:'string'},state,channel,next_at:nullableString,archived_at:nullableString,paused_at:nullableString});
const selection={channel,limit:{type:'integer',minimum:1,maximum:50},offset:{type:'integer',minimum:0,maximum:10000}};
const schedule=object({due_at:nullableString,cancelled_at:nullableString,states:strings,configured_at:nullableString,sent_at:nullableString,origin:nullableString,delivery_status:{enum:['unknown','cancelled','queued','scheduled','in_progress','needs_attention','partially_accepted','accepted','accepted_with_receipt','displayed','ended_or_cancelled','available_in_app']},message_count:nullableInteger,receipt_count:nullableInteger,group_count:nullableInteger,group_names:strings});
const publication=object({id:{type:'string'},title:{type:'string'},revision:nullableInteger,
 schedules:{type:'array',items:schedule}});
export const campaignTools=['list_campaigns','get_campaign'].map(name=>{
 const listing=name==='list_campaigns';
 const source=draft.tools.find(tool=>tool.name===name);
 return {
  name,description:listing?'Listar campanhas do titular no ambiente conectado, incluindo estado e próximo horário disponível.':
   'Consultar campanha, publicações, grupos conhecidos, datas de configuração e envio e histórico. Use include_recurrences=true para consultar recorrências. accepted_with_receipt indica aceite com recibo do executor, não comprova entrega ou leitura no WhatsApp.',
  annotations:source.annotations,
  inputSchema:{
   type:'object',additionalProperties:false,
   required:listing?['channel']:['channel','campaign_id'],
   properties:listing?{...selection,state}:{...selection,campaign_id:{type:'string',format:'uuid'},include_recurrences:{type:'boolean'}}
  },
  outputSchema:listing?object({items:{type:'array',items:campaign},next_offset:nullableInteger}):
   object({campaign,publications:{type:'array',items:publication},next_offset:nullableInteger,
    history:{type:'array',items:object({event:{type:'string'},recorded_at:nullableString})},
    recurrences:{type:['array','null'],items:object({id:{type:'string'},state:{type:'string'},configured_at:nullableString,timezone:nullableString,dates:strings})}})
 };
});

const readAnnotation={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
const assetKind={enum:['product','document','community']};
campaignTools.push(
 {name:'get_publication_content',description:'Ler conteúdo editorial e revisão da publicação do titular. Retorna texto, rótulos e tipos, não caminhos de mídia ou URLs privadas. Depende do gate de exclusão nativo.',annotations:readAnnotation,
 inputSchema:{type:'object',additionalProperties:false,required:['channel','campaign_id','publication_id'],properties:{channel,campaign_id:{type:'string',format:'uuid'},publication_id:{type:'string',format:'uuid'}}},
 outputSchema:object({campaign_id:{type:'string'},publication_id:{type:'string'},channel,revision:{type:'integer'},title:{type:'string'},planned_local:nullableString,timezone:nullableString,editable_draft:{type:'boolean'},blocks:{type:'array',items:object({id:{type:'string'},type:{enum:['text','image','file','link','product','document','community']},text:nullableString,label:nullableString,name:nullableString,has_attachment:{type:'boolean'},has_link:{type:'boolean'}})}})},
 {name:'list_authorized_assets',description:'Consultar catálogo autorizado do editor (Loja, Biblioteca e Comunidade), até 30 referências. Não retorna fotos, conteúdo dos membros, preço, credenciais ou arquivos privados. Nenhuma vinculação é realizada.',annotations:readAnnotation,
 inputSchema:{type:'object',additionalProperties:false,required:['channel','kind'],properties:{channel,kind:assetKind,search:{type:'string',maxLength:100}}},
 outputSchema:object({items:{type:'array',items:object({id:{type:'string'},label:{type:'string'},kind:assetKind})},limit:{const:30}})},
 {name:'list_destinations',description:'Consultar nomes e disponibilidade de grupos WhatsApp da conexão vigente do administrador. Não retorna JID, contatos, telefones ou membros; seleção e envio não são realizados.',annotations:readAnnotation,
 inputSchema:{type:'object',additionalProperties:false,required:['channel'],properties:{channel:{enum:['whatsapp']}}},
 outputSchema:object({items:{type:'array',items:object({name:{type:'string'},state:{enum:['eligible','stale']}})},selection_limit:{const:30}})}
);
