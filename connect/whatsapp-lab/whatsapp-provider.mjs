// Adaptador experimental, restrito a pareamento e metadados de grupos.
const loadModules=()=>Promise.all([import('@whiskeysockets/baileys'),import('pino')]);

// 25 MiB MP4/MOV, 5 MiB PDF; base64 and JSON fit the 40 MiB Windows IPC envelope.
export const CAMPAIGN_FILE_MAX=25*1024*1024;
export function validCampaignFile(bytes,mime,name){
 if(!Buffer.isBuffer(bytes)||bytes.length<8||bytes.length>(mime==='application/pdf'?5*1024*1024:CAMPAIGN_FILE_MAX)||typeof name!=='string'||!name.trim()||name.length>160||/[\\/:*?"<>|\x00-\x1f\x7f]/.test(name))return false;
 if(mime==='application/pdf')return /\.pdf$/i.test(name)&&bytes.subarray(0,5).toString('ascii')==='%PDF-'&&bytes.subarray(Math.max(0,bytes.length-1024)).includes(Buffer.from('%%EOF'));
 if(mime==='video/quicktime')return /\.mov$/i.test(name)&&bytes.length>=16&&bytes.subarray(4,8).toString('ascii')==='ftyp'&&bytes.subarray(8,12).toString('ascii')==='qt  '&&bytes.readUInt32BE(0)>=16&&bytes.readUInt32BE(0)<=bytes.length;
 if(mime==='video/mp4')return /\.mp4$/i.test(name)&&bytes.length>=16&&bytes.subarray(4,8).toString('ascii')==='ftyp'&&bytes.readUInt32BE(0)>=8&&bytes.readUInt32BE(0)<=bytes.length;
 return false;
}
// Diagnostics only: never infer a phone number from a LID or publish participant IDs.
export function groupDiagnostics(row,ownIds){
 const normalize=id=>typeof id==='string'?id.replace(/:[0-9]+@/,'@'):'';
 const own=new Set(ownIds.map(normalize).filter(Boolean));
 const self=Array.isArray(row.participants)?row.participants.find(p=>[p.id,p.phoneNumber,p.lid].some(id=>own.has(normalize(id)))):undefined;
 const role=self?(self.admin==='superadmin'||self.isSuperAdmin===true?'superadmin':self.admin==='admin'||self.isAdmin===true?'admin':'member'):'unknown';
 return {addressing_mode:['pn','lid'].includes(row.addressingMode)?row.addressingMode:'unknown',
  role,posting:row.announce===true?'admins':row.announce===false?'all':'unknown',
  settings:row.restrict===true?'admins':row.restrict===false?'all':'unknown'};
}
// Fresh, read-only group metadata check. Participant identifiers never leave this module.
export function compareGroupMetadata(listed, fresh, ownIds, changedDuringRead=false){
 const mode=row=>['pn','lid'].includes(row?.addressingMode)?row.addressingMode:'unknown';
 const ids=row=>Array.isArray(row?.participants)?row.participants.map(p=>typeof p?.id==='string'?p.id.replace(/:[0-9]+@/,'@'):''):null;
 const before=ids(listed),after=ids(fresh);
 const sameMembers=!!before&&!!after&&before.length===after.length&&new Set(before).size===new Set(after).size&&before.every(id=>after.includes(id));
 const stats={listed_mode:mode(listed),fresh_mode:mode(fresh),listed_count:before?.length??0,fresh_count:after?.length??0,
  lid_count:after?.filter(id=>id.endsWith('@lid')).length??0,pn_count:after?.filter(id=>id.endsWith('@s.whatsapp.net')).length??0,
  members_changed:!sameMembers||changedDuringRead};
 const self=fresh?groupDiagnostics(fresh,ownIds):{role:'unknown',posting:'unknown'};
 let code='ok';
 if(!fresh||fresh.id!==listed?.id||!after?.length||after.some(id=>!id)||new Set(after).size!==after.length)code='metadata_invalid';
 else if(stats.listed_mode==='unknown'||stats.fresh_mode==='unknown'||stats.listed_mode!==stats.fresh_mode)code='mode_mismatch';
 else if(self.role==='unknown'||self.posting==='unknown'||(self.posting==='admins'&&!['admin','superadmin'].includes(self.role)))code='permission_unverified';
 else if(changedDuringRead)code='membership_changed_during_read';
 else if(!sameMembers)code='membership_refreshed';
 return {...stats,code};
}
// Local-only inventory: presence of a record does not prove that its key or session is valid.
export async function auditGroupCryptoStore({groupJid,metadata,keys,repository,ownPn,ownLid}){
 const parse=id=>{
  const match=typeof id==='string'&&/^([0-9]+)(?::([0-9]+))?@(lid|s\.whatsapp\.net|hosted\.lid|hosted)$/.exec(id);
  return match?{user:match[1],device:match[2]||'0',domain:match[3],bare:match[1]+'@'+match[3]}:null;
 };
 const members=Array.isArray(metadata?.participants)?metadata.participants:[];
 const aliases=new Set(),deviceAddresses=new Set();
 let cachedMembers=0,uncachedMembers=0;
 for(const member of members){
  for(const value of [member?.id,member?.lid,member?.phoneNumber]){
   const parsed=parse(value);if(parsed)aliases.add(parsed.bare);
  }
  const primary=parse(member?.id);
  const cached=primary&&keys.get('device-list:'+primary.user);
  if(!Array.isArray(cached)||!cached.length){uncachedMembers++;continue;}
  cachedMembers++;
  for(const device of cached){
   if(typeof device!=='string'||!/^\d{1,3}$/.test(device))continue;
   deviceAddresses.add(primary.user+':'+device+'@'+primary.domain);
  }
 }
 const raw=keys.get('sender-key-memory:'+groupJid);
 const mapPresent=raw!==undefined&&raw!==null;
 const mapValid=!mapPresent||(typeof raw==='object'&&!Array.isArray(raw)&&!ArrayBuffer.isView(raw));
 const remembered=mapPresent&&mapValid?Object.entries(raw).filter(([,value])=>value===true).map(([id])=>id):[];
 let lid=0,pn=0,other=0,unmatched=0,unparseable=0;
 for(const id of remembered){
  const entry=parse(id);
  if(!entry){other++;unparseable++;continue;}
  if(entry.domain==='lid'||entry.domain==='hosted.lid')lid++;else pn++;
  if(!aliases.has(entry.bare))unmatched++;
 }
 let sessionRecords=null;
 if(typeof repository?.jidToSignalProtocolAddress==='function'){
  const addresses=new Set();
  let count=0;
  for(const jid of deviceAddresses){
   try{const address=repository.jidToSignalProtocolAddress(jid);if(typeof address==='string'&&address&&!addresses.has(address)){addresses.add(address);if(keys.has('session:'+address))count++;}}catch{}
  }
  sessionRecords=count;
 }
 const presence=async id=>{
  if(!parse(id)||typeof repository?.hasSenderKey!=='function')return 'unknown';
  try{return await repository.hasSenderKey({group:groupJid,meId:id})?'present':'absent';}catch{return 'unknown';}
 };
 return {store_status:mapValid?'inspected':'invalid_memory_shape',memory_status:!mapPresent?'absent':mapValid?'present':'invalid',
  memory_entries:remembered.length,memory_lid:lid,memory_pn:pn,memory_other:other,memory_unmatched:unmatched,memory_unparseable:unparseable,
  cached_members:cachedMembers,uncached_members:uncachedMembers,cached_devices:deviceAddresses.size,session_records:sessionRecords,
  own_lid_available:!!parse(ownLid)&&['lid','hosted.lid'].includes(parse(ownLid).domain),
  own_lid_key:await presence(ownLid),own_pn_key:await presence(ownPn)};
}
export async function createBaileysProvider(
 {onQr,onState,onCredentials=()=>{},onReceipt=()=>{},onGroupCheck=()=>{},serialized=null},
 {load=loadModules,schedule=setTimeout,cancel=clearTimeout}={}
){
 let socket=null,connected=false,closed=false,retries=0,reconnectTimer,pendingGroup=null,pendingDiagnostic=null;
 const [baileys,{default:pino}]=await load();
 const {BufferJSON,DisconnectReason,proto}=baileys;
 const stored=serialized?JSON.parse(serialized,BufferJSON.reviver):null;
 const creds=stored?.creds||baileys.initAuthCreds();
 const keys=new Map(Array.isArray(stored?.keys)?stored.keys:[]);
 const save=()=>{if(!closed)onCredentials(JSON.stringify({creds,keys:[...keys]},BufferJSON.replacer));};
 const auth={creds,keys:{
  async get(type,ids){
   const result=Object.create(null);
   for(const id of ids){
    let value=keys.get(type+':'+id);
    if(type==='app-state-sync-key'&&value)value=proto.Message.AppStateSyncKeyData.fromObject(value);
    if(value)result[id]=value;
   }
   return result;
  },
  async set(data){
   for(const [type,entries] of Object.entries(data))for(const [id,value] of Object.entries(entries)){
    const key=type+':'+id;
    if(value)keys.set(key,value);else keys.delete(key);
   }
   save();
  }
 }};
 function detach(current){
  if(!current)return;
  current.ev.removeAllListeners('connection.update');
  current.ev.removeAllListeners('creds.update');
  current.ev.removeAllListeners('messages.update');
  current.ev.removeAllListeners('message-receipt.update');
  current.ev.removeAllListeners('group-participants.update');
  current.end?.(undefined);
 }
 function start(){
  if(closed)return;
  const current=baileys.default({
   auth,logger:pino({level:'silent'}),markOnlineOnConnect:false,syncFullHistory:false,
   shouldSyncHistoryMessage:()=>false,defaultQueryTimeoutMs:15000,
   // The documented metadata hook runs at relay time. No long-lived metadata cache.
   cachedGroupMetadata:async jid=>{
    const task=pendingGroup;
    if(!task||task.socket!==current||task.jid!==jid)return undefined;
    let fresh;
    const reportCheck=check=>{if(!closed&&socket===current)onGroupCheck({group_jid:jid,...check});};
    try{fresh=await current.groupMetadata(jid);}
    catch{reportCheck({code:'metadata_unavailable'});throw Error('Metadados do grupo indisponíveis.');}
    if(!connected||socket!==current)throw Error('A sessão mudou.');
    const ownIds=[current.user?.id,current.user?.lid,creds.me?.id,creds.me?.lid];
    const check=compareGroupMetadata(task.listed,fresh,ownIds,task.changed);
    reportCheck(check);
    if(!['ok','membership_refreshed'].includes(check.code))throw Error('Metadados ou permissões do grupo inconsistentes.');
    return fresh;
   }
  });
  socket=current;
  current.ev.on('creds.update',save);
  current.ev.on('group-participants.update',event=>{
   if(pendingGroup?.socket===current&&pendingGroup.jid===event?.id)pendingGroup.changed=true;
   if(pendingDiagnostic?.socket===current&&pendingDiagnostic.jid===event?.id)pendingDiagnostic.changed=true;
  });
  // A generated message key is not delivery evidence.
  const validKey=key=>key?.fromMe===true&&/^[0-9-]{1,64}@g\.us$/.test(key.remoteJid||'')&&typeof key.id==='string'&&key.id.length>0&&key.id.length<=160;
  const report=(key,status,code)=>{if(!closed&&current===socket&&validKey(key))onReceipt({group_jid:key.remoteJid,message_id:key.id,status,...(code?{error_code:code}:{})});};
  current.ev.on('messages.update',updates=>{
   const ack=proto?.WebMessageInfo?.Status?.SERVER_ACK;
   if(ack===undefined||!Array.isArray(updates))return;
   const failure=proto?.WebMessageInfo?.Status?.ERROR;
   for(const {key,update} of updates){
    if(update?.status===ack)report(key,'server_ack');
    else if(failure!==undefined&&update?.status===failure){
     const raw=String(update?.messageStubParameters?.[0]??'');
     report(key,'send_error',/^[0-9]{1,5}$/.test(raw)?raw:'unknown');
    }
   }
  });
  current.ev.on('message-receipt.update',updates=>{
   if(!Array.isArray(updates)||typeof baileys.areJidsSameUser!=='function')return;
   for(const {key,receipt} of updates){
    const participant=receipt?.userJid,own=[current.user?.id,current.user?.lid,creds.me?.id,creds.me?.lid].filter(Boolean);
    // rc14 uses receiptTimestamp specifically for DELIVERY_ACK.
    if(validKey(key)&&own.length&&typeof participant==='string'&&!own.some(id=>baileys.areJidsSameUser(participant,id))&&Number(receipt?.receiptTimestamp)>0)report(key,'delivery_ack');
   }
  });
  current.ev.on('connection.update',update=>{
   if(closed||current!==socket)return;
   if(update.qr)void Promise.resolve(onQr(update.qr)).catch(()=>{onState('erro');});
   if(update.connection==='open'){connected=true;retries=0;onState('conectado');}
   if(update.connection!=='close')return;
   connected=false;socket=null;detach(current);
   const code=update.lastDisconnect?.error?.output?.statusCode;
   if(code===DisconnectReason.loggedOut||code===DisconnectReason.badSession){
    closed=true;keys.clear();onCredentials(null);onState('revogado');return;
   }
   if(code===DisconnectReason.connectionReplaced){onState('sessao_substituida');return;}
   if(++retries>5){onState('rede_indisponivel');return;}
   onState('reconectando');
   reconnectTimer=schedule(()=>{
    try{start()}catch{onState('rede_indisponivel');}
   },code===DisconnectReason.restartRequired?250:Math.min(15000,1000*2**(retries-1)));
  });
 }
 async function sendToParticipatingGroup(groupJid,payload){
  const current=socket;
  if(!connected||!current)throw Error('WhatsApp desconectado.');
  if(typeof groupJid!=='string'||!/^[0-9-]{1,64}@g\.us$/.test(groupJid))throw Error('Grupo inválido.');
  const groups=await current.groupFetchAllParticipating();
  if(!connected||socket!==current)throw Error('A sessão mudou.');
  const listed=Object.values(groups).find(group=>group?.id===groupJid);
  if(!listed)throw Error('A conta não participa deste grupo.');
  if(pendingGroup||pendingDiagnostic)throw Error('Operação em andamento.');
  const task={socket:current,jid:groupJid,listed,changed:false};
  pendingGroup=task;
  try{
   const receipt=await current.sendMessage(groupJid,payload,{useCachedGroupMetadata:true});
   if(!receipt?.key?.id)throw Error('Não foi possível obter o identificador da tentativa.');
   return {messageId:String(receipt.key.id).slice(0,160)};
  }finally{if(pendingGroup===task)pendingGroup=null;}
 }
 return {
  start,
  account(){
   const user=connected?socket?.user:null;
   const number=/^([0-9]{6,15})(?::[0-9]+)?@s\.whatsapp\.net$/.exec(user?.id??'')?.[1];
   return {name:user?.name??'',number:number??''};
  },
  // Read-only metadata inspection. Never relay, retry, reset or expose cryptographic material.
  async diagnoseGroup(jid){
   const current=socket;
   if(!connected||!current||pendingGroup||pendingDiagnostic||typeof jid!=='string'||!/^[0-9-]{1,64}@g\.us$/.test(jid))return {code:'diagnostic_unavailable',stage:'start'};
   const task={socket:current,jid,changed:false};
   pendingDiagnostic=task;
   let listed;
   try{
    let groups;
    try{groups=await current.groupFetchAllParticipating();}
    catch{return {code:'metadata_unavailable',stage:'list'};}
    if(!connected||current!==socket)return {code:'diagnostic_unavailable',stage:'list'};
    listed=Object.values(groups||{}).find(row=>row?.id===jid);
    if(!listed)return {code:'not_participating',stage:'list'};
    let fresh;
    try{fresh=await current.groupMetadata(jid);}
    catch{return {code:'metadata_unavailable',stage:'individual',listed_mode:listed.addressingMode,listed_count:Array.isArray(listed.participants)?listed.participants.length:0};}
    if(!connected||current!==socket)return {code:'diagnostic_unavailable',stage:'individual'};
    const ownIds=[current.user?.id,current.user?.lid,creds.me?.id,creds.me?.lid];
    const result=compareGroupMetadata(listed,fresh,ownIds,task.changed);
    const own=fresh?groupDiagnostics(fresh,ownIds):{role:'unknown',posting:'unknown',settings:'unknown'};
    let audit={store_status:'unavailable'};
    try{
     audit=await auditGroupCryptoStore({groupJid:jid,metadata:fresh,keys,repository:current.signalRepository,
      ownPn:creds.me?.id||current.user?.id,ownLid:creds.me?.lid||current.user?.lid});
    }catch{}
    if(!connected||current!==socket)return {code:'diagnostic_unavailable',stage:'individual'};
    return {...result,...audit,stage:'complete',role:own.role,posting:own.posting,settings:own.settings,
     unknown_count:Math.max(0,result.fresh_count-result.lid_count-result.pn_count),crypto_status:'not_verified'};
   }finally{if(pendingDiagnostic===task)pendingDiagnostic=null;}
  },
  async listGroups(){
   const current=socket;
   if(!connected||!current)throw Error('Sem sessão ativa.');
   const groups=await current.groupFetchAllParticipating();
   if(!connected||current!==socket)throw Error('A sessão mudou.');
   return Object.values(groups).map(row=>({
    id:row.id,name:row.subject,members:Number.isSafeInteger(row.size)?row.size:Array.isArray(row.participants)?row.participants.length:null,
    ...groupDiagnostics(row,[current.user?.id,current.user?.lid,creds.me?.id,creds.me?.lid])
   }));
  },
  // Envio manual, não automático: confirma participação antes de enviar.
  // Um timeout/erro após a chamada não autoriza nova tentativa automática.
  async sendText(groupJid,text){
   if(typeof text!=='string'||!text.trim()||text.length>2000)throw Error('Mensagem inválida.');
   return sendToParticipatingGroup(groupJid,{text:text.trim()});
  },
  async sendImage(groupJid,caption,image){
   if(typeof caption!=='string'||caption.length>2000||!Buffer.isBuffer(image)||image.length<4||image.length>1024*1024)
    throw Error('Imagem ou legenda inválida.');
   return sendToParticipatingGroup(groupJid,{image,caption:caption.trim(),mimetype:'image/jpeg'});
  },
  async sendFile(groupJid,caption,bytes,mime,name){
   if(typeof caption!=='string'||caption.length>1000||!validCampaignFile(bytes,mime,name))throw Error('Arquivo ou legenda inválido.');
   const payload=mime==='application/pdf'||mime==='video/quicktime'||bytes.length>16*1024*1024?{document:bytes,mimetype:mime,fileName:name,caption:caption.trim()}:{video:bytes,mimetype:mime,caption:caption.trim()};
   return sendToParticipatingGroup(groupJid,payload);
  },
  async forget(){
   closed=true;connected=false;cancel(reconnectTimer);
   const current=socket;socket=null;keys.clear();onCredentials(null);
   if(!current)return !creds.registered;
   let timeout;
   try{
    await Promise.race([current.logout(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Tempo de revogação excedido.')),5000);})]);
    return true;
   }catch{return false;}
   finally{clearTimeout(timeout);detach(current);}
  },
  close(){
   closed=true;connected=false;cancel(reconnectTimer);detach(socket);socket=null;keys.clear();
  }
 };
}
