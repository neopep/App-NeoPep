using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

internal sealed class UpdateManifest {
    public string Version,Profile,Channel,Sha256,Artifact,Signature,Notes,Url;
    public long Bytes;
    public bool Required;
    internal static UpdateManifest Parse(string json){
        var row=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(json);
        if(row==null)return null;
        return new UpdateManifest{
            Version=Field(row,"version"),Profile=Field(row,"profile"),Channel=Field(row,"channel"),
            Sha256=Field(row,"sha256"),Artifact=Field(row,"artifact"),Signature=Field(row,"signature"),
            Notes=Field(row,"notes"),Url=Field(row,"url"),Bytes=Convert.ToInt64(row["bytes"],CultureInfo.InvariantCulture),
            Required=Field(row,"required")=="True"
        };
    }
    static string Field(Dictionary<string,object> row,string name){
        object value;return row.TryGetValue(name,out value)?Convert.ToString(value,CultureInfo.InvariantCulture):"";
    }
    internal string Canonical(){
        return String.Join("\n",new[]{"neopep-connect/v1",Version,Profile,Channel,Bytes.ToString(CultureInfo.InvariantCulture),Sha256,Artifact});
    }
}

internal static class UpdateTrust {
    internal const string FileName="NeoPepConnectSetup.exe";
    internal const long MaxBytes=52428800L;
    internal static string PublisherKey(){
        using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("NeoPepUpdatePublisher"))
            return stream==null?"":new StreamReader(stream).ReadToEnd();
    }
    internal static bool Verify(UpdateManifest m,string installed,string profile,string publicKey){
        Version next,current;
        if(m==null||m.Profile!=profile||m.Channel!="stable"||String.IsNullOrEmpty(publicKey)
            ||!Regex.IsMatch(m.Version??"",@"^[0-9]{1,8}\.[0-9]{1,8}\.[0-9]{1,8}$")
            ||!Version.TryParse(m.Version,out next)||!Version.TryParse(installed,out current)||next<=current
            ||m.Bytes<1||m.Bytes>MaxBytes||!Regex.IsMatch(m.Sha256??"","^[0-9a-f]{64}$")
            ||!Regex.IsMatch(m.Artifact??"","^[A-Za-z0-9._-]{1,120}$"))return false;
        try{
            using(var rsa=new RSACryptoServiceProvider(new CspParameters(24))){
                rsa.PersistKeyInCsp=false;rsa.FromXmlString(publicKey);
                if(!rsa.PublicOnly||rsa.KeySize<2048)return false;
                return rsa.VerifyData(Encoding.UTF8.GetBytes(m.Canonical()),CryptoConfig.MapNameToOID("SHA256"),Convert.FromBase64String(m.Signature));
            }
        }catch{return false;}
    }
    internal static bool Matches(Stream stream,UpdateManifest m){
        if(stream.Length!=m.Bytes)return false;
        using(var sha=SHA256.Create()){
            var actual=BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
            return String.Equals(actual,m.Sha256,StringComparison.Ordinal);
        }
    }
    internal static bool TrustedDownload(Uri url,string version){
        var project=new Uri(ConnectProfile.SupabaseUrl);
        return url!=null&&url.IsAbsoluteUri&&version!=null&&Regex.IsMatch(version,@"\A[0-9]{1,8}\.[0-9]{1,8}\.[0-9]{1,8}\z")&&url.Scheme=="https"&&url.Host==project.Host&&url.IsDefaultPort&&url.UserInfo==""
          &&url.AbsolutePath=="/storage/v1/object/sign/neo-connect-releases/"+version+"/"+FileName
          &&Regex.IsMatch(url.Query,@"\A\?token=[A-Za-z0-9_.-]{1,8192}\z")
          &&String.IsNullOrEmpty(url.Fragment);
    }
    internal static void EnsureLocal(params string[] paths){
        foreach(string path in paths)
            if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new IOException();
    }
    internal static string Cache(){return Path.Combine(ConnectProfile.LocalFolder,"updates");}
}
