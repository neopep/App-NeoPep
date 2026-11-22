using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

sealed partial class WhatsApp {
    readonly TextBox destinationSearch=new TextBox(),campaignTitle=new TextBox(),campaignCta=new TextBox(),sourceSearch=new TextBox();
    readonly ComboBox sourceKind=new ComboBox(),sourceItems=new ComboBox();
    readonly PictureBox picturePreview=new PictureBox();
    readonly Label phoneGroup=new Label(),mediaStatus=new Label(),scheduleStatus=new Label();
    readonly DateTimePicker scheduleDate=new DateTimePicker();
    readonly Func<string,string,Task<Dictionary<string,object>[]>> loadSources;
    byte[] campaignImage;
    DateTime? scheduledUtc;
    bool dueShown,loadingSources;

    TabPage BuildCampaignPage(){
        var page=new TabPage("Publicar");
        tabs.TabPages.Add(page);
        var layout=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=1,Padding=new Padding(10)};
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,275));
        page.Controls.Add(layout);
        var editor=CampaignColumn();
        layout.Controls.Add(editor,0,0);
        editor.Controls.Add(LabelOf("Destino • selecione primeiro na aba Grupos"));
        destinationSearch.Width=325;destinationSearch.AccessibleName="Buscar destino selecionado";
        targetGroup.Width=325;targetGroup.DropDownStyle=ComboBoxStyle.DropDownList;
        destinationSearch.TextChanged+=delegate{RefreshComposerGroups();};
        targetGroup.SelectedIndexChanged+=delegate{UpdateComposer();};
        editor.Controls.Add(destinationSearch);editor.Controls.Add(targetGroup);
        editor.Controls.Add(LabelOf("Origem do conteúdo"));
        sourceKind.DropDownStyle=ComboBoxStyle.DropDownList;
        sourceKind.Items.AddRange(new object[]{"Criar manualmente","Produto do app","Oferta do app","Campanha do painel","Rascunho salvo"});
        sourceKind.SelectedIndex=0;sourceKind.Width=325;
        sourceKind.SelectedIndexChanged+=delegate{sourceItems.Items.Clear();};
        sourceSearch.Width=325;sourceSearch.AccessibleName="Pesquisar catálogo";
        sourceItems.Width=325;sourceItems.DropDownStyle=ComboBoxStyle.DropDownList;
        editor.Controls.Add(sourceKind);editor.Controls.Add(sourceSearch);
        var searchButton=new Button{Text="Consultar origem",AutoSize=true};
        searchButton.Click+=async delegate{await SearchCampaignSources();};
        editor.Controls.Add(searchButton);editor.Controls.Add(sourceItems);
        editor.Controls.Add(Action("Usar conteúdo selecionado",UseCampaignSource));
        ConfigureField(editor,"Título opcional",campaignTitle,120);
        ConfigureField(editor,"Mensagem",messageText,2000);messageText.Multiline=true;
        messageText.Height=100;messageText.ScrollBars=ScrollBars.Vertical;
        ConfigureField(editor,"CTA opcional",campaignCta,240);
        editor.Controls.Add(CampaignActions(Action("Escolher imagem",ChooseCampaignImage),Action("Remover imagem",delegate{SetCampaignImage(null);})));
        Format(mediaStatus);editor.Controls.Add(mediaStatus);
        editor.Controls.Add(LabelOf("Programação local • horário do Windows"));
        scheduleDate.Format=DateTimePickerFormat.Custom;scheduleDate.CustomFormat="dd/MM/yyyy HH:mm";
        scheduleDate.Width=220;scheduleDate.Value=DateTime.Now.AddMinutes(10);
        editor.Controls.Add(scheduleDate);
        editor.Controls.Add(CampaignActions(Action("Agendar revisão",ScheduleCampaign),Action("Cancelar agendamento",CancelSchedule)));
        Format(scheduleStatus);editor.Controls.Add(scheduleStatus);
        editor.Controls.Add(CampaignActions(Action("Salvar rascunho",SaveDraft),Action("Reabrir rascunho",LoadDraft)));
        sendTextButton=Action("Revisar e publicar agora",PublishManualText);sendTextButton.Enabled=false;
        editor.Controls.Add(sendTextButton);
        Format(sendStatus);editor.Controls.Add(sendStatus);
        sendStatus.Text="Conecte o WhatsApp e consulte os grupos para publicar.";
        var phone=CampaignColumn();phone.Tag="surface";phone.Padding=new Padding(10);
        layout.Controls.Add(phone,1,0);
        Format(phoneGroup);phoneGroup.Tag="accent";phone.Controls.Add(phoneGroup);
        var bubble=CampaignColumn();bubble.Tag="balloon";bubble.Dock=DockStyle.None;
        bubble.AutoSize=true;bubble.Width=224;bubble.Padding=new Padding(7);
        picturePreview.Width=205;picturePreview.Height=130;picturePreview.Visible=false;picturePreview.SizeMode=PictureBoxSizeMode.Zoom;
        bubble.Controls.Add(picturePreview);
        Format(previewText);previewText.Tag="message";previewText.MaximumSize=new Size(205,0);
        bubble.Controls.Add(previewText);phone.Controls.Add(bubble);
        phone.Controls.Add(LabelOf("Prévia da mensagem"));
        var timer=new Timer{Interval=15000};
        timer.Tick+=delegate{ShowSchedule();};timer.Start();
        FormClosed+=delegate{timer.Dispose();if(picturePreview.Image!=null)picturePreview.Image.Dispose();};
        UpdatePhone();ShowSchedule();
        return page;
    }
    static FlowLayoutPanel CampaignColumn(){
        return new FlowLayoutPanel{Dock=DockStyle.Fill,AutoScroll=true,FlowDirection=FlowDirection.TopDown,WrapContents=false};
    }
    static FlowLayoutPanel CampaignActions(params Control[] buttons){
        var row=new FlowLayoutPanel{AutoSize=true,WrapContents=false};
        row.Controls.AddRange(buttons);return row;
    }
    void ConfigureField(FlowLayoutPanel panel,string label,TextBox field,int max){
        panel.Controls.Add(LabelOf(label));field.AccessibleName=label;field.Width=325;field.MaxLength=max;
        field.TextChanged+=delegate{UpdateComposer();};panel.Controls.Add(field);
    }
    string CampaignText(){
        var lines=new List<string>();
        foreach(string part in new[]{campaignTitle.Text,messageText.Text,campaignCta.Text})
            if(!String.IsNullOrWhiteSpace(part))lines.Add(part.Trim());
        return String.Join("\r\n\r\n",lines);
    }
    void UpdatePhone(){
        var group=targetGroup.SelectedItem as GroupChoice;
        phoneGroup.Text=group==null?"Grupo de destino":group.Name;
        string text=CampaignText();previewText.Text=text.Length==0?"Sua mensagem aparecerá aqui.":text;
        mediaStatus.Text=text.Length>2000?"Reduza o conteúdo total para 2.000 caracteres.":
            campaignImage!=null?"Imagem JPEG anexada. A publicação precisa da sua confirmação.":"Adicione uma imagem se desejar.";
    }
    void ChooseCampaignImage(){
        using(var picker=new OpenFileDialog{Filter="Imagens (*.jpg;*.jpeg;*.png)|*.jpg;*.jpeg;*.png",CheckFileExists=true}){
            if(picker.ShowDialog(this)!=DialogResult.OK)return;
            try{
                var file=new FileInfo(picker.FileName);
                if(file.Length>8*1024*1024)throw new IOException();
                using(var source=Image.FromFile(file.FullName)){
                    if(source.RawFormat.Guid!=ImageFormat.Jpeg.Guid&&source.RawFormat.Guid!=ImageFormat.Png.Guid)throw new IOException();
                    if((long)source.Width*source.Height>20000000)throw new IOException();
                    double scale=Math.Min(1.0,720.0/Math.Max(source.Width,source.Height));
                    using(var bitmap=new Bitmap(Math.Max(1,(int)(source.Width*scale)),Math.Max(1,(int)(source.Height*scale))))
                    using(var output=new MemoryStream()){
                        using(var graphics=Graphics.FromImage(bitmap)){graphics.Clear(Color.White);graphics.DrawImage(source,0,0,bitmap.Width,bitmap.Height);}
                        bitmap.Save(output,ImageFormat.Jpeg);SetCampaignImage(output.ToArray());
                    }
                }
            }catch{mediaStatus.Text="Não foi possível preparar a imagem. Use JPEG ou PNG de até 8 MiB.";}
        }
    }
    void SetCampaignImage(byte[] bytes){
        Image replacement=null;
        if(bytes!=null){
            if(bytes.Length>1024*1024)throw new IOException();
            using(var data=new MemoryStream(bytes))
            using(var decoded=Image.FromStream(data)){replacement=new Bitmap(decoded);}
        }
        var previous=picturePreview.Image;
        picturePreview.Image=replacement;picturePreview.Visible=replacement!=null;
        if(previous!=null)previous.Dispose();
        campaignImage=bytes;UpdateComposer();
    }
    void RestoreCampaignMedia(string image,string due){
        SetCampaignImage(String.IsNullOrEmpty(image)?null:Convert.FromBase64String(image));
        DateTime date;
        scheduledUtc=DateTime.TryParseExact(due,"o",CultureInfo.InvariantCulture,DateTimeStyles.RoundtripKind,out date)?(DateTime?)date.ToUniversalTime():null;
        if(scheduledUtc.HasValue)scheduleDate.Value=scheduledUtc.Value.ToLocalTime();
        dueShown=false;ShowSchedule();
    }
    void ScheduleCampaign(){
        if(!(targetGroup.SelectedItem is GroupChoice)||(campaignImage==null&&String.IsNullOrWhiteSpace(CampaignText()))){
            scheduleStatus.Text="Escolha o grupo e informe o conteúdo antes de agendar.";return;
        }
        var local=DateTime.SpecifyKind(scheduleDate.Value,DateTimeKind.Unspecified);
        if(TimeZoneInfo.Local.IsInvalidTime(local)||TimeZoneInfo.Local.IsAmbiguousTime(local)){
            scheduleStatus.Text="Escolha um horário sem conflito de fuso no Windows.";return;
        }
        var utc=TimeZoneInfo.ConvertTimeToUtc(local);
        if(utc<=DateTime.UtcNow){scheduleStatus.Text="Escolha uma data futura.";return;}
        var previous=scheduledUtc;
        scheduledUtc=utc;
        if(!SaveCampaignDraft()){scheduledUtc=previous;return;}
        dueShown=false;ShowSchedule();
    }
    void CancelSchedule(){
        var previous=scheduledUtc;
        scheduledUtc=null;
        if(!SaveCampaignDraft()){scheduledUtc=previous;return;}
        ShowSchedule();
    }
    void ShowSchedule(){
        bool due=scheduledUtc.HasValue&&scheduledUtc.Value<=DateTime.UtcNow;
        scheduleStatus.Text=!scheduledUtc.HasValue?"Sem revisão programada.":due?"Revisão pendente. Confirme o envio manualmente.":
            "Revisão agendada para "+scheduledUtc.Value.ToLocalTime().ToString("g")+".";
        if(due&&!dueShown){dueShown=true;sendStatus.Text="Campanha pronta para revisão. O envio depende da sua confirmação.";}
    }
    async Task SearchCampaignSources(){
        if(loadingSources||sourceKind.SelectedIndex==0)return;
        if(sourceKind.SelectedIndex==4){LoadDraft();return;}
        if(loadSources==null)return;
        int selection=sourceKind.SelectedIndex;
        string kind=selection==1?"product":selection==2?"offer":"templates";
        loadingSources=true;sourceItems.Items.Clear();sendStatus.Text="Consultando conteúdo do NeoPep Teste…";
        try{
            var rows=await loadSources(kind,sourceSearch.Text);
            if(closing||sourceKind.SelectedIndex!=selection)return;
            foreach(var row in rows){
                string title=TextValue(row,kind=="templates"?"title":"label");
                if(!String.IsNullOrWhiteSpace(title)&&title.IndexOf(sourceSearch.Text.Trim(),StringComparison.CurrentCultureIgnoreCase)>=0)
                    sourceItems.Items.Add(new CampaignSource{Title=title,Body=TextValue(row,"body"),Cta=TextValue(row,"link_label")});
            }
            if(sourceItems.Items.Count>0)sourceItems.SelectedIndex=0;
            sendStatus.Text=sourceItems.Items.Count>0?"Selecione o conteúdo e revise antes de publicar.":"Nenhum conteúdo encontrado.";
        }catch{if(!closing)sendStatus.Text="Consulta indisponível. Confira a sessão administrativa do NeoPep Teste.";}
        finally{loadingSources=false;}
    }
    sealed class CampaignSource{
        internal string Title,Body,Cta;
        public override string ToString(){return Title;}
    }
    void UseCampaignSource(){
        var source=sourceItems.SelectedItem as CampaignSource;
        if(source==null)return;
        campaignTitle.Text=Limit(source.Title,120);messageText.Text=Limit(source.Body,2000);campaignCta.Text=Limit(source.Cta,240);
    }
    static string Limit(string value,int length){return value.Length<=length?value:value.Substring(0,length);}
}
