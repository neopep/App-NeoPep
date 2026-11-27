import {readFileSync,writeFileSync} from 'node:fs';
import {getPublicationGuide} from './publication-guide.mjs';
const registry=JSON.parse(readFileSync(new URL('../references/creative-gpts.json',import.meta.url),'utf8'));
const guide=getPublicationGuide('test',[]);
const snapshot={version:guide.guide_version,kind:'candidate_reference_only',workflow:guide.workflow,native_editor:guide.native_editor,examples:guide.examples,creative_context:guide.creative_context,guardrails:guide.guardrails,operations:guide.operations.map(({name,requires,rules})=>({name,requires,rules})),references:registry.sources,provenance:registry.provenance};
const destination=new URL('../../../dist/admin/connect-ai-knowledge.js',import.meta.url);
const output='// Generated from the canonical guide. No session data or runtime capabilities.\nwindow.NeoConnectAIKnowledge='+JSON.stringify(snapshot,null,2)+';\n';
if(process.argv.includes('--check')){
 if(readFileSync(destination,'utf8')!==output)throw Error('Regere a base de conhecimento administrativa.');
}else writeFileSync(destination,output);
