// Adaptador experimental, restrito a pareamento e metadados de grupos.
const loadModules=()=>Promise.all([import('@whiskeysockets/baileys'),import('pino')]);

// 25 MiB MP4, 5 MiB PDF; base64 and JSON fit the 40 MiB Windows IPC envelope.
export const CAMPAIGN_FILE_MAX=25*1024*1024;
export function validCampaignFile(bytes,mime,name){
 if(!Buffer.isBuffer(bytes)||bytes.length<8||bytes.length>(mime==='video/mp4'?CAMPAIGN_FILE_MAX:5*1024*1024)||typeof name!=='string'||!name.trim()||name.length>160||/[\\/:*?"<>|\x00-\x1f\x7f]/.test(name))return false;
 if(mime==='application/pdf')return /\.pdf$/i.test(name)&&bytes.subarray(0,5).toString('ascii')==='%PDF-'&&bytes.subarray(Math.max(0,bytes.length-1024)).includes(Buffer.from('%%EOF'));
 if(mime==='video/mp4')return /\.mp4$/i.test(name)&&bytes.length>=16&&bytes.subarray(4,8).toString('ascii')==='ftyp'&&bytes.readUInt32BE(0)>=8&&bytes.readUInt32BE(0)<=bytes.length;
 return false;
}
export async function createBaileysProvider(
 {onQr,onState,onCredentials=()=>{},serialized=null},
 {load=loadModules,schedule=setTimeout,cancel=clearTimeout}={}
){
 let socket=null,connected=false,closed=false,retries=0,reconnectTimer;
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
  current.end?.(undefined);
 }
 function start(){
  if(closed)return;
  const current=baileys.default({
   auth,logger:pino({level:'silent'}),markOnlineOnConnect:false,syncFullHistory:false,
   shouldSyncHistoryMessage:()=>false,defaultQueryTimeoutMs:15000
  });
  socket=current;
  current.ev.on('creds.update',save);
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
  if(!Object.values(groups).some(group=>group?.id===groupJid))throw Error('A conta não participa deste grupo.');
  const receipt=await current.sendMessage(groupJid,payload);
  if(!receipt?.key?.id)throw Error('Não foi possível confirmar o aceite do envio.');
  return {messageId:String(receipt.key.id).slice(0,160)};
 }
 return {
  start,
  account(){
   const user=connected?socket?.user:null;
   const number=/^([0-9]{6,15})(?::[0-9]+)?@s\.whatsapp\.net$/.exec(user?.id??'')?.[1];
   return {name:user?.name??'',number:number??''};
  },
  async listGroups(){
   const current=socket;
   if(!connected||!current)throw Error('Sem sessão ativa.');
   const groups=await current.groupFetchAllParticipating();
   if(!connected||current!==socket)throw Error('A sessão mudou.');
   return Object.values(groups).map(row=>({
    id:row.id,name:row.subject,members:Number.isSafeInteger(row.size)?row.size:Array.isArray(row.participants)?row.participants.length:null
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
   const payload=mime==='application/pdf'||bytes.length>16*1024*1024?{document:bytes,mimetype:mime,fileName:name,caption:caption.trim()}:{video:bytes,mimetype:mime,caption:caption.trim()};
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
