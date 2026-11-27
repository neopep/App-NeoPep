import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planNativeVideo,verifyNativeVideo,NATIVE_VIDEO_MAX,convertCampaignVideo} from '../campaign-video.mjs';
const v={codec_type:'video',codec_name:'h264',pix_fmt:'yuv420p',width:720,height:1280,avg_frame_rate:'30/1'};
const a={codec_type:'audio',codec_name:'aac'};
const input={format:{format_name:'mov,mp4,m4a,3gp,3g2,mj2',duration:'42.5'},streams:[v,a]};
test('compatible MP4 can be remuxed, HEVC/MOV or incompatible audio is transcoded',()=>{
 const plan=planNativeVideo(input);assert.equal(plan.compatible,true);assert.equal(plan.audio,true);
 assert.equal(planNativeVideo({...input,streams:[{...v,codec_name:'hevc'},a]}).compatible,false);
 assert.equal(planNativeVideo({...input,streams:[v,{...a,codec_name:'pcm_s16le'}]}).compatible,false);
});
test('video output must preserve duration and audio and meet compatibility and capacity',()=>{
 const plan=planNativeVideo(input);
 assert.equal(verifyNativeVideo(input,plan,1000000),true);
 assert.throws(()=>verifyNativeVideo({...input,format:{...input.format,duration:'6'}},plan,1000000));
 assert.throws(()=>verifyNativeVideo({...input,streams:[v]},plan,1000000));
 assert.throws(()=>verifyNativeVideo({...input,streams:[{...v,codec_name:'hevc'},a]},plan,1000000));
 assert.throws(()=>verifyNativeVideo(input,plan,NATIVE_VIDEO_MAX+1));
 assert.throws(()=>planNativeVideo({...input,streams:[a]}));
});
test('silent videos stay valid and extreme duration cannot exceed native budget',()=>{
 const silent={...input,streams:[v]};assert.equal(verifyNativeVideo(silent,planNativeVideo(silent),1000000),true);
 assert.throws(()=>planNativeVideo({...input,format:{...input.format,duration:'10800'}}));
});

test('real converter preserves a full MOV clip with audio and produces native-compatible MP4',{timeout:90000},async t=>{
 const {access,mkdtemp,rm,stat}=await import('node:fs/promises');
 const {join,delimiter,isAbsolute}=await import('node:path');
 const {tmpdir}=await import('node:os');
 const {execFile}=await import('node:child_process');
 const {promisify}=await import('node:util');
 const run=promisify(execFile);
 async function binary(name){
  for(const dir of (process.env.PATH||'').split(delimiter)){
   if(!isAbsolute(dir))continue;
   const file=join(dir,name+(process.platform==='win32'?'.exe':''));
   try{await access(file);return file;}catch{}
  }
 }
 const ffmpeg=await binary('ffmpeg'),ffprobe=await binary('ffprobe');
 if(!ffmpeg||!ffprobe){t.skip('FFmpeg/FFprobe not installed on this runner');return;}
 const work=await mkdtemp(join(tmpdir(),'neo-native-video-'));
 try{
  const source=join(work,'source.media');
  await run(ffmpeg,['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','2','-c:v','mpeg4','-c:a','pcm_s16le','-f','mov','-n',source],{timeout:30000});
  const originalSize=(await stat(source)).size;
  await convertCampaignVideo(work,{ffmpeg,ffprobe,signal:AbortSignal.timeout(65000)});
  const out=join(work,'native.mp4');
  const result=JSON.parse((await run(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,pix_fmt','-of','json',out])).stdout);
  assert.equal(result.streams.find(s=>s.codec_type==='video').codec_name,'h264');
  assert.equal(result.streams.find(s=>s.codec_type==='audio').codec_name,'aac');
  assert.ok(Math.abs(Number(result.format.duration)-2)<.5);
  assert.ok((await stat(out)).size<=NATIVE_VIDEO_MAX);
  assert.equal((await stat(source)).size,originalSize);
 }finally{await rm(work,{recursive:true,force:true});}
});
