using System;
using System.Drawing;
using System.Windows.Forms;

// Identidade visual desktop do NeoPep: superfícies escuras, acento champagne e foco visível.
// Compatível com .NET Framework/WinForms, sem dependências externas.
internal static class ConnectTheme {
    internal static readonly Color Background=Color.FromArgb(19,22,27);
    internal static readonly Color Surface=Color.FromArgb(29,34,41);
    internal static readonly Color Raised=Color.FromArgb(37,43,51);
    internal static readonly Color Accent=Color.FromArgb(192,165,119);
    internal static readonly Color Text=Color.FromArgb(240,238,233);
    internal static readonly Color Muted=Color.FromArgb(175,182,190);
    internal static readonly Color Stroke=Color.FromArgb(69,74,81);

    internal static void Apply(Form window,TabControl tabs){
        window.BackColor=Background;
        window.ForeColor=Text;
        window.Font=new Font("Segoe UI",10f);
        window.MinimumSize=new Size(Math.Max(window.MinimumSize.Width,800),Math.Max(window.MinimumSize.Height,570));
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
            TextRenderer.DrawText(args.Graphics,tabs.TabPages[args.Index].Text,
                new Font(window.Font,selected?FontStyle.Bold:FontStyle.Regular),
                r,selected?Accent:Muted,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);
        };
        tabs.SelectedIndexChanged+=(sender,args)=>tabs.Invalidate();
    }

    internal static void ApplyContent(Control root){
        foreach(Control control in root.Controls){
            var page=control as TabPage;
            if(page!=null){page.BackColor=Background;page.ForeColor=Text;}
            var label=control as Label;
            if(label!=null){
                label.ForeColor=label.ForeColor==Color.Gainsboro||label.ForeColor==SystemColors.ControlText?Muted:label.ForeColor;
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

        var shell=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=1,
            BackColor=Background,Margin=new Padding(0),Padding=new Padding(0)};
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,218));
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        shell.RowStyles.Add(new RowStyle(SizeType.Percent,100));

        var sidebar=new Panel{Dock=DockStyle.Fill,BackColor=Surface,
            Padding=new Padding(13,18,10,12),Margin=new Padding(0,0,10,0)};
        var brand=new Label{Text=title,Font=new Font("Segoe UI Semibold",17,FontStyle.Bold),
            ForeColor=Accent,Height=54,Dock=DockStyle.Top,TextAlign=ContentAlignment.MiddleLeft};
        var navigation=new FlowLayoutPanel{Dock=DockStyle.Fill,
            AutoScroll=true,FlowDirection=FlowDirection.TopDown,WrapContents=false,
            BackColor=Surface,Padding=new Padding(0,18,0,4)};
        var buttons=new System.Collections.Generic.Dictionary<TabPage,Button>();
        foreach(TabPage page in tabs.TabPages){
            var target=page;
            var button=new Button{Text=target.Text,Width=186,Height=45,
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
        shell.Controls.Add(sidebar,0,0);
        shell.Controls.Add(tabs,1,0);
        refresh();
        return shell;
    }

    internal static void Primary(Button button){
        button.BackColor=Accent;
        button.ForeColor=Background;
        button.FlatAppearance.BorderColor=Accent;
        button.Font=new Font("Segoe UI Semibold",10f,FontStyle.Bold);
    }
}
