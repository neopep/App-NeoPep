using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

interface ICampaignProvider {
    string Identity { get; set; }
    Task<string> LinkAsync();
    bool CanProcess(string account);
    Task<string> PublishAsync(string task, string account);
}

sealed class SimulatedProvider : ICampaignProvider {
    public string Identity { get; set; }
    public Task<string> LinkAsync() { return Task.FromResult(Identity); }
    public bool CanProcess(string account) { return account == Identity && !String.IsNullOrEmpty(account); }
    public Task<string> PublishAsync(string task, string account) {
        if (!CanProcess(account)) throw new InvalidOperationException();
        return Task.FromResult("simulated");
    }
}

sealed partial class Connect : Form {
    const string Version = ConnectVersion.Number;
    readonly ConnectProfile profile;
    readonly string Folder,vault,log;
    Connect sibling;
    WhatsApp whatsapp;
    Guid sessionOwner;
    static bool installingUpdate;
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    readonly TextBox email = new TextBox(), password = new TextBox();
    readonly ComboBox accounts = new ComboBox();
    readonly Label state = new Label();
    readonly CheckBox startup = new CheckBox();
    readonly NotifyIcon tray = new NotifyIcon();
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    readonly ICampaignProvider provider = new SimulatedProvider();
    Dictionary<string,object> local = new Dictionary<string,object>();
    string access;
    DateTime expires;
    bool busy, exiting, deviceApproved;

    [STAThread] static void Main(string[] args) {
        bool created;
        using (var instance = new Mutex(true, ConnectProfile.MutexName, out created)) {
            if (!created) return;
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            bool background=Array.IndexOf(args,"--background")>=0;
            using(var test=new Connect(ConnectProfile.Teste,background))
            using(var production=new Connect(ConnectProfile.Producao,false)){
                test.sibling=production;production.sibling=test;
                if(!background)test.Shown+=delegate{test.BeginInvoke((Action)(()=>production.Show()));};
                Application.Run(test);
            }
        }
    }

