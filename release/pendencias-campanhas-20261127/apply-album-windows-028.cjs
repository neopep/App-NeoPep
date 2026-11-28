// Candidate integration: use only the exact source of the published Windows 0.2.28 installer.
// Does not build, distribute, activate, or deploy. All source files verified before any write.
// Usage: node apply-album-windows-028.cjs /path/to/clean/028/worktree
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const baseline="8b2430aaae1eccf1bd2cdef1c8988efd124e0d2c",hashes={
  "connect/whatsapp-lab/whatsapp-provider.mjs": "5efbae803d12b7ef5b8d61427dff00981de02bab",
  "connect/whatsapp-lab/windows-bridge.mjs": "8ea63e5d13f4aed3e1741312089ea71ed31e3333",
  "connect/windows/WhatsApp.cs": "99b4501ade77b6d69b925d1063f8f29f64575848",
  "connect/windows/Connect.cs": "a3b4352dbef1d9ccad209f026baa4f3761609ecd"
};
const edits={
  "connect/whatsapp-lab/whatsapp-provider.mjs": [
    [
      "export const CAMPAIGN_FILE_MAX=50*1024*1024;",
      "export const CAMPAIGN_FILE_MAX=50*1024*1024;\nexport function validNativeAlbum(items){\n return Array.isArray(items)&&items.length>=2&&items.length<=4&&items.every(item=>typeof item?.caption==='string'&&item.caption.length<=1000&&Buffer.isBuffer(item.image)&&item.image.length>=5&&item.image.length<=1048576&&item.image[0]===255&&item.image[1]===216&&item.image[2]===255&&item.image.at(-2)===255&&item.image.at(-1)===217);\n}"
    ],
    [
      "  async sendFile(groupJid,caption,bytes,mime,name){",
      "  async sendAlbum(groupJid,images){\n   if(!validNativeAlbum(images))throw Error('Álbum inválido.');\n   const current=socket;\n   if(!connected||!current||pendingGroup||pendingDiagnostic||typeof groupJid!=='string'||!/^[0-9-]{1,64}@g[.]us$/.test(groupJid))throw Error('Álbum indisponível.');\n   if(rejectedGroups.has(groupJid))return {status:'rejected',blocked:'previous_421',messageId:null,media:[]};\n   const groups=await current.groupFetchAllParticipating();\n   if(!connected||socket!==current||pendingGroup||pendingDiagnostic||rejectedGroups.has(groupJid))throw Error('A sessão mudou.');\n   const listed=Object.values(groups||{}).find(group=>group?.id===groupJid);\n   if(!listed)throw Error('A conta não participa deste grupo.');\n   const task={socket:current,jid:groupJid,listed,changed:false};\n   pendingGroup=task;\n   const result={status:'uncertain',messageId:null,media:[]};\n   const active=()=>connected&&socket===current&&pendingGroup===task&&!task.changed&&!rejectedGroups.has(groupJid);\n   try{\n    // Native album does not trigger maintenance, retry, or individual-image fallback.\n    if(!active())return result;\n    const parent=await current.sendMessage(groupJid,{album:{expectedImageCount:images.length,expectedVideoCount:0}},{useCachedGroupMetadata:true});\n    if(typeof parent?.key?.id!=='string'||!parent.key.id||parent.key.id.length>160)return result;\n    result.messageId=parent.key.id;\n    for(const [index,item] of images.entries()){\n     if(!active())return result;\n     const child=await current.sendMessage(groupJid,{image:item.image,mimetype:'image/jpeg',caption:item.caption,albumParentKey:parent.key},{useCachedGroupMetadata:true});\n     const id=child?.key?.id;\n     if(typeof id!=='string'||!id||id.length>160||id===result.messageId||result.media.some(x=>x.messageId===id))return result;\n     result.media.push({index,messageId:id});\n    }\n    if(active())result.status='accepted';\n   }catch{}finally{if(pendingGroup===task)pendingGroup=null;}\n   return result;\n  },\n  async sendFile(groupJid,caption,bytes,mime,name){"
    ]
  ],
  "connect/whatsapp-lab/windows-bridge.mjs": [
    [
      "validCampaignFile,CAMPAIGN_FILE_MAX}",
      "validCampaignFile,CAMPAIGN_FILE_MAX,validNativeAlbum}"
    ],
    [
      "export function createBridge({emit,providerFactory=createBaileysProvider,renderQr}){",
      "export function createBridge({emit,providerFactory=createBaileysProvider,renderQr,enableAlbums=false}){"
    ],
    [
      "const fileAttempts=new Set(),tracked=new Map(),earlyReceipts=new Map();",
      "const fileAttempts=new Set(),tracked=new Map(),earlyReceipts=new Map(),albumAttempts=new Set();"
    ],
    [
      "    }else if((message.action==='send_text'||message.action==='send_image'||message.action==='send_file')){",
      "    }else if(message.action==='send_album'){\n     const requestId=message.request_id;\n     if(typeof requestId!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId))return;\n     const report=(status,extra={})=>output('send_result',{request_id:requestId,status,...extra});\n     if(!enableAlbums||sending||diagnosing||state!=='conectado'||typeof current?.sendAlbum!=='function')return report('rejected');\n     if(albumAttempts.has(requestId.toLowerCase())||albumAttempts.size>=4096)return report('uncertain');\n     if(typeof message.group_jid!=='string'||!/^[0-9-]{1,64}@g[.]us$/.test(message.group_jid)||!Array.isArray(message.images)||message.images.length<2||message.images.length>4)return report('rejected');\n     const images=[];\n     for(const item of message.images){\n      if(typeof item?.image!=='string'||item.image.length>1398104)return report('rejected');\n      const image=Buffer.from(item.image,'base64');\n      if(image.toString('base64')!==item.image)return report('rejected');\n      images.push({image,caption:item.caption});\n     }\n     if(!validNativeAlbum(images))return report('rejected');\n     albumAttempts.add(requestId.toLowerCase());sending=true;\n     const revision=generation,provider=current;\n     try{\n      const receipt=await provider.sendAlbum(message.group_jid,images);\n      if(receipt?.blocked==='previous_421')return report('rejected',{reason_code:'previous_421'});\n      report(revision===generation&&state==='conectado'&&receipt?.status==='accepted'?'accepted':'uncertain',{message_id:receipt?.messageId??null,media:receipt?.media??[]});\n     }catch{report('uncertain');}finally{sending=false;}\n    }else if((message.action==='send_text'||message.action==='send_image'||message.action==='send_file')){"
    ],
    [
      "const bridge=createBridge({emit});",
      "const bridge=createBridge({emit,enableAlbums:process.env.NEO_CONNECT_ALBUM_V1==='1'});"
    ]
  ],
  "connect/windows/WhatsApp.cs": [
    [
      "TaskCompletionSource<Tuple<string,string>> automatedSend;",
      "TaskCompletionSource<Tuple<string,string>> automatedSend;\n    // Capability compiled for Teste only; local opt-in and the independent server gate authorize dispatch.\n    static readonly bool AlbumTransportApproved=true;\n    bool automatedAlbum;\n    Dictionary<string,object> automatedAlbumResult;\n    public bool CampaignAlbumReady { get { return AlbumTransportApproved&&!environment.IsProduction&&CampaignSessionReady&&canPublish!=null&&canPublish(); } }"
    ],
    [
      "    public async Task<Tuple<string,string>> DispatchCampaignImageAsync",
      "    public async Task<Dictionary<string,object>> DispatchCampaignAlbumAsync(Guid request,string group,List<Tuple<byte[],string>> images) {\n        var uncertain=new Dictionary<string,object>{{\"status\",\"uncertain\"}};\n        if(!CampaignAlbumReady||pendingSend!=Guid.Empty||automatedSend!=null||!selected.Contains(group)||request==Guid.Empty\n           ||canPublish==null||!canPublish()||images==null||images.Count<2||images.Count>4)return uncertain;\n        var payload=new List<object>();\n        foreach(var image in images){\n            if(image==null||image.Item1==null||image.Item1.Length<5||image.Item1.Length>1048576||image.Item2==null||image.Item2.Length>1000)return uncertain;\n            var bytes=image.Item1;\n            if(bytes[0]!=255||bytes[1]!=216||bytes[2]!=255||bytes[bytes.Length-2]!=255||bytes[bytes.Length-1]!=217)return uncertain;\n            payload.Add(new {image=Convert.ToBase64String(bytes),caption=image.Item2});\n        }\n        var completion=new TaskCompletionSource<Tuple<string,string>>(TaskCreationOptions.RunContinuationsAsynchronously);\n        automatedAlbum=true;automatedAlbumResult=null;automatedSend=completion;automatedRequest=request;sendingText=true;UpdateComposer();\n        try {\n            pipe.WriteLine(json.Serialize(new {action=\"send_album\",request_id=request.ToString(),group_jid=group,images=payload}));\n            if(await Task.WhenAny(completion.Task,Task.Delay(TimeSpan.FromSeconds(120)))==completion.Task)\n                return automatedAlbumResult??uncertain;\n            return uncertain;\n        }catch{return uncertain;}\n        finally{automatedAlbum=false;automatedAlbumResult=null;automatedSend=null;automatedRequest=Guid.Empty;sendingText=false;UpdateComposer();}\n    }\n    public async Task<Tuple<string,string>> DispatchCampaignImageAsync"
    ],
    [
      "start.EnvironmentVariables.Remove(\"NODE_OPTIONS\");start.EnvironmentVariables.Remove(\"NODE_PATH\");",
      "start.EnvironmentVariables.Remove(\"NODE_OPTIONS\");start.EnvironmentVariables.Remove(\"NODE_PATH\");\n            start.EnvironmentVariables[\"NEO_CONNECT_ALBUM_V1\"]=AlbumTransportApproved&&!environment.IsProduction?\"1\":\"0\";"
    ],
    [
      "var outcome=TextValue(result,\"status\");",
      "var outcome=TextValue(result,\"status\");\n                    if(automatedAlbum)automatedAlbumResult=new Dictionary<string,object>(result);"
    ]
  ],
  "connect/windows/Connect.cs": [
    [
      "originals_50mb=true});",
      "originals_50mb=true,album_v1=window.CampaignAlbumReady});",
      2
    ],
    [
      "var dispatchClock=System.Diagnostics.Stopwatch.StartNew();",
      "var dispatchClock=System.Diagnostics.Stopwatch.StartNew();\n        Dictionary<string,object> albumReceipt=null;"
    ],
    [
      "                if(kind==\"image\"||(kind==\"product\"&&!String.IsNullOrEmpty(Value(job,\"media_path\")))){",
      "                if(kind==\"album\"&&window.CampaignAlbumReady){\n                    object raw;\n                    var entries=job.TryGetValue(\"album_items\",out raw)?raw as System.Collections.IList:null;\n                    if(entries==null||entries.Count<2||entries.Count>4)throw new InvalidOperationException();\n                    var images=new List<Tuple<byte[],string>>();\n                    foreach(var entry in entries){\n                        var image=entry as Dictionary<string,object>;\n                        if(image==null)throw new InvalidOperationException();\n                        var bytes=await LoadRichCampaignJpeg(\"neo-campaign-images\",Value(image,\"media_path\"));\n                        images.Add(Tuple.Create(bytes,Value(image,\"text\")));\n                    }\n                    if(dispatchClock.Elapsed.TotalSeconds<85&&whatsapp==window&&window.CampaignConnection==connection&&window.CampaignAlbumReady&&deviceApproved&&SessionReady()&&Value(local,\"campaign_worker_enabled\")==\"1\"){\n                        albumReceipt=await window.DispatchCampaignAlbumAsync(request,Value(job,\"group_jid\"),images);\n                        var parent=Value(albumReceipt,\"message_id\");\n                        var status=Value(albumReceipt,\"status\");\n                        outcome=status==\"accepted\"&&!String.IsNullOrWhiteSpace(parent)?Tuple.Create(\"accepted\",parent):Tuple.Create(\"uncertain\",(string)null);\n                        if(!albumReceipt.ContainsKey(\"media\"))albumReceipt=null;\n                    }\n                }else if(kind==\"image\"||(kind==\"product\"&&!String.IsNullOrEmpty(Value(job,\"media_path\")))){"
    ],
    [
      "receipt_id=outcome.Item1==\"accepted\"?outcome.Item2:null,blocked_reason=",
      "receipt_id=outcome.Item1==\"accepted\"?outcome.Item2:null,album_receipt=albumReceipt,blocked_reason="
    ]
  ]
};
function patch(inputs){const result={};for(const [p,changes] of Object.entries(edits)){let v=inputs[p];if(typeof v!=="string")throw Error("missing "+p);for(const [a,b,n=1] of changes){if(v.split(a).length!==n+1)throw Error("anchor mismatch "+p+" "+a.slice(0,100));v=v.split(a).join(b)}result[p]=v;}return result;}
function apply(root){
 const input={};for(const [p,expected] of Object.entries(hashes)){const b=fs.readFileSync(path.join(root,p));const actual=crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');if(actual!==expected)throw Error('Source differs from '+baseline+': '+p);input[p]=b.toString('utf8');}
 const output=patch(input);for(const [p,s] of Object.entries(output))fs.writeFileSync(path.join(root,p),s,'utf8');
}
module.exports={patch,apply,baseline,hashes};
if(require.main===module){if(!process.argv[2])throw Error('Provide isolated 0.2.28 worktree');apply(path.resolve(process.argv[2]));}
