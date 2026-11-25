'use strict';
const fs=require('node:fs');

const sources=[
 'campaign-dispatch/20261124234500_campaign_dispatch.sql',
 'campaign-rich/20261125042000_campaign_rich_staging.sql',
 'campaign-rich/20261125042100_editor_media_path.sql',
 'campaign-rich/20261125042200_serial_claims.sql',
 'campaign-rich/20261125102000_editable_reference_captions.sql',
 'campaign-rich/20261125102100_allow_library_community_kinds.sql',
 'campaign-central/20261125143000_campaign_central.sql'
];
const read=file=>fs.readFileSync('release/'+file,'utf8');
const body=sql=>sql.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'').replace(/^notify pgrst,\s*'reload schema';\s*$/mi,'').trim();
function render(){
 const policy=body(read('campaign-wa-homologation/20261125023000_campaign_wa_homologation.sql'));
 const declaration=policy.match(/create table neo_private\.campaign_wa_test_config[\s\S]*?insert into neo_private\.campaign_wa_test_config default values;/)?.[0];
 const functions=policy.match(/create function neo_private\.campaign_wa_test_allowed[\s\S]*?revoke all on function neo_private\.campaign_wa_test_ready\(uuid,uuid,text\) from public,anon,authenticated;/)?.[0];
 if(!declaration||!functions)throw Error('Não foi possível localizar o contrato de destinatários.');
 const authorization=declaration+'\n'+
  'alter table neo_private.campaign_wa_test_config enable row level security;\n'+
  'revoke all on neo_private.campaign_wa_test_config from public,anon,authenticated,service_role;\n'+functions;
 const [dispatch,...rich]=sources.map(file=>body(read(file)));
 return [
  'begin;',
  "set local lock_timeout='5s';",
  dispatch,
  'alter table neo_private.campaign_dispatch_config add constraint campaign_dispatch_legacy_off check(not whatsapp_enabled and not app_enabled);',
  authorization,
  ...rich,
  "notify pgrst,'reload schema';",
  'commit;'
 ].join('\n\n').replaceAll('campaign_wa_test_','campaign_wa_official_')
  .replaceAll('https://qnuluspqfazdppciermw.supabase.co/auth/v1','https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1')
  .replaceAll('https://teste.app.neopep.com.br','https://app.neopep.com.br')+'\n';
}
if(require.main===module)process.stdout.write(render());
module.exports={render};