    Connect(ConnectProfile environment,bool background) {
        profile=environment;Folder=profile.LocalFolder;
        Directory.CreateDirectory(Folder);
        vault=Path.Combine(Folder,"session.dat");log=Path.Combine(Folder,"diagnostico.log");
        Text=profile.AppName; BackColor=ConnectTheme.Background; ForeColor=ConnectTheme.Text;
        Size=new Size(720,550); MinimumSize=new Size(500,430); Font=new Font("Segoe UI",10);
        AutoScaleMode=AutoScaleMode.Dpi;
        var tabs=new TabControl{Dock=DockStyle.Fill};
        var overview=Page(tabs,"Visão geral");
        var credentials=Page(tabs,"Conta NeoPep");
        var computer=Page(tabs,"Computador");
        var diagnostics=Page(tabs,"Diagnóstico");
        var settings=Page(tabs,"Configurações");
        var title=new Label{Tag="accent",Text="NeoPep Connect",ForeColor=ConnectTheme.Accent,Font=new Font("Segoe UI Semibold",24,FontStyle.Bold),AutoSize=true};
        overview.Controls.Add(title);
        overview.Controls.Add(new Label{Text=profile.EnvironmentName+" • versão "+Version+" • configuração automática",AutoSize=true});
        overview.Controls.Add(new Label{Text=profile.IsProduction?"Conexão NeoPep • envio em homologação":"Conexão NeoPep • provedor simulado",AutoSize=true});
        var metrics=new FlowLayoutPanel{AutoSize=true,Dock=DockStyle.Top,WrapContents=true,Padding=new Padding(4,14,4,14)};
        var deviceMetric=new Label();
        metrics.Controls.Add(Metric("COMPUTADOR",deviceMetric,"Verificação pendente"));
        metrics.Controls.Add(Metric("WHATSAPP",new Label{Text="Gerenciar conexão"},"Conexão local"));
        metrics.Controls.Add(Metric("PUBLICAÇÕES",new Label{Text="Envio manual"},profile.IsProduction?"Produção • envio bloqueado":"Teste • confirmação obrigatória"));
        overview.Controls.Add(metrics);
        state.TextChanged+=delegate{
            deviceMetric.Text=deviceApproved?"Autorizado":"Aguardando conexão";
        };
        AddField(credentials,"E-mail administrativo",email);
        password.UseSystemPasswordChar=true; AddField(credentials,"Senha",password);
        AddField(computer,"Sessão fictícia deste computador",accounts);accounts.DropDownStyle=ComboBoxStyle.DropDownList;
        accounts.SelectedIndexChanged+=delegate {
            var account=accounts.SelectedItem as Account;
            var next=account==null?"":account.Id;
            if(next!=Value(local,"account")){local["account"]=next;Save();}
        };
        var actions=new FlowLayoutPanel{AutoSize=true,WrapContents=true,Dock=DockStyle.Top};
        var login=Button("Entrar e registrar");var diagnose=Button("Atualizar diagnóstico");var open=Button("Painel / atualizações");
        var statusLog=new TextBox{Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,Height=235,Dock=DockStyle.Top};
        AddField(diagnostics,"Eventos locais",statusLog);
        diagnostics.Controls.Add(diagnose);
        computer.Controls.Add(new Label{Text="Gerencie a aprovação do computador no painel de "+profile.EnvironmentName+".",AutoSize=true});
        var whatsAppPage=Page(tabs,"WhatsApp");
        whatsAppPage.Controls.Add(new Label{Text="Integração experimental. Vincule somente uma conta autorizada para "+profile.EnvironmentName+".",AutoSize=true});
        var groupsPage=Page(tabs,"Grupos");
        groupsPage.Controls.Add(new Label{Text="Consulte apenas o nome e a contagem dos grupos da conta conectada.",AutoSize=true});
        var pairing=Button("Abrir conexão WhatsApp");var groupList=Button("Abrir consulta de grupos");
        pairing.Click+=delegate {OpenWhatsApp(false);};
        groupList.Click+=delegate {OpenWhatsApp(true);};
        whatsAppPage.Controls.Add(pairing);groupsPage.Controls.Add(groupList);
        var publishPage=Page(tabs,"Publicar");
        var prepare=Button("Preparar campanha");
        prepare.Click+=delegate{OpenWhatsApp(false,true);};
        publishPage.Controls.Add(new Label{Text="Organize a mensagem, confira a prévia e revise o destino.",AutoSize=true});
        publishPage.Controls.Add(prepare);
        var loginFeedback=new Label{AutoSize=true,MaximumSize=new Size(420,0)};
        login.Click+=async delegate {
            if(busy)return;
            login.Enabled=false;
            try {await Login();loginFeedback.Text=state.Text;}
            finally{login.Enabled=true;}
        };
        credentials.Controls.Add(loginFeedback);
        diagnose.Click+=delegate {statusLog.Text=File.Exists(log)?File.ReadAllText(log):"Sem eventos registrados.";};
        open.Enabled=!String.IsNullOrEmpty(profile.PanelUrl);
        open.Click+=delegate {if(!String.IsNullOrEmpty(profile.PanelUrl))Process.Start(profile.PanelUrl);};
        credentials.Controls.Add(login);
        var logout=Button("Sair desta conta");logout.Click+=async delegate{await Logout();};credentials.Controls.Add(logout);
        actions.Controls.Add(open);
        var switchEnvironment=Button(profile.IsProduction?"Abrir TESTE":"Abrir PRODUÇÃO");
        switchEnvironment.Click+=delegate{if(sibling!=null){sibling.Show();sibling.Activate();}};
        actions.Controls.Add(switchEnvironment);overview.Controls.Add(actions);
        startup.Text="Iniciar com o Windows";startup.AutoSize=true;
        using(var run=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")){
            startup.Checked=run.GetValue(ConnectProfile.StartupRegistryName)!=null;
        }
        startup.CheckedChanged+=delegate {
            using(var run=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")){
                if(startup.Checked)run.SetValue(ConnectProfile.StartupRegistryName,"\""+Application.ExecutablePath+"\" --background");
                else run.DeleteValue(ConnectProfile.StartupRegistryName,false);
            }
        };
        if(!profile.IsProduction)settings.Controls.Add(startup);state.AutoSize=true;overview.Controls.Add(state);
        LoadVault();local.Remove("key");
        var theme=new ComboBox{DropDownStyle=ComboBoxStyle.DropDownList,Width=210};
        theme.Items.AddRange(new object[]{"Claro","Escuro","Seguir sistema"});
        string savedTheme=Value(local,"theme");
        theme.SelectedItem=theme.Items.Contains(savedTheme)?savedTheme:"Escuro";
        ConnectTheme.Select(theme.Text);AddField(settings,"Tema",theme);
        Activated+=delegate{ConnectTheme.Select(theme.Text);ConnectTheme.Restyle(this);};
        theme.SelectedIndexChanged+=delegate{
            ConnectTheme.Select(theme.Text);ConnectTheme.Restyle(this);
            try{local["theme"]=theme.Text;Save();}catch{Record("tema_nao_salvo");}
        };
        InitUpdates(tabs);
        foreach(TabPage tab in tabs.TabPages) {
            if(tab==tabs.TabPages[0])continue;
            var back=Button("Voltar");back.Dock=DockStyle.Bottom;back.Click+=delegate{tabs.SelectedIndex=0;};
            tab.Controls.Add(back);back.BringToFront();
        }
        ConnectTheme.Apply(this,tabs);
        ConnectTheme.ApplyContent(tabs);
        Controls.Add(ConnectTheme.BuildShell(tabs,profile.EnvironmentName));
        ConnectTheme.Restyle(this);
        ConnectTheme.Primary(login);
        tray.Icon=Icon;tray.Text=profile.AppName;tray.Visible=true;
        var menu=new ContextMenuStrip();
        menu.Items.Add("Abrir "+profile.EnvironmentName,null,delegate {Show();Activate();});menu.Items.Add("Sair dos dois ambientes",null,delegate {ExitBoth();});
        tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate {Show();Activate();};
        FormClosing+=delegate(object sender,FormClosingEventArgs e) {
            if(!exiting&&e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();return;}
            timer.Stop();tray.Dispose();
        };
        state.Text=String.IsNullOrEmpty(Value(local,"refresh_token"))?"Entre para registrar este computador.":"Aguardando estado do computador.";
        timer.Interval=12000;timer.Tick+=async delegate {CheckCampaignReview();await Tick();};timer.Start();
        Shown+=async delegate {if(background)Hide();await Tick();await CheckUpdate(false);};
    }

