using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

sealed class WhatsApp : Form {
    static readonly Encoding Utf8=new UTF8Encoding(false);
    readonly string vault;
    readonly string runtime;
    readonly TabControl tabs=new TabControl();
    readonly Label connection=new Label(),summary=new Label(),diagnostic=new Label();
    readonly PictureBox qr=new PictureBox();
    Button pair,disconnect;
    readonly ListView groups=new ListView();
    readonly JavaScriptSerializer json=new JavaScriptSerializer { MaxJsonLength=16*1024*1024 };
    Process process;
    StreamWriter pipe;
    bool closing,forgetting,ready;
    int generation;

    public WhatsApp(string profile,bool showGroups=false) {
        vault=Path.Combine(profile,"whatsapp-session.dat");
        runtime=Path.Combine(profile,ConnectVersion.Runtime);
        Text="NeoPep Connect • WhatsApp experimental"; Size=new Size(620,600); MinimumSize=new Size(460,510); AutoScaleMode=AutoScaleMode.Dpi;
        BackColor=Color.FromArgb(23,22,19); ForeColor=Color.Gainsboro; Font=new Font("Segoe UI",10);
        tabs.Dock=DockStyle.Fill;
        var status=Page("Estado");status.Controls.Add(LabelOf("Homologação. Use somente um número próprio de teste. O agente simulado funciona separadamente."));
        summary.Text="WhatsApp desconectado.";Format(summary);status.Controls.Add(summary);
        var pairing=Page("Conexão WhatsApp");pairing.Controls.Add(LabelOf("No telefone de teste, abra Dispositivos conectados e escaneie o QR Code desta janela."));
        pair=Action("Conectar WhatsApp",ConnectSession);
        disconnect=Action("Desconectar WhatsApp",Disconnect);
        var actions=new FlowLayoutPanel{AutoSize=true,Dock=DockStyle.Top};actions.Controls.Add(pair);actions.Controls.Add(disconnect);
        pairing.Controls.Add(actions);Format(connection);connection.Text="Desconectado.";pairing.Controls.Add(connection);
        qr.Size=new Size(270,270);qr.SizeMode=PictureBoxSizeMode.Zoom;qr.AccessibleName="QR Code temporário do WhatsApp";pairing.Controls.Add(qr);
        var listing=new TabPage("Grupos"){BackColor=Color.FromArgb(23,22,19),ForeColor=Color.Gainsboro};tabs.TabPages.Add(listing);
        groups.Dock=DockStyle.Fill;groups.BackColor=Color.FromArgb(36,33,27);groups.ForeColor=Color.Gainsboro;groups.View=View.Details;groups.FullRowSelect=true;
        groups.Columns.Add("Grupo",300);groups.Columns.Add("Participantes",110);
        var refresh=Action("Atualizar grupos",delegate{if(ready)Send("groups",null);else Notify("Conecte o WhatsApp para consultar grupos.");});
        refresh.Dock=DockStyle.Top;listing.Controls.Add(groups);listing.Controls.Add(refresh);
        var diagnostics=Page("Diagnóstico");Format(diagnostic);
        diagnostic.Text="A conexão e o QR Code ficam neste computador. Os diagnósticos mostram apenas estados e erros genéricos.";diagnostics.Controls.Add(diagnostic);
        var back=Action("Voltar",Close);back.Dock=DockStyle.Bottom;
        Controls.Add(tabs);Controls.Add(back);if(showGroups)tabs.SelectedTab=listing;
        FormClosing+=delegate{closing=true;StopBridge();ClearQr();};
    }
    FlowLayoutPanel Page(string name) {
        var page=new TabPage(name){BackColor=Color.FromArgb(23,22,19),ForeColor=Color.Gainsboro};tabs.TabPages.Add(page);
        var panel=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new Padding(12)};
        page.Controls.Add(panel);return panel;
    }
    static void Format(Label value){value.AutoSize=true;value.MaximumSize=new Size(370,0);value.ForeColor=Color.FromArgb(245,232,207);}
    static Label LabelOf(string text){var label=new Label{Text=text};Format(label);return label;}
    static Button Action(string label,System.Action handler){
        var button=new Button{Text=label,AutoSize=true,BackColor=Color.FromArgb(234,192,111),ForeColor=Color.FromArgb(30,24,15)};
        button.Click+=delegate{handler();};return button;
    }
    void Notify(string text){
        connection.Text=text;summary.Text=text;diagnostic.Text=text;
        pair.Enabled=ConnectProfile.ConnectEnabled&&process==null&&!forgetting;
        disconnect.Enabled=ConnectProfile.ConnectEnabled&&!forgetting;
    }
    void ClearQr(){var previous=qr.Image;qr.Image=null;if(previous!=null)previous.Dispose();}
    string OpenVault(){
        if(!File.Exists(vault))return null;
        return Utf8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(vault),null,DataProtectionScope.CurrentUser));
    }
    void WriteVault(string value){
        if(value==null){File.Delete(vault);File.Delete(vault+".new");return;}
        File.WriteAllBytes(vault+".new",ProtectedData.Protect(Utf8.GetBytes(value),null,DataProtectionScope.CurrentUser));
        if(File.Exists(vault))File.Replace(vault+".new",vault,null);else File.Move(vault+".new",vault);
    }
    void ConnectSession(){
        if(!ConnectProfile.ConnectEnabled||forgetting||ready||process!=null)return;
        try{
            string existing=OpenVault();
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
        }catch{StopBridge();Notify("Não foi possível iniciar ou ler a sessão protegida. Confira a instalação ou use Desconectar.");}
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
        if(!ConnectProfile.ConnectEnabled||forgetting)return;
        forgetting=true;ready=false;ClearQr();groups.Items.Clear();
        try{
            WriteVault(null);
            if(process==null){forgetting=false;Notify("Sessão local removida. Se houver vínculo remoto, remova-o em Dispositivos conectados no telefone.");return;}
            Notify("Encerrando e solicitando revogação…");Send("disconnect",null);
        }catch{StopBridge();Notify("Não foi possível apagar o cofre local. Confira as permissões do perfil do Windows.");}
    }
    static string TextValue(Dictionary<string,object> values,string key){object value;return values.TryGetValue(key,out value)?Convert.ToString(value):"";}
    void Receive(string line){
        if(closing||line.Length>16*1024*1024)return;
        try{
            var message=json.Deserialize<Dictionary<string,object>>(line);
            string type=TextValue(message,"type"),value=TextValue(message,"value");
            if(type=="vault"){
                if(message["value"]==null)WriteVault(null);
                else if(!forgetting)WriteVault(value);
            }else if(type=="state"){
                ready=value=="conectado";
                if(value!="aguardando_qr")ClearQr();
                if(!ready)groups.Items.Clear();
                switch(value){
                    case "conectando": Notify("Conectando…");break;
                    case "aguardando_qr": Notify("Escaneie o QR Code no telefone de teste.");break;
                    case "conectado": Notify("WhatsApp conectado. Consulte os grupos na aba Grupos.");break;
                    case "reconectando": Notify("Rede interrompida. Reconectando…");break;
                    case "desconectando": break;
                    case "desconectado": StopBridge();Notify("Sessão desconectada e removida.");break;
                    case "limpeza_local": StopBridge();Notify("Sessão local removida. Revogue também em Dispositivos conectados no telefone.");break;
                    case "revogado": StopBridge();Notify("Vínculo revogado pelo WhatsApp. Conecte novamente para gerar outro QR.");break;
                    case "sessao_substituida": StopBridge();Notify("Sessão substituída em outro dispositivo. Confira o telefone antes de reconectar.");break;
                    default: StopBridge();Notify("Conexão indisponível. Confira a rede e tente novamente.");break;
                }
            }else if(type=="qr"&&!forgetting&&!ready&&value.Length<500000){
                using(var data=new MemoryStream(Convert.FromBase64String(value)))
                using(var image=Image.FromStream(data)){ClearQr();qr.Image=new Bitmap(image);}
            }else if(type=="groups"&&ready&&!forgetting){
                groups.Items.Clear();
                var rows=message["value"] as IEnumerable;
                if(rows!=null)foreach(Dictionary<string,object> item in rows){
                    var row=new ListViewItem(TextValue(item,"name"));row.SubItems.Add(TextValue(item,"members"));groups.Items.Add(row);
                }
            }else if(type=="error"&&value=="grupos_indisponiveis")Notify("Não foi possível consultar grupos. Tente novamente.");
        }catch{StopBridge();Notify("Não foi possível processar a sessão local protegida.");}
    }
    void StopBridge(){
        ++generation;ready=false;forgetting=false;
        if(pipe!=null){try{pipe.Dispose();}catch{}pipe=null;}
        var child=process;process=null;
        if(child!=null){
            try{if(!child.WaitForExit(200))child.Kill();}catch(InvalidOperationException){}
            child.Dispose();
        }
        ClearQr();groups.Items.Clear();
    }
}
