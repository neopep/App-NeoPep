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
    System.Windows.Forms.Button videoToolsInstall;
    System.Windows.Forms.Label videoToolsStatus;
    // Download separately, on an explicit user action. No Supabase credentials
    // are sent to the upstream distributor and no converter is repackaged.
    const string VideoToolsVersion="9.0.2";
    const string VideoToolsArchive="https://github.com/GyanD/codexffmpeg/releases/download/9.0.2/ffmpeg-9.0.2-essentials_build.zip";
    const string VideoToolsArchiveHash="60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba";
    const long VideoToolsArchiveBytes=114768076;
    static bool provisioningVideoTools;
    static string VideoToolsFolder(){return Path.Combine(ConnectProfile.InstallFolder,"video-tools-"+VideoToolsVersion);}
    static string PreviewFileHash(string path){
        using(var stream=File.OpenRead(path))using(var hash=SHA256.Create())
            return BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
    }
    static async Task DownloadVideoToolsArchive(string path){
        var url=new Uri(VideoToolsArchive);
        for(int hop=0;hop<5;hop++){
            if(url.Scheme!="https"||(url.Host!="github.com"&&url.Host!="release-assets.githubusercontent.com"&&url.Host!="objects.githubusercontent.com"&&url.Host!="github-releases.githubusercontent.com")||!String.IsNullOrEmpty(url.UserInfo))throw new IOException("video_tools_source");
            var request=(HttpWebRequest)WebRequest.Create(url);
            request.AllowAutoRedirect=false;request.UseDefaultCredentials=false;request.Credentials=null;
            request.UserAgent="NeoPep-Connect";request.Timeout=240000;
            using(var deadline=new System.Threading.Timer(_=>request.Abort(),null,TimeSpan.FromMinutes(4),System.Threading.Timeout.InfiniteTimeSpan))
            using(var response=(HttpWebResponse)await request.GetResponseAsync()){
                int status=(int)response.StatusCode;
                if(status>=300&&status<400){
                    var next=response.Headers["Location"];
                    if(String.IsNullOrEmpty(next))throw new IOException("video_tools_redirect");
                    url=new Uri(url,next);continue;
                }
                if(status!=200||(response.ContentLength>=0&&response.ContentLength!=VideoToolsArchiveBytes))throw new IOException("video_tools_size");
                using(var input=response.GetResponseStream())
                using(var output=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None)){
                    var buffer=new byte[65536];int count;
                    while((count=await input.ReadAsync(buffer,0,buffer.Length))!=0){
                        if(output.Length+count>VideoToolsArchiveBytes)throw new IOException("video_tools_size");
                        await output.WriteAsync(buffer,0,count);
                    }
                    if(output.Length!=VideoToolsArchiveBytes)throw new IOException("video_tools_size");
                }
                return;
            }
        }
        throw new IOException("video_tools_redirect");
    }
    static void ExtractVideoTools(string archive,string target){
        if(PreviewFileHash(archive)!=VideoToolsArchiveHash)throw new IOException("video_tools_checksum");
        Directory.CreateDirectory(target);
        using(var zip=System.IO.Compression.ZipFile.OpenRead(archive)){
            const string prefix="ffmpeg-9.0.2-essentials_build/";
            var names=new[]{"ffmpeg.exe","ffprobe.exe"};
            var hashes=new string[2];
            for(int i=0;i<names.Length;i++){
                var entry=zip.GetEntry(prefix+"bin/"+names[i]);
                if(entry==null||entry.Length<1024||entry.Length>256L*1024*1024)throw new IOException("video_tools_entry");
                var path=Path.Combine(target,names[i]);
                using(var input=entry.Open())using(var output=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None)){
                    var buffer=new byte[65536];int count;
                    while((count=input.Read(buffer,0,buffer.Length))!=0){
                        if(output.Length+count>entry.Length)throw new IOException("video_tools_entry");
                        output.Write(buffer,0,count);
                    }
                    if(output.Length!=entry.Length)throw new IOException("video_tools_entry");
                }
                hashes[i]=PreviewFileHash(path);
            }
            // Keep the upstream licensing notices with the local tool.
            var license=zip.GetEntry(prefix+"LICENSE")??zip.GetEntry(prefix+"LICENSE.txt");
            if(license==null||license.Length<=0||license.Length>1024*1024)throw new IOException("video_tools_license");
            using(var input=license.Open())using(var output=new FileStream(Path.Combine(target,"LICENSE.txt"),FileMode.CreateNew))input.CopyTo(output);
            File.WriteAllLines(Path.Combine(target,"sha256.txt"),hashes);
            File.WriteAllText(Path.Combine(target,"source.txt"),VideoToolsArchive+Environment.NewLine+VideoToolsArchiveHash+Environment.NewLine);
        }
    }
    async Task PrepareVideoTools(){
        if(provisioningVideoTools||installingUpdate||exiting||videoPreviewBusy||(sibling!=null&&sibling.videoPreviewBusy))return;
        var runtime=Path.Combine(ConnectProfile.InstallFolder,ConnectVersion.Runtime);
        var button=videoToolsInstall;var label=videoToolsStatus;
        provisioningVideoTools=true;button.Enabled=false;
        string stage=null;
        try{
            if(await Task.Run(()=>PreviewToolReady(runtime))){label.Text="Conversor de vídeos pronto.";return;}
            if(System.Windows.Forms.MessageBox.Show("Baixar o conversor FFmpeg (aprox. 115 MB) diretamente do distribuidor oficial indicado pelo projeto FFmpeg? O arquivo será conferido antes de ser usado.","Conversor de vídeos",System.Windows.Forms.MessageBoxButtons.YesNo,System.Windows.Forms.MessageBoxIcon.Question)!=System.Windows.Forms.DialogResult.Yes)return;
            label.Text="Baixando e verificando o conversor…";
            stage=Path.Combine(ConnectProfile.InstallFolder,"video-tools-stage-"+Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(stage);
            var archive=Path.Combine(stage,"ffmpeg.zip");var extracted=Path.Combine(stage,"verified");
            await DownloadVideoToolsArchive(archive);
            await Task.Run(()=>ExtractVideoTools(archive,extracted));
            if(exiting||installingUpdate)throw new IOException("video_tools_interrupted");
            var target=VideoToolsFolder();
            if(Directory.Exists(target))Directory.Move(target,target+".previous-"+Guid.NewGuid().ToString("N"));
            Directory.Move(extracted,target);
            if(!await Task.Run(()=>PreviewToolReady(runtime)))throw new IOException("video_tools_verification");
            label.Text="Conversor pronto para vídeos nativos e prévias da biblioteca.";
        }catch{label.Text="Não foi possível preparar o conversor. Verifique a conexão e tente novamente.";}
        finally{
            if(stage!=null)try{Directory.Delete(stage,true);}catch{}
            provisioningVideoTools=false;button.Enabled=true;
        }
    }

    // Independent of the WhatsApp connection and dispatch gate. No media processing
    // unless both a provisioned converter and the separate server gate are available.
    bool PreviewToolReady(string runtime) {
        try {
            var root=VideoToolsFolder();
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
        using(var deadline=new System.Threading.Timer(_=>request.Abort(),null,TimeSpan.FromMinutes(10),System.Threading.Timeout.InfiniteTimeSpan))
        using(var response=(HttpWebResponse)await request.GetResponseAsync())
        using(var input=response.GetResponseStream())
        using(var output=new FileStream(destination,FileMode.CreateNew,FileAccess.Write,FileShare.None)){
            const int limit=200*1024*1024;
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
    static void ConvertPreview(string runtime,string work,bool campaign=false){
        // Fixed local names and executable; the process receives no session credentials.
        var start=new ProcessStartInfo(Path.Combine(runtime,"node.exe"),campaign?"video-preview-cli.mjs campaign-native":"video-preview-cli.mjs"){
            WorkingDirectory=Path.Combine(runtime,"bridge"),UseShellExecute=false,CreateNoWindow=true,
            RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true
        };
        start.EnvironmentVariables.Remove("NODE_OPTIONS");
        using(var process=Process.Start(start)){
            var stdout=process.StandardOutput.ReadToEndAsync();
            var stderr=process.StandardError.ReadToEndAsync();
            process.StandardInput.WriteLine(work);process.StandardInput.Close();
            if(!process.WaitForExit(campaign?70000:420000)){
                try{process.Kill();}catch{}
                throw new IOException("preview_timeout");
            }
            if(process.ExitCode!=0)throw new IOException("preview_conversion");
            if(!Task.WaitAll(new Task[]{stdout,stderr},5000))throw new IOException("preview_pipe");
        }
    }
    async Task<byte[]> PrepareNativeCampaignVideo(byte[] source){
        if(source==null||source.Length<8||source.Length>50*1024*1024||provisioningVideoTools||videoPreviewBusy||(sibling!=null&&sibling.videoPreviewBusy))throw new IOException("video_conversion_unavailable");
        var runtime=Path.Combine(ConnectProfile.InstallFolder,ConnectVersion.Runtime);
        videoPreviewBusy=true;
        string work=null;
        try{
            if(!await Task.Run(()=>PreviewToolReady(runtime)))throw new IOException("video_tools_unavailable");
            work=Path.Combine(Folder,"campaign-video-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(work);
            var target=Path.Combine(work,"native.mp4");
            await Task.Run(()=>{File.WriteAllBytes(Path.Combine(work,"source.media"),source);ConvertPreview(runtime,work,true);});
            if(!File.Exists(target)||new FileInfo(target).Length<16||new FileInfo(target).Length>16*1024*1024)throw new IOException("video_output_invalid");
            return File.ReadAllBytes(target);
        }finally{
            if(work!=null)try{Directory.Delete(work,true);}catch{}
            videoPreviewBusy=false;
        }
    }
    async Task TickVideoPreview(){
        if(videoPreviewBusy||provisioningVideoTools||exiting||installingUpdate||!deviceApproved||!SessionReady())return;
        videoPreviewBusy=true;
        string work=null,id=null,fence=null;bool finishing=false;
        var owner=sessionOwner;var device=Value(local,"device");
        try {
          bool failed=false;
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
          }catch{failed=true;}
          if(failed){
            if(!finishing&&id!=null&&fence!=null&&PreviewSession(owner,device)){
                try{await VideoPreviewRpc("fail",new {id=id,fence=fence,video_preview_v1=true});}catch{}
            }
            Record("video_preview_unavailable");
          }
        }finally{
            if(work!=null)try{Directory.Delete(work,true);}catch{}
            videoPreviewBusy=false;
        }
    }
}
