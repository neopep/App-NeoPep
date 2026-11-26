const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('converter download has pinned archive and separate user consent',()=>{
 const host=fs.readFileSync('connect/windows/VideoPreview.cs','utf8'),ui=fs.readFileSync('connect/windows/UpdateUi.cs','utf8'),cli=fs.readFileSync('connect/whatsapp-lab/video-preview-cli.mjs','utf8');
 assert.match(host,/60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba/);
 assert.match(host,/PreviewFileHash\(archive\)!=VideoToolsArchiveHash/);assert.match(host,/request.AllowAutoRedirect=false/);
 assert.match(host,/MessageBox.Show/);assert.match(host,/VideoToolsArchiveBytes=114768076/);
 assert.match(ui,/Preparar prévias de vídeo/);assert.match(cli,/video-tools-9.0.2/);
});
