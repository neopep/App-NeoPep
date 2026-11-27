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
    readonly string diagnosticPath,maintenancePath;
    readonly CheckBox automaticMaintenance=new CheckBox();
    string draftGroupId="";
    readonly TabControl tabs=new TabControl();
    readonly Label connection=new Label(),summary=new Label(),diagnostic=new Label();
    readonly PictureBox qr=new PictureBox();
    Button pair,disconnect;
    readonly ListView groups=new ListView();
    readonly TextBox search=new TextBox();
    readonly Label groupStatus=new Label(),accountStatus=new Label(),groupAccount=new Label();
    readonly Dictionary<string,string> groupLastErrors=new Dictionary<string,string>(StringComparer.Ordinal);
    readonly Dictionary<string,List<string>> groupDiagnosticHistory=new Dictionary<string,List<string>>(StringComparer.Ordinal);
    readonly ComboBox diagnosticGroup=new ComboBox();
    readonly TextBox diagnosticHistory=new TextBox();
    readonly Label diagnosticProgress=new Label();
    Button runDiagnostic,recoverDistribution;
    readonly HashSet<string> recoveryEligible=new HashSet<string>(StringComparer.Ordinal);
    TabPage diagnosticPage;
    string diagnosingGroup="";
    bool diagnosing;
    string accountLabel="WhatsApp";
    internal string GroupAccountLabel {get{return ready?accountLabel:"WhatsApp";}}
    static string GroupMode(string value){return value=="pn"?"PN":value=="lid"?"LID":"—";}
    static string GroupRole(string value){return value=="superadmin"?"Criador / admin":value=="admin"?"Administrador":value=="member"?"Membro":"—";}
    static string GroupPermission(string value){return value=="admins"?"Só admins":value=="all"?"Todos":"—";}
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
    // Aggregate delivery evidence only; never store recipient identities.
    readonly Dictionary<string,Dictionary<string,object>> deliveryReceipts=new Dictionary<string,Dictionary<string,object>>(StringComparer.Ordinal);
    public Dictionary<string,object>[] CampaignDeliveryReceipts() {
        var rows=new List<Dictionary<string,object>>();
        var expired=new List<string>();
        foreach(var pair in deliveryReceipts){
            if((DateTime)pair.Value["observed_at"]<DateTime.UtcNow.AddMinutes(-30))expired.Add(pair.Key);
            else if(rows.Count<8)rows.Add(pair.Value);
        }
        foreach(var key in expired)deliveryReceipts.Remove(key);
        return rows.ToArray();
    }
    public void ConfirmCampaignDeliveryReceipt(Dictionary<string,object> row) {
        var key=TextValue(row,"group_jid")+":"+TextValue(row,"message_id");
        Dictionary<string,object> latest;
        if(deliveryReceipts.TryGetValue(key,out latest)&&Object.ReferenceEquals(latest,row))deliveryReceipts.Remove(key);
    }
    Dictionary<string,object> localVault;
    readonly JavaScriptSerializer json=new JavaScriptSerializer { MaxJsonLength=40*1024*1024 };
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
        maintenancePath=Path.Combine(profile,"whatsapp-maintenance-disabled.flag");
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
        groups.Columns.Add("Grupo",250);groups.Columns.Add("Membros",75);groups.Columns.Add("Modo",70);groups.Columns.Add("Minha função",130);
        groups.Columns.Add("Enviar",100);groups.Columns.Add("Configurar",100);groups.Columns.Add("Último erro",95);
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
        groupTools.Controls.Add(Action("Diagnosticar grupo",OpenGroupDiagnostic));
        Format(groupStatus);groupStatus.Text="Conecte o WhatsApp para consultar grupos.";groupStatus.Dock=DockStyle.Bottom;
        Format(groupAccount);groupAccount.Dock=DockStyle.Bottom;groupAccount.Font=new Font("Segoe UI",9);groupAccount.ForeColor=ConnectTheme.Muted;
        listing.Controls.Add(groups);listing.Controls.Add(groupTools);listing.Controls.Add(groupStatus);listing.Controls.Add(groupAccount);
        var compose=BuildCampaignPage();
        var diagnostics=Page("Diagnóstico");Format(diagnostic);
        diagnosticPage=tabs.TabPages[tabs.TabPages.Count-1];
        diagnostic.Text="Diagnóstico local, sem publicar mensagens.";diagnostics.Controls.Add(diagnostic);
        diagnosticGroup.DropDownStyle=ComboBoxStyle.DropDownList;diagnosticGroup.Width=340;
        diagnosticGroup.AccessibleName="Grupo para diagnóstico";
        diagnosticGroup.SelectedIndexChanged+=delegate{ShowGroupDiagnostic();};
        diagnostics.Controls.Add(diagnosticGroup);
        runDiagnostic=Action("Executar diagnóstico completo",RunGroupDiagnostic);runDiagnostic.Enabled=false;
        diagnostics.Controls.Add(runDiagnostic);
        recoverDistribution=Action("Recuperar distribuição deste grupo",RunGroupRecovery);recoverDistribution.Enabled=false;
        diagnostics.Controls.Add(recoverDistribution);
        automaticMaintenance.Text="Manutenção automática antes de publicar";
        automaticMaintenance.AutoSize=true;automaticMaintenance.Checked=!File.Exists(maintenancePath);
        automaticMaintenance.CheckedChanged+=delegate{
            try{
                if(automaticMaintenance.Checked){if(File.Exists(maintenancePath))File.Delete(maintenancePath);}
                else File.WriteAllText(maintenancePath,"disabled");
            }catch{
                diagnosticProgress.Text="Não foi possível salvar a preferência local.";
                return;
            }
            if(pipe!=null)try{pipe.WriteLine(json.Serialize(new {action="maintenance_settings",automatic_maintenance=automaticMaintenance.Checked}));}
            catch{diagnosticProgress.Text="Preferência salva; será aplicada na próxima conexão.";}
        };
        diagnostics.Controls.Add(automaticMaintenance);
        diagnostics.Controls.Add(LabelOf("Verifica metadados e remove somente registros de distribuição LID sem correspondência confirmada. Não reenvia após rejeição."));
        Format(diagnosticProgress);diagnosticProgress.MaximumSize=new Size(680,0);
        diagnostics.Controls.Add(diagnosticProgress);
        diagnosticHistory.Multiline=true;diagnosticHistory.ReadOnly=true;diagnosticHistory.ScrollBars=ScrollBars.Vertical;
        diagnosticHistory.Size=new Size(640,310);diagnosticHistory.AccessibleName="Histórico local do grupo";
        diagnostics.Controls.Add(diagnosticHistory);
        diagnostics.Controls.Add(LabelOf("Histórico separado por grupo nesta sessão. Nenhum identificador individual, chave ou mensagem é exibido."));
        var back=Action("Voltar",Close);back.Dock=DockStyle.Bottom;
        Controls.Add(back);
        ConnectTheme.Apply(this,tabs);
        ConnectTheme.ApplyContent(tabs);
        Controls.Add(ConnectTheme.BuildShell(tabs,environment.EnvironmentName));
        ConnectTheme.Primary(pair);ConnectTheme.Primary(sendTextButton);ConnectTheme.Primary(sync);
        ConnectTheme.Restyle(this);
        if(environment.IsProduction)sendStatus.Text="Produção: envio manual bloqueado; campanhas exigem opt-in e aprovação no servidor oficial.";
        if(showComposer)tabs.SelectedTab=compose;else if(showGroups)tabs.SelectedTab=listing;
        Shown+=delegate{LoadDraft();if(File.Exists(vault))ConnectSession();};
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
        if(!ready){diagnosing=false;diagnosingGroup="";diagnosticProgress.Text="Conecte o WhatsApp para consultar.";}
        UpdateDiagnosticControls();
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

    void UpdateDiagnosticControls(){
        if(runDiagnostic!=null)runDiagnostic.Enabled=ready&&pipe!=null&&!diagnosing&&!sendingText&&diagnosticGroup.SelectedItem is GroupChoice;
        var choice=diagnosticGroup.SelectedItem as GroupChoice;
        if(recoverDistribution!=null)recoverDistribution.Enabled=ready&&pipe!=null&&!diagnosing&&!sendingText&&choice!=null&&recoveryEligible.Contains(choice.Id);
        diagnosticGroup.Enabled=!diagnosing;
    }
    void RefreshDiagnosticGroups(){
        var old=diagnosticGroup.SelectedItem as GroupChoice;
        string previous=old==null?"":old.Id;
        diagnosticGroup.Items.Clear();
        int index=-1;
        foreach(var row in groupRows){
            string id=TextValue(row,"id");
            if(id==previous)index=diagnosticGroup.Items.Count;
            diagnosticGroup.Items.Add(new GroupChoice{Id=id,Name=TextValue(row,"name")});
        }
        if(diagnosticGroup.Items.Count>0)diagnosticGroup.SelectedIndex=index>=0?index:0;
        ShowGroupDiagnostic();
    }
    void OpenGroupDiagnostic(){
        if(diagnosticPage==null)return;
        string id=groups.SelectedItems.Count==1?Convert.ToString(groups.SelectedItems[0].Tag):"";
        tabs.SelectedTab=diagnosticPage;
        for(int i=0;i<diagnosticGroup.Items.Count;i++)
            if(((GroupChoice)diagnosticGroup.Items[i]).Id==id){diagnosticGroup.SelectedIndex=i;break;}
        ShowGroupDiagnostic();
    }
    void ShowGroupDiagnostic(){
        var choice=diagnosticGroup.SelectedItem as GroupChoice;
        List<string> history;
        diagnosticHistory.Text=choice!=null&&groupDiagnosticHistory.TryGetValue(choice.Id,out history)?
            String.Join(Environment.NewLine+Environment.NewLine,history.ToArray()):"Nenhum diagnóstico registrado para este grupo nesta sessão.";
        UpdateDiagnosticControls();
    }
    void AddGroupDiagnostic(string jid,string description){
        List<string> history;
        if(!groupDiagnosticHistory.TryGetValue(jid,out history)){
            if(groupDiagnosticHistory.Count>=500)return;
            history=new List<string>();groupDiagnosticHistory[jid]=history;
        }
        history.Insert(0,DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss")+" • "+description);
        if(history.Count>12)history.RemoveAt(history.Count-1);
        var choice=diagnosticGroup.SelectedItem as GroupChoice;
        if(choice!=null&&choice.Id==jid)ShowGroupDiagnostic();
    }
    void RunGroupDiagnostic(){
        var choice=diagnosticGroup.SelectedItem as GroupChoice;
        if(choice==null||!ready||pipe==null||diagnosing||sendingText)return;
        diagnosing=true;diagnosingGroup=choice.Id;
        diagnosticProgress.Text="Consultando "+choice.Name+" sem envio de mensagens…";
        AddGroupDiagnostic(choice.Id,"Consulta manual iniciada (sem envio).");
        UpdateComposer();
        try{pipe.WriteLine(json.Serialize(new {action="diagnose_group",group_jid=choice.Id}));}
        catch{diagnosing=false;diagnosingGroup="";diagnosticProgress.Text="Não foi possível iniciar a consulta.";UpdateComposer();}
    }
    void RunGroupRecovery(){
        var choice=diagnosticGroup.SelectedItem as GroupChoice;
        if(choice==null||!ready||pipe==null||diagnosing||sendingText||!recoveryEligible.Contains(choice.Id))return;
        if(MessageBox.Show("Recuperar somente o registro local de distribuição de chaves do grupo '"+choice.Name+"'?"+
            Environment.NewLine+"As chaves, credenciais e sessões serão preservadas. Nenhuma mensagem será enviada nesta operação. "+
            "Não garante a correção do erro 421.","Confirmar recuperação seletiva",MessageBoxButtons.YesNo,MessageBoxIcon.Warning,MessageBoxDefaultButton.Button2)!=DialogResult.Yes)return;
        if(!ready||pipe==null||diagnosing||sendingText)return;
        diagnosing=true;diagnosingGroup=choice.Id;
        recoveryEligible.Remove(choice.Id);
        diagnosticProgress.Text="Recuperando registro local de "+choice.Name+"…";
        AddGroupDiagnostic(choice.Id,"Recuperação seletiva iniciada (sem envio).");UpdateComposer();
        try{pipe.WriteLine(json.Serialize(new {action="recover_group_distribution",group_jid=choice.Id,confirmed=true}));}
        catch{diagnosing=false;diagnosingGroup="";diagnosticProgress.Text="Resultado incerto. Execute novo diagnóstico.";UpdateComposer();}
    }
    static string CryptoPresence(string value){return value=="present"?"presente":value=="absent"?"ausente":"não verificada";}
    static string DiagnosticCount(Dictionary<string,object> check,string key){
        int count;
        return Int32.TryParse(TextValue(check,key),out count)&&count>=0&&count<=100000?count.ToString():"—";
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
                row.SubItems.Add(members.Length==0?"—":members);
                row.SubItems.Add(GroupMode(TextValue(item,"addressing_mode")));row.SubItems.Add(GroupRole(TextValue(item,"role")));
                row.SubItems.Add(GroupPermission(TextValue(item,"posting")));row.SubItems.Add(GroupPermission(TextValue(item,"settings")));
                string last;row.SubItems.Add(groupLastErrors.TryGetValue(id,out last)?last:"—");groups.Items.Add(row);
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
        UpdateDiagnosticControls();
        if(sendTextButton==null)return;
        UpdatePhone();
        targetGroup.Enabled=ready&&!sendingText&&targetGroup.Items.Count>0;
        sendTextButton.Enabled=!environment.IsProduction&&ready&&!diagnosing&&!sendingText&&canPublish!=null&&canPublish()&&groupReadAt.HasValue&&
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
        if(environment.IsProduction||!ready||diagnosing||sendingText||automatedSend!=null||!groupReadAt.HasValue||pendingSend!=Guid.Empty||canPublish==null||!canPublish())return;
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
        get { return !closing&&!forgetting&&!diagnosing&&ready&&pipe!=null&&process!=null
            &&connectionId!=Guid.Empty&&groupReadAt.HasValue&&DateTime.Now-groupReadAt.Value<TimeSpan.FromHours(24); }
    }
    public async Task<Tuple<string,string>> DispatchCampaignTextAsync(Guid request,string group,string text,bool trackDelivery=false) {
        if(!CampaignSessionReady||pendingSend!=Guid.Empty||automatedSend!=null||!selected.Contains(group)
            ||String.IsNullOrWhiteSpace(text)||text.Length>2000||request==Guid.Empty
            ||canPublish==null||!canPublish())return Tuple.Create("refused",(string)null);
        var completion=new TaskCompletionSource<Tuple<string,string>>(TaskCreationOptions.RunContinuationsAsynchronously);
        automatedSend=completion;automatedRequest=request;sendingText=true;UpdateComposer();
        try {
            pipe.WriteLine(json.Serialize(new {action="send_text",request_id=request.ToString(),group_jid=group,text=text,track_delivery=trackDelivery}));
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
                group_jid=group,text=caption,image=Convert.ToBase64String(jpeg),track_delivery=true}));
            return await Task.WhenAny(completion.Task,Task.Delay(TimeSpan.FromSeconds(35)))==completion.Task
                ? await completion.Task : Tuple.Create("uncertain",(string)null);
        }catch{return Tuple.Create("uncertain",(string)null);}
        finally{automatedSend=null;automatedRequest=Guid.Empty;sendingText=false;UpdateComposer();}
    }
    // Candidate transport; no production or unapproved destination can reach this method.
    public async Task<Tuple<string,string>> DispatchCampaignFileAsync(Guid request,string group,string caption,byte[] bytes,string mime,string name) {
        if(!CampaignSessionReady||pendingSend!=Guid.Empty||automatedSend!=null||!selected.Contains(group)
            ||caption==null||caption.Length>1000||bytes==null||bytes.Length<8||bytes.Length>(mime=="application/pdf"?5:25)*1024*1024
            ||request==Guid.Empty||String.IsNullOrWhiteSpace(name)||name.Length>160
            ||name.IndexOfAny(System.IO.Path.GetInvalidFileNameChars())>=0
            ||(mime!="application/pdf"&&mime!="video/mp4"&&mime!="video/quicktime")
            ||(mime=="application/pdf"&&!name.EndsWith(".pdf",StringComparison.OrdinalIgnoreCase))
            ||(mime=="video/mp4"&&!name.EndsWith(".mp4",StringComparison.OrdinalIgnoreCase))
            ||(mime=="video/quicktime"&&!name.EndsWith(".mov",StringComparison.OrdinalIgnoreCase))
            ||canPublish==null||!canPublish())return Tuple.Create("refused",(string)null);
        var completion=new TaskCompletionSource<Tuple<string,string>>(TaskCreationOptions.RunContinuationsAsynchronously);
        automatedSend=completion;automatedRequest=request;sendingText=true;UpdateComposer();
        try {
            pipe.WriteLine(json.Serialize(new {action="send_file",request_id=request.ToString(),
                group_jid=group,text=caption,file=Convert.ToBase64String(bytes),mime=mime,name=name,track_delivery=true}));
            return await Task.WhenAny(completion.Task,Task.Delay(TimeSpan.FromSeconds(mime!="application/pdf"&&bytes.Length>5*1024*1024?80:40)))==completion.Task
                ? await completion.Task : Tuple.Create("uncertain",(string)null);
        }catch{return Tuple.Create("uncertain",(string)null);}
        finally{automatedSend=null;automatedRequest=Guid.Empty;sendingText=false;UpdateComposer();}
    }
    void ClearGroups(){
        sync.Enabled=false;
        groupRows.Clear();selected.Clear();groupReadAt=null;RenderGroups();
        groupStatus.Text="Conecte o WhatsApp para consultar grupos.";
        accountStatus.Text="";groupAccount.Text="";accountLabel="WhatsApp";groupLastErrors.Clear();
        groupDiagnosticHistory.Clear();recoveryEligible.Clear();diagnosing=false;diagnosingGroup="";RefreshDiagnosticGroups();
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
        try{pipe.WriteLine(json.Serialize(new {action=action,vault=credential,automatic_maintenance=automaticMaintenance.Checked}));}
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
                    string cleanName=System.Text.RegularExpressions.Regex.Replace(name,@"[\p{Cc}\p{Cf}]+"," ").Trim();
                    if(!System.Text.RegularExpressions.Regex.IsMatch(number,@"\A[0-9]{6,15}\z"))number="";
                    string suffix=number.Length==0?"":" (+"+number+")";
                    if(cleanName.Length==0)cleanName="WhatsApp";
                    if(cleanName.Length>80-suffix.Length)cleanName=cleanName.Substring(0,80-suffix.Length);
                    accountLabel=cleanName+suffix;groupAccount.Text="Conta conectada: "+accountLabel;
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
                groupReadAt=DateTime.Now;RenderGroups();ShowGroupStatus();RefreshComposerGroups();RefreshDiagnosticGroups();
            }else if((type=="group_check"||type=="group_diagnostic")&&ready&&!forgetting){
                phase="GRUPO_METADADOS";
                var check=message["value"] as Dictionary<string,object>;
                if(check!=null){
                    string jid=TextValue(check,"group_jid"),code=TextValue(check,"code");
                    string[] allowed={"ok","membership_refreshed","membership_changed_during_read","mode_mismatch","metadata_invalid","metadata_unavailable","permission_unverified","not_participating","diagnostic_unavailable"};
                    if(System.Text.RegularExpressions.Regex.IsMatch(jid,@"\A[0-9-]{1,64}@g[.]us\z")&&Array.IndexOf(allowed,code)>=0){
                        bool manual=type=="group_diagnostic";
                        string listed=GroupMode(TextValue(check,"listed_mode")),fresh=GroupMode(TextValue(check,"fresh_mode"));
                        string description=code=="ok"?"Metadados consistentes":code=="membership_refreshed"?"Participantes diferentes entre consultas":code=="mode_mismatch"?"Divergência PN/LID":code=="permission_unverified"?"Permissão não confirmada":code=="membership_changed_during_read"?"Grupo mudou durante consulta":code=="metadata_unavailable"?"Metadados indisponíveis":code=="not_participating"?"Grupo não encontrado entre os grupos da conta":code=="diagnostic_unavailable"?"Consulta indisponível":"Metadados inválidos";
                        string stage=TextValue(check,"stage");
                        string stageLabel=stage=="list"?"lista geral":stage=="individual"?"consulta individual":stage=="complete"?"comparação concluída":"início";
                        string details=(manual?"Consulta manual • "+stageLabel:"Validação durante envio")+" • "+description+
                            "\nModo: "+listed+" → "+fresh+" | Membros: "+DiagnosticCount(check,"listed_count")+" → "+DiagnosticCount(check,"fresh_count")+
                            "\nIdentificadores atuais: LID "+DiagnosticCount(check,"lid_count")+" / PN "+DiagnosticCount(check,"pn_count");
                        if(manual)details+=" / Outros "+DiagnosticCount(check,"unknown_count")+
                            "\nFunção: "+GroupRole(TextValue(check,"role"))+" | Enviar: "+GroupPermission(TextValue(check,"posting"))+" | Configurar: "+GroupPermission(TextValue(check,"settings"))+
                            "\nCriptografia de entrega: não verificada (consulta sem envio).";
                        if(manual&&TextValue(check,"store_status")!="unavailable"){
                            string mem=TextValue(check,"memory_status");
                            details+="\n\nESTADO CRIPTOGRÁFICO LOCAL (somente leitura)"+
                                "\nRegistro de distribuição: "+(mem=="present"?"presente":mem=="absent"?"ausente":mem=="invalid"?"formato inesperado":"não verificado")+
                                "\nDispositivos registrados: "+DiagnosticCount(check,"memory_entries")+" | LID "+DiagnosticCount(check,"memory_lid")+" / PN "+DiagnosticCount(check,"memory_pn")+" / Outros "+DiagnosticCount(check,"memory_other")+
                                "\nSem correspondência nas identidades atuais: "+DiagnosticCount(check,"memory_unmatched")+" | Não interpretáveis: "+DiagnosticCount(check,"memory_unparseable")+
                                "\nParticipantes com lista local de dispositivos: "+DiagnosticCount(check,"cached_members")+" | Sem lista: "+DiagnosticCount(check,"uncached_members")+
                                "\nDispositivos na lista local: "+DiagnosticCount(check,"cached_devices")+" | Registros de sessão por endereço exato: "+DiagnosticCount(check,"session_records")+
                                "\nLID próprio disponível: "+(TextValue(check,"own_lid_available")=="True"?"sim":TextValue(check,"own_lid_available")=="False"?"não":"não verificado")+
                                "\nChave própria registrada — LID: "+CryptoPresence(TextValue(check,"own_lid_key"))+" | PN: "+CryptoPresence(TextValue(check,"own_pn_key"))+
                                "\nRegistros locais não comprovam validade das chaves nem entrega.";
                        }else if(manual)details+="\nInventário criptográfico local indisponível.";
                        details=details.Replace("\n","\r\n");
                        if(manual){
                            recoveryEligible.Remove(jid);
                            int unmatched;
                            if(code=="ok"&&TextValue(check,"store_status")=="inspected"&&TextValue(check,"memory_status")=="present"&&TextValue(check,"fresh_mode")=="lid"&&TextValue(check,"own_lid_key")=="present"&&(TextValue(check,"role")=="admin"||TextValue(check,"role")=="superadmin")&&Int32.TryParse(TextValue(check,"memory_unmatched"),out unmatched)&&unmatched>0)recoveryEligible.Add(jid);
                        }
                        AddGroupDiagnostic(jid,details);
                        if(manual&&diagnosingGroup==jid){diagnosing=false;diagnosingGroup="";diagnosticProgress.Text="Consulta concluída: "+description+".";UpdateComposer();}
                        if(!manual&&code!="ok"&&code!="membership_refreshed"){
                            if(groupLastErrors.Count<500||groupLastErrors.ContainsKey(jid)){groupLastErrors[jid]=code;RenderGroups();}
                        }
                    }
                }
            }else if(type=="group_recovery"&&ready&&!forgetting){
                phase="GRUPO_RECUPERACAO";
                var result=message["value"] as Dictionary<string,object>;
                if(result!=null){
                    string jid=TextValue(result,"group_jid"),code=TextValue(result,"code");
                    if(System.Text.RegularExpressions.Regex.IsMatch(jid,@"\A[0-9-]{1,64}@g[.]us\z")&&diagnosingGroup==jid){
                        string description=code=="recovered"?"Registro local invalidado; chaves e sessões preservadas.":code=="already_empty"?"Registro já vazio.":code=="already_recovered"?"Recuperação já executada nesta sessão.":code=="no_mismatch"?"Sem divergência atual; nada alterado.":code=="metadata_or_permission"?"Metadados ou permissões não confirmados.":code=="identity_unverified"?"Identidade criptográfica não confirmada.":code=="not_participating"?"Grupo não encontrado.":code=="invalid_memory"?"Formato do registro inesperado; nada alterado.":"Recuperação indisponível ou não confirmada.";
                        AddGroupDiagnostic(jid,description+"\r\nRegistros antes: "+DiagnosticCount(result,"before")+" | Depois: "+DiagnosticCount(result,"after")+"\r\nNenhum envio solicitado por esta operação. Execute novo diagnóstico.");
                        diagnosing=false;diagnosingGroup="";diagnosticProgress.Text=description;UpdateComposer();
                    }
                }
            }else if(type=="group_maintenance"&&ready&&!forgetting){
                var row=message["value"] as Dictionary<string,object>;
                if(row!=null){
                    string jid=TextValue(row,"group_jid"),code=TextValue(row,"code");
                    if(System.Text.RegularExpressions.Regex.IsMatch(jid,@"\A[0-9-]{1,64}@g[.]us\z")){
                        string description=code=="pruned"?"Manutenção automática: registros antigos removidos "+DiagnosticCount(row,"removed")+" (antes "+DiagnosticCount(row,"before")+", depois "+DiagnosticCount(row,"after")+")":code=="checked_no_change"?"Manutenção automática: nenhuma alteração necessária ou elegível.":code=="previous_421"?"Envio pausado: rejeição 421 anterior nesta sessão. Verifique no WhatsApp oficial.":code=="preflight_blocked"?"Envio interrompido: metadados ou permissões não confirmados.":code=="preflight_unavailable"?"Consulta de manutenção indisponível.":code=="maintenance_unverified"?"Manutenção não confirmada; envio interrompido.":null;
                        if(description!=null){AddGroupDiagnostic(jid,description);if(code=="pruned")recoveryEligible.Remove(jid);}
                    }
                }
            }else if(type=="group_send_stage"&&ready&&!forgetting){
                phase="GRUPO_ENVIO";
                var stageRow=message["value"] as Dictionary<string,object>;
                if(stageRow!=null){
                    string jid=TextValue(stageRow,"group_jid"),stage=TextValue(stageRow,"stage");
                    if(System.Text.RegularExpressions.Regex.IsMatch(jid,@"\A[0-9-]{1,64}@g[.]us\z")){
                        if(stage=="attempt_started")AddGroupDiagnostic(jid,"Envio: tentativa iniciada.");
                        else if(stage=="receipt_generated")AddGroupDiagnostic(jid,"Envio: identificador gerado; aguardando confirmação do WhatsApp.");
                        else if(stage=="uncertain")AddGroupDiagnostic(jid,"Envio: resultado incerto. Não repetir automaticamente.");
                    }
                }
            }else if(type=="delivery_receipt"&&ready&&!forgetting){
                phase="ENTREGA";
                var row=message["value"] as Dictionary<string,object>;
                if(row!=null){
                    var jid=TextValue(row,"group_jid");var id=TextValue(row,"message_id");var status=TextValue(row,"status");
                    if(System.Text.RegularExpressions.Regex.IsMatch(jid,@"\A[0-9-]{1,64}@g[.]us\z")&&id.Length>0&&id.Length<=160&&(status=="server_ack"||status=="delivery_ack"||status=="send_error")){
                        var key=jid+":"+id;Dictionary<string,object> previous;
                        if(deliveryReceipts.TryGetValue(key,out previous)&&(TextValue(previous,"status")=="delivery_ack"||(TextValue(previous,"status")=="send_error"&&status=="server_ack")))return;
                        if(status=="send_error"){var code=TextValue(row,"error_code");row["error_code"]=System.Text.RegularExpressions.Regex.IsMatch(code,@"\A[0-9]{1,5}\z")?code:"unknown";
                            if(groupLastErrors.Count<500||groupLastErrors.ContainsKey(jid)){groupLastErrors[jid]=TextValue(row,"error_code");RenderGroups();}}
                        AddGroupDiagnostic(jid,status=="send_error"?"Retorno do WhatsApp: rejeição "+TextValue(row,"error_code"):status=="delivery_ack"?"Retorno do WhatsApp: entrega confirmada":"Retorno do WhatsApp: aceite do servidor");
                        if(deliveryReceipts.Count<256||deliveryReceipts.ContainsKey(key)){row["observed_at"]=DateTime.UtcNow;deliveryReceipts[key]=row;}
                    }
                }
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
        ++generation;ready=false;forgetting=false;deliveryReceipts.Clear();
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
