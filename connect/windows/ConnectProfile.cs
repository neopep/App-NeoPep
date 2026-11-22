using System;
using System.IO;

internal static class ConnectProfile {
#if NEOPEP_PRODUCTION
    public const string EnvironmentName = "Produção";
    public const string EnvironmentCode = "production";
    public const string SupabaseUrl = "https://cpslafpzjtbpmoxxysaa.supabase.co";
    public const string PublishableKey = "sb_publishable_jZGrvy0CyOpXlaSiCooRdw_7Z2D_-1Y";
    // Back-end NeoPep Connect ainda não existe em produção: bloquear chamadas até homologação.
    public const bool ConnectEnabled = false;
    public const string PanelUrl = "";
    public const string AppName = "NeoPep Connect • Produção";
    public const string InstallerName = "NeoPep Connect (Produção)";
    public const string LocalFolderName = "NeoPep Connect Producao";
    public const string MutexName = @"Local\NeoPepConnectProduction";
    public const string StartupRegistryName = "NeoPepConnectProduction";
    public const string UninstallRegistryName = "NeoPepConnectProduction";
    public const string ShortcutName = "NeoPep Connect Produção.lnk";
#else
    public const string EnvironmentName = "Homologação";
    public const string EnvironmentCode = "staging";
    public const string SupabaseUrl = "https://qnuluspqfazdppciermw.supabase.co";
    public const string PublishableKey = "sb_publishable__DBr41nzy1oHAdWxmx1xHA_uKJy00R_";
    public const bool ConnectEnabled = true;
    public const string PanelUrl = "https://teste.app.neopep.com.br/admin/";
    public const string AppName = "NeoPep Connect • Teste";
    public const string InstallerName = "NeoPep Connect (Teste)";
    // Preserva a pasta e os tokens DPAPI do cliente 0.1.1 já autorizado.
    public const string LocalFolderName = "NeoPep Connect";
    public const string MutexName = @"Local\NeoPepConnectStaging";
    public const string StartupRegistryName = "NeoPepConnectStaging";
    public const string UninstallRegistryName = "NeoPepConnectStaging";
    public const string ShortcutName = "NeoPep Connect Teste.lnk";
#endif

    public static string LocalFolder {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), LocalFolderName); }
    }

    public static string UninstallRegistryPath {
        get { return @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + UninstallRegistryName; }
    }

    public static bool IsValid {
        get {
            Uri url;
            return Uri.TryCreate(SupabaseUrl,UriKind.Absolute,out url)
                && url.Scheme == Uri.UriSchemeHttps
                && url.Host.EndsWith(".supabase.co",StringComparison.OrdinalIgnoreCase)
                && PublishableKey.StartsWith("sb_publishable_",StringComparison.Ordinal)
                && !PublishableKey.StartsWith("sb_secret_",StringComparison.Ordinal);
        }
    }
}
