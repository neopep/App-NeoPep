const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Windows preview worker is independent of WhatsApp, bounded and fenced',()=>{
 const host=fs.readFileSync('connect/windows/VideoPreview.cs','utf8'),main=fs.readFileSync('connect/windows/Connect.cs','utf8'),build=fs.readFileSync('connect/windows/build.ps1','utf8');
 assert.match(main,/_ = TickVideoPreview|var previewTask=TickVideoPreview/);
 for(const p of [/PreviewToolReady/,/SHA256.Create/,/video_preview_v1=true/,/PreviewSession\(owner,device\)/,/200\*1024\*1024/,/512000/,/x-upsert.*false/,/finish.*fence/,/Directory.Delete\(work,true\)/])assert.match(host,p);
 assert.doesNotMatch(host,/DispatchCampaign|sendMessage|whatsapp\./);
 assert.match(build,/video-preview-cli\.mjs/);assert.match(build,/VideoPreview\.cs/);
});
