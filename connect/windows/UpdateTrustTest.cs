using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
internal static class UpdateTrustTest {
    static void Require(bool ok){if(!ok)throw new InvalidOperationException("Regressão na atualização");}
    static int Main(){
        using(var rsa=new RSACryptoServiceProvider(2048,new CspParameters(24))){
            rsa.PersistKeyInCsp=false;
            string key=rsa.ToXmlString(false);
            var m=new UpdateManifest{Version="0.2.3",Profile="staging",Channel="stable",Bytes=3,
                Sha256="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",Artifact="runner-fixture"};
            m.Signature=Convert.ToBase64String(rsa.SignData(Encoding.UTF8.GetBytes(m.Canonical()),CryptoConfig.MapNameToOID("SHA256")));
            Require(UpdateTrust.Verify(m,"0.2.2","staging",key));
            Require(!UpdateTrust.Verify(m,"0.2.3","staging",key));
            Require(!UpdateTrust.Verify(m,"0.2.2","production",key));
            Require(!UpdateTrust.Verify(m,"0.2.2","staging",""));
            using(var valid=new MemoryStream(Encoding.ASCII.GetBytes("abc")))Require(UpdateTrust.Matches(valid,m));
            using(var altered=new MemoryStream(Encoding.ASCII.GetBytes("abd")))Require(!UpdateTrust.Matches(altered,m));
            m.Artifact="other";Require(!UpdateTrust.Verify(m,"0.2.2","staging",key));
            const string version="0.2.2";
            var url=ConnectProfile.Teste.SupabaseUrl+"/storage/v1/object/sign/neo-connect-releases/"+version+"/NeoPepConnectSetup.exe";
            const string token="?token=header.payload.signature";
            Require(UpdateTrust.TrustedDownload(new Uri(url+token),version,ConnectProfile.Teste));
            Require(!UpdateTrust.TrustedDownload(new Uri(url),version,ConnectProfile.Teste));
            Require(!UpdateTrust.TrustedDownload(new Uri(url+token),"0.2.1",ConnectProfile.Teste));
            Require(!UpdateTrust.TrustedDownload(new Uri(url+token+"&extra=1"),version,ConnectProfile.Teste));
            Require(!UpdateTrust.TrustedDownload(new Uri(url+token+"#other"),version,ConnectProfile.Teste));
            Require(!UpdateTrust.TrustedDownload(new Uri(url.Replace("https:","http:")+token),version,ConnectProfile.Teste));
            Require(!UpdateTrust.TrustedDownload(new Uri(url.Replace(new Uri(ConnectProfile.Teste.SupabaseUrl).Host,"example.invalid")+token),version,ConnectProfile.Teste));
            Require(!UpdateTrust.TrustedDownload(new Uri(url.Replace("neo-connect-releases","public")+token),version,ConnectProfile.Teste));
            var prodUrl=new Uri(ConnectProfile.Producao.SupabaseUrl+new Uri(url+token).PathAndQuery);
            Require(UpdateTrust.TrustedDownload(prodUrl,version,ConnectProfile.Producao));
            Require(!UpdateTrust.TrustedDownload(prodUrl,version,ConnectProfile.Teste));
            Require(!UpdateTrust.TrustedDownload(new Uri(url+token),version,ConnectProfile.Producao));
            m.Artifact="runner-fixture";m.Profile="production";
            Require(!UpdateTrust.Verify(m,"0.2.2","production",key));
            m.Signature=Convert.ToBase64String(rsa.SignData(Encoding.UTF8.GetBytes(m.Canonical()),CryptoConfig.MapNameToOID("SHA256")));
            Require(UpdateTrust.Verify(m,"0.2.2","production",key));
        }
        var test=ConnectProfile.Teste;var prod=ConnectProfile.Producao;
        var account=Guid.NewGuid();var other=Guid.NewGuid();
        Require(test.LocalFolder==ConnectProfile.InstallFolder&&prod.LocalFolder!=test.LocalFolder);
        Require(test.AccountFolder(account,account)==test.LocalFolder);
        Require(test.AccountFolder(other,account)!=prod.AccountFolder(other,account));
        Require(prod.AccountFolder(account,account)!=prod.AccountFolder(other,account));
        Require(test.Endpoint("/auth/v1/token").Host=="qnuluspqfazdppciermw.supabase.co");
        Require(prod.Endpoint("/auth/v1/token").Host=="cpslafpzjtbpmoxxysaa.supabase.co");
        Require(ConnectProfile.FromCode("outside")==null);
        var legacy=ProtectedData.Protect(Encoding.UTF8.GetBytes("fixture"),test.Entropy,DataProtectionScope.CurrentUser);
        Require(Encoding.UTF8.GetString(ProtectedData.Unprotect(legacy,test.Entropy,DataProtectionScope.CurrentUser))=="fixture");
        bool isolated=false;try{ProtectedData.Unprotect(legacy,prod.Entropy,DataProtectionScope.CurrentUser);}catch(CryptographicException){isolated=true;}
        Require(isolated);
        Console.WriteLine("Assinatura, integridade, downgrade e origem: aprovados.");
        return 0;
    }
}
