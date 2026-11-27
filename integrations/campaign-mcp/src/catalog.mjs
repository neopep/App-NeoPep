import draft from '../contracts/tools.v1.draft.json' with {type:'json'};

const environment={type:'string',enum:['test','production']};
const strings={type:'array',items:{type:'string'}};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const version='1.0.0-preview.1';
const outputs={
 get_capabilities:object({environment,contract_version:{const:version},enabled_tools:strings,restrictions:strings}),
 get_brand_context:object({brand_version:{type:'string'},name:{const:'NeoPep'},editorial_rules:strings})
};
export const tools=draft.tools.filter(tool=>Object.hasOwn(outputs,tool.name)).map(tool=>({
 name:tool.name,description:tool.description,inputSchema:tool.inputSchema,outputSchema:outputs[tool.name],
 annotations:tool.annotations
}));
export const scopeByTool=new Map(tools.map(tool=>[tool.name,'campaigns:read']));

const state={enum:['archived','needs_attention','scheduled','in_progress','draft','unknown']};
const channel={enum:['app','whatsapp']};
const nullableString={type:['string','null']};
const nullableInteger={type:['integer','null']};
const campaign=object({id:{type:'string'},title:{type:'string'},state,channel});
const selection={channel,limit:{type:'integer',minimum:1,maximum:50},offset:{type:'integer',minimum:0,maximum:10000}};
const schedule=object({due_at:nullableString,cancelled_at:nullableString,states:strings});
const publication=object({id:{type:'string'},title:{type:'string'},revision:nullableInteger,
 schedules:{type:'array',items:schedule}});
export const campaignTools=['list_campaigns','get_campaign'].map(name=>{
 const listing=name==='list_campaigns';
 const source=draft.tools.find(tool=>tool.name===name);
 return {
  name,description:listing?'Listar campanhas do titular em Teste nos canais habilitados.':
   'Consultar campanha, publicações, agenda resumida e histórico disponível em Teste.',
  annotations:source.annotations,
  inputSchema:{
   type:'object',additionalProperties:false,
   required:listing?['channel']:['channel','campaign_id'],
   properties:listing?{...selection,state}:{...selection,campaign_id:{type:'string',format:'uuid'},include_recurrences:{type:'boolean'}}
  },
  outputSchema:listing?object({items:{type:'array',items:campaign},next_offset:nullableInteger}):
   object({campaign,publications:{type:'array',items:publication},next_offset:nullableInteger,
    history:{type:'array',items:object({event:{type:'string'},recorded_at:nullableString})},
    recurrences:{type:['array','null'],items:object({id:{type:'string'},state:{type:'string'},dates:strings})}})
 };
});
