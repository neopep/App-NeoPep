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
    static readonly string Origin = ConnectProfile.SupabaseUrl;
    static readonly string Folder = ConnectProfile.LocalFolder;
    readonly string vault = Path.Combine(Folder, "session.dat");
    readonly string log = Path.Combine(Folder, "diagnostico.log");
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
    bool busy, exiting;

    [STAThread] static void Main(string[] args) {
        bool created;
        using (var instance = new Mutex(true, ConnectProfile.MutexName, out created)) {
            if (!created) return;
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Connect(Array.IndexOf(args,"--background")>=0));
        }
    }

    Connect(bool background) {
        Directory.CreateDirectory(Folder);
        Text=ConnectProfile.AppName; BackColor=Color.FromArgb(23,22,19); ForeColor=Color.Gainsboro;
        Size=new Size(720,550); MinimumSize=new Size(500,430); Font=new Font("Segoe UI",10);
        AutoScaleMode=AutoScaleMode.Dpi;
        var tabs=new TabControl{Dock=DockStyle.Fill};
        var overview=Page(tabs,"Visão geral");
        var credentials=Page(tabs,"Conta NeoPep");
        var computer=Page(tabs,"Computador");
        var diagnostics=Page(tabs,"Diagnóstico");
        var settings=Page(tabs,"Configurações");
        var title=new Label{Text="NeoPep Connect",ForeColor=Color.FromArgb(236,193,112),Font=new Font("Segoe UI",21),AutoSize=true};
        overview.Controls.Add(title);
        overview.Controls.Add(new Label{Text=ConnectProfile.EnvironmentName+" • versão "+Version+" • configuração automática",AutoSize=true});
        overview.Controls.Add(new Label{Text=ConnectProfile.ConnectEnabled?"Conexão NeoPep • provedor simulado":"Produção preparada • Connect ainda não habilitado no servidor",AutoSize=true});
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
        computer.Controls.Add(new Label{Text="Gerencie a aprovação do computador pelo painel de homologação.",AutoSize=true});
        var whatsAppPage=Page(tabs,"WhatsApp");
        whatsAppPage.Controls.Add(new Label{Text="Integração experimental. Use somente conta própria de teste.",AutoSize=true});
        var groupsPage=Page(tabs,"Grupos");
        groupsPage.Controls.Add(new Label{Text="Consulte apenas o nome e a contagem dos grupos da conta conectada.",AutoSize=true});
        var pairing=Button("Abrir conexão WhatsApp");var groupList=Button("Abrir consulta de grupos");
        pairing.Enabled=groupList.Enabled=ConnectProfile.ConnectEnabled&&ConnectProfile.IsValid;
        pairing.Click+=delegate {OpenWhatsApp(false);};
        groupList.Click+=delegate {OpenWhatsApp(true);};
        whatsAppPage.Controls.Add(pairing);groupsPage.Controls.Add(groupList);
        login.Enabled=ConnectProfile.ConnectEnabled && ConnectProfile.IsValid;
        var loginFeedback=new Label{AutoSize=true,MaximumSize=new Size(420,0)};
        login.Click+=async delegate {
            if(busy)return;
            login.Enabled=false;
            try {await Login();loginFeedback.Text=state.Text;}
            finally{login.Enabled=ConnectProfile.ConnectEnabled&&ConnectProfile.IsValid;}
        };
        credentials.Controls.Add(loginFeedback);
        diagnose.Click+=delegate {statusLog.Text=File.Exists(log)?File.ReadAllText(log):"Sem eventos registrados.";};
        open.Enabled=!String.IsNullOrEmpty(ConnectProfile.PanelUrl);
        open.Click+=delegate {if(!String.IsNullOrEmpty(ConnectProfile.PanelUrl))Process.Start(ConnectProfile.PanelUrl);};
        credentials.Controls.Add(login);actions.Controls.Add(open);overview.Controls.Add(actions);
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
        settings.Controls.Add(startup);state.AutoSize=true;overview.Controls.Add(state);
        LoadVault();local.Remove("key");
        InitUpdates(tabs);
        foreach(TabPage tab in tabs.TabPages) {
            if(tab==tabs.TabPages[0])continue;
            var back=Button("Voltar");back.Dock=DockStyle.Bottom;back.Click+=delegate{tabs.SelectedIndex=0;};
            tab.Controls.Add(back);back.BringToFront();
        }
        Controls.Add(tabs);
        tray.Icon=SystemIcons.Application;tray.Text=ConnectProfile.AppName;tray.Visible=true;
        var menu=new ContextMenuStrip();
        menu.Items.Add("Abrir",null,delegate {Show();Activate();});menu.Items.Add("Sair",null,delegate {exiting=true;Close();});
        tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate {Show();Activate();};
        FormClosing+=delegate(object sender,FormClosingEventArgs e) {
            if(!exiting&&e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();return;}
            timer.Stop();tray.Dispose();
        };
        state.Text=!ConnectProfile.IsValid?"Configuração inválida. Instale uma versão oficial.":!ConnectProfile.ConnectEnabled?"Produção preparada • Connect ainda não habilitado.":String.IsNullOrEmpty(Value(local,"refresh_token"))?"Entre para registrar este computador.":"Aguardando estado do computador.";
        timer.Interval=12000;timer.Tick+=async delegate {await Tick();};timer.Start();
        Shown+=async delegate {if(background)Hide();await Tick();await CheckUpdate(false);};
    }

    void OpenWhatsApp(bool groups){
        whatsappOpen=true;
        try{using(var window=new WhatsApp(Folder,groups))window.ShowDialog(this);}
        finally{whatsappOpen=false;}
    }

    static TableLayoutPanel Page(TabControl tabs,string title) {
        var page=new TabPage(title){BackColor=Color.FromArgb(23,22,19),ForeColor=Color.Gainsboro};
        var content=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(22),ColumnCount=1,AutoScroll=true};
        content.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        page.Controls.Add(content);tabs.TabPages.Add(page);return content;
    }

    static void AddField(TableLayoutPanel panel,string text,Control control) {
        panel.Controls.Add(new Label{Text=text,AutoSize=true});control.Dock=DockStyle.Top;panel.Controls.Add(control);
    }
    static Button Button(string text) {
        return new Button{Text=text,AutoSize=true,BackColor=Color.FromArgb(234,192,111),ForeColor=Color.FromArgb(30,24,15)};
    }
    static string Value(Dictionary<string,object> row,string name) {
        object value; return row!=null&&row.TryGetValue(name,out value)&&value!=null?Convert.ToString(value):"";
    }
    void LoadVault() {
        if(!File.Exists(vault))return;
        try {local=json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(vault),null,DataProtectionScope.CurrentUser)));}
        catch(CryptographicException){Record("cofre_indisponivel");}
    }
    void Save() {
        byte[] data=ProtectedData.Protect(Encoding.UTF8.GetBytes(json.Serialize(local)),null,DataProtectionScope.CurrentUser);
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
    async Task<Dictionary<string,object>> Post(string route, object data, bool session) {
        if(!ConnectProfile.ConnectEnabled||!ConnectProfile.IsValid)throw new InvalidOperationException();
        using(var client=route=="/functions/v1/connect-update"?new UpdateBrokerClient():new WebClient()) {
            client.Proxy=WebRequest.DefaultWebProxy;
            client.Encoding=Encoding.UTF8;
            client.Headers["Content-Type"]="application/json";client.Headers["apikey"]=ConnectProfile.PublishableKey;
            if(session)client.Headers["Authorization"]="Bearer "+access;
            string result=await client.UploadStringTaskAsync(new Uri(Origin+route),"POST",json.Serialize(data));
            return json.Deserialize<Dictionary<string,object>>(result);
        }
    }
    async Task Tokens(string grant,object credentials,bool persist=true) {
        var result=await Post("/auth/v1/token?grant_type="+grant,credentials,false);
        var nextAccess=Value(result,"access_token");var nextRefresh=Value(result,"refresh_token");
        if(String.IsNullOrEmpty(nextAccess)||String.IsNullOrEmpty(nextRefresh))throw new InvalidOperationException();
        access=nextAccess;expires=DateTime.UtcNow.AddSeconds(Convert.ToInt32(result["expires_in"])-60);
        local["refresh_token"]=nextRefresh;if(persist)Save();
    }
    Task<Dictionary<string,object>> RPC(string action,object data) {
        var device=Value(local,"device");
        return Post("/rest/v1/rpc/neo_connect_device",new {
            p_action=action,p_device=String.IsNullOrEmpty(device)?null:device,p_secret=Value(local,"secret"),p_data=data
        },true);
    }
    async Task Login() {
        if(busy || !ConnectProfile.ConnectEnabled)return;busy=true;
        var previous=new Dictionary<string,object>(local);
        try {
            if(!ConnectProfile.IsValid)throw new InvalidOperationException();
            await Tokens("password",new {email=email.Text.Trim(),password=password.Text},false);
            if(!String.IsNullOrEmpty(Value(local,"device"))){
                var identity=Value(local,"account");
                var heartbeat=await RPC("heartbeat",new {version=Version,working_set_mb=Environment.WorkingSet/1048576,
                    account=String.IsNullOrEmpty(identity)?null:identity});
                Save();RenderAccounts(heartbeat);
                state.Text=Value(heartbeat,"state")=="approved"?"Computador autorizado • simulação":"Aprovação pendente.";
            }else{
                var buffer=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(buffer);
                local["secret"]=BitConverter.ToString(buffer).Replace("-","").ToLowerInvariant();
                await Register();
            }
        } catch(Exception) {
            local=previous;access=null;
            state.Text="Falha no login. Use a conta administrativa que autorizou este computador.";
            Record("login_ou_registro_falhou");
        }
        finally {password.Clear();busy=false;}
    }
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
        var list=data["accounts"] as System.Collections.IEnumerable;
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
        if(!ConnectProfile.ConnectEnabled||!ConnectProfile.IsValid||busy||String.IsNullOrEmpty(Value(local,"refresh_token")))return;
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
            if(Value(heartbeat,"state")!="approved"){state.Text="Aprovação pendente.";return;}
            state.Text="Computador autorizado • simulação";
            var reminders=await RPC("reminders",new { });
            var entries=reminders["items"] as System.Collections.ICollection;
            if(entries!=null&&entries.Count>0) {
                tray.BalloonTipTitle="NeoPep Connect";
                tray.BalloonTipText="Há divulgações manuais previstas. Consulte o painel.";
                tray.ShowBalloonTip(5000);
            }
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
                state.Text="Sessão ou computador sem autorização.";access=null;
            } else state.Text="Conexão indisponível. Nova tentativa automática.";
            Record("comunicacao_indisponivel");
        } catch(Exception){state.Text="Falha local. Consulte o diagnóstico.";Record("falha_local");}
        finally{busy=false;}
    }
}
