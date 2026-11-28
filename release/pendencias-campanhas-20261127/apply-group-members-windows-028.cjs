// Read-only, local Teste consultation. No cloud RPC, upload, export or message-history ingestion.
// Apply only together with album patch on the exact published 0.2.28 source.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const album=require('./apply-album-windows-028.cjs');
const edits={
  "connect/whatsapp-lab/whatsapp-provider.mjs": [
    [
      "  async listGroups(){",
      "  async listGroupMembers(jid){\n   const current=socket;\n   if(!connected||!current||pendingGroup||pendingDiagnostic||typeof jid!=='string'||!/^[0-9-]{1,64}@g[.]us$/.test(jid))throw Error('Consulta indisponível.');\n   const task={socket:current,jid,changed:false};pendingDiagnostic=task;\n   try{\n    const groups=await current.groupFetchAllParticipating();\n    if(!connected||socket!==current||task.changed||!Object.values(groups||{}).some(g=>g?.id===jid))throw Error('Grupo indisponível.');\n    const row=await current.groupMetadata(jid);\n    if(!connected||socket!==current||task.changed||row?.id!==jid||!Array.isArray(row.participants))throw Error('Metadados indisponíveis.');\n    const own=[current.user?.id,current.user?.lid,creds.me?.id,creds.me?.lid];\n    if(!['admin','superadmin'].includes(groupDiagnostics(row,own).role))throw Error('Consulta restrita ao administrador do grupo.');\n    const safeName=v=>typeof v==='string'?v.replace(/[\\p{Cc}\\p{Cf}]/gu,' ').trim().slice(0,120):'';\n    const rows=row.participants.slice(0,1024).map(p=>{\n     // Phone only when explicitly exposed as a phone-number JID or phoneNumber; never derive a phone from a LID.\n     const phone=[p?.phoneNumber,p?.id].map(v=>typeof v==='string'?(/^(?:\\+)?([0-9]{6,15})(?::[0-9]+)?@s[.]whatsapp[.]net$/.exec(v)?.[1]||(/^\\+?[0-9]{6,15}$/.test(v)&&v===p?.phoneNumber?v.replace(/^\\+/,''):'')):'').find(Boolean)||'';\n     return {name:safeName(p?.name||p?.notify||p?.verifiedName),phone,role:p?.admin==='superadmin'||p?.isSuperAdmin===true?'superadmin':p?.admin==='admin'||p?.isAdmin===true?'admin':'member'};\n    });\n    return {total:row.participants.length,rows};\n   }finally{if(pendingDiagnostic===task)pendingDiagnostic=null;}\n  },\n  async listGroups(){"
    ]
  ],
  "connect/whatsapp-lab/windows-bridge.mjs": [
    [
      "    }else if(message.action==='revalidate_group_availability'){",
      "    }else if(message.action==='group_members'){\n     const jid=message.group_jid,request=message.request_id;\n     if(typeof request!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(request)||typeof jid!=='string'||!/^[0-9-]{1,64}@g[.]us$/.test(jid))return;\n     const report=(status,total=0,rows=[])=>output('group_members',{request_id:request,group_jid:jid,status,total,rows});\n     if(message.confirmed!==true||state!=='conectado'||!current||checking||sending||diagnosing||typeof current.listGroupMembers!=='function')return report('unavailable');\n     diagnosing=true;const revision=generation,provider=current;\n     try{\n      const r=await provider.listGroupMembers(jid);\n      if(revision!==generation||state!=='conectado')return;\n      if(!Number.isSafeInteger(r?.total)||r.total<0||!Array.isArray(r.rows)||r.rows.length>1024||r.rows.length>r.total)return report('unavailable');\n      const rows=r.rows.map(p=>({name:typeof p?.name==='string'?p.name.replace(/[\\p{Cc}\\p{Cf}]/gu,' ').slice(0,120):'',phone:/^[0-9]{6,15}$/.test(p?.phone||'')?p.phone:'',role:['admin','superadmin','member'].includes(p?.role)?p.role:'unknown'}));\n      report('ok',r.total,rows);\n     }catch{if(revision===generation)report('unavailable');}finally{diagnosing=false;}\n    }else if(message.action==='revalidate_group_availability'){"
    ]
  ],
  "connect/windows/WhatsApp.cs": [
    [
      "    readonly List<Dictionary<string,object>> groupRows",
      "    Guid membersRequest=Guid.Empty;\n    string membersGroup=\"\";\n    Form membersDialog;\n    TextBox membersText;\n    readonly List<Dictionary<string,object>> groupRows"
    ],
    [
      "        groupTools.Controls.Add(Action(\"Diagnosticar grupo\",OpenGroupDiagnostic));",
      "        groupTools.Controls.Add(Action(\"Diagnosticar grupo\",OpenGroupDiagnostic));\n        if(!environment.IsProduction)groupTools.Controls.Add(Action(\"Consultar participantes\",RequestGroupMembers));"
    ],
    [
      "    void OpenGroupDiagnostic(){",
      "    void ClearGroupMembers(){\n        membersRequest=Guid.Empty;membersGroup=\"\";\n        if(membersText!=null){membersText.Clear();membersText=null;}\n        var dialog=membersDialog;membersDialog=null;if(dialog!=null&&!dialog.IsDisposed)dialog.Close();\n    }\n    async void RequestGroupMembers(){\n        if(environment.IsProduction||!CampaignSessionReady||sendingText||automatedSend!=null||membersRequest!=Guid.Empty||groups.SelectedItems.Count!=1)return;\n        string jid=Convert.ToString(groups.SelectedItems[0].Tag);\n        if(!selected.Contains(jid)){MessageBox.Show(\"Selecione e marque o grupo primeiro.\",\"Participantes\");return;}\n        if(MessageBox.Show(\"Consultar participantes deste grupo, somente nesta sessão? A conta conectada precisa ser administradora. Os dados não serão enviados ao NeoPep nem salvos.\",\"Consulta local\",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;\n        ClearGroupMembers();\n        var request=Guid.NewGuid();membersRequest=request;membersGroup=jid;\n        try{pipe.WriteLine(json.Serialize(new {action=\"group_members\",request_id=request.ToString(),group_jid=jid,confirmed=true}));}\n        catch{ClearGroupMembers();return;}\n        await Task.Delay(TimeSpan.FromSeconds(35));\n        if(membersRequest==request){ClearGroupMembers();if(ready&&!closing)MessageBox.Show(\"A consulta não retornou a tempo.\",\"Participantes\");}\n    }\n    void ShowGroupMembers(Dictionary<string,object> result){\n        if(result==null||membersRequest==Guid.Empty||TextValue(result,\"request_id\")!=membersRequest.ToString()||TextValue(result,\"group_jid\")!=membersGroup)return;\n        string jid=membersGroup;membersRequest=Guid.Empty;membersGroup=\"\";\n        if(!ready||!selected.Contains(jid)||environment.IsProduction||closing)return;\n        if(TextValue(result,\"status\")!=\"ok\"){MessageBox.Show(\"Consulta indisponível. Verifique a conexão e se a conta é administradora.\",\"Participantes\");return;}\n        int total;if(!Int32.TryParse(TextValue(result,\"total\"),out total)||total<0)return;\n        object raw;var rows=result.TryGetValue(\"rows\",out raw)?raw as System.Collections.IList:null;\n        if(rows==null||rows.Count>1024||rows.Count>total)return;\n        ClearGroupMembers();\n        var dialog=new Form{Text=\"Participantes — consulta local\",Width=630,Height=520,StartPosition=FormStartPosition.CenterParent,ShowInTaskbar=false};\n        var text=new TextBox{Dock=DockStyle.Fill,Multiline=true,ReadOnly=true,WordWrap=false,ScrollBars=ScrollBars.Both,Font=new Font(\"Segoe UI\",10)};\n        var lines=new List<string>();lines.Add(\"Participantes consultados: \"+rows.Count+\" de \"+total);lines.Add(\"Números não disponibilizados pelo WhatsApp permanecem ocultos.\");lines.Add(\"\");\n        int index=0;foreach(var value in rows){\n            var row=value as Dictionary<string,object>;if(row==null)continue;\n            string number=TextValue(row,\"phone\"),name=TextValue(row,\"name\");\n            if(!System.Text.RegularExpressions.Regex.IsMatch(number,@\"\\A[0-9]{6,15}\\z\"))number=\"\";\n            name=System.Text.RegularExpressions.Regex.Replace(name,@\"[\\p{Cc}\\p{Cf}]+\",\" \").Trim();\n            if(name.Length>120)name=name.Substring(0,120);\n            lines.Add((++index).ToString()+\". \"+(name.Length==0?\"Participante\":name)+(number.Length==0?\" — número indisponível\":\" (+\"+number+\")\")+\" — \"+GroupRole(TextValue(row,\"role\")));\n        }\n        text.Lines=lines.ToArray();dialog.Controls.Add(text);membersDialog=dialog;membersText=text;\n        dialog.FormClosed+=delegate{if(membersDialog==dialog){membersDialog=null;membersText=null;}text.Clear();dialog.Dispose();};\n        dialog.Show(this);\n    }\n    void OpenGroupDiagnostic(){"
    ],
    [
      "                ready=value==\"conectado\";",
      "                ready=value==\"conectado\";\n                if(!ready)ClearGroupMembers();"
    ],
    [
      "            }else if((type==\"group_check\"||type==\"group_diagnostic\")&&ready&&!forgetting){",
      "            }else if(type==\"group_members\"&&ready&&!forgetting){\n                phase=\"GRUPO_PARTICIPANTES\";ShowGroupMembers(message[\"value\"] as Dictionary<string,object>);\n            }else if((type==\"group_check\"||type==\"group_diagnostic\")&&ready&&!forgetting){"
    ],
    [
      "    void ClearGroups(){",
      "    void ClearGroups(){\n        ClearGroupMembers();"
    ],
    [
      "            if(args.Item.Checked)selected.Add(id);else selected.Remove(id);",
      "            if(args.Item.Checked)selected.Add(id);else {selected.Remove(id);ClearGroupMembers();}"
    ]
  ]
};
function patchMembers(input){const out={...input};for(const [p,changes] of Object.entries(edits)){let s=out[p];if(typeof s!=="string")throw Error("missing "+p);for(const [a,b] of changes){if(s.split(a).length!==2)throw Error("anchor "+p+" "+a);s=s.replace(a,()=>b)}out[p]=s;}return out}
function apply(root){const input={};for(const [p,sha] of Object.entries(album.hashes)){const b=fs.readFileSync(path.join(root,p));if(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')!==sha)throw Error('Source differs from published 0.2.28: '+p);input[p]=b.toString('utf8');}const result=patchMembers(album.patch(input));for(const [p,s] of Object.entries(result))fs.writeFileSync(path.join(root,p),s,'utf8');}
module.exports={patchMembers,apply};
if(require.main===module){if(!process.argv[2])throw Error('Provide clean 0.2.28 worktree');apply(path.resolve(process.argv[2]));}
