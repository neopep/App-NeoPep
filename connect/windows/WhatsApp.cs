using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

sealed partial class WhatsApp : Form {
    static readonly Encoding Utf8=new UTF8Encoding(false);
    readonly string vault;
    readonly string runtime;
    readonly ConnectProfile environment;
    readonly byte[] entropy;
    readonly string draftPath;
    readonly string sendAuditPath;
    readonly string diagnosticPath;
    string draftGroupId="";
    readonly TabControl tabs=new TabControl();
    readonly Label connection=new Label(),summary=new Label(),diagnostic=new Label();
    readonly PictureBox qr=new PictureBox();
    Button pair,disconnect;
    readonly ListView groups=new ListView();
    readonly TextBox search=new TextBox();
    readonly Label groupStatus=new Label(),accountStatus=new Label();
    readonly List<Dictionary<string,object>> groupRows=new List<Dictionary<string,object>>();
    readonly HashSet<string> selected=new HashSet<string>(StringComparer.Ordinal);
    bool drawingGroups,syncing;
    readonly Func<Guid,long,object[],Task<long>> saveSelection;
    readonly Func<Guid,string,Task> reportStatus;
    readonly Func<bool> canPublish;
    Guid connectionId;
    long selectionRevision;
    Button sync,sendTextButton;
    readonly ComboBox targetGroup=new ComboBox();
    readonly TextBox messageText=new TextBox();
    readonly Label sendStatus=new Label(),previewText=new Label();
    Guid pendingSend=Guid.Empty;
    bool sendingText;
    TaskCompletionSource<Tuple<string,string>> automatedSend;
    Guid automatedRequest;
    readonly HashSet<string> sentRequests=new HashSet<string>(StringComparer.Ordinal);
    Dictionary<string,object> localVault;
    readonly JavaScriptSerializer json=new JavaScriptSerializer { MaxJsonLength=16*1024*1024 };
    Process process;
    StreamWriter pipe;
    bool closing,forgetting,ready;
    int generation;

    public WhatsApp(string profile,bool showGroups=false,Func<Guid,long,object[],Task<long>> saveSelection=null,Func<Guid,string,Task> reportStatus=null,Func<bool> canPublish=null,Func<string,string,Task<Dictionary<string,object>[]>> loadSources=null,bool showComposer=false,Func<string,string,Task<byte[]>> loadImage=null) : this(profile,showGroups,saveSelection,reportStatus,canPublish,loadSources,showComposer,loadImage,ConnectProfile.Teste,null) {}

