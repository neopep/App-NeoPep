// Adaptador local, nao oficial. Nunca envia mensagens nem exporta credenciais ou conversas.
import {mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';

function authFolder(){
 const root=process.env.LOCALAPPDATA||join(homedir(),'.local','share');
 return join(root,'NeoPep Connect','whatsapp-lab-auth');
}
export async function createBaileysProvider({onQr,onState}){
 let socket=null,connected=false,closed=false;
 const folder=authFolder();
 return {
  async start(){
   // Importacao apenas quando o operador solicita o pareamento experimental.
   let baileys,logger;
   try{
    [baileys,{default:logger}]=await Promise.all([
     import('@whiskeysockets/baileys'),import('pino')
    ]);
   }catch{
    const error=new Error('Dependencias do laboratorio nao instaladas.');
    error.code='PROVIDER_UNAVAILABLE';throw error;
   }
   await mkdir(folder,{recursive:true,mode:0o700});
   const {state,saveCreds}=await baileys.useMultiFileAuthState(folder);
   if(closed)return;
   socket=baileys.default({
    auth:state,
    logger:logger({level:'silent'}),
    markOnlineOnConnect:false,
    syncFullHistory:false,
    printQRInTerminal:false
   });
   socket.ev.on('creds.update',saveCreds);
   socket.ev.on('connection.update',update=>{
    if(closed)return;
    if(update.qr){
     void Promise.resolve(onQr(update.qr)).catch(()=>{onState('erro');});
    }
    if(update.connection==='open'){
     connected=true;onState('conectado');
    }else if(update.connection==='close'){
     connected=false;onState('desconectado');
    }
   });
   // Nao existem handlers de mensagens, contatos, participantes ou publicacoes.
  },
  async listGroups(){
   if(!connected||!socket)throw new Error('Sem sessao ativa.');
   const groups=await socket.groupFetchAllParticipating();
   return Object.values(groups).map(row=>({
    id:row.id,
    name:row.subject,
    members:Array.isArray(row.participants)?row.participants.length:null
   }));
  },
  async forget(){
   closed=true;
   if(socket){
    try{await socket.logout();}finally{socket.ws?.close?.();}
   }
   // Apaga somente o estado local do laboratorio explicitamente ao desconectar.
   await rm(folder,{recursive:true,force:true});
   connected=false;
   onState('desconectado');
  },
  async close(){
   closed=true;connected=false;
   socket?.ws?.close?.();
  }
 };
}
