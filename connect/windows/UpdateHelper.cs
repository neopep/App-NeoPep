using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Text.RegularExpressions;
using System.Threading;

internal static class UpdateHelper {
    static int Main(string[] args){
        if(!ConnectProfile.ConnectEnabled||args.Length!=1||!Regex.IsMatch(args[0],"^[a-f0-9]{32}$"))return 2;
        bool acquired;
        using(var mutex=new Mutex(true,ConnectProfile.MutexName+"-update",out acquired)){
            if(!acquired)return 2;
            return Run(args[0]);
        }
    }
    static int Run(string ticketId){
        ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
        string folder=ConnectProfile.LocalFolder,work=Path.Combine(UpdateTrust.Cache(),ticketId);
        string application=Path.Combine(folder,"NeoPepConnect.exe"),setup=Path.Combine(work,UpdateTrust.FileName);
        string backup=Path.Combine(work,"previous.exe"),installPath=Path.Combine(folder,UpdateTrust.FileName),previousSetup=Path.Combine(work,"previous-setup.exe");
        UpdateManifest manifest=null;
        bool backupReady=false,safeWork=false,keepBackup=false;
        string current=null;
        try{
            UpdateTrust.EnsureLocal(folder,UpdateTrust.Cache(),work,setup,Path.Combine(work,"ticket.dat"),application);
            if(File.Exists(installPath))UpdateTrust.EnsureLocal(installPath);
            safeWork=true;
            var ticket=Path.Combine(work,"ticket.dat");
            if(DateTime.UtcNow-File.GetLastWriteTimeUtc(ticket)>TimeSpan.FromMinutes(3)||new FileInfo(ticket).Length>20000)throw new IOException();
            var json=new JavaScriptSerializer();
            var credentials=json.Deserialize<Dictionary<string,string>>(Encoding.UTF8.GetString(
                ProtectedData.Unprotect(File.ReadAllBytes(ticket),null,DataProtectionScope.CurrentUser)));
            manifest=UpdateManifest.Parse(credentials["manifest"]);
            var fileVersion=FileVersionInfo.GetVersionInfo(application);
            current=new Version(fileVersion.FileMajorPart,fileVersion.FileMinorPart,fileVersion.FileBuildPart).ToString();
            if(!UpdateTrust.Verify(manifest,current,ConnectProfile.EnvironmentCode,UpdateTrust.PublisherKey()))throw new IOException();
            if(!WaitForExit())throw new IOException();
            var approval=CheckApproval(credentials,manifest);
            if(!UpdateTrust.Verify(approval,current,ConnectProfile.EnvironmentCode,UpdateTrust.PublisherKey())
                ||approval.Canonical()!=manifest.Canonical())throw new IOException();
            using(var file=new FileStream(setup,FileMode.Open,FileAccess.Read,FileShare.Read)){
                if(!UpdateTrust.Matches(file,manifest))throw new IOException();
                File.Copy(application,backup);
                if(File.Exists(installPath))File.Copy(installPath,previousSetup);
                backupReady=true;
                using(var installer=Process.Start(new ProcessStartInfo(setup,"--quiet"){UseShellExecute=false,CreateNoWindow=true})){
                    if(installer==null)throw new IOException();
                    if(!installer.WaitForExit(120000)){
                        installer.Kill();installer.WaitForExit();throw new IOException();
                    }
                    if(installer.ExitCode!=0)throw new IOException();
                }
            }
            var installed=FileVersionInfo.GetVersionInfo(application);
            var actual=new Version(installed.FileMajorPart,installed.FileMinorPart,installed.FileBuildPart).ToString();
            if(actual!=manifest.Version)throw new IOException();
            using(var app=Process.Start(application)){
                if(app==null||app.WaitForExit(2500))throw new IOException();
            }
            try{Receipt(manifest.Version,"installed");}catch{}
            return 0;
        }catch{
            if(!safeWork)return 1;
            keepBackup=backupReady;
            try{
                if(backupReady){
                    var restored=Path.Combine(work,"restore.exe");
                    File.Copy(backup,restored);
                    if(File.Exists(application))File.Replace(restored,application,null);else File.Move(restored,application);
                    if(File.Exists(previousSetup))File.Copy(previousSetup,installPath,true);
                    else File.Delete(installPath);
                    using(var key=Microsoft.Win32.Registry.CurrentUser.OpenSubKey(ConnectProfile.UninstallRegistryPath,true)){
                        if(key!=null)key.SetValue("DisplayVersion",current);
                    }
                    keepBackup=false;
                }
                if(manifest!=null&&Regex.IsMatch(manifest.Version??"",@"^[0-9]+\.[0-9]+\.[0-9]+$"))Receipt(manifest.Version,backupReady?"rollback":"failed");
                if(File.Exists(application)&&WaitForExit())Process.Start(application);
            }catch{if(manifest!=null)try{Receipt(manifest.Version,"failed");}catch{}}
            return 1;
        }finally{
            if(safeWork){
                try{File.Delete(setup);File.Delete(Path.Combine(work,"ticket.dat"));}catch{}
                if(!keepBackup){
                    try{File.Delete(backup);File.Delete(previousSetup);Directory.Delete(work);}catch{}
                }
            }
        }
    }
    static UpdateManifest CheckApproval(Dictionary<string,string> credentials,UpdateManifest manifest){
        var request=(HttpWebRequest)WebRequest.Create(ConnectProfile.SupabaseUrl+"/functions/v1/connect-update");
        request.Method="POST";request.ContentType="application/json";request.AllowAutoRedirect=false;
        request.Timeout=15000;request.ReadWriteTimeout=10000;
        request.Headers["apikey"]=ConnectProfile.PublishableKey;
        request.Headers["Authorization"]="Bearer "+credentials["token"];
        var data=Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(new{
            action="authorize",version=manifest.Version,device=credentials["device"],secret=credentials["secret"]
        }));
        request.ContentLength=data.Length;
        using(var body=request.GetRequestStream())body.Write(data,0,data.Length);
        using(var response=(HttpWebResponse)request.GetResponse())
        using(var reader=new StreamReader(response.GetResponseStream(),Encoding.UTF8)){
            if(response.StatusCode!=HttpStatusCode.OK)throw new IOException();
            var buffer=new char[20000];var count=reader.ReadBlock(buffer,0,buffer.Length);
            if(count==buffer.Length)throw new IOException();
            return UpdateManifest.Parse(new String(buffer,0,count));
        }
    }
    static void Receipt(string version,string result){
        string path=Path.Combine(ConnectProfile.LocalFolder,"update-result.txt");
        string temp=path+".new";File.WriteAllLines(temp,new[]{version,result});
        if(File.Exists(path))File.Replace(temp,path,null);else File.Move(temp,path);
    }
    static bool WaitForExit(){
        for(int attempt=0;attempt<80;attempt++){
            try{using(var mutex=Mutex.OpenExisting(ConnectProfile.MutexName)){}}
            catch(WaitHandleCannotBeOpenedException){return true;}
            Thread.Sleep(250);
        }
        return false;
    }
}
