using System;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class PasswordGrant {
    internal static object Payload(string email,string password,string token){
        if(String.IsNullOrEmpty(token))return new {email=email,password=password};
        return new {email=email,password=password,gotrue_meta_security=new {captcha_token=token}};
    }
    internal static string Error(string code,bool deviceStage){
        switch(code){
            case "captcha_failed": return "Conclua a verificação de segurança e tente novamente.";
            case "invalid_credentials": return "E-mail ou senha inválidos.";
            case "network_error": return "Não foi possível conectar ao NeoPep. Confira a rede e tente novamente.";
            case "42501": if(deviceStage)return "Login válido. O registro ou acesso deste computador exige autorização no painel.";break;
            case "account_mismatch": return "Este perfil está vinculado a outra conta. Saia da conta atual antes de trocar.";
        }
        return deviceStage?"O login foi aceito, mas não foi possível confirmar o computador.":"Não foi possível iniciar a sessão neste ambiente.";
    }
}

internal sealed class TurnstileAttempt {
    internal readonly Uri Page;
    internal readonly string Nonce;
    readonly DateTime deadline;
    bool used;
    internal TurnstileAttempt(Uri origin,DateTime now){
        var bytes=new byte[24];
        using(var rng=RandomNumberGenerator.Create())rng.GetBytes(bytes);
        Nonce=Convert.ToBase64String(bytes);
        Page=new Uri(origin,"/neopep-connect-verificacao/"+Guid.NewGuid().ToString("N"));
        deadline=now.AddMinutes(4);
    }
    internal string Accept(string source,string message,DateTime now){
        if(used||now>=deadline||source!=Page.AbsoluteUri||message==null||
           !message.StartsWith(Nonce+":",StringComparison.Ordinal))return null;
        string token=message.Substring(Nonce.Length+1);
        if(!Regex.IsMatch(token,@"\A[A-Za-z0-9_.-]{1,2048}\z"))return null;
        used=true;return token;
    }
    internal string Html(string key){
        if(!Regex.IsMatch(key??"", @"\A[0-9A-Za-z_-]{1,100}\z"))throw new InvalidOperationException();
        return "<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\">"+
          "<title>Verificação NeoPep</title><h1>Verificação de segurança</h1>"+
          "<p>Complete a verificação para continuar com o login no NeoPep Connect.</p><div id=\"challenge\"></div>"+
          "<script nonce=\""+Nonce+"\">function init(){turnstile.render('#challenge',{sitekey:'"+key+"',"+
          "callback:function(token){window.chrome.webview.postMessage('"+Nonce+":'+token);},"+
          "'expired-callback':function(){window.chrome.webview.postMessage('expired');},"+
          "'error-callback':function(){window.chrome.webview.postMessage('failed');}});}</script>"+
          "<script src=\"https://challenges.cloudflare.com/turnstile/v0/api.js?onload=init&render=explicit\" defer></script></html>";
    }
}

internal sealed class TurnstileDialog : Form {
    internal static Task<string> Verify(Form owner,ConnectProfile profile){
        var dialog=new TurnstileDialog(profile);
        dialog.Show(owner);
        return dialog.completion.Task;
    }

    readonly TaskCompletionSource<string> completion=new TaskCompletionSource<string>();
    readonly WebView2 browser=new WebView2{Dock=DockStyle.Fill};
    readonly Label status=new Label{Text="Abrindo verificação…",Dock=DockStyle.Top,Height=36};
    readonly Timer timer=new Timer{Interval=240000};
    readonly string folder=Path.Combine(Path.GetTempPath(),"NeoPepWebView-"+Guid.NewGuid().ToString("N"));
    readonly TurnstileAttempt attempt;
    string token;
    CoreWebView2Environment environment;
    MemoryStream pageContent;
    bool delivered;