    DateTime campaignDraftWrite;
    DateTime? campaignReview;
    void CheckCampaignReview(){
        if(sessionOwner==Guid.Empty)return;
        try{
            string path=Path.Combine(WhatsAppFolder(),"whatsapp-message-draft.dat");
            var file=new FileInfo(path);
            if(!file.Exists||file.Length>2*1024*1024){campaignReview=null;campaignDraftWrite=DateTime.MinValue;return;}
            if(file.LastWriteTimeUtc!=campaignDraftWrite){
                campaignReview=null;
                var clear=ProtectedData.Unprotect(File.ReadAllBytes(path),WhatsAppEntropy(),DataProtectionScope.CurrentUser);
                var draft=json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(clear));
                DateTime due;
                if(DateTime.TryParseExact(Value(draft,"due"),"o",System.Globalization.CultureInfo.InvariantCulture,System.Globalization.DateTimeStyles.RoundtripKind,out due))
                    campaignReview=due.ToUniversalTime();
                campaignDraftWrite=file.LastWriteTimeUtc;
            }
            if(!campaignReview.HasValue||campaignReview.Value>DateTime.UtcNow)return;
            string key=campaignReview.Value.ToString("o");
            if(Value(local,"campaign_review_notified")==key)return;
            local["campaign_review_notified"]=key;Save();
            tray.BalloonTipTitle=profile.AppName;
            tray.BalloonTipText="Uma campanha está pronta para revisão. Abra Publicar para conferir.";
            tray.ShowBalloonTip(5000);
        }catch{}
    }

    void ExitBoth(){
        exiting=true;
        if(sibling!=null){sibling.exiting=true;if(sibling.whatsapp!=null)sibling.whatsapp.Close();sibling.Close();}
        if(whatsapp!=null)whatsapp.Close();Close();
    }

    string WhatsAppFolder(){
        Guid legacy;
        Guid.TryParse(Value(local,"legacy_owner"),out legacy);
        return profile.AccountFolder(sessionOwner,legacy);
    }
    byte[] WhatsAppEntropy(){
        return WhatsAppFolder()==ConnectProfile.InstallFolder?null:
            Encoding.UTF8.GetBytes("NeoPepConnect/"+profile.EnvironmentCode+"/"+sessionOwner.ToString("D"));
    }
    void OpenWhatsApp(bool groups,bool composer=false){
        if(sessionOwner==Guid.Empty||!SessionReady()){
            MessageBox.Show("Entre na conta deste ambiente primeiro.",profile.AppName);
            return;
        }
        if(whatsapp!=null){whatsapp.Activate();return;}
        var folder=WhatsAppFolder();
        Directory.CreateDirectory(folder);
        whatsapp=new WhatsApp(folder,groups,SyncWhatsAppGroups,SetWhatsAppStatus,
            ()=>!profile.IsProduction&&SessionReady()&&deviceApproved,LoadCampaignSources,composer,LoadCampaignImage,
            profile,WhatsAppEntropy());
        whatsappOpen=true;
        whatsapp.FormClosed+=delegate{whatsappOpen=false;whatsapp=null;};
        whatsapp.Show(this);
    }

    async Task Logout(){
        if(busy||checkingUpdate||installingUpdate)return;
        busy=true;
        try{
            if(!String.IsNullOrEmpty(access)){
                try{await Post("/auth/v1/logout?scope=local",new {},true);}catch{}
            }
            access=null;expires=DateTime.MinValue;sessionOwner=Guid.Empty;deviceApproved=false;
            if(whatsapp!=null)whatsapp.Close();offer=null;updateInstall.Enabled=false;updateDetails.Text="";
            foreach(var key in new[]{"refresh_token","device","secret","account","owner","campaign_review_notified"})local.Remove(key);
            accounts.Items.Clear();email.Clear();password.Clear();Save();
            state.Text="Sessão local encerrada neste ambiente.";
        }catch{state.Text="Não foi possível persistir a saída. Tente novamente.";}
        finally{busy=false;}
    }

    async Task<long> SyncWhatsAppGroups(Guid connection,long revision,object[] groups){
        if(!SessionReady()||!deviceApproved)throw new InvalidOperationException();
        var result=await Post("/rest/v1/rpc/neo_connect_wa_replace_selection",new {
            p_device=Value(local,"device"),p_secret=Value(local,"secret"),p_connection=connection,
            p_expected_revision=revision,p_label="WhatsApp",p_groups=groups
        },true);
        return Convert.ToInt64(result["revision"]);
    }

    async Task SetWhatsAppStatus(Guid connection,string status){
        if(!SessionReady()||!deviceApproved)return;
        await Post("/rest/v1/rpc/neo_connect_wa_set_status",new {
            p_device=Value(local,"device"),p_secret=Value(local,"secret"),p_connection=connection,p_status=status
        },true);
    }

    static Panel Metric(string heading,Label figure,string detail){
        var panel=ConnectTheme.Card(194,116);
        panel.Margin=new Padding(8);
        panel.Padding=new Padding(12);

        var caption=new Label{Text=heading,Dock=DockStyle.Top,Height=25,
            ForeColor=ConnectTheme.Muted,Font=new Font("Segoe UI",9,FontStyle.Bold)};
        figure.Tag="accent";figure.Dock=DockStyle.Top;figure.Height=36;figure.ForeColor=ConnectTheme.Accent;
        figure.Font=new Font("Segoe UI Semibold",14,FontStyle.Bold);
        var sub=new Label{Text=detail,Dock=DockStyle.Bottom,Height=24,
            ForeColor=ConnectTheme.Muted,Font=new Font("Segoe UI",8)};
        panel.Controls.Add(sub);panel.Controls.Add(figure);panel.Controls.Add(caption);
        return panel;
    }

    static TableLayoutPanel Page(TabControl tabs,string title) {
        var page=new TabPage(title){BackColor=ConnectTheme.Background,ForeColor=ConnectTheme.Text};
        var content=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(22),ColumnCount=1,AutoScroll=true};
        content.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        page.Controls.Add(content);tabs.TabPages.Add(page);return content;
    }

    static void AddField(TableLayoutPanel panel,string text,Control control) {
        panel.Controls.Add(new Label{Text=text,AutoSize=true});control.Dock=DockStyle.Top;panel.Controls.Add(control);
    }
    static Button Button(string text) {
        return new Button{Text=text,AutoSize=true,BackColor=ConnectTheme.Raised,ForeColor=ConnectTheme.Text};
    }
    static string Value(Dictionary<string,object> row,string name) {
        object value; return row!=null&&row.TryGetValue(name,out value)&&value!=null?Convert.ToString(value):"";
    }
    void LoadVault() {
        if(!File.Exists(vault))return;
        try {local=json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(vault),profile.Entropy,DataProtectionScope.CurrentUser)));}
        catch(Exception){Record("cofre_indisponivel");}
    }
    void Save() {
        byte[] data=ProtectedData.Protect(Encoding.UTF8.GetBytes(json.Serialize(local)),profile.Entropy,DataProtectionScope.CurrentUser);
        string temporary=vault+".new";
        File.WriteAllBytes(temporary,data);
        if(File.Exists(vault))File.Replace(temporary,vault,null);else File.Move(temporary,vault);
    }
    void Record(string code) {
        if(File.Exists(log)&&new FileInfo(log).Length>64000)File.Delete(log);
        File.AppendAllText(log,DateTime.UtcNow.ToString("u")+" "+code+Environment.NewLine);
    }
    sealed class UpdateBrokerClient : WebClient {
        protected override WebRequest GetWebRequest(Uri address){
            var request=(HttpWebRequest)base.GetWebRequest(address);
            request.AllowAutoRedirect=false;
            return request;
        }
    }
    Task<Dictionary<string,object>> Post(string route,object data,bool session){
        return PostJson<Dictionary<string,object>>(route,data,session);
    }
    async Task<T> PostJson<T>(string route, object data, bool session) {
        using(var client=new UpdateBrokerClient()) {
            client.Proxy=WebRequest.DefaultWebProxy;
            client.Encoding=Encoding.UTF8;
            client.Headers["Content-Type"]="application/json";client.Headers["apikey"]=profile.PublishableKey;
            if(session)client.Headers["Authorization"]="Bearer "+access;
            string result=await client.UploadStringTaskAsync(profile.Endpoint(route),"POST",json.Serialize(data));
            return String.IsNullOrWhiteSpace(result)?default(T):json.Deserialize<T>(result);
        }
    }
    async Task<Dictionary<string,object>[]> LoadCampaignSources(string kind,string search){
        if(!SessionReady()||!deviceApproved)throw new InvalidOperationException();
        if(kind=="product"){
            var catalog=await Post("/rest/v1/rpc/neo_shop",new {p_action="catalog"},true);
            var rows=new List<Dictionary<string,object>>();
            object products;
            if(catalog.TryGetValue("products",out products)&&products is System.Collections.IEnumerable)
                foreach(var item in (System.Collections.IEnumerable)products){
                    var row=item as Dictionary<string,object>;
                    if(row!=null&&String.Equals(Value(row,"active"),"True",StringComparison.Ordinal)&&
                       Value(row,"name").IndexOf(search.Trim(),StringComparison.CurrentCultureIgnoreCase)>=0)rows.Add(row);
                    if(rows.Count==50)break;
                }
            return rows.ToArray();
        }
        var body=kind=="templates"?new {p_action="list",p_data=(object)new {offset=0}}:
            new {p_action="catalog",p_data=(object)new {kind=kind,search=search}};
        return await PostJson<Dictionary<string,object>[]>("/rest/v1/rpc/neo_campaign_admin",body,true);
    }
    async Task<byte[]> LoadCampaignImage(string bucket,string path){
        if(!SessionReady()||!deviceApproved||(bucket!="neo-shop-products"&&bucket!="neo-campaign-images")||
           !System.Text.RegularExpressions.Regex.IsMatch(path,@"\A[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|jpeg|png)\z"))
            throw new InvalidOperationException();
        var request=(HttpWebRequest)WebRequest.Create(profile.Endpoint("/storage/v1/object/authenticated/"+bucket+"/"+path));
        request.AllowAutoRedirect=false;request.Headers["Authorization"]="Bearer "+access;request.Headers["apikey"]=profile.PublishableKey;
        using(var deadline=new System.Threading.Timer(_=>request.Abort(),null,TimeSpan.FromSeconds(15),System.Threading.Timeout.InfiniteTimeSpan))
        using(var response=(HttpWebResponse)await request.GetResponseAsync())
        using(var input=response.GetResponseStream())
        using(var content=new MemoryStream()){
            const int limit=5*1024*1024;
            if(response.StatusCode!=HttpStatusCode.OK||response.ContentLength>limit)throw new IOException();
            var buffer=new byte[16384];
            int read;
            while((read=await input.ReadAsync(buffer,0,buffer.Length))!=0){
                if(content.Length+read>limit)throw new IOException();
                content.Write(buffer,0,read);
            }
            return content.ToArray();
        }
    }
    async Task Tokens(string grant,object credentials,bool persist=true) {
        var result=await Post("/auth/v1/token?grant_type="+grant,credentials,false);
        var nextAccess=Value(result,"access_token");var nextRefresh=Value(result,"refresh_token");
        if(String.IsNullOrEmpty(nextAccess)||String.IsNullOrEmpty(nextRefresh))throw new InvalidOperationException();
        object user;
        if(!result.TryGetValue("user",out user))throw new InvalidOperationException();
        var owner=Value(user as Dictionary<string,object>,"id");Guid id;
        if(!Guid.TryParse(owner,out id)||id==Guid.Empty)throw new InvalidOperationException();
        var previousOwner=Value(local,"owner");
        if(previousOwner!=""&&previousOwner!=id.ToString("D"))throw new InvalidOperationException("account_mismatch");
        sessionOwner=id;
        local["owner"]=id.ToString("D");
        if(!profile.IsProduction&&Value(local,"legacy_owner")=="")local["legacy_owner"]=id.ToString("D");
        access=nextAccess;expires=DateTime.UtcNow.AddSeconds(Convert.ToInt32(result["expires_in"])-60);
        local["refresh_token"]=nextRefresh;if(persist)Save();
    }
    Task<Dictionary<string,object>> RPC(string action,object data) {
        var device=Value(local,"device");
        return Post("/rest/v1/rpc/neo_connect_device",new {
            p_action=action,p_device=String.IsNullOrEmpty(device)?null:device,p_secret=Value(local,"secret"),p_data=data
        },true);
    }
    Task<Dictionary<string,object>> CampaignDispatch(string action,object data) {
        return Post("/rest/v1/rpc/neo_campaign_dispatch_device_v1",new {
            p_action=action,p_device=Value(local,"device"),p_secret=Value(local,"secret"),p_data=data
        },true);
    }
    async Task TickCampaignDispatch() {
        // Explicit local opt-in and a disabled-by-default server gate are both required.
        if(profile.IsProduction||Environment.GetEnvironmentVariable("NEO_CONNECT_CAMPAIGN_WORKER")!="1")return;
        var window=whatsapp;
        if(window==null||window.CampaignConnection==Guid.Empty)return;
        try {
            var connection=window.CampaignConnection;
            bool ready=window.CampaignSessionReady;
            if(ready)await SetWhatsAppStatus(connection,"connected");
            var gate=await CampaignDispatch("heartbeat",new {connection_id=connection,bridge_version="wa-text-v1",session_ready=ready});
            if(gate==null||!gate.ContainsKey("enabled")||!Convert.ToBoolean(gate["enabled"])||!ready)return;
            var lease=await CampaignDispatch("claim",new {});
            if(lease==null||whatsapp!=window||window.CampaignConnection!=connection||!window.CampaignSessionReady)return;
            var id=Value(lease,"id");var fence=Value(lease,"fence");
            var job=await CampaignDispatch("start",new {id=id,fence=fence});
            if(job==null)return;
            var receipt=Tuple.Create("uncertain",(string)null);
            Guid idempotency;
            if(whatsapp==window&&window.CampaignConnection==connection&&Guid.TryParse(fence,out idempotency))
                receipt=await window.DispatchCampaignTextAsync(idempotency,Value(job,"group_jid"),Value(job,"text"));
            await CampaignDispatch("finish",new {id=id,fence=fence,outcome=receipt.Item1,receipt_id=receipt.Item2});
        }catch(Exception){Record("campaign_worker_unavailable");}
    }
    async Task Login() {
        if(busy||installingUpdate||checkingUpdate||whatsappOpen)return;busy=true;
        var previous=new Dictionary<string,object>(local);
        bool deviceStage=false;
        try {
            string loginEmail=email.Text.Trim(),loginPassword=password.Text;
            string captcha=null;
            if(!String.IsNullOrEmpty(profile.CaptchaSiteKey)){
                captcha=await TurnstileDialog.Verify(this,profile);
                if(captcha==null){state.Text=PasswordGrant.Error("captcha_failed",false);return;}
            }
            try{await Tokens("password",PasswordGrant.Payload(loginEmail,loginPassword,captcha),false);}
            finally{captcha=null;loginPassword=null;}
            deviceStage=true;
            if(!String.IsNullOrEmpty(Value(local,"device"))){
                var identity=Value(local,"account");
                var heartbeat=await RPC("heartbeat",new {version=Version,working_set_mb=Environment.WorkingSet/1048576,
                    account=String.IsNullOrEmpty(identity)?null:identity});
                Save();RenderAccounts(heartbeat);
                deviceApproved=Value(heartbeat,"state")=="approved";
                state.Text=deviceApproved?ApprovedStatus():"Aprovação pendente.";
            }else{
                var buffer=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(buffer);
                local["secret"]=BitConverter.ToString(buffer).Replace("-","").ToLowerInvariant();
                await Register();
            }
        } catch(Exception error) {
            local=previous;access=null;sessionOwner=Guid.Empty;deviceApproved=false;if(whatsapp!=null)whatsapp.Close();
            string code=LoginErrorCode(error);
            state.Text=PasswordGrant.Error(code,deviceStage);
            Record("login_"+code);
        }
        finally {password.Clear();busy=false;}
    }
    string LoginErrorCode(Exception error){
        if(error is InvalidOperationException&&error.Message=="account_mismatch")return "account_mismatch";
        var web=error as WebException;
        if(web==null)return "internal";
        using(var response=web.Response as HttpWebResponse){
            if(response==null)return "network_error";
            if((int)response.StatusCode>=500)return "network_error";
            try{
                using(var stream=response.GetResponseStream())
                using(var reader=new StreamReader(stream,Encoding.UTF8)){
                    var buffer=new char[4096];
                    int size=reader.ReadBlock(buffer,0,buffer.Length);
                    if(size>=buffer.Length)return "unclassified";
                    var row=json.Deserialize<Dictionary<string,object>>(new string(buffer,0,size));
                    string code=Value(row,"error_code");
                    if(String.IsNullOrEmpty(code))code=Value(row,"code");
                    if(Array.IndexOf(new[]{"captcha_failed","invalid_credentials","42501"},code)>=0)return code;
                }
            }catch{}
            return "unclassified";
        }
    }
    string ApprovedStatus(){return profile.IsProduction?"Computador autorizado • produção":"Computador autorizado • simulação";}
    async Task Register() {
        var device=await RPC("register",new {label=Environment.MachineName});
        local["device"]=Value(device,"id");Save();Record("registrado");
        state.Text="Registro enviado. Aprovação pendente no painel.";
    }
    sealed class Account {
        public string Id,Name;
        public override string ToString(){return Name;}
    }
    void RenderAccounts(Dictionary<string,object> data) {
        object accountRows;
        if(!data.TryGetValue("accounts",out accountRows))return;
        var list=accountRows as System.Collections.IEnumerable;
        if(list==null)return;
        var selected=Value(local,"account");
        var next=new List<Account>{new Account{ Id="",Name="Sem sessão fictícia"}};
        foreach(var item in list) {
            var row=(Dictionary<string,object>)item;
            next.Add(new Account{Id=Value(row,"id"),Name=Value(row,"identity")});
        }
        bool changed=accounts.Items.Count!=next.Count;
        if(!changed)for(int i=0;i<next.Count;i++)if(((Account)accounts.Items[i]).Id!=next[i].Id){changed=true;break;}
        if(!changed)return;
        accounts.Items.Clear();accounts.Items.AddRange(next.ToArray());
        var index=next.FindIndex(x=>x.Id==selected);
        accounts.SelectedIndex=index<0?0:index;
    }
    async Task Tick() {
        if(exiting||installingUpdate||busy||String.IsNullOrEmpty(Value(local,"refresh_token")))return;
        busy=true;
        try {
            if(String.IsNullOrEmpty(access)||DateTime.UtcNow>=expires)await Tokens("refresh_token",new {refresh_token=Value(local,"refresh_token")});
            if(String.IsNullOrEmpty(Value(local,"device"))){
                if(String.IsNullOrEmpty(Value(local,"secret")))return;
                await Register();
            }
            provider.Identity=Value(local,"account");
            string identity=await provider.LinkAsync();
            var heartbeat=await RPC("heartbeat",new {version=Version,working_set_mb=Environment.WorkingSet/1048576,
                account=String.IsNullOrEmpty(identity)?null:identity});
            RenderAccounts(heartbeat);
            deviceApproved=Value(heartbeat,"state")=="approved";
            if(!deviceApproved){state.Text="Aprovação pendente.";return;}
            state.Text=ApprovedStatus();
            var reminders=await RPC("reminders",new { });
            var entries=reminders["items"] as System.Collections.ICollection;
            if(entries!=null&&entries.Count>0) {
                tray.BalloonTipTitle=profile.AppName;
                tray.BalloonTipText="Há divulgações manuais previstas. Consulte o painel.";
                tray.ShowBalloonTip(5000);
            }
            await TickCampaignDispatch();
            if(profile.IsProduction)return;
            var job=await RPC("claim",new { });
            if(job==null)return;
            var id=Value(job,"id");var fence=Value(job,"fence");var account=Value(job,"account");
            if(!provider.CanProcess(account))return;
            await RPC("start",new {task=id,fence=fence});
            string outcome="uncertain";
            try {outcome=await provider.PublishAsync(id,account);}catch(Exception){Record("resultado_incerto");}
            await RPC("finish",new {task=id,fence=fence,outcome=outcome});
            Record(outcome);
        } catch(WebException error) {
            var response=error.Response as HttpWebResponse;
            if(response!=null&&(response.StatusCode==HttpStatusCode.Unauthorized||response.StatusCode==HttpStatusCode.Forbidden)) {
                state.Text="Sessão ou computador sem autorização.";access=null;deviceApproved=false;
            } else state.Text="Conexão indisponível. Nova tentativa automática.";
            Record("comunicacao_indisponivel");
        } catch(Exception){state.Text="Falha local. Consulte o diagnóstico.";Record("falha_local");}
        finally{busy=false;}
    }
}
