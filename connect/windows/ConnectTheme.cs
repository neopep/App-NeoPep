using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Reflection;
using System.Windows.Forms;

// Identidade visual desktop do NeoPep: superfícies escuras, acento champagne e foco visível.
// Compatível com .NET Framework/WinForms, sem dependências externas.
internal static class ConnectTheme {
    internal static Color Background,Surface,Raised,Accent,Text,Muted,Stroke;
    internal static bool Light;
    static ConnectTheme(){Select("Escuro");}
    internal static void Select(string mode){
        Light=mode=="Claro"||(mode=="Seguir sistema"&&SystemColors.Window.GetBrightness()>.5f);
        Background=Light?Color.FromArgb(246,244,239):Color.FromArgb(19,22,27);
        Surface=Light?Color.White:Color.FromArgb(29,34,41);
        Raised=Light?Color.FromArgb(242,236,222):Color.FromArgb(37,43,51);
        Accent=Light?Color.FromArgb(105,72,27):Color.FromArgb(213,182,125);
        Text=Light?Color.FromArgb(36,29,23):Color.FromArgb(240,238,233);
        Muted=Light?Color.FromArgb(87,75,63):Color.FromArgb(175,182,190);
        Stroke=Light?Color.FromArgb(202,189,171):Color.FromArgb(69,74,81);
    }
    internal static Panel Card(int width,int height){
        var card=new Panel{Width=width,Height=height,Tag="surface",BackColor=Surface};
        Round(card);
        return card;
    }
    static void Round(Panel panel){
        panel.SizeChanged+=delegate{
            if(panel.Width<20||panel.Height<20)return;
            using(var path=new GraphicsPath()){
                int d=18,w=panel.Width,h=panel.Height;
                path.AddArc(0,0,d,d,180,90);path.AddArc(w-d,0,d,d,270,90);
                path.AddArc(w-d,h-d,d,d,0,90);path.AddArc(0,h-d,d,d,90,90);path.CloseFigure();
                var previous=panel.Region;panel.Region=new Region(path);if(previous!=null)previous.Dispose();
            }
        };
        panel.Size=new Size(panel.Width+1,panel.Height);
        panel.Width--;
    }
    internal static void Restyle(Form window){
        window.BackColor=Background;window.ForeColor=Text;
        ApplyContent(window);window.Invalidate(true);
    }
    internal static void Apply(Form window,TabControl tabs){
        window.BackColor=Background;
        window.ForeColor=Text;
        window.Font=new Font("Segoe UI Variable Text",10f);
        window.MinimumSize=new Size(Math.Max(window.MinimumSize.Width,940),Math.Max(window.MinimumSize.Height,570));
        window.Size=new Size(Math.Max(window.Width,1040),Math.Max(window.Height,720));
        window.Padding=new Padding(10);
        tabs.DrawMode=TabDrawMode.OwnerDrawFixed;
        tabs.SizeMode=TabSizeMode.Fixed;
        tabs.ItemSize=new Size(144,38);
        tabs.Padding=new Point(15,7);
        tabs.BackColor=Background;
        tabs.ForeColor=Text;
        tabs.DrawItem+=(sender,args)=>{
            bool selected=(args.State & DrawItemState.Selected)==DrawItemState.Selected;
            var r=args.Bounds;
            using(var bg=new SolidBrush(selected?Raised:Background))args.Graphics.FillRectangle(bg,r);
            if(selected){
                using(var pen=new Pen(Accent,3))args.Graphics.DrawLine(pen,r.Left+8,r.Bottom-2,r.Right-8,r.Bottom-2);
            }
            using(var font=new Font(window.Font,selected?FontStyle.Bold:FontStyle.Regular))
            TextRenderer.DrawText(args.Graphics,tabs.TabPages[args.Index].Text,
                font,
                r,selected?Accent:Muted,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);
        };
        tabs.SelectedIndexChanged+=(sender,args)=>tabs.Invalidate();
    }

