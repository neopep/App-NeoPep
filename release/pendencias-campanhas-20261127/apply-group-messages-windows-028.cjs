// Local and explicitly authorized temporary message view. No history sync, upload, or persistence.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const album=require('./apply-album-windows-028.cjs'),members=require('./apply-group-members-windows-028.cjs');
const edits={
  "connect/whatsapp-lab/whatsapp-provider.mjs": [
    [
      " let maintenanceEnabled=automaticMaintenance===true;",
      " let maintenanceEnabled=automaticMaintenance===true;\n let messageView=null;\n function stopMessageView(){\n  const view=messageView;messageView=null;\n  if(!view)return;\n  cancel(view.timer);view.socket.ev.off('messages.upsert',view.listener);\n  try{view.onStop();}catch{}\n }\n"
    ],
    [
      " function detach(current){",
      " function detach(current){\n  if(messageView?.socket===current)stopMessageView();"
    ],
    [
      "   if(pendingDiagnostic?.socket===current&&pendingDiagnostic.jid===event?.id)pendingDiagnostic.changed=true;",
      "   if(pendingDiagnostic?.socket===current&&pendingDiagnostic.jid===event?.id)pendingDiagnostic.changed=true;\n   if(messageView?.socket===current&&messageView.jid===event?.id)stopMessageView();"
    ],
    [
      "  async listGroupMembers(jid){",
      "  stopGroupMessageView(){stopMessageView();},\n  async startGroupMessageView(jid,onMessage,onStop){\n   stopMessageView();\n   const current=socket;\n   if(!connected||!current||pendingGroup||pendingDiagnostic||typeof jid!=='string'||!/^[0-9-]{1,64}@g[.]us$/.test(jid)||typeof onMessage!=='function'||typeof onStop!=='function')throw Error('Consulta indisponível.');\n   const task={socket:current,jid,changed:false};pendingDiagnostic=task;\n   try{\n    const groups=await current.groupFetchAllParticipating();\n    if(!connected||socket!==current||task.changed||!Object.values(groups||{}).some(g=>g?.id===jid))throw Error('Grupo indisponível.');\n    const row=await current.groupMetadata(jid);\n    if(!connected||socket!==current||task.changed||row?.id!==jid||!Array.isArray(row.participants)||Number(row.ephemeralDuration||0)>0)throw Error('Metadados indisponíveis ou grupo temporário.');\n    if(!['admin','superadmin'].includes(groupDiagnostics(row,[current.user?.id,current.user?.lid,creds.me?.id,creds.me?.lid]).role))throw Error('Consulta restrita ao administrador.');\n    const started=Date.now(),seen=new Set(),view={socket:current,jid,onStop,listener:null,timer:null};\n    view.listener=event=>{\n     if(messageView!==view||!connected||socket!==current||Date.now()-started>=120000){if(messageView===view)stopMessageView();return;}\n     if(event?.type!=='notify'||!Array.isArray(event.messages))return;\n     for(const item of event.messages){\n      if(messageView!==view)return;\n      const key=item?.key,id=key?.id,stamp=Number(item?.messageTimestamp)*1000;\n      if(key?.remoteJid!==jid||typeof id!=='string'||!id||id.length>160||seen.has(id)||!Number.isFinite(stamp)||stamp<Math.floor(started/1000)*1000||stamp>Date.now()+1000)continue;\n      const msg=item.message;\n      if(!msg||msg.ephemeralMessage||msg.viewOnceMessage||msg.viewOnceMessageV2||msg.viewOnceMessageV2Extension||msg.extendedTextMessage?.contextInfo?.expiration||msg.extendedTextMessage?.contextInfo?.ephemeralSettingTimestamp)continue;\n      const value=typeof msg.conversation==='string'?msg.conversation:typeof msg.extendedTextMessage?.text==='string'?msg.extendedTextMessage.text:'';\n      const text=value.replace(/[\\p{Cc}\\p{Cf}]/gu,' ').trim().slice(0,500);\n      if(!text)continue;\n      seen.add(id);\n      try{onMessage({text});}catch{stopMessageView();return;}\n      if(seen.size>=50){stopMessageView();return;}\n     }\n    };\n    messageView=view;view.timer=schedule(()=>{if(messageView===view)stopMessageView();},120000);\n    current.ev.on('messages.upsert',view.listener);\n   }finally{if(pendingDiagnostic===task)pendingDiagnostic=null;}\n  },\n  async listGroupMembers(jid){"
    ]
  ],
  "connect/whatsapp-lab/windows-bridge.mjs": [
    [
      "enableAlbums=false}){",
      "enableAlbums=false,enableGroupView=false}){"
    ],
    [
      " const output=(type,value)=>",
      " let groupView=null;\n const output=(type,value)=>"
    ],
    [
      "     const revision=++generation;tracked.clear();earlyReceipts.clear();",
      "     const revision=++generation;groupView=null;tracked.clear();earlyReceipts.clear();"
    ],
    [
      "       update(value);",
      "       if(value!=='conectado')groupView=null;\n       update(value);"
    ],
    [
      "    }else if(message.action==='group_members'){",
      "    }else if(message.action==='group_messages_stop'){\n     if(groupView?.request===message.request_id){groupView=null;current?.stopGroupMessageView?.();}\n    }else if(message.action==='group_messages_start'){\n     const jid=message.group_jid,request=message.request_id;\n     if(typeof request!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(request)||typeof jid!=='string'||!/^[0-9-]{1,64}@g[.]us$/.test(jid))return;\n     const report=(status,extra={})=>output('group_messages',{request_id:request,group_jid:jid,status,...extra});\n     if(!enableGroupView||message.confirmed!==true||state!=='conectado'||!current||checking||sending||diagnosing||groupView||typeof current.startGroupMessageView!=='function')return report('unavailable');\n     const revision=generation,provider=current,view={request,jid};groupView=view;diagnosing=true;\n     try{\n      await provider.startGroupMessageView(jid,item=>{\n       if(groupView===view&&revision===generation&&state==='conectado'&&typeof item?.text==='string')report('message',{text:item.text.slice(0,500)});\n      },()=>{if(groupView===view){groupView=null;report('stopped');}});\n      if(groupView===view&&revision===generation&&state==='conectado')report('started');\n      else provider.stopGroupMessageView?.();\n     }catch{if(groupView===view){groupView=null;report('unavailable');}}\n     finally{diagnosing=false;}\n    }else if(message.action==='group_members'){"
    ],
    [
      "enableAlbums:process.env.NEO_CONNECT_ALBUM_V1==='1'",
      "enableAlbums:process.env.NEO_CONNECT_ALBUM_V1==='1',enableGroupView:process.env.NEO_CONNECT_GROUP_VIEW_V1==='1'"
    ]
  ],
  "connect/windows/WhatsApp.cs": [
    [
      "    Guid membersRequest=Guid.Empty;",
      "    Guid messageViewRequest=Guid.Empty;\n    string messageViewGroup=\"\";\n    Form messageViewDialog;\n    TextBox messageViewText;\n    Guid membersRequest=Guid.Empty;"
    ],
    [
      "        if(!environment.IsProduction)groupTools.Controls.Add(Action(\"Consultar participantes\",RequestGroupMembers));",
      "        if(!environment.IsProduction){\n            groupTools.Controls.Add(Action(\"Consultar participantes\",RequestGroupMembers));\n            groupTools.Controls.Add(Action(\"Consultar mensagens\",OpenGroupMessages));\n        }"
    ],
    [
      "    void ClearGroupMembers(){",
      "    void ClearGroupMessages(){\n        var request=messageViewRequest;messageViewRequest=Guid.Empty;messageViewGroup=\"\";\n        if(request!=Guid.Empty&&pipe!=null)try{pipe.WriteLine(json.Serialize(new {action=\"group_messages_stop\",request_id=request.ToString()}));}catch{}\n        if(messageViewText!=null){messageViewText.Clear();messageViewText=null;}\n        var dialog=messageViewDialog;messageViewDialog=null;if(dialog!=null&&!dialog.IsDisposed)dialog.Close();\n    }\n    async void OpenGroupMessages(){\n        if(environment.IsProduction||!CampaignSessionReady||sendingText||automatedSend!=null||messageViewRequest!=Guid.Empty||membersRequest!=Guid.Empty||groups.SelectedItems.Count!=1)return;\n        string jid=Convert.ToString(groups.SelectedItems[0].Tag);\n        if(!selected.Contains(jid)){MessageBox.Show(\"Selecione e marque o grupo primeiro.\",\"Mensagens\");return;}\n        if(MessageBox.Show(\"Consultar somente novas mensagens de texto deste grupo por até 2 minutos, no máximo 50 mensagens? A conta precisa ser administradora. Sem histórico anterior, identificação de remetentes, armazenamento ou envio ao NeoPep. Confirme que você tem autorização para visualizar estas mensagens.\",\"Consulta temporária\",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;\n        var request=Guid.NewGuid();messageViewRequest=request;messageViewGroup=jid;\n        var dialog=new Form{Text=\"Mensagens recentes — consulta temporária\",Width=630,Height=520,StartPosition=FormStartPosition.CenterParent,ShowInTaskbar=false};\n        var view=new TextBox{Dock=DockStyle.Fill,Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,Font=new Font(\"Segoe UI\",10),Text=\"Verificando acesso ao grupo…\"+Environment.NewLine};\n        dialog.Controls.Add(view);messageViewDialog=dialog;messageViewText=view;\n        dialog.FormClosed+=delegate{if(messageViewDialog==dialog){view.Clear();messageViewDialog=null;messageViewText=null;ClearGroupMessages();}};\n        dialog.Show(this);\n        try{pipe.WriteLine(json.Serialize(new {action=\"group_messages_start\",request_id=request.ToString(),group_jid=jid,confirmed=true}));}catch{ClearGroupMessages();return;}\n        await Task.Delay(TimeSpan.FromSeconds(155));\n        if(messageViewRequest==request)ClearGroupMessages();\n    }\n    void ShowGroupMessage(Dictionary<string,object> result){\n        if(result==null||messageViewRequest==Guid.Empty||TextValue(result,\"request_id\")!=messageViewRequest.ToString()||TextValue(result,\"group_jid\")!=messageViewGroup||messageViewText==null)return;\n        if(!ready||!selected.Contains(messageViewGroup)||environment.IsProduction||closing){ClearGroupMessages();return;}\n        string status=TextValue(result,\"status\");\n        if(status==\"started\"){messageViewText.AppendText(\"Aguardando novas mensagens…\"+Environment.NewLine);return;}\n        if(status==\"message\"){\n            string value=System.Text.RegularExpressions.Regex.Replace(TextValue(result,\"text\"),@\"[\\p{Cc}\\p{Cf}]+\",\" \").Trim();\n            if(value.Length>500)value=value.Substring(0,500);\n            if(value.Length>0&&messageViewText.TextLength<30000)messageViewText.AppendText(value+Environment.NewLine+Environment.NewLine);\n            return;\n        }\n        ClearGroupMessages();\n    }\n    void ClearGroupMembers(){"
    ],
    [
      "            if(args.Item.Checked)selected.Add(id);else {selected.Remove(id);ClearGroupMembers();}",
      "            if(args.Item.Checked)selected.Add(id);else {selected.Remove(id);ClearGroupMembers();ClearGroupMessages();}"
    ],
    [
      "                if(!ready)ClearGroupMembers();",
      "                if(!ready){ClearGroupMembers();ClearGroupMessages();}"
    ],
    [
      "    void ClearGroups(){\n        ClearGroupMembers();",
      "    void ClearGroups(){\n        ClearGroupMembers();ClearGroupMessages();"
    ],
    [
      "            }else if(type==\"group_members\"&&ready&&!forgetting){",
      "            }else if(type==\"group_messages\"&&ready&&!forgetting){\n                phase=\"GRUPO_MENSAGENS\";ShowGroupMessage(message[\"value\"] as Dictionary<string,object>);\n            }else if(type==\"group_members\"&&ready&&!forgetting){"
    ],
    [
      "start.EnvironmentVariables[\"NEO_CONNECT_ALBUM_V1\"]=AlbumTransportApproved&&!environment.IsProduction?\"1\":\"0\";",
      "start.EnvironmentVariables[\"NEO_CONNECT_ALBUM_V1\"]=AlbumTransportApproved&&!environment.IsProduction?\"1\":\"0\";\n            start.EnvironmentVariables[\"NEO_CONNECT_GROUP_VIEW_V1\"]=environment.IsProduction?\"0\":\"1\";"
    ]
  ]
};
function patchMessages(input){const out={...input};for(const [p,changes] of Object.entries(edits)){let s=out[p];for(const [a,b] of changes){if(s.split(a).length!==2)throw Error("anchor "+p+" "+a);s=s.replace(a,()=>b)}out[p]=s;}return out}
function apply(root){const input={};for(const [p,sha] of Object.entries(album.hashes)){const b=fs.readFileSync(path.join(root,p));if(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')!==sha)throw Error('Source differs from published 0.2.28: '+p);input[p]=b.toString('utf8');}const result=patchMessages(members.patchMembers(album.patch(input)));for(const [p,s] of Object.entries(result))fs.writeFileSync(path.join(root,p),s,'utf8');}
module.exports={patchMessages,apply};
if(require.main===module){if(!process.argv[2])throw Error('Provide clean 0.2.28 worktree');apply(path.resolve(process.argv[2]));}
