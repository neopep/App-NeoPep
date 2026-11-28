// Candidate, Teste only, server gate closed. Reuse exact published Windows 0.2.28.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const album=require('./apply-album-windows-028.cjs'),members=require('./apply-group-members-windows-028.cjs'),messages=require('./apply-group-messages-windows-028.cjs');
const edits={
  "connect/whatsapp-lab/whatsapp-provider.mjs": [
    [
      " function stopMessageView(){",
      " function stopMessageView(reason='aborted'){"
    ],
    [
      "try{view.onStop();}catch{}",
      "try{view.onStop(reason);}catch{}"
    ],
    [
      "if(seen.size>=50){stopMessageView();return;}",
      "if(seen.size>=50){stopMessageView('complete');return;}"
    ],
    [
      "view.timer=schedule(()=>{if(messageView===view)stopMessageView();},120000);",
      "view.timer=schedule(()=>{if(messageView===view)stopMessageView('complete');},120000);"
    ],
    [
      "if(messageView===view)stopMessageView();return;",
      "if(messageView===view)stopMessageView();return;"
    ]
  ],
  "connect/whatsapp-lab/windows-bridge.mjs": [
    [
      "import {Writable} from 'node:stream';",
      "import {Writable} from 'node:stream';\nimport {createPublicKey,publicEncrypt,randomBytes,createCipheriv,constants} from 'node:crypto';"
    ],
    [
      "export function createBridge(",
      "// Results are encrypted in the bridge before IPC or network transport.\nexport function encryptGroupView(browserKey,id,kind,rows){\n if(!/^[a-f0-9-]{36}$/.test(id)||!['members','messages'].includes(kind)||typeof browserKey!=='string'||browserKey.length!==392||!/^[A-Za-z0-9+/]+$/.test(browserKey)||!Array.isArray(rows)||rows.length>(kind==='members'?1024:50))throw Error('Invalid consultation.');\n const key=createPublicKey({key:Buffer.from(browserKey,'base64'),format:'der',type:'spki'});\n if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails?.modulusLength!==2048)throw Error('Invalid key.');\n const safe=rows.map(p=>kind==='members'?{name:typeof p?.name==='string'?p.name.slice(0,120):'',phone:/^[0-9]{6,15}$/.test(p?.phone||'')?p.phone:'',role:['admin','superadmin','member'].includes(p?.role)?p.role:'unknown'}:{text:typeof p?.text==='string'?p.text.slice(0,500):''});\n const secret=randomBytes(32),iv=randomBytes(12);\n try{\n  const cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(Buffer.from(id+':'+kind,'utf8'));\n  const ciphertext=Buffer.concat([cipher.update(JSON.stringify({kind,rows:safe}),'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');\n  if(ciphertext.length>1048576)throw Error('Oversize consultation.');\n  const wrapped_key=publicEncrypt({key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},secret).toString('base64');\n  return {wrapped_key,iv:iv.toString('base64'),ciphertext};\n }finally{secret.fill(0);}\n}\nexport function createBridge("
    ],
    [
      "    }else if(message.action==='group_messages_stop'){",
      "    }else if(message.action==='group_view_cancel'){\n     if(groupView?.request===message.request_id){groupView=null;current?.stopGroupMessageView?.();}\n    }else if(message.action==='group_view_query'){\n     const jid=message.group_jid,request=message.request_id,kind=message.kind;\n     if(typeof request!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(request)||typeof jid!=='string'||!/^[0-9-]{1,64}@g[.]us$/.test(jid))return;\n     const report=(status,extra={})=>output('group_view_result',{request_id:request,group_jid:jid,status,...extra});\n     if(!enableGroupView||message.confirmed!==true||state!=='conectado'||!current||checking||sending||diagnosing||groupView||!['members','messages'].includes(kind)||typeof message.browser_key!=='string'||message.browser_key.length!==392)return report('denied');\n     const revision=generation,provider=current,view={request,jid};groupView=view;diagnosing=true;\n     const active=()=>groupView===view&&revision===generation&&state==='conectado'&&provider===current;\n     try{\n      let rows=[];\n      if(kind==='members'){const result=await provider.listGroupMembers(jid);if(!Array.isArray(result?.rows)||result.rows.length>1024)throw Error('Invalid result');rows=result.rows;}\n      else{\n       const done=new Promise(resolve=>{view.complete=resolve;});\n       await provider.startGroupMessageView(jid,item=>{if(active()&&rows.length<50)rows.push({text:item.text});},reason=>view.complete(reason));\n       if(!active()){provider.stopGroupMessageView();return;}\n       const reason=await done;\n       if(reason!=='complete'){if(active())report('denied');return;}\n      }\n      if(active())report('ready',{result:encryptGroupView(message.browser_key,request,kind,rows)});\n     }catch{if(active())report('denied');}\n     finally{if(groupView===view)groupView=null;diagnosing=false;}\n    }else if(message.action==='group_messages_stop'){"
    ]
  ],
  "connect/windows/WhatsApp.cs": [
    [
      "    Guid messageViewRequest=Guid.Empty;",
      "    Guid remoteGroupViewRequest=Guid.Empty;\n    string remoteGroupViewGroup=\"\";\n    TaskCompletionSource<Dictionary<string,object>> remoteGroupViewCompletion;\n    public bool GroupViewAvailable { get {return !environment.IsProduction&&CampaignSessionReady&&!sendingText&&automatedSend==null&&remoteGroupViewRequest==Guid.Empty&&messageViewRequest==Guid.Empty&&membersRequest==Guid.Empty;} }\n    Guid messageViewRequest=Guid.Empty;"
    ],
    [
      "    void ClearGroupMessages(){",
      "    void CancelRemoteGroupView(){\n        var request=remoteGroupViewRequest;remoteGroupViewRequest=Guid.Empty;remoteGroupViewGroup=\"\";\n        if(request!=Guid.Empty&&pipe!=null)try{pipe.WriteLine(json.Serialize(new {action=\"group_view_cancel\",request_id=request.ToString()}));}catch{}\n        var done=remoteGroupViewCompletion;remoteGroupViewCompletion=null;if(done!=null)done.TrySetResult(null);\n    }\n    public async Task<Dictionary<string,object>> RunRemoteGroupView(Guid request,string jid,string kind,string key,DateTime expiresAt){\n        if(!GroupViewAvailable||request==Guid.Empty||!selected.Contains(jid)||!(kind==\"members\"||kind==\"messages\")||key==null||key.Length!=392||DateTime.UtcNow.AddSeconds(140)>=expiresAt)return null;\n        var answer=MessageBox.Show(\"O NeoPep web solicitou \"+(kind==\"members\"?\"a lista de participantes\":\"até 50 novas mensagens de texto por dois minutos\")+\" do grupo selecionado. Confirme a autorização. O resultado será cifrado para a sessão que fez a solicitação, sem histórico ou cópia em texto aberto no servidor.\",\"Autorizar consulta web\",MessageBoxButtons.YesNo,MessageBoxIcon.Question);\n        if(answer!=DialogResult.Yes||!GroupViewAvailable||!selected.Contains(jid)||DateTime.UtcNow.AddSeconds(140)>=expiresAt)return null;\n        var done=new TaskCompletionSource<Dictionary<string,object>>(TaskCreationOptions.RunContinuationsAsynchronously);\n        remoteGroupViewCompletion=done;remoteGroupViewRequest=request;remoteGroupViewGroup=jid;\n        try{\n            pipe.WriteLine(json.Serialize(new {action=\"group_view_query\",request_id=request.ToString(),group_jid=jid,kind=kind,browser_key=key,confirmed=true}));\n            if(await Task.WhenAny(done.Task,Task.Delay(TimeSpan.FromSeconds(140)))==done.Task&&remoteGroupViewRequest==request&&CampaignSessionReady&&selected.Contains(jid)&&DateTime.UtcNow<expiresAt)return await done.Task;\n            return null;\n        }catch{return null;}finally{if(remoteGroupViewRequest==request)CancelRemoteGroupView();}\n    }\n    void ShowRemoteGroupViewResult(Dictionary<string,object> result){\n        if(result==null||remoteGroupViewRequest==Guid.Empty||TextValue(result,\"request_id\")!=remoteGroupViewRequest.ToString()||TextValue(result,\"group_jid\")!=remoteGroupViewGroup||remoteGroupViewCompletion==null)return;\n        object raw;\n        var envelope=TextValue(result,\"status\")==\"ready\"&&result.TryGetValue(\"result\",out raw)?raw as Dictionary<string,object>:null;\n        remoteGroupViewCompletion.TrySetResult(envelope);\n    }\n    void ClearGroupMessages(){"
    ],
    [
      "                if(!ready){ClearGroupMembers();ClearGroupMessages();}",
      "                if(!ready){ClearGroupMembers();ClearGroupMessages();CancelRemoteGroupView();}"
    ],
    [
      "else {selected.Remove(id);ClearGroupMembers();ClearGroupMessages();}",
      "else {selected.Remove(id);ClearGroupMembers();ClearGroupMessages();CancelRemoteGroupView();}"
    ],
    [
      "        ClearGroupMembers();ClearGroupMessages();\n        sync.Enabled=false;",
      "        ClearGroupMembers();ClearGroupMessages();CancelRemoteGroupView();\n        sync.Enabled=false;"
    ],
    [
      "            }else if(type==\"group_messages\"&&ready&&!forgetting){",
      "            }else if(type==\"group_view_result\"&&ready&&!forgetting){\n                phase=\"GRUPO_CONSULTA_WEB\";ShowRemoteGroupViewResult(message[\"value\"] as Dictionary<string,object>);\n            }else if(type==\"group_messages\"&&ready&&!forgetting){"
    ]
  ],
  "connect/windows/Connect.cs": [
    [
      "    async Task<byte[]> LoadRichCampaignJpeg(",
      "    bool groupViewBusy;\n    Task<Dictionary<string,object>> GroupViewRpc(string action,object data){\n        return Post(\"/rest/v1/rpc/neo_group_view_device_v1\",new {p_action=action,p_device=Value(local,\"device\"),p_secret=Value(local,\"secret\"),p_data=data},true);\n    }\n    async Task TickGroupView(){\n        if(profile.IsProduction||groupViewBusy||!deviceApproved||!SessionReady())return;\n        var window=whatsapp;if(window==null||!window.GroupViewAvailable)return;\n        var connection=window.CampaignConnection;var owner=sessionOwner;var device=Value(local,\"device\");\n        groupViewBusy=true;\n        try{\n            var job=await GroupViewRpc(\"claim\",new {connection_id=connection});\n            if(job==null||Value(job,\"state\")!=\"claimed\")return;\n            Guid id;DateTime expiry;\n            var fence=Value(job,\"fence\");\n            Dictionary<string,object> result=null;\n            if(Guid.TryParse(Value(job,\"id\"),out id)&&DateTime.TryParse(Value(job,\"expires_at\"),null,System.Globalization.DateTimeStyles.AdjustToUniversal,out expiry)&&whatsapp==window&&window.CampaignConnection==connection&&sessionOwner==owner&&Value(local,\"device\")==device&&deviceApproved&&SessionReady())\n                result=await window.RunRemoteGroupView(id,Value(job,\"group_jid\"),Value(job,\"kind\"),Value(job,\"browser_key\"),expiry.ToUniversalTime());\n            if(whatsapp!=window||window.CampaignConnection!=connection||sessionOwner!=owner||Value(local,\"device\")!=device||!deviceApproved||!SessionReady())return;\n            if(result==null)await GroupViewRpc(\"deny\",new {connection_id=connection,id=Value(job,\"id\"),fence=fence});\n            else await GroupViewRpc(\"finish\",new {connection_id=connection,id=Value(job,\"id\"),fence=fence,confirmed=true,result=result});\n        }catch(Exception){/* No content, identifiers or secrets logged. Server expires unavailable requests. */}\n        finally{groupViewBusy=false;}\n    }\n    async Task<byte[]> LoadRichCampaignJpeg("
    ],
    [
      "            var previewTask=TickVideoPreview();",
      "            var previewTask=TickVideoPreview();\n            var groupViewTask=TickGroupView();"
    ]
  ]
};
function patchBroker(input){const out={...input};for(const [p,changes] of Object.entries(edits)){let s=out[p];for(const [a,b] of changes){if(s.split(a).length!==2)throw Error("anchor "+p+" "+a);s=s.replace(a,()=>b)}out[p]=s;}return out}
function apply(root){const input={};for(const [p,sha] of Object.entries(album.hashes)){const b=fs.readFileSync(path.join(root,p));if(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')!==sha)throw Error('Source differs from published 0.2.28: '+p);input[p]=b.toString('utf8');}const result=patchBroker(messages.patchMessages(members.patchMembers(album.patch(input))));for(const [p,s] of Object.entries(result))fs.writeFileSync(path.join(root,p),s,'utf8');}
module.exports={patchBroker,apply};
if(require.main===module){if(!process.argv[2])throw Error('Provide clean 0.2.28 worktree');apply(path.resolve(process.argv[2]));}