    internal WhatsApp(string profile,bool showGroups,Func<Guid,long,object[],Task<long>> saveSelection,Func<Guid,string,Task> reportStatus,Func<bool> canPublish,Func<string,string,Task<Dictionary<string,object>[]>> loadSources,bool showComposer,Func<string,string,Task<byte[]>> loadImage,ConnectProfile environment,byte[] entropy) {
        this.environment=environment;this.entropy=entropy;
        this.saveSelection=saveSelection;this.reportStatus=reportStatus;this.canPublish=canPublish;this.loadSources=loadSources;this.loadImage=loadImage;
        var waHeartbeat=new Timer{Interval=60000};
        waHeartbeat.Tick+=async delegate{if(ready)await ReportStatus("connected");};
        waHeartbeat.Start();
        FormClosed+=delegate{waHeartbeat.Dispose();};
        vault=Path.Combine(profile,"whatsapp-session.dat");
        runtime=Path.Combine(ConnectProfile.InstallFolder,ConnectVersion.Runtime);
        draftPath=Path.Combine(profile,"whatsapp-message-draft.dat");
        sendAuditPath=Path.Combine(profile,"whatsapp-send-audit.log");
        diagnosticPath=Path.Combine(profile,"whatsapp-diagnostico.log");
        Text=environment.AppName+" • WhatsApp"; Size=new Size(1024,700); MinimumSize=new Size(800,570); AutoScaleMode=AutoScaleMode.Dpi;
        BackColor=ConnectTheme.Background; ForeColor=ConnectTheme.Text; Font=new Font("Segoe UI",10);
        tabs.Dock=DockStyle.Fill;
        var status=Page("Estado");status.Controls.Add(LabelOf(environment.EnvironmentName+" • Conta WhatsApp vinculada localmente neste ambiente."));
        summary.Text="WhatsApp desconectado.";Format(summary);status.Controls.Add(summary);
        var pairing=Page("Conexão WhatsApp");pairing.Controls.Add(LabelOf("No telefone autorizado para "+environment.EnvironmentName+", abra Dispositivos conectados e escaneie o QR Code desta janela."));
        pair=Action("Conectar WhatsApp",ConnectSession);
        disconnect=Action("Desconectar WhatsApp",Disconnect);
        var actions=new FlowLayoutPanel{AutoSize=true,Dock=DockStyle.Top};actions.Controls.Add(pair);actions.Controls.Add(disconnect);
        pairing.Controls.Add(actions);Format(connection);connection.Text="Desconectado.";pairing.Controls.Add(connection);Format(accountStatus);pairing.Controls.Add(accountStatus);
        qr.Size=new Size(270,270);qr.SizeMode=PictureBoxSizeMode.Zoom;qr.AccessibleName="QR Code temporário do WhatsApp";pairing.Controls.Add(qr);
        var listing=new TabPage("Grupos"){BackColor=ConnectTheme.Background,ForeColor=ConnectTheme.Text};tabs.TabPages.Add(listing);
        groups.Dock=DockStyle.Fill;groups.BackColor=ConnectTheme.Surface;groups.ForeColor=ConnectTheme.Text;groups.View=View.Details;groups.FullRowSelect=true;
        groups.CheckBoxes=true;
        groups.Columns.Add("Grupo",350);groups.Columns.Add("Participantes",130);groups.Columns.Add("Identificador",290);
        groups.ItemChecked+=delegate(object sender,ItemCheckedEventArgs args){
            if(drawingGroups||!ready)return;
            string id=(string)args.Item.Tag;
            if(args.Item.Checked)selected.Add(id);else selected.Remove(id);
            ShowGroupStatus();RefreshComposerGroups();
        };
        var refresh=Action("Atualizar grupos",RefreshGroups);
        search.AccessibleName="Buscar grupos por nome";search.Width=180;
        search.TextChanged+=delegate{RenderGroups();};
        var groupTools=new FlowLayoutPanel{AutoSize=true,Dock=DockStyle.Top};
        groupTools.Controls.Add(LabelOf("Buscar grupo"));groupTools.Controls.Add(search);groupTools.Controls.Add(refresh);
        sync=new Button{Text="Sincronizar selecionados",AutoSize=true,Enabled=false};
        sync.Click+=async delegate{await SyncSelection();};
        groupTools.Controls.Add(sync);
        Format(groupStatus);groupStatus.Text="Conecte o WhatsApp para consultar grupos.";groupStatus.Dock=DockStyle.Bottom;
        listing.Controls.Add(groups);listing.Controls.Add(groupTools);listing.Controls.Add(groupStatus);
        var compose=BuildCampaignPage();
        var diagnostics=Page("Diagnóstico");Format(diagnostic);
        diagnostic.Text="A conexão e o QR Code ficam neste computador. Os diagnósticos mostram apenas estados e erros genéricos.";diagnostics.Controls.Add(diagnostic);
        var back=Action("Voltar",Close);back.Dock=DockStyle.Bottom;
        Controls.Add(back);
        ConnectTheme.Apply(this,tabs);
        ConnectTheme.ApplyContent(tabs);
        Controls.Add(ConnectTheme.BuildShell(tabs,environment.EnvironmentName));
        ConnectTheme.Primary(pair);ConnectTheme.Primary(sendTextButton);ConnectTheme.Primary(sync);
        ConnectTheme.Restyle(this);
        if(environment.IsProduction)sendStatus.Text="Produção: envio bloqueado até a homologação controlada.";
        if(showComposer)tabs.SelectedTab=compose;else if(showGroups)tabs.SelectedTab=listing;
        Shown+=delegate{LoadDraft();if(!environment.IsProduction&&File.Exists(vault))ConnectSession();};
        FormClosing+=delegate{if(ready)ObserveStatus(ReportStatus("disconnected"));closing=true;StopBridge();ClearQr();};
    }
    FlowLayoutPanel Page(string name) {
        var page=new TabPage(name){BackColor=ConnectTheme.Background,ForeColor=ConnectTheme.Text};tabs.TabPages.Add(page);
        var panel=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new Padding(22)};
        page.Controls.Add(panel);return panel;
    }
    static void Format(Label value){value.AutoSize=true;value.MaximumSize=new Size(370,0);value.ForeColor=ConnectTheme.Muted;}
    static Label LabelOf(string text){var label=new Label{Text=text};Format(label);return label;}
    static Button Action(string label,System.Action handler){
        var button=new Button{Text=label,AutoSize=true,BackColor=ConnectTheme.Raised,ForeColor=ConnectTheme.Text};
        button.Click+=delegate{handler();};return button;
    }
    void Notify(string text){
        connection.Text=text;summary.Text=text;diagnostic.Text=text;
        pair.Enabled=process==null&&!forgetting;
        disconnect.Enabled=!forgetting;
    }

    // Never log raw exception messages, vault JSON, WhatsApp identifiers, QR codes, phone
    // numbers or file paths. Only locally-defined phases and coarse error classes are stored.
    static string SafeDiagnosticKind(Exception error){
        if(error is CryptographicException)return "DPAPI";
        if(error is UnauthorizedAccessException)return "PERMISSAO";
        if(error is IOException)return "ARQUIVO";
        if(error is InvalidOperationException||error is ArgumentException||error is FormatException)return "FORMATO";
        return "PROCESSAMENTO";
    }
    string RecordSafeDiagnostic(string phase,Exception error){
        string code="WA-"+phase+"-"+SafeDiagnosticKind(error);
        try{
            string entry=DateTime.UtcNow.ToString("u")+" "+code+Environment.NewLine;
            if(File.Exists(diagnosticPath)&&new FileInfo(diagnosticPath).Length>32768)
                File.WriteAllText(diagnosticPath,"");
            File.AppendAllText(diagnosticPath,entry);
        }catch{} // Diagnostic failure must never mutate the session or mask the original error.
        return code;
    }
    void ShowSafeFailure(string code){
        Notify("Falha ao processar a conexão protegida ("+code+"). Não use Desconectar. Consulte Diagnóstico.");
        diagnostic.Text=code+" • "+DateTime.Now.ToString("g")+
            "\nO diagnóstico não apaga o cofre. Não use Desconectar nem refaça o QR Code."+
            "\nRegistro local restrito: whatsapp-diagnostico.log (apenas data e código).";
    }

    DateTime? groupReadAt;
    void RefreshGroups(){
        if(ready&&!syncing){groupReadAt=null;sync.Enabled=false;Send("groups",null);}
        else groupStatus.Text="Conecte o WhatsApp para consultar grupos.";
    }
    void ShowGroupStatus(){
        sync.Enabled=ready&&!syncing&&groupReadAt.HasValue&&saveSelection!=null;
        UpdateComposer();
        groupStatus.Text=groupRows.Count+" grupos • "+selected.Count+" selecionados localmente"
            +(groupReadAt.HasValue?" • consulta "+groupReadAt.Value.ToString("g"):"");
    }
    void RenderGroups(){
        drawingGroups=true;
        groups.BeginUpdate();
        try{
            groups.Items.Clear();
            foreach(var item in groupRows){
                string name=TextValue(item,"name"),id=TextValue(item,"id");
                if(name.IndexOf(search.Text.Trim(),StringComparison.CurrentCultureIgnoreCase)<0)continue;
                var row=new ListViewItem(name){Tag=id,Checked=selected.Contains(id)};
                string members=TextValue(item,"members");
                row.SubItems.Add(members.Length==0?"—":members);row.SubItems.Add(id);groups.Items.Add(row);
            }
        }finally{groups.EndUpdate();drawingGroups=false;}
    }
    sealed class GroupChoice {
        internal string Id,Name;
        public override string ToString(){return Name;}
    }
    void RefreshComposerGroups(){
        var currentChoice=targetGroup.SelectedItem as GroupChoice;
        string previous=currentChoice==null?null:currentChoice.Id;
        targetGroup.Items.Clear();
        foreach(var row in groupRows){
            string id=TextValue(row,"id");
            if(!selected.Contains(id)||TextValue(row,"name").IndexOf(destinationSearch.Text.Trim(),StringComparison.CurrentCultureIgnoreCase)<0)continue;
            targetGroup.Items.Add(new GroupChoice{Id=id,Name=TextValue(row,"name")});
        }
        if(targetGroup.Items.Count>0){
            if(!String.IsNullOrEmpty(draftGroupId))previous=draftGroupId;
            int index=-1;
            for(int i=0;i<targetGroup.Items.Count;i++)
                if(((GroupChoice)targetGroup.Items[i]).Id==previous){index=i;break;}
            targetGroup.SelectedIndex=index>=0?index:String.IsNullOrEmpty(previous)?0:-1;
            if(index>=0)draftGroupId="";
        }
        UpdateComposer();
    }
    void UpdateComposer(){
        if(sendTextButton==null)return;
        UpdatePhone();
        targetGroup.Enabled=ready&&!sendingText&&targetGroup.Items.Count>0;
        sendTextButton.Enabled=!environment.IsProduction&&ready&&!sendingText&&canPublish!=null&&canPublish()&&groupReadAt.HasValue&&
            targetGroup.SelectedItem is GroupChoice&&(campaignImage!=null||!String.IsNullOrWhiteSpace(CampaignText()))&&CampaignText().Length<=2000;
    }
    void SaveDraft(){SaveCampaignDraft();}
    bool SaveCampaignDraft(){
        try{
            var choice=targetGroup.SelectedItem as GroupChoice;
            var payload=json.Serialize(new {text=messageText.Text,group=choice==null?draftGroupId:choice.Id,title=campaignTitle.Text,cta=campaignCta.Text,
                image=campaignImage==null?null:Convert.ToBase64String(campaignImage),origin=campaignOrigin.Text,due=scheduledUtc.HasValue?scheduledUtc.Value.ToString("o"):null});
            byte[] bytes=ProtectedData.Protect(Utf8.GetBytes(payload),entropy,DataProtectionScope.CurrentUser);
            string temporary=draftPath+".new";
            File.WriteAllBytes(temporary,bytes);
            if(File.Exists(draftPath))File.Replace(temporary,draftPath,null);
            else File.Move(temporary,draftPath);
            sendStatus.Text="Rascunho salvo com proteção do usuário Windows.";return true;
        }catch{sendStatus.Text="Não foi possível salvar o rascunho neste computador.";return false;}
    }
    void LoadDraft(){
        if(!File.Exists(draftPath))return;
        try{
            var data=ProtectedData.Unprotect(File.ReadAllBytes(draftPath),entropy,DataProtectionScope.CurrentUser);
            var draft=json.Deserialize<Dictionary<string,object>>(Utf8.GetString(data));
            draftGroupId=TextValue(draft,"group");
            messageText.Text=TextValue(draft,"text");
            campaignOrigin.Text=TextValue(draft,"origin");
            campaignTitle.Text=TextValue(draft,"title");campaignCta.Text=TextValue(draft,"cta");
            RestoreCampaignMedia(TextValue(draft,"image"),TextValue(draft,"due"));
            RefreshComposerGroups();
            sendStatus.Text="Rascunho local restaurado.";
        }catch{sendStatus.Text="Não foi possível restaurar o rascunho protegido.";}
    }
    void AuditSend(string outcome){
        // Sem número, JID, conteúdo da mensagem ou identificador de destinatário.
        try{
            if(File.Exists(sendAuditPath)&&new FileInfo(sendAuditPath).Length>64000)File.Delete(sendAuditPath);
            File.AppendAllText(sendAuditPath,DateTime.UtcNow.ToString("u")+" "+outcome+Environment.NewLine);
        }catch{}
    }
    void PublishManualText(){
        if(environment.IsProduction||!ready||sendingText||automatedSend!=null||!groupReadAt.HasValue||pendingSend!=Guid.Empty||canPublish==null||!canPublish())return;
        var choice=targetGroup.SelectedItem as GroupChoice;
        string text=CampaignText();
        if(choice==null||!selected.Contains(choice.Id)||(campaignImage==null&&String.IsNullOrEmpty(text))||text.Length>2000)return;
        string question=environment.EnvironmentName+" • Enviar uma mensagem real para o grupo '"+choice.Name+"'?"+
            Environment.NewLine+Environment.NewLine+(campaignImage==null?"":"Imagem JPEG anexada."+Environment.NewLine)+text+
            Environment.NewLine+Environment.NewLine+"A ação não pode ser desfeita. Não haverá repetição automática.";
        if(MessageBox.Show(question,"Confirmar publicação real",
            MessageBoxButtons.YesNo,MessageBoxIcon.Warning,MessageBoxDefaultButton.Button2)!=DialogResult.Yes)return;
        if(!ready||process==null||!canPublish())return;
        pendingSend=Guid.NewGuid();
        sendingText=true;UpdateComposer();
        sendStatus.Text="Enviando ao WhatsApp. Não feche esta janela nem repita a operação.";
        try{
            if(campaignImage==null)pipe.WriteLine(json.Serialize(new {action="send_text",request_id=pendingSend.ToString(),
                group_jid=choice.Id,text=text}));
            else pipe.WriteLine(json.Serialize(new {action="send_image",request_id=pendingSend.ToString(),
                group_jid=choice.Id,text=text,image=Convert.ToBase64String(campaignImage)}));
        }catch{
            AuditSend("uncertain");
            pendingSend=Guid.Empty;sendingText=false;UpdateComposer();
            sendStatus.Text="Conexão interrompida. Resultado incerto: confira o grupo antes de reenviar.";
        }
    }
    public Guid CampaignConnection { get { return connectionId; } }
    public bool CampaignSessionReady {
        get { return !environment.IsProduction&&!closing&&!forgetting&&ready&&pipe!=null&&process!=null
            &&connectionId!=Guid.Empty&&groupReadAt.HasValue&&DateTime.Now-groupReadAt.Value<TimeSpan.FromHours(24); }
    }
    public async Task<Tuple<string,string>> DispatchCampaignTextAsync(Guid request,string group,string text) {
        if(!CampaignSessionReady||pendingSend!=Guid.Empty||automatedSend!=null||!selected.Contains(group)
            ||String.IsNullOrWhiteSpace(text)||text.Length>2000||request==Guid.Empty
            ||canPublish==null||!canPublish())return Tuple.Create("refused",(string)null);
        var completion=new TaskCompletionSource<Tuple<string,string>>(TaskCreationOptions.RunContinuationsAsynchronously);
        automatedSend=completion;automatedRequest=request;sendingText=true;UpdateComposer();
        try {
            pipe.WriteLine(json.Serialize(new {action="send_text",request_id=request.ToString(),group_jid=group,text=text}));
            return await Task.WhenAny(completion.Task,Task.Delay(TimeSpan.FromSeconds(25)))==completion.Task
                ? await completion.Task : Tuple.Create("uncertain",(string)null);
        }catch{return Tuple.Create("uncertain",(string)null);}
        finally{automatedSend=null;automatedRequest=Guid.Empty;sendingText=false;UpdateComposer();}
    }
    public async Task<Tuple<string,string>> DispatchCampaignImageAsync(Guid request,string group,string caption,byte[] jpeg) {
        if(!CampaignSessionReady||pendingSend!=Guid.Empty||automatedSend!=null||!selected.Contains(group)
            ||caption==null||caption.Length>2000||jpeg==null||jpeg.Length<4||jpeg.Length>1048576
            ||jpeg[0]!=0xff||jpeg[1]!=0xd8||jpeg[2]!=0xff||request==Guid.Empty
            ||canPublish==null||!canPublish())return Tuple.Create("refused",(string)null);
        var completion=new TaskCompletionSource<Tuple<string,string>>(TaskCreationOptions.RunContinuationsAsynchronously);
        automatedSend=completion;automatedRequest=request;sendingText=true;UpdateComposer();
        try {
            pipe.WriteLine(json.Serialize(new {action="send_image",request_id=request.ToString(),
                group_jid=group,text=caption,image=Convert.ToBase64String(jpeg)}));
            return await Task.WhenAny(completion.Task,Task.Delay(TimeSpan.FromSeconds(35)))==completion.Task
                ? await completion.Task : Tuple.Create("uncertain",(string)null);
        }catch{return Tuple.Create("uncertain",(string)null);}
        finally{automatedSend=null;automatedRequest=Guid.Empty;sendingText=false;UpdateComposer();}
    }
    // Candidate transport; no production or unapproved destination can reach this method.
    public async Task<Tuple<string,string>> DispatchCampaignFileAsync(Guid request,string group,string caption,byte[] bytes,string mime,string name) {
        if(!CampaignSessionReady||pendingSend!=Guid.Empty||automatedSend!=null||!selected.Contains(group)
            ||caption==null||caption.Length>1000||bytes==null||bytes.Length<8||bytes.Length>5*1024*1024
            ||request==Guid.Empty||String.IsNullOrWhiteSpace(name)||name.Length>160
            ||name.IndexOfAny(System.IO.Path.GetInvalidFileNameChars())>=0
            ||(mime!="application/pdf"&&mime!="video/mp4")
            ||(mime=="application/pdf"&&!name.EndsWith(".pdf",StringComparison.OrdinalIgnoreCase))
            ||(mime=="video/mp4"&&!name.EndsWith(".mp4",StringComparison.OrdinalIgnoreCase))
            ||canPublish==null||!canPublish())return Tuple.Create("refused",(string)null);
        var completion=new TaskCompletionSource<Tuple<string,string>>(TaskCreationOptions.RunContinuationsAsynchronously);
        automatedSend=completion;automatedRequest=request;sendingText=true;UpdateComposer();
        try {
            pipe.WriteLine(json.Serialize(new {action="send_file",request_id=request.ToString(),
                group_jid=group,text=caption,file=Convert.ToBase64String(bytes),mime=mime,name=name}));
            return await Task.WhenAny(completion.Task,Task.Delay(TimeSpan.FromSeconds(40)))==completion.Task
                ? await completion.Task : Tuple.Create("uncertain",(string)null);
        }catch{return Tuple.Create("uncertain",(string)null);}
        finally{automatedSend=null;automatedRequest=Guid.Empty;sendingText=false;UpdateComposer();}
    }
    void ClearGroups(){
        sync.Enabled=false;
        groupRows.Clear();selected.Clear();groupReadAt=null;RenderGroups();
        groupStatus.Text="Conecte o WhatsApp para consultar grupos.";
        accountStatus.Text="";
        RefreshComposerGroups();
    }
    async Task SyncSelection(){
        if(!ready||syncing||!groupReadAt.HasValue||saveSelection==null||localVault==null)return;
        if(MessageBox.Show("Enviar esta seleção completa? Grupos desmarcados serão removidos da lista web desta conexão.",
            "Sincronizar grupos",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
        var rows=new List<object>();
        foreach(var row in groupRows){
            string id=TextValue(row,"id");
            if(selected.Contains(id))rows.Add(new {group_jid=id,display_name=TextValue(row,"name"),participant_count=row["members"]});
        }
        syncing=true;sync.Enabled=false;groups.Enabled=false;var idAtStart=connectionId;
        try{
            var next=await saveSelection(idAtStart,selectionRevision,rows.ToArray());
            if(closing||idAtStart!=connectionId||localVault==null)return;
            selectionRevision=next;SaveVault();
            groupStatus.Text="Seleção sincronizada com o NeoPep.";
        }catch{
            if(!closing)groupStatus.Text="Não foi possível confirmar a sincronização. Confira a autorização, a rede e a disponibilidade do serviço.";
        }finally{
            syncing=false;
            if(!closing){groups.Enabled=true;sync.Enabled=ready&&groupReadAt.HasValue&&saveSelection!=null;}
        }
    }
    // ReportStatus handles remote failures itself. Observe background completion without
    // awaiting UI teardown or connection-state transitions (C# 5 compatible).
    static void ObserveStatus(Task operation){
        operation.ContinueWith(completed=>{
            if(completed.Exception!=null)completed.Exception.Handle(error=>true);
        },TaskContinuationOptions.OnlyOnFaulted);
    }
    async Task ReportStatus(string status){
        if(selectionRevision==0||reportStatus==null||connectionId==Guid.Empty)return;
        try{await reportStatus(connectionId,status);}catch{}
    }
    void ClearQr(){var previous=qr.Image;qr.Image=null;if(previous!=null)previous.Dispose();}
    string OpenVault(){
        if(!File.Exists(vault))return null;
        var text=Utf8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(vault),entropy,DataProtectionScope.CurrentUser));
        localVault=json.Deserialize<Dictionary<string,object>>(text);
        if(!Guid.TryParse(TextValue(localVault,"neo_connection"),out connectionId))connectionId=Guid.NewGuid();
        if(!Int64.TryParse(TextValue(localVault,"neo_revision"),out selectionRevision))selectionRevision=0;
        var saved=localVault.ContainsKey("neo_selected")?localVault["neo_selected"] as IEnumerable:null;
        selected.Clear();
        if(saved!=null)foreach(object id in saved)if(id is string)selected.Add((string)id);
        return text;
    }
    void WriteVault(string value){
        if(value==null){localVault=null;connectionId=Guid.Empty;selectionRevision=0;File.Delete(vault);File.Delete(vault+".new");return;}
        localVault=json.Deserialize<Dictionary<string,object>>(value);
        if(connectionId==Guid.Empty)connectionId=Guid.NewGuid();
        SaveVault();
    }
    void SaveVault(){
        localVault["neo_connection"]=connectionId.ToString();
        localVault["neo_revision"]=selectionRevision;
        localVault["neo_selected"]=new List<string>(selected).ToArray();
        File.WriteAllBytes(vault+".new",ProtectedData.Protect(Utf8.GetBytes(json.Serialize(localVault)),entropy,DataProtectionScope.CurrentUser));
        if(File.Exists(vault))File.Replace(vault+".new",vault,null);else File.Move(vault+".new",vault);
    }
    void ConnectSession(){
        if(forgetting||ready||process!=null)return;
        string phase="LEITURA";
        try{
            string existing=OpenVault();
            phase="INICIALIZACAO";
            var start=new ProcessStartInfo(Path.Combine(runtime,"node.exe"),"windows-bridge.mjs") {
                WorkingDirectory=Path.Combine(runtime,"bridge"),UseShellExecute=false,CreateNoWindow=true,
                RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Utf8
            };
            start.EnvironmentVariables.Remove("NODE_OPTIONS");start.EnvironmentVariables.Remove("NODE_PATH");
            var child=new Process{StartInfo=start,EnableRaisingEvents=true};
            int revision=++generation;
            child.OutputDataReceived+=delegate(object sender,DataReceivedEventArgs args){
                if(args.Data!=null)Dispatch(delegate{if(revision==generation)Receive(args.Data);});
            };
            child.ErrorDataReceived+=delegate {}; // stderr descartado, inclusive dados da biblioteca.
            child.Exited+=delegate{Dispatch(delegate{
                if(revision==generation){StopBridge();Notify("A conexão local foi interrompida. Tente conectar novamente.");}
            });};
            process=child;
            if(!child.Start())throw new InvalidOperationException();
            pipe=new StreamWriter(child.StandardInput.BaseStream,Utf8){AutoFlush=true};
            child.BeginOutputReadLine();child.BeginErrorReadLine();
            ClearQr();Notify("Iniciando conexão experimental…");
            Send("connect",existing);
        }catch(Exception error){
            string code=RecordSafeDiagnostic(phase,error);
            try{StopBridge();}catch{}
            ShowSafeFailure(code);
        }
    }
    void Dispatch(System.Action action){
        if(closing||IsDisposed)return;
        try{BeginInvoke(action);}catch(InvalidOperationException){}
    }
    void Send(string action,string credential){
        try{pipe.WriteLine(json.Serialize(new {action=action,vault=credential}));}
        catch{StopBridge();Notify("A conexão local foi interrompida. Tente novamente.");}
    }
    void Disconnect(){
        if(forgetting)return;
        ObserveStatus(ReportStatus("revoked"));
        forgetting=true;ready=false;ClearQr();ClearGroups();
        try{
            WriteVault(null);
            if(process==null){forgetting=false;Notify("Sessão local removida. Se houver vínculo remoto, remova-o em Dispositivos conectados no telefone.");return;}
            Notify("Encerrando e solicitando revogação…");Send("disconnect",null);
        }catch{StopBridge();Notify("Não foi possível apagar o cofre local. Confira as permissões do perfil do Windows.");}
    }
    static string TextValue(Dictionary<string,object> values,string key){object value;return values.TryGetValue(key,out value)?Convert.ToString(value):"";}
    void Receive(string line){
        if(closing||line.Length>16*1024*1024)return;
        string phase="ENVELOPE";
        try{
            var message=json.Deserialize<Dictionary<string,object>>(line);
            if(message==null)throw new InvalidOperationException();
            string type=TextValue(message,"type"),value=TextValue(message,"value");
            if(type=="vault"){
                phase="CREDENCIAL";
                if(message["value"]==null){if(!forgetting)ObserveStatus(ReportStatus("revoked"));WriteVault(null);}
                else if(!forgetting)WriteVault(value);
            }else if(type=="state"){
                phase="ESTADO";
                ready=value=="conectado";
                if(value!="aguardando_qr")ClearQr();
                if(!ready){
                    if(value=="conectando"||value=="reconectando"){sync.Enabled=false;groupReadAt=null;groups.Items.Clear();}
                    else ClearGroups();
                }
                switch(value){
                    case "conectando": Notify("Conectando…");break;
                    case "aguardando_qr": Notify("Escaneie o QR Code no telefone de teste.");break;
                    case "conectado": Notify("WhatsApp conectado. Consulte os grupos na aba Grupos.");RefreshGroups();ObserveStatus(ReportStatus("connected"));break;
                    case "reconectando": Notify("Rede interrompida. Reconectando…");break;
                    case "desconectando": break;
                    case "desconectado": StopBridge();Notify("Sessão desconectada e removida.");break;
                    case "limpeza_local": StopBridge();Notify("Sessão local removida. Revogue também em Dispositivos conectados no telefone.");break;
                    case "revogado": StopBridge();Notify("Vínculo revogado pelo WhatsApp. Conecte novamente para gerar outro QR.");break;
                    case "sessao_substituida": StopBridge();Notify("Sessão substituída em outro dispositivo. Confira o telefone antes de reconectar.");break;
                    default: StopBridge();Notify("Conexão indisponível. Confira a rede e tente novamente.");break;
                }
            }else if(type=="qr"&&!forgetting&&!ready&&value.Length<500000){
                phase="QR";
                using(var data=new MemoryStream(Convert.FromBase64String(value)))
                using(var image=Image.FromStream(data)){ClearQr();qr.Image=new Bitmap(image);}
            }else if(type=="account"&&ready&&!forgetting){
                phase="CONTA";
                var account=message["value"] as Dictionary<string,object>;
                if(account!=null){
                    string name=TextValue(account,"name"),number=TextValue(account,"number");
                    accountStatus.Text=(name+(number.Length==0?"":" +"+number)).Trim();
                }
            }else if(type=="groups_loading"&&ready){
                phase="GRUPOS_ESPERA";
                groupStatus.Text="Consultando grupos…";
            }else if(type=="groups"&&ready&&!forgetting){
                phase="GRUPOS";
                groupRows.Clear();
                var rows=message["value"] as IEnumerable;
                if(rows!=null)foreach(Dictionary<string,object> item in rows)groupRows.Add(item);
                selected.IntersectWith(groupRows.ConvertAll(item=>TextValue(item,"id")));
                groupReadAt=DateTime.Now;RenderGroups();ShowGroupStatus();RefreshComposerGroups();
            }else if(type=="send_result"){
                phase="RESULTADO";
                var result=message["value"] as Dictionary<string,object>;
                if(result!=null&&automatedSend!=null&&TextValue(result,"request_id")==automatedRequest.ToString()){
                    var outcome=TextValue(result,"status");
                    var receipt=TextValue(result,"message_id");
                    var accepted=outcome=="accepted"&&!String.IsNullOrWhiteSpace(receipt);
                    automatedSend.TrySetResult(Tuple.Create(accepted?"accepted":outcome=="rejected"?"refused":"uncertain",
                        accepted?receipt:null));
                }
                if(result!=null&&pendingSend!=Guid.Empty&&TextValue(result,"request_id")==pendingSend.ToString()){
                    var status=TextValue(result,"status");
                    if(status=="accepted"){
                        sendStatus.Text="Mensagem aceita pelo WhatsApp. Confirme entrega e leitura no telefone.";
                        messageText.Clear();
                    }else if(status=="rejected"){
                        sendStatus.Text="Envio recusado: "+TextValue(result,"reason");
                    }else{
                        sendStatus.Text="Resultado incerto. Confira no WhatsApp antes de tentar novamente. Não será reenviado automaticamente.";
                    }
                    AuditSend(status=="accepted"?"accepted":status=="rejected"?"rejected":"uncertain");
                    sentRequests.Add(pendingSend.ToString());
                    pendingSend=Guid.Empty;sendingText=false;UpdateComposer();
                }
            }else if(type=="error"&&value=="grupos_indisponiveis"){
                phase="GRUPOS_ERRO";
                groupStatus.Text="Não foi possível consultar grupos. Use Atualizar grupos para tentar novamente.";
            }
        }catch(Exception error){
            string code=RecordSafeDiagnostic(phase,error);
            try{StopBridge();}catch{}
            ShowSafeFailure(code);
        }
    }
    void StopBridge(){
        ++generation;ready=false;forgetting=false;
        if(automatedSend!=null)automatedSend.TrySetResult(Tuple.Create("uncertain",(string)null));
        if(pendingSend!=Guid.Empty){
            AuditSend("uncertain");
            sendStatus.Text="Conexão encerrada durante envio: resultado incerto. Consulte o grupo antes de tentar novamente.";
            pendingSend=Guid.Empty;sendingText=false;
        }
        UpdateComposer();
        if(pipe!=null){try{pipe.Dispose();}catch{}pipe=null;}
        var child=process;process=null;
        if(child!=null){
            try{if(!child.WaitForExit(200))child.Kill();}catch(InvalidOperationException){}
            child.Dispose();
        }
        ClearQr();ClearGroups();
    }
}
