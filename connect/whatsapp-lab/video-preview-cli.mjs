// Private subprocess of the installed Connect. Input is a local, per-job directory.
// No credentials, network URLs or arbitrary executable names are accepted.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,isAbsolute,basename,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateVideoPreview} from './video-preview.mjs';
try{
 const chunks=[];let length=0;
 for await(const chunk of process.stdin){length+=chunk.length;if(length>4096)throw Error('input');chunks.push(chunk);}
 const work=Buffer.concat(chunks).toString('utf8').trim();
 if(!isAbsolute(work)||!/^video-preview-[a-f0-9]{32}$/.test(basename(work)))throw Error('path');
 const file=join(work,'source.media'),info=await stat(file);
 if(!info.isFile()||info.size<=0||info.size>50*1024*1024)throw Error('size');
 const tools=join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))),'video-tools-9.0.2');
 const signal=AbortSignal.timeout(390000);
 const result=await generateVideoPreview(await readFile(file),{ffmpeg:join(tools,'ffmpeg.exe'),ffprobe:join(tools,'ffprobe.exe'),signal});
 await writeFile(join(work,'preview.mp4'),result.bytes,{flag:'wx'});
}catch{process.exitCode=1;}
