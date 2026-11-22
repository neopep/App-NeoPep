using System;
using System.IO;
using System.Text;

internal enum ConnectEnvironment { Teste, Producao }

internal sealed class ConnectProfile {
    internal static readonly ConnectProfile Teste = new ConnectProfile(ConnectEnvironment.Teste);
    internal static readonly ConnectProfile Producao = new ConnectProfile(ConnectEnvironment.Producao);
    internal const string InstallerName = "NeoPep Connect";
    // The existing installation and updater use these identifiers.
    internal const string MutexName = @"Local\NeoPepConnectStaging";
    internal const string StartupRegistryName = "NeoPepConnectStaging";
    internal const string UninstallRegistryPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\NeoPepConnectStaging";
    internal const string ShortcutName = "NeoPep Connect Teste.lnk";
    internal static string InstallFolder {get{return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"NeoPep Connect");}}

    internal readonly ConnectEnvironment EnvironmentId;
    internal readonly string EnvironmentName, EnvironmentCode, SupabaseUrl, PublishableKey, PanelUrl;
    internal bool IsProduction {get{return EnvironmentId==ConnectEnvironment.Producao;}}
    internal string AppName {get{return "NeoPep Connect • "+EnvironmentName;}}
    // The legacy folder remains the Teste profile, so upgrade and rollback never copy its data.
    internal string LocalFolder {get{return IsProduction?Path.Combine(InstallFolder,"profiles","production"):InstallFolder;}}
    internal byte[] Entropy {get{return IsProduction?Encoding.UTF8.GetBytes("NeoPepConnect/production/v1"):null;}}
    internal string AccountFolder(Guid account,Guid legacyOwner){
        return !IsProduction&&account==legacyOwner?LocalFolder:Path.Combine(LocalFolder,"accounts",account.ToString("D"));
    }
    internal static ConnectProfile FromCode(string code){
        return code=="staging"?Teste:code=="production"?Producao:null;
    }
    internal Uri Endpoint(string route){
        if(String.IsNullOrEmpty(route)||!route.StartsWith("/",StringComparison.Ordinal)||route.StartsWith("//",StringComparison.Ordinal)||route.Contains("\\"))
            throw new ArgumentException("Rota inválida.");
        return new Uri(SupabaseUrl+route);
    }
    ConnectProfile(ConnectEnvironment environment){
        EnvironmentId=environment;
        bool production=environment==ConnectEnvironment.Producao;
        EnvironmentName=production?"PRODUÇÃO":"TESTE";
        EnvironmentCode=production?"production":"staging";
        SupabaseUrl=production?"https://cpslafpzjtbpmoxxysaa.supabase.co":"https://qnuluspqfazdppciermw.supabase.co";
        PublishableKey=production?"sb_publishable_jZGrvy0CyOpXlaSiCooRdw_7Z2D_-1Y":"sb_publishable__DBr41nzy1oHAdWxmx1xHA_uKJy00R_";
        PanelUrl=production?"https://app.neopep.com.br/admin/":"https://teste.app.neopep.com.br/admin/";
    }
}
