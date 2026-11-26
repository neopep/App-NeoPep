const {test}=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const modulePath='../connect/whatsapp-lab/video-preview.mjs';
test('preview ranges, aspect ratio and local tool requirement',async()=>{
 const {previewRanges,previewDimensions,generateVideoPreview}=await import(modulePath);
 assert.deepEqual(previewRanges(4),[{start:0,length:4}]);assert.equal(previewRanges(30).length,3);
 assert.ok(previewRanges(30).every(x=>x.length===2&&x.start>=0&&x.start+2<=30));
 assert.deepEqual(previewDimensions(1920,1080),[480,270]);assert.deepEqual(previewDimensions(1080,1920),[270,480]);
 assert.throws(()=>previewRanges(Infinity));assert.throws(()=>previewDimensions(100000,100000));
 await assert.rejects(generateVideoPreview(Buffer.from('fake'),{ffmpeg:'ffmpeg',ffprobe:'ffprobe'}),/não configurado/);
});
let ffmpeg,ffprobe;
try{const cmd=process.platform==='win32'?'where':'which';ffmpeg=execFileSync(cmd,['ffmpeg'],{encoding:'utf8'}).trim().split(/\r?\n/)[0];ffprobe=execFileSync(cmd,['ffprobe'],{encoding:'utf8'}).trim().split(/\r?\n/)[0];}catch{}
test('synthetic 12s MP4 yields silent H264 preview no longer than 6.3s and <=500KiB',{skip:!ffmpeg||!ffprobe,timeout:120000},async()=>{
 const {generateVideoPreview,PREVIEW_MAX}=await import(modulePath);
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'neo-test-preview-'));
 try{
  const file=path.join(work,'input.mp4');
  execFileSync(ffmpeg,['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=360x640:rate=12:duration=12','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',file],{timeout:30000});
  const result=await generateVideoPreview(file,{ffmpeg,ffprobe});
  assert.equal(result.mime,'video/mp4');assert.ok(result.duration>=5.8&&result.duration<=6.3);assert.ok(result.bytes.length<=PREVIEW_MAX);assert.deepEqual([result.width,result.height],[270,480]);
 }finally{fs.rmSync(work,{recursive:true,force:true});}
});

test('preview source limit is 200 MiB; oversized file is rejected before FFmpeg',async()=>{
 const {generateVideoPreview,PREVIEW_SOURCE_MAX,PREVIEW_MAX}=await import(modulePath);
 assert.equal(PREVIEW_SOURCE_MAX,209715200);assert.equal(PREVIEW_MAX,512000);
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'neo-test-large-preview-')),file=path.join(work,'large.mp4');
 try{fs.closeSync(fs.openSync(file,'w'));fs.truncateSync(file,PREVIEW_SOURCE_MAX+1);
  await assert.rejects(generateVideoPreview(file,{ffmpeg:'/not-run',ffprobe:'/not-run'}),/acima de 200 MB/);
 }finally{fs.rmSync(work,{recursive:true,force:true});}
});
