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
