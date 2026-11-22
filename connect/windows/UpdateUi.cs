using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;

sealed partial class Connect {
    readonly Timer updateTimer=new Timer();
    Label updateStatus,updateDetails,updateHistory;
    ProgressBar updateProgress;
    Button updateInstall;
    bool checkingUpdate,whatsappOpen;
    UpdateManifest offer;
    string notificationVersion;

    void InitUpdates(TabControl tabs){
        var page=Page(tabs,"Atualizações");
        updateStatus=new Label{Text="Versão instalada "+Version,AutoSize=true,MaximumSize=new Size(500,0)};
        updateDetails=new Label{AutoSize=true,MaximumSize=new Size(500,0)};
        updateHistory=new Label{AutoSize=true,MaximumSize=new Size(500,0),Text=Value(local,"updates_history")};
        updateProgress=new ProgressBar{Dock=DockStyle.Top,Maximum=100};
        var check=Button("Verificar atualizações");var defer=Button("Adiar");
        updateInstall=Button("Atualizar agora");updateInstall.Enabled=false;
        var enabled=new CheckBox{Text="Notificar automaticamente",AutoSize=true,Checked=Value(local,"updates_notify")!="False"};
        int minutes; if(!Int32.TryParse(Value(local,"updates_minutes"),out minutes)||minutes<15||minutes>1440)minutes=60;
        var interval=new NumericUpDown{Minimum=15,Maximum=1440,Value=minutes};
        page.Controls.Add(updateStatus);page.Controls.Add(updateDetails);page.Controls.Add(updateProgress);
        page.Controls.Add(check);page.Controls.Add(updateInstall);page.Controls.Add(defer);
        page.Controls.Add(enabled);AddField(page,"Intervalo de verificação em minutos",interval);
        AddField(page,"Histórico local",updateHistory);
        check.Click+=async delegate {await CheckUpdate(true);};
        updateInstall.Click+=async delegate {await InstallUpdate();};
        defer.Click+=delegate {
            if(offer!=null){local["updates_deferred"]=offer.Version;Save();updateStatus.Text="Atualização adiada. Você pode verificar novamente quando desejar.";}
        };
        enabled.CheckedChanged+=delegate {local["updates_notify"]=enabled.Checked;Save();};
        interval.ValueChanged+=delegate {local["updates_minutes"]=(int)interval.Value;Save();updateTimer.Interval=(int)interval.Value*60000;};
        updateTimer.Interval=minutes*60000;updateTimer.Tick+=async delegate {await CheckUpdate(false);};
        updateTimer.Start();
        FormClosed+=delegate {updateTimer.Dispose();};
    }
    async Task<UpdateManifest> FetchUpdate(string action,string version=null){
        var response=await Post("/functions/v1/connect-update",new {action=action,device=Value(local,"device"),secret=Value(local,"secret"),version=version},true);
        return UpdateManifest.Parse(json.Serialize(response));
    }
    bool SessionReady(){return !String.IsNullOrEmpty(access)&&DateTime.UtcNow<expires
        &&!String.IsNullOrEmpty(Value(local,"device"))&&!String.IsNullOrEmpty(Value(local,"secret"));}
    async Task CheckUpdate(bool manual){
        if(checkingUpdate||installingUpdate||exiting)return;
        if(!SessionReady()){
            if(manual)updateStatus.Text="Entre com uma conta e aguarde a autorização do computador.";
            return;
        }
        checkingUpdate=true;
        try{
            updateStatus.Text="Instalada "+Version+" • verificação "+DateTime.Now.ToString("g");
            offer=await FetchUpdate("check");
            updateInstall.Enabled=UpdateTrust.Verify(offer,Version,profile.EnvironmentCode,UpdateTrust.PublisherKey());
            updateDetails.Text=updateInstall.Enabled?("Disponível "+offer.Version+(offer.Required?" • obrigatória":"")+"\n"+(offer.Bytes/1048576.0).ToString("0.0")+" MiB\n"+offer.Notes)
                :offer==null?"Nenhuma versão aprovada em distribuição.":"Nenhuma versão mais recente com assinatura confiável.";
            if(updateInstall.Enabled&&!manual&&Value(local,"updates_notify")!="False"&&notificationVersion!=offer.Version&&Value(local,"updates_deferred")!=offer.Version){
                notificationVersion=offer.Version;tray.BalloonTipTitle=profile.AppName;
                tray.BalloonTipText="Uma atualização está disponível na aba Atualizações.";tray.ShowBalloonTip(5000);
            }
            await ReportUpdate();
        }catch(WebException error){
            updateInstall.Enabled=false;offer=null;
            using(var response=error.Response as HttpWebResponse)
                updateDetails.Text=response!=null&&response.StatusCode==HttpStatusCode.NotFound?
                    "O serviço de atualização não está disponível neste ambiente.":
                    "Verificação indisponível. O programa pode continuar em uso.";
        }catch{updateInstall.Enabled=false;offer=null;updateDetails.Text="Verificação indisponível. O programa pode continuar em uso.";}
        finally{checkingUpdate=false;}
    }
    async Task ReportUpdate(){
        string receipt=Path.Combine(Folder,"update-result.txt");
        if(!File.Exists(receipt)||new FileInfo(receipt).Length>1000)return;
        var result=File.ReadAllLines(receipt);
        if(result.Length!=2||!Regex.IsMatch(result[0],@"^[0-9]{1,8}\.[0-9]{1,8}\.[0-9]{1,8}$")
         ||Array.IndexOf(new[]{"installed","failed","rollback"},result[1])<0)return;
        string stamp=File.GetLastWriteTimeUtc(receipt).Ticks.ToString();
        if(Value(local,"updates_receipt")!=stamp){
            var history=new System.Collections.Generic.List<string>(Value(local,"updates_history").Split(new[]{'\n'},StringSplitOptions.RemoveEmptyEntries));
            string outcome=result[1]=="installed"?"instalada":result[1]=="rollback"?"versão anterior restaurada":"falha na instalação";
            history.Insert(0,File.GetLastWriteTime(receipt).ToString("g")+" • "+result[0]+" • "+outcome);
            if(history.Count>5)history.RemoveRange(5,history.Count-5);
            local["updates_history"]=updateHistory.Text=String.Join("\n",history);
            local["updates_receipt"]=stamp;
            Save();
        }
        await Post("/functions/v1/connect-update",new {action="report",device=Value(local,"device"),secret=Value(local,"secret"),version=result[0],outcome=result[1]},true);
        File.Delete(receipt);
    }
    async Task InstallUpdate(){
        if(checkingUpdate||installingUpdate||exiting||!SessionReady()||offer==null)return;
        if(busy||whatsappOpen||(sibling!=null&&(sibling.busy||sibling.whatsappOpen||sibling.checkingUpdate))){updateDetails.Text="Aguarde o fim da operação ou feche a janela WhatsApp antes de atualizar.";return;}
        if(MessageBox.Show("Instalar a atualização aprovada em "+profile.EnvironmentName+"? As duas janelas serão reiniciadas.",
            "Atualizações",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
        checkingUpdate=true;installingUpdate=true;updateInstall.Enabled=false;
        var token=Guid.NewGuid().ToString("N");
        string work=Path.Combine(UpdateTrust.Cache(profile),token),setup=Path.Combine(work,UpdateTrust.FileName);
        bool handedOff=false,safeWork=false;
        try{
            var selected=await FetchUpdate("download",offer.Version);
            if(!UpdateTrust.Verify(selected,Version,profile.EnvironmentCode,UpdateTrust.PublisherKey())||selected.Canonical()!=offer.Canonical())throw new IOException();
            Uri url;
            if(!Uri.TryCreate(selected.Url,UriKind.Absolute,out url)||!UpdateTrust.TrustedDownload(url,selected.Version,profile))throw new IOException();
            UpdateTrust.EnsureLocal(ConnectProfile.InstallFolder,Folder);
            Directory.CreateDirectory(UpdateTrust.Cache(profile));
            UpdateTrust.EnsureLocal(UpdateTrust.Cache(profile));
            Directory.CreateDirectory(work);
            UpdateTrust.EnsureLocal(work);
            safeWork=true;
            updateDetails.Text="Baixando instalador…";updateProgress.Value=0;
            var request=(HttpWebRequest)WebRequest.Create(url);request.AllowAutoRedirect=false;request.Timeout=90000;request.ReadWriteTimeout=15000;
            using(var deadline=new System.Threading.Timer(_=>request.Abort(),null,TimeSpan.FromMinutes(3),System.Threading.Timeout.InfiniteTimeSpan))
            using(var response=(HttpWebResponse)await request.GetResponseAsync())
            using(var source=response.GetResponseStream())
            using(var output=new FileStream(setup,FileMode.CreateNew,FileAccess.ReadWrite,FileShare.None)){
                if(response.StatusCode!=HttpStatusCode.OK||(response.ContentLength>=0&&response.ContentLength!=selected.Bytes))throw new IOException();
                var buffer=new byte[65536];long size=0;int count;
                while((count=await source.ReadAsync(buffer,0,buffer.Length))!=0){
                    size+=count;if(size>selected.Bytes)throw new IOException();
                    await output.WriteAsync(buffer,0,count);updateProgress.Value=(int)(100*size/selected.Bytes);
                }
                output.Position=0;if(!UpdateTrust.Matches(output,selected))throw new IOException();
            }
            // Recheck the distribution before handing control to the helper.
            var current=await FetchUpdate("authorize",selected.Version);
            if(!UpdateTrust.Verify(current,Version,profile.EnvironmentCode,UpdateTrust.PublisherKey())||current.Canonical()!=selected.Canonical())throw new IOException();
            if(busy||whatsappOpen||exiting||(sibling!=null&&(sibling.busy||sibling.whatsappOpen||sibling.checkingUpdate))){updateDetails.Text="Ainda há uma operação em andamento. Tente novamente quando terminar.";return;}
            var claims=new {version=current.Version,profile=current.Profile,channel=current.Channel,bytes=current.Bytes,sha256=current.Sha256,artifact=current.Artifact,signature=current.Signature};
            var ticket=new {manifest=json.Serialize(claims),token=access,device=Value(local,"device"),secret=Value(local,"secret")};
            File.WriteAllBytes(Path.Combine(work,"ticket.dat"),ProtectedData.Protect(
                Encoding.UTF8.GetBytes(json.Serialize(ticket)),profile.Entropy,DataProtectionScope.CurrentUser));
            string helper=Path.Combine(ConnectProfile.InstallFolder,"NeoPepUpdate-"+Version+".exe");
            using(var process=Process.Start(new ProcessStartInfo(helper,profile.EnvironmentCode+" "+token){UseShellExecute=false,CreateNoWindow=true})){
                if(process==null)throw new IOException();
            }
            handedOff=true;ExitBoth();
        }catch{updateDetails.Text="Instalação interrompida. A versão atual continua disponível.";}
        finally {
            if(!handedOff){if(safeWork){
                    try{File.Delete(setup);File.Delete(Path.Combine(work,"ticket.dat"));Directory.Delete(work);}catch{}
                }checkingUpdate=false;installingUpdate=false;updateInstall.Enabled=true;}
        }
    }
}
