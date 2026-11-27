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

const campaign=object({id:{type:'string'},title:{type:'string'},state:{enum:['active','archived']},channel:{const:'whatsapp'}});
const selection={channel:{const:'whatsapp'},limit:{type:'integer',minimum:1,maximum:50}};
export const campaignTools=['list_campaigns','get_campaign'].map(name=>{
 const listing=name==='list_campaigns';
 const source=draft.tools.find(tool=>tool.name===name);
 return {
  name,description:listing?'Listar a primeira página de campanhas WhatsApp do titular em Teste.':
   'Consultar uma campanha WhatsApp do titular em Teste e o resumo das suas publicações.',
  annotations:source.annotations,
  inputSchema:{
   type:'object',additionalProperties:false,
   required:listing?['channel']:['channel','campaign_id'],
   properties:listing?selection:{...selection,campaign_id:{type:'string',format:'uuid'}}
  },
  outputSchema:listing?object({items:{type:'array',items:campaign}}):
   object({campaign,publications:{type:'array',items:object({id:{type:'string'},title:{type:'string'},revision:{type:['integer','null']}})}})
 };
});
