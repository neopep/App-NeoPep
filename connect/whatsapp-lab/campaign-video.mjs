// Convert the full video locally, never fall back to a WhatsApp document.
// Only verified local binaries supplied by the installed Connect may be used.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {stat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
const exec=promisify(execFile);
export const NATIVE_VIDEO_MAX=16*1024*1024;
export function planNativeVideo(input){
 const v=input.streams?.find(s=>s.codec_type==='video'&&s.disposition?.attached_pic!==1);
 const audio=input.streams?.find(s=>s.codec_type==='audio');
 const duration=Number(input.format?.duration);
 if(!/(^|,)(mov|mp4|webm|matroska)(,|$)/.test(input.format?.format_name||'')||!v||!Number.isSafeInteger(v.width)||!Number.isSafeInteger(v.height)||v.width<2||v.height<2||v.width*v.height>40000000||!Number.isFinite(duration)||duration<=0||duration>10800)throw Error('video_invalid');
 const bitrate=Math.min(4000,Math.floor((14*1024*1024*8/duration/1000)-128));
 if(bitrate<100)throw Error('video_capacity');
 const fps=String(v.avg_frame_rate||'').split('/').map(Number);
 const compatible=v.codec_name==='h264'&&v.pix_fmt==='yuv420p'&&v.width%2===0&&v.height%2===0&&Math.max(v.width,v.height)<=1920&&(!audio||audio.codec_name==='aac')&&fps.length===2&&fps[1]>0&&fps[0]/fps[1]<=30;
 return {duration,audio:!!audio,bitrate,compatible};
}
export function verifyNativeVideo(output,plan,size){
 const streams=output.streams||[],v=streams.find(s=>s.codec_type==='video'),a=streams.find(s=>s.codec_type==='audio');
 const duration=Number(output.format?.duration);
 if(!Number.isFinite(size)||size<16||size>NATIVE_VIDEO_MAX||!/(^|,)mp4(,|$)/.test(output.format?.format_name||'')||!v||v.codec_name!=='h264'||v.pix_fmt!=='yuv420p'||v.width%2||v.height%2||!Number.isFinite(duration)||duration<=0||Math.abs(duration-plan.duration)>Math.max(.5,Math.min(2,plan.duration*.02))||(plan.audio&&a?.codec_name!=='aac')||streams.some(s=>!['video','audio'].includes(s.codec_type)))throw Error('video_output_invalid');
 return true;
}
export async function convertCampaignVideo(work,{ffmpeg,ffprobe,signal}={}){
 if(!isAbsolute(work)||!isAbsolute(ffmpeg||'')||!isAbsolute(ffprobe||''))throw Error('video_tools_unavailable');
 const inputPath=join(work,'source.media'),outputPath=join(work,'native.mp4');
 const info=await stat(inputPath);if(!info.isFile()||info.size<8||info.size>50*1024*1024)throw Error('video_source_size');
 const run=async(bin,args)=>{signal?.throwIfAborted();return exec(bin,args,{cwd:work,shell:false,windowsHide:true,timeout:60000,maxBuffer:1024*1024,signal});};
 const probe=async(path)=>JSON.parse((await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=format_name,duration:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate:stream_disposition=attached_pic','-of','json',path])).stdout);
 const plan=planNativeVideo(await probe(inputPath));
 const base=['-nostdin','-hide_banner','-v','error','-protocol_whitelist','file,pipe','-threads','2','-i',inputPath,'-map','0:V:0','-map','0:a:0?','-sn','-dn','-map_metadata','-1','-map_chapters','-1'];
 const encode=['-vf',"scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=30",'-c:v','libx264','-preset','veryfast','-threads','2','-pix_fmt','yuv420p','-b:v',plan.bitrate+'k','-maxrate',plan.bitrate+'k','-bufsize',(plan.bitrate*2)+'k','-c:a','aac','-b:a','96k'];
 // Copy compatible streams only when comfortably within budget; otherwise transcode.
 const codec=plan.compatible&&info.size<=14*1024*1024?['-c','copy']:encode;
 await run(ffmpeg,[...base,...codec,'-movflags','+faststart','-f','mp4','-n',outputPath]);
 verifyNativeVideo(await probe(outputPath),plan,(await stat(outputPath)).size);
}
