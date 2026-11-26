// Local-only candidate. Caller supplies trusted, provisioned FFmpeg binaries.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
const exec=promisify(execFile);
export const PREVIEW_MAX=500*1024;
export function previewRanges(duration){
 if(!Number.isFinite(duration)||duration<=0||duration>10800)throw Error('Duração do vídeo inválida.');
 if(duration<=6)return [{start:0,length:duration}];
 return [.18,.48,.78].map(f=>({start:Math.min(duration-2,Math.max(0,duration*f-1)),length:2}));
}
export function previewDimensions(w,h){
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<2||h<2||w*h>40000000)throw Error('Dimensões do vídeo inválidas.');
 const s=Math.min(1,480/Math.max(w,h));
 return [Math.max(2,Math.floor(w*s/2)*2),Math.max(2,Math.floor(h*s/2)*2)];
}
export async function generateVideoPreview(bytes,{ffmpeg,ffprobe,signal}={}){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>50*1024*1024)throw Error('Vídeo inválido ou acima de 50 MB.');
 if(!isAbsolute(ffmpeg||'')||!isAbsolute(ffprobe||''))throw Error('Conversor local ainda não configurado.');
 signal?.throwIfAborted();
 const work=await mkdtemp(join(tmpdir(),'neo-video-preview-'));
 const run=async(bin,args)=>{signal?.throwIfAborted();return exec(bin,args,{cwd:work,shell:false,windowsHide:true,timeout:45000,maxBuffer:1024*1024,signal});};
 const probe=async(name)=>JSON.parse((await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=format_name,duration:stream=codec_type,codec_name,width,height,duration','-of','json',name])).stdout);
 try{
  await writeFile(join(work,'input.media'),bytes,{flag:'wx',mode:0o600});
  const input=await probe('input.media');
  if(!/(^|,)(mov|mp4|webm|matroska)(,|$)/.test(input.format?.format_name||''))throw Error('Formato de vídeo não suportado.');
  const video=input.streams?.find(s=>s.codec_type==='video');
  if(!video)throw Error('Arquivo sem vídeo.');
  const duration=Number(input.format?.duration),ranges=previewRanges(duration);
  const [w,h]=previewDimensions(video.width,video.height);
  const files=[];
  for(let i=0;i<ranges.length;i++){
   const range=ranges[i];
   const offsets=[range.start,Math.min(Math.max(0,duration-range.length),range.start+range.length),Math.max(0,range.start-range.length)];
   let chosen;
   for(const start of [...new Set(offsets)]){
    const result=await run(ffmpeg,['-nostdin','-hide_banner','-v','info','-protocol_whitelist','file,pipe','-threads','1','-ss',String(start),'-i','input.media','-t',String(range.length),'-map','0:v:0','-an','-sn','-dn','-vf','scale=160:-2,blackdetect=d=0.10:pix_th=0.10:pic_th=0.98','-f','null','-']);
    const black=[...result.stderr.matchAll(/black_duration:([0-9.]+)/g)].reduce((n,m)=>n+Number(m[1]),0);
    if(black<range.length*.5){chosen=start;break;}
   }
   if(chosen===undefined)continue;
   const out='part'+i+'.mp4';
   await run(ffmpeg,['-nostdin','-hide_banner','-v','error','-protocol_whitelist','file,pipe','-threads','1','-ss',String(chosen),'-i','input.media','-t',String(range.length),'-map','0:v:0','-an','-sn','-dn','-vf','scale='+w+':'+h+':force_original_aspect_ratio=decrease:force_divisible_by=2,pad='+w+':'+h+':(ow-iw)/2:(oh-ih)/2,setsar=1,fps=12,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.25,trim=duration='+range.length,'-c:v','libx264','-threads','1','-profile:v','baseline','-pix_fmt','yuv420p','-bf','0','-b:v','380k','-maxrate','420k','-bufsize','420k','-movflags','+faststart','-map_metadata','-1','-map_chapters','-1','-y',out]);
   files.push(out);
  }
  if(!files.length)throw Error('Não foi possível localizar trechos visíveis.');
  await writeFile(join(work,'parts.txt'),files.map(f=>"file '"+f+"'").join('\n')+'\n',{flag:'wx'});
  await run(ffmpeg,['-nostdin','-hide_banner','-v','error','-protocol_whitelist','file,pipe','-f','concat','-safe','1','-i','parts.txt','-map','0:v:0','-c','copy','-an','-map_metadata','-1','-map_chapters','-1','-movflags','+faststart','-y','preview.mp4']);
  const output=await probe('preview.mp4'),v=output.streams?.[0],seconds=Number(output.format?.duration),size=(await stat(join(work,'preview.mp4'))).size;
  if(output.streams?.length!==1||v?.codec_type!=='video'||v.codec_name!=='h264'||Math.max(v.width,v.height)>480||!Number.isFinite(seconds)||seconds<=0||seconds>6.3||size<=0||size>PREVIEW_MAX)throw Error('Prévia fora do padrão de qualidade ou tamanho.');
  return {bytes:await readFile(join(work,'preview.mp4')),mime:'video/mp4',duration:seconds,width:v.width,height:v.height};
 }finally{await rm(work,{recursive:true,force:true});}
}
