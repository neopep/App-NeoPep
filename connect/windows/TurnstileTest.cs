using System;
using System.Web.Script.Serialization;
internal static class TurnstileTest {
    static void Require(bool check){if(!check)throw new InvalidOperationException("Contrato Turnstile inválido.");}
    static void Main(){
        var prod=ConnectProfile.Producao;var test=ConnectProfile.Teste;
        Require(!String.IsNullOrEmpty(prod.CaptchaSiteKey) && test.CaptchaSiteKey==null);
        var now=DateTime.UtcNow;
        var a=new TurnstileAttempt(new Uri(prod.PanelUrl),now);
        var b=new TurnstileAttempt(new Uri(test.PanelUrl),now);
        Require(a.Page.Host=="app.neopep.com.br"&&b.Page.Host=="teste.app.neopep.com.br"&&a.Nonce!=b.Nonce);
        Require(a.Accept(b.Page.AbsoluteUri,a.Nonce+":fixture",now)==null);
        Require(b.Accept(b.Page.AbsoluteUri,a.Nonce+":fixture",now)==null);
        Require(a.Accept(a.Page.AbsoluteUri,a.Nonce+":fixture",now.AddMinutes(4))==null);
        Require(a.Accept(a.Page.AbsoluteUri,a.Nonce+":fixture",now)=="fixture");
        Require(a.Accept(a.Page.AbsoluteUri,a.Nonce+":fixture",now)==null);
        var json=new JavaScriptSerializer();
        Require(json.Serialize(PasswordGrant.Payload("fixture","fixture",null)).IndexOf("captcha_token",StringComparison.Ordinal)<0);
        Require(json.Serialize(PasswordGrant.Payload("fixture","fixture","test-token")).Contains("\"gotrue_meta_security\":{\"captcha_token\":\"test-token\"}"));
        Require(PasswordGrant.Error("42501",true).StartsWith("Login válido."));
        Require(PasswordGrant.Error("captcha_failed",false).StartsWith("Conclua"));
        Require(PasswordGrant.Error("network_error",false).Contains("rede"));
        Require(PasswordGrant.Error("invalid_credentials",false).Contains("inválidos"));
        Require(PasswordGrant.Error("account_mismatch",false).Contains("outra conta"));
    }
}