    internal static void ApplyContent(Control root){
        foreach(Control control in root.Controls){
            var tag=control.Tag as string;
            if(tag=="surface")control.BackColor=Surface;
            if(tag=="canvas")control.BackColor=Background;
            if(tag=="balloon")control.BackColor=Light?Color.FromArgb(214,239,215):Color.FromArgb(24,77,65);
            var page=control as TabPage;
            if(page!=null){page.BackColor=Background;page.ForeColor=Text;}
            var label=control as Label;
            if(label!=null){
                label.ForeColor=tag=="accent"?Accent:tag=="message"?Text:Muted;
                label.Margin=new Padding(8,10,8,8);
            }
            var button=control as Button;
            if(button!=null){
                button.FlatStyle=FlatStyle.Flat;
                button.FlatAppearance.BorderSize=1;
                button.FlatAppearance.BorderColor=Stroke;
                button.BackColor=Raised;
                button.ForeColor=Text;
                button.Padding=new Padding(14,7,14,7);
                button.Cursor=Cursors.Hand;
                button.MinimumSize=new Size(0,36);
                button.Margin=new Padding(7,7,7,7);
                if(tag=="primary"){button.BackColor=Accent;button.ForeColor=Background;}
                if(tag=="navigation"){button.BackColor=Surface;button.FlatAppearance.BorderSize=0;}
            }
            var textbox=control as TextBox;
            if(textbox!=null){
                textbox.BackColor=Surface;
                textbox.ForeColor=Text;
                textbox.BorderStyle=BorderStyle.FixedSingle;
                textbox.Margin=new Padding(8,8,8,10);
            }
            var dropdown=control as ComboBox;
            if(dropdown!=null){
                dropdown.BackColor=Surface;
                dropdown.ForeColor=Text;
                dropdown.FlatStyle=FlatStyle.Flat;
                dropdown.Margin=new Padding(8,8,8,10);
            }
            var list=control as ListView;
            if(list!=null){
                list.BackColor=Surface;list.ForeColor=Text;list.BorderStyle=BorderStyle.None;
            }
            ApplyContent(control);
        }
    }

    // Casca desktop: navegação fixa à esquerda, conteúdo original preservado à direita.
    internal static Control BuildShell(TabControl tabs,string title){
        tabs.Appearance=TabAppearance.FlatButtons;
        tabs.DrawMode=TabDrawMode.Normal;
        tabs.SizeMode=TabSizeMode.Fixed;
        tabs.ItemSize=new Size(0,1);
        tabs.Dock=DockStyle.Fill;

        var shell=new TableLayoutPanel{Tag="canvas",Dock=DockStyle.Fill,ColumnCount=2,RowCount=1,
            BackColor=Background,Margin=new Padding(0),Padding=new Padding(0)};
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,218));
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        shell.RowStyles.Add(new RowStyle(SizeType.Percent,100));

        var sidebar=new Panel{Tag="surface",Dock=DockStyle.Fill,BackColor=Surface,
            Padding=new Padding(13,18,10,12),Margin=new Padding(0,0,10,0)};
        var brand=new Label{Tag="accent",Text=title,Font=new Font("Segoe UI Semibold",17,FontStyle.Bold),
            ForeColor=Accent,Height=54,Dock=DockStyle.Top,TextAlign=ContentAlignment.MiddleLeft};
        var navigation=new FlowLayoutPanel{Tag="surface",Dock=DockStyle.Fill,
            AutoScroll=true,FlowDirection=FlowDirection.TopDown,WrapContents=false,
            BackColor=Surface,Padding=new Padding(0,18,0,4)};
        var buttons=new System.Collections.Generic.Dictionary<TabPage,Button>();
        foreach(TabPage page in tabs.TabPages){
            var target=page;
            var button=new Button{Tag="navigation",Text=target.Text,Width=186,Height=45,
                TextAlign=ContentAlignment.MiddleLeft,FlatStyle=FlatStyle.Flat,
                BackColor=Surface,ForeColor=Muted,
                Font=new Font("Segoe UI",10,FontStyle.Regular),
                Margin=new Padding(0,0,0,7),Padding=new Padding(12,0,0,0),
                Cursor=Cursors.Hand};
            button.FlatAppearance.BorderSize=0;
            button.Click+=(sender,args)=>tabs.SelectedTab=target;
            buttons.Add(target,button);
            navigation.Controls.Add(button);
        }
        System.Action refresh=()=>{
            foreach(var pair in buttons){
                bool active=tabs.SelectedTab==pair.Key;
                pair.Value.BackColor=active?Raised:Surface;
                pair.Value.ForeColor=active?Accent:Muted;
                pair.Value.Font=new Font("Segoe UI",10,active?FontStyle.Bold:FontStyle.Regular);
            }
        };
        tabs.SelectedIndexChanged+=(sender,args)=>refresh();
        sidebar.Controls.Add(navigation);
        sidebar.Controls.Add(brand);
        using(var source=Assembly.GetExecutingAssembly().GetManifestResourceStream("NeoPepBrand")){
            if(source!=null)using(var image=Image.FromStream(source)){
                var logo=new PictureBox{Image=new Bitmap(image),Height=56,Dock=DockStyle.Top,SizeMode=PictureBoxSizeMode.Zoom,AccessibleName="Logo NeoPep"};
                logo.Disposed+=delegate{logo.Image.Dispose();};sidebar.Controls.Add(logo);
            }
        }
        shell.Controls.Add(sidebar,0,0);
        shell.Controls.Add(tabs,1,0);
        refresh();
        return shell;
    }

    internal static void Primary(Button button){
        button.Tag="primary";button.BackColor=Accent;
        button.ForeColor=Background;
        button.FlatAppearance.BorderColor=Accent;
        button.Font=new Font("Segoe UI Semibold",10f,FontStyle.Bold);
    }
}