    TurnstileDialog(ConnectProfile profile){
        attempt=new TurnstileAttempt(new Uri(profile.PanelUrl),DateTime.UtcNow);
        Text=profile.AppName+" • Verificação";
        Width=520;Height=440;StartPosition=FormStartPosition.CenterParent;
        var cancel=new Button{Text="Cancelar",Dock=DockStyle.Bottom,Height=40};
        cancel.Click+=delegate{Close();};
        Controls.Add(browser);Controls.Add(status);Controls.Add(cancel);
        timer.Tick+=delegate{Fail("A verificação expirou. Feche e tente novamente.");};
        Shown+=async delegate{
            timer.Start();
            try{
                environment=await CoreWebView2Environment.CreateAsync(null,folder);
                if(IsDisposed)return;
                var options=environment.CreateCoreWebView2ControllerOptions();
                options.IsInPrivateModeEnabled=true;
                await browser.EnsureCoreWebView2Async(environment,options);
                if(IsDisposed)return;
                var core=browser.CoreWebView2;
                core.Settings.AreDevToolsEnabled=false;
                core.Settings.AreDefaultContextMenusEnabled=false;
                core.Settings.AreHostObjectsAllowed=false;
                core.Settings.IsStatusBarEnabled=false;
                core.NewWindowRequested+=delegate(object sender,CoreWebView2NewWindowRequestedEventArgs e){e.Handled=true;};
                core.NavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){e.Cancel=e.Uri!=attempt.Page.AbsoluteUri;};
                core.NavigationCompleted+=delegate(object sender,CoreWebView2NavigationCompletedEventArgs e){if(!e.IsSuccess)Fail("Não foi possível carregar a verificação.");};
                core.AddWebResourceRequestedFilter(attempt.Page.AbsoluteUri,CoreWebView2WebResourceContext.Document);
                core.WebResourceRequested+=delegate(object sender,CoreWebView2WebResourceRequestedEventArgs e){
                    if(e.Request.Uri!=attempt.Page.AbsoluteUri||e.Request.Method!="GET")return;
                    if(pageContent==null)pageContent=new MemoryStream(Encoding.UTF8.GetBytes(attempt.Html(profile.CaptchaSiteKey)));
                    e.Response=environment.CreateWebResourceResponse(pageContent,200,"OK",
                        "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\n"+
                        "Content-Security-Policy: default-src 'none'; script-src 'nonce-"+attempt.Nonce+"' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; base-uri 'none'; form-action 'none'");
                };
                core.WebMessageReceived+=delegate(object sender,CoreWebView2WebMessageReceivedEventArgs e){
                    if(e.Source!=attempt.Page.AbsoluteUri||delivered)return;
                    string message;
                    try{message=e.TryGetWebMessageAsString();}catch(ArgumentException){return;}
                    if(message=="expired"||message=="failed"){Fail("A verificação não foi concluída. Feche e tente novamente.");return;}
                    token=attempt.Accept(e.Source,message,DateTime.UtcNow);
                    if(token!=null){delivered=true;Close();}
                };
                status.Text="Conclua a verificação para entrar.";
                core.Navigate(attempt.Page.AbsoluteUri);
            }catch(WebView2RuntimeNotFoundException){Fail("Instale o Microsoft Edge WebView2 Runtime oficial e tente novamente.");}
            catch(Exception){if(!IsDisposed)Fail("Não foi possível abrir a verificação. Confira a rede e tente novamente.");}
        };
        FormClosed+=delegate{
            timer.Dispose();
            browser.Dispose();
            if(pageContent!=null)pageContent.Dispose();
            string value=token;token=null;
            completion.TrySetResult(value);
            Task.Run(async delegate{
                for(int i=0;i<5;i++){
                    try{if(Directory.Exists(folder))Directory.Delete(folder,true);return;}
                    catch(IOException){}catch(UnauthorizedAccessException){}
                    await Task.Delay(1000);
                }
            });
        };
    }
    void Fail(string message){
        if(IsDisposed||delivered)return;
        delivered=true;timer.Stop();status.Text=message;browser.Visible=false;
    }
}
