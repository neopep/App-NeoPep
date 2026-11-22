using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

static class Installer {
    static readonly string Name=ConnectProfile.InstallerName;
    static readonly string Folder=ConnectProfile.LocalFolder;
    static readonly string Uninstall=ConnectProfile.UninstallRegistryPath;

    [STAThread] static int Main(string[] args) {
        bool uninstall=Array.IndexOf(args,"--uninstall")>=0,quiet=Array.IndexOf(args,"--quiet")>=0;
        try {
            if(!quiet&&MessageBox.Show(uninstall?"Desinstalar o NeoPep Connect Teste?":"Instalar ou atualizar o NeoPep Connect Teste?",
                Name,MessageBoxButtons.OKCancel,MessageBoxIcon.Question)!=DialogResult.OK)return 1;
            if(uninstall) {
                using(var run=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run",true))
                    if(run!=null)run.DeleteValue(ConnectProfile.StartupRegistryName,false);
                foreach(string file in new[]{"NeoPepConnect.exe","session.dat","diagnostico.log","session.dat.new"})
                    File.Delete(Path.Combine(Folder,file));
                Registry.CurrentUser.DeleteSubKeyTree(Uninstall,false);
                File.Delete(Shortcut());
                return 0;
            }
            Directory.CreateDirectory(Folder);
            string binary=Path.Combine(Folder,"NeoPepConnect.exe"),pending=binary+".new";
            using(Stream source=Assembly.GetExecutingAssembly().GetManifestResourceStream("NeoPepConnect.exe"))
            using(var destination=File.Create(pending)){source.CopyTo(destination);}
            if(File.Exists(binary))File.Replace(pending,binary,null);else File.Move(pending,binary);
            string installed=Path.Combine(Folder,"NeoPepConnectSetup.exe");
            string sourcePath=Assembly.GetExecutingAssembly().Location;
            if(!String.Equals(sourcePath,installed,StringComparison.OrdinalIgnoreCase))File.Copy(sourcePath,installed,true);
            using(var item=Registry.CurrentUser.CreateSubKey(Uninstall)){
                item.SetValue("DisplayName",Name);item.SetValue("DisplayVersion","0.1.2");item.SetValue("Publisher","NeoPep");
                item.SetValue("UninstallString","\""+installed+"\" --uninstall");
            }
            Type shell=Type.GetTypeFromProgID("WScript.Shell");
            if(shell!=null){
                object instance=Activator.CreateInstance(shell);
                object shortcut=shell.InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,instance,new object[]{Shortcut()});
                shortcut.GetType().InvokeMember("TargetPath",BindingFlags.SetProperty,null,shortcut,new object[]{binary});
                shortcut.GetType().InvokeMember("Save",BindingFlags.InvokeMethod,null,shortcut,new object[0]);
            }
            if(!quiet)Process.Start(binary);
            return 0;
        } catch(Exception){
            if(!quiet)MessageBox.Show("Feche o NeoPep Connect antes de atualizar ou desinstalar.",Name);
            return 2;
        }
    }
    static string Shortcut(){return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),ConnectProfile.ShortcutName);}
}
