const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=file=>fs.readFileSync('connect/windows/'+file,'utf8');
test('campanhas usam prévia e texto do mesmo editor, e mídia não é descartada no envio',()=>{
 const panel=read('CampaignComposer.cs'),wa=read('WhatsApp.cs');
 assert.match(panel,/previewText\.Text=text\.Length==0/);
 assert.match(panel,/campaignTitle\.Text,messageText\.Text,campaignCta\.Text/);
 assert.match(wa,/string text=CampaignText\(\)/);
 assert.match(wa,/action="send_image"[\s\S]*image=Convert.ToBase64String\(campaignImage\)/);
 assert.match(wa,/MessageBoxDefaultButton\.Button2/);
 assert.match(wa,/action="send_text"/);
 assert.match(panel,/ImageFormat\.Jpeg/);
});
test('rascunho e revisão programada ficam protegidos e lembrete não invoca envio',()=>{
 const panel=read('CampaignComposer.cs'),wa=read('WhatsApp.cs');
 assert.match(wa,/image=campaignImage==null\?null:Convert.ToBase64String/);
 assert.match(wa,/ProtectedData\.Protect[\s\S]*DataProtectionScope\.CurrentUser/);
 assert.match(wa,/RestoreCampaignMedia\(TextValue\(draft,"image"\),TextValue\(draft,"due"\)\)/);
 assert.match(panel,/timer\.Tick\+=delegate\{ShowSchedule\(\);\}/);
 assert.match(panel,/IsInvalidTime/);
 assert.match(panel,/IsAmbiguousTime/);
 assert.doesNotMatch(panel,/timer.*PublishManualText/);
});
test('tema permanece no cofre e catálogo reaproveita RPC administrativa de Teste',()=>{
 const app=read('Connect.cs'),theme=read('ConnectTheme.cs');
 assert.match(app,/local\["theme"\]=theme.Text;Save\(\)/);
 assert.match(theme,/Light=mode=="Claro"/);
 assert.match(theme,/GetManifestResourceStream\("NeoPepBrand"\)/);
 assert.match(app,/LoadCampaignSources[\s\S]*if\(!SessionReady\(\)\|\|!deviceApproved\)[\s\S]*neo_campaign_admin/);
});
