import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planNativeVideo,verifyNativeVideo,NATIVE_VIDEO_MAX} from '../campaign-video.mjs';
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
