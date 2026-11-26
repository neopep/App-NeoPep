using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;

sealed partial class Connect {
    bool videoPreviewBusy;
    // Independent of the WhatsApp connection and dispatch gate. No media processing
    // unless both a provisioned converter and the separate server gate are available.
    bool PreviewToolReady(string runtime) {
        try {
            var root=Path.Combine(runtime,"video-tools");
            var manifest=Path.Combine(root,"sha256.txt");
            if(!File.Exists(manifest)||new FileInfo(manifest).Length>1024)return false;
            var lines=File.ReadAllLines(manifest);
            if(lines.Length!=2)return false;
            var names=new[]{"ffmpeg.exe","ffprobe.exe"};
            for(int i=0;i<names.Length;i++){
                var path=Path.Combine(root,names[i]);
                if(!File.Exists(path)||!System.Text.RegularExpressions.Regex.IsMatch(lines[i],@"\A[a-f0-9]{64}\z"))return false;
                using(var stream=File.OpenRead(path))using(var hash=SHA256.Create()){
                    if(BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant()!=lines[i])return false;
                }
            }
            return File.Exists(Path.Combine(runtime,"node.exe"))&&File.Exists(Path.Combine(runtime,"bridge","video-preview-cli.mjs"));
        }catch{return false;}
    }
    Task<Dictionary<string,object>> VideoPreviewRpc(string action,object data){
        return Post("/rest/v1/rpc/neo_library_video_preview_device",new {
            p_action=action,p_device=Value(local,"device"),p_secret=Value(local,"secret"),p_data=data
        },true);
    }
    bool PreviewSession(Guid owner,string device){
        return !exiting&&!installingUpdate&&deviceApproved&&SessionReady()&&sessionOwner==owner&&Value(local,"device")==device;
    }
    async Task DownloadPreviewSource(string source,string destination){
        var request=(HttpWebRequest)WebRequest.Create(profile.Endpoint("/storage/v1/object/authenticated/neo-library/"+source));
        request.AllowAutoRedirect=false;request.Headers["Authorization"]="Bearer "+access;request.Headers["apikey"]=profile.PublishableKey;
        using(var deadline=new System.Threading.Timer(_=>request.Abort(),null,TimeSpan.FromSeconds(90),System.Threading.Timeout.InfiniteTimeSpan))
        using(var response=(HttpWebResponse)await request.GetResponseAsync())
        using(var input=response.GetResponseStream())
        using(var output=new FileStream(destination,FileMode.CreateNew,FileAccess.Write,FileShare.None)){
            const int limit=50*1024*1024;
            if(response.StatusCode!=HttpStatusCode.OK||response.ContentLength>limit)throw new IOException();
            var buffer=new byte[65536];int count;
            while((count=await input.ReadAsync(buffer,0,buffer.Length))!=0){
                if(output.Length+count>limit)throw new IOException();
                await output.WriteAsync(buffer,0,count);
            }
            if(output.Length==0)throw new IOException();
        }
    }
    async Task UploadVideoPreview(string path,byte[] bytes){
        var request=(HttpWebRequest)WebRequest.Create(profile.Endpoint("/storage/v1/object/neo-library-video-previews/"+path));
        request.AllowAutoRedirect=false;request.Method="POST";request.ContentType="video/mp4";request.ContentLength=bytes.Length;
        request.Headers["Authorization"]="Bearer "+access;request.Headers["apikey"]=profile.PublishableKey;request.Headers["x-upsert"]="false";
        using(var deadline=new System.Threading.Timer(_=>request.Abort(),null,TimeSpan.FromSeconds(30),System.Threading.Timeout.InfiniteTimeSpan)){
            using(var body=await request.GetRequestStreamAsync())await body.WriteAsync(bytes,0,bytes.Length);
            using(var response=(HttpWebResponse)await request.GetResponseAsync()){
                if(response.StatusCode!=HttpStatusCode.OK&&response.StatusCode!=HttpStatusCode.Created)throw new IOException();
            }
        }
    }
    static void ConvertPreview(string runtime,string work){
        // Fixed local names and executable; the process receives no session credentials.
        var start=new ProcessStartInfo(Path.Combine(runtime,"node.exe"),"video-preview-cli.mjs"){
            WorkingDirectory=Path.Combine(runtime,"bridge"),UseShellExecute=false,CreateNoWindow=true,
            RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true
        };
        start.EnvironmentVariables.Remove("NODE_OPTIONS");
        using(var process=Process.Start(start)){
            var stdout=process.StandardOutput.ReadToEndAsync();
            var stderr=process.StandardError.ReadToEndAsync();
            process.StandardInput.WriteLine(work);process.StandardInput.Close();
            if(!process.WaitForExit(420000)){
                try{process.Kill();}catch{}
                throw new IOException("preview_timeout");
            }
            if(process.ExitCode!=0)throw new IOException("preview_conversion");
            if(!Task.WaitAll(new Task[]{stdout,stderr},5000))throw new IOException("preview_pipe");
        }
    }
    async Task TickVideoPreview(){
        if(videoPreviewBusy||exiting||installingUpdate||!deviceApproved||!SessionReady())return;
        videoPreviewBusy=true;
        string work=null,id=null,fence=null;bool finishing=false;
        var owner=sessionOwner;var device=Value(local,"device");
        try {
            var runtime=Path.Combine(ConnectProfile.InstallFolder,ConnectVersion.Runtime);
            if(!await Task.Run(()=>PreviewToolReady(runtime))||!PreviewSession(owner,device))return;
            var job=await VideoPreviewRpc("claim",new {video_preview_v1=true});
            if(job==null||!PreviewSession(owner,device))return;
            id=Value(job,"id");fence=Value(job,"fence");
            var source=Value(job,"source_path");var output=Value(job,"output_path");
            Guid jid,jf;
            if(!Guid.TryParseExact(id,"D",out jid)||!Guid.TryParseExact(fence,"D",out jf)
               ||!System.Text.RegularExpressions.Regex.IsMatch(source,@"\A[a-f0-9-]{36}/[a-f0-9-]{36}[.][a-z0-9]{1,12}\z")
               ||output!=owner.ToString("D")+"/"+id+"/"+fence+".mp4")throw new IOException("preview_lease");
            work=Path.Combine(Folder,"video-preview-"+Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(work);
            await DownloadPreviewSource(source,Path.Combine(work,"source.media"));
            if(!PreviewSession(owner,device))return;
            await Task.Run(()=>ConvertPreview(runtime,work));
            if(!PreviewSession(owner,device))return;
            var file=Path.Combine(work,"preview.mp4");
            if(!File.Exists(file)||new FileInfo(file).Length<=0||new FileInfo(file).Length>512000)throw new IOException("preview_size");
            var bytes=File.ReadAllBytes(file);
            if(bytes.Length<12||bytes[4]!=102||bytes[5]!=116||bytes[6]!=121||bytes[7]!=112)throw new IOException("preview_format");
            await UploadVideoPreview(output,bytes);
            if(!PreviewSession(owner,device))return;
            finishing=true;
            var result=await VideoPreviewRpc("finish",new {id=id,fence=fence,video_preview_v1=true});
            if(Value(result,"state")=="ready")Record("video_preview_ready");
            else Record("video_preview_confirmation_pending");
        }catch{
            if(!finishing&&id!=null&&fence!=null&&PreviewSession(owner,device)){
                try{await VideoPreviewRpc("fail",new {id=id,fence=fence,video_preview_v1=true});}catch{}
            }
            Record("video_preview_unavailable");
        }finally{
            if(work!=null)try{Directory.Delete(work,true);}catch{}
            videoPreviewBusy=false;
        }
    }
}
