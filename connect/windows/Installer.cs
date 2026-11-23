using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Threading;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

static class Installer {
    const string Runtime=ConnectVersion.Runtime;
    static readonly string[] WebViewFiles={"Microsoft.Web.WebView2.Core.dll","Microsoft.Web.WebView2.WinForms.dll","WebView2Loader.dll"};
    const string Name=ConnectProfile.InstallerName;
    static readonly string Folder=ConnectProfile.InstallFolder;
    static readonly string Uninstall=ConnectProfile.UninstallRegistryPath;

    [STAThread] static int Main(string[] args) {
        bool uninstall=Array.IndexOf(args,"--uninstall")>=0,quiet=Array.IndexOf(args,"--quiet")>=0;
        try {
            if(!quiet&&MessageBox.Show(uninstall?"Desinstalar o "+Name+"?":"Instalar ou atualizar o "+Name+"?",
                Name,MessageBoxButtons.OKCancel,MessageBoxIcon.Question)!=DialogResult.OK)return 1;
            try {
                using(Mutex running=Mutex.OpenExisting(ConnectProfile.MutexName))return 2;
            } catch(WaitHandleCannotBeOpenedException){}
            if(uninstall) {
                using(var run=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run",true))
                    if(run!=null)run.DeleteValue(ConnectProfile.StartupRegistryName,false);
                foreach(string file in new[]{"NeoPepConnect.exe"})
                    File.Delete(Path.Combine(Folder,file));
                foreach(string file in WebViewFiles)File.Delete(Path.Combine(Folder,file));
                string runtime=Path.Combine(Folder,Runtime);
                if(Directory.Exists(runtime))Directory.Delete(runtime,true);
                string legacy=Path.Combine(Folder,"whatsapp-runtime-0.2.0");
                if(Directory.Exists(legacy))Directory.Delete(legacy,true);
                if(Directory.Exists(Folder))foreach(string helper in Directory.GetFiles(Folder,"NeoPepUpdate-*.exe"))File.Delete(helper);
                string updates=Path.Combine(Folder,"updates");
                if(Directory.Exists(updates))Directory.Delete(updates,true);
                Registry.CurrentUser.DeleteSubKeyTree(Uninstall,false);
                File.Delete(Shortcut());
                return 0;
            }
            Directory.CreateDirectory(Folder);
            {
                InstallRuntime();
                string helper=Path.Combine(Folder,"NeoPepUpdate-"+ConnectVersion.Number+".exe"),temporary=helper+".new";
                using(Stream source=Assembly.GetExecutingAssembly().GetManifestResourceStream("NeoPepUpdate.exe"))
                using(var output=File.Create(temporary))source.CopyTo(output);
                if(File.Exists(helper))File.Replace(temporary,helper,null);else File.Move(temporary,helper);
            }
            foreach(string file in WebViewFiles)InstallResource(file);
            string binary=Path.Combine(Folder,"NeoPepConnect.exe"),pending=binary+".new";
            using(Stream source=Assembly.GetExecutingAssembly().GetManifestResourceStream("NeoPepConnect.exe"))
            using(var destination=File.Create(pending)){source.CopyTo(destination);}
            if(File.Exists(binary))File.Replace(pending,binary,null);else File.Move(pending,binary);
            string installed=Path.Combine(Folder,"NeoPepConnectSetup.exe");
            string sourcePath=Assembly.GetExecutingAssembly().Location;
            if(!String.Equals(sourcePath,installed,StringComparison.OrdinalIgnoreCase))File.Copy(sourcePath,installed,true);
            using(var item=Registry.CurrentUser.CreateSubKey(Uninstall)){
                item.SetValue("DisplayName",Name);item.SetValue("DisplayVersion",ConnectVersion.Number);item.SetValue("Publisher","NeoPep");
                item.SetValue("DisplayIcon",binary+",0");
                item.SetValue("UninstallString","\""+installed+"\" --uninstall");
            }
            Type shell=Type.GetTypeFromProgID("WScript.Shell");
            if(shell!=null){
                object instance=Activator.CreateInstance(shell);
                object shortcut=shell.InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,instance,new object[]{Shortcut()});
                shortcut.GetType().InvokeMember("TargetPath",BindingFlags.SetProperty,null,shortcut,new object[]{binary});
                shortcut.GetType().InvokeMember("IconLocation",BindingFlags.SetProperty,null,shortcut,new object[]{binary+",0"});
                shortcut.GetType().InvokeMember("Save",BindingFlags.InvokeMethod,null,shortcut,new object[0]);
            }
            if(!quiet)Process.Start(binary);
            return 0;
        } catch(Exception){
            if(!quiet)MessageBox.Show("Feche o NeoPep Connect antes de atualizar ou desinstalar.",Name);
            return 2;
        }
    }
    static void InstallResource(string name){
        string target=Path.Combine(Folder,name),temporary=target+".new";
        using(Stream source=Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        using(var output=File.Create(temporary))source.CopyTo(output);
        if(File.Exists(target))File.Replace(temporary,target,null);else File.Move(temporary,target);
    }
    static void InstallRuntime(){
        string runtime=Path.Combine(Folder,Runtime), staging=runtime+"-"+Guid.NewGuid().ToString("N");
        string zip=staging+".zip";
        Directory.CreateDirectory(staging);
        try{
            using(Stream source=Assembly.GetExecutingAssembly().GetManifestResourceStream("whatsapp-runtime.zip"))
            using(var output=File.Create(zip))source.CopyTo(output);
            ZipFile.ExtractToDirectory(zip,staging);
            if(!File.Exists(Path.Combine(staging,"node.exe"))||!File.Exists(Path.Combine(staging,"bridge","windows-bridge.mjs")))
                throw new InvalidDataException();
            string previous=staging+".previous";
            if(Directory.Exists(runtime))Directory.Move(runtime,previous);
            try{Directory.Move(staging,runtime);}
            catch{if(Directory.Exists(previous))Directory.Move(previous,runtime);throw;}
            if(Directory.Exists(previous))Directory.Delete(previous,true);
        }finally{
            File.Delete(zip);
            if(Directory.Exists(staging))Directory.Delete(staging,true);
        }
    }
    static string Shortcut(){return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),ConnectProfile.ShortcutName);}
}
