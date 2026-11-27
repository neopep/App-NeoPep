// Protocolo privado por pipes herdados. Nenhuma porta HTTP é aberta.
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createBaileysProvider,validCampaignFile,CAMPAIGN_FILE_MAX} from './whatsapp-provider.mjs';

export function createBridge({emit,providerFactory=createBaileysProvider,renderQr}){
 let current,generation=0,qrVersion=0,state='desconectado',checking=false,sending=false,closed=false;
 // Refuse replay of original-file request IDs during the runtime session, including uncertain sends.
 const fileAttempts=new Set();
 const output=(type,value)=>{if(!closed)emit({type,value});};
 function update(next){state=next;++qrVersion;output('state',next);}
 return {
  async receive(message){
   if(closed)return;
   try{
    if(message.action==='connect'){
     const revision=++generation;
     await current?.close();current=null;update('conectando');
     const candidate=await providerFactory({
      serialized:typeof message.vault==='string'?message.vault:null,
      onCredentials:value=>{if(revision===generation)output('vault',value);},
      onState:value=>{
       if(revision!==generation)return;
       update(value);
       if(value==='conectado'){
        const account=current?.account?.();
        output('account',{name:String(account?.name??'').slice(0,120),
         number:/^[0-9]{6,15}$/.test(account?.number??'')?account.number:''});
       }
      },
      onQr:async raw=>{
       const version=++qrVersion;
       const renderer=renderQr||(async value=>{
        const {default:qr}=await import('qrcode');
        return (await qr.toBuffer(value,{type:'png',width:264,margin:2})).toString('base64');
       });
       const image=await renderer(raw);
       if(revision===generation&&version===qrVersion&&state!=='conectado'){
        state='aguardando_qr';output('state',state);output('qr',image);
       }
      }
     });
     if(closed||revision!==generation){await candidate.close();return;}
     current=candidate;await current.start();
    }else if(message.action==='groups'&&state==='conectado'&&!checking){
     checking=true;output('groups_loading',null);
     const revision=generation;
     try{
      const rows=await current.listGroups();
      if(revision===generation&&state==='conectado')output('groups',rows.filter(row=>/^[0-9-]+@g\.us$/.test(row?.id))
       .map(row=>({id:row.id,name:String(row.name||'Sem nome').slice(0,120),members:Number.isSafeInteger(row.members)&&row.members>=0?row.members:null})));
     }finally{checking=false;}
    }else if((message.action==='send_text'||message.action==='send_image'||message.action==='send_file')){
     const requestId=typeof message.request_id==='string'&&/^[a-f0-9-]{36}$/i.test(message.request_id)?message.request_id:null;
     if(!requestId)return;
     if(sending||state!=='conectado'||!current){
      output('send_result',{request_id:requestId,status:'rejected',reason:'Envio indisponível ou em andamento.'});return;
     }
     const jid=message.group_jid,text=message.text;
     const isImage=message.action==='send_image';
     const isFile=message.action==='send_file';
     const base64=message.image;
     let image;
     if(isImage&&typeof base64==='string'&&base64.length<=1398104&&base64.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(base64)){
      const bytes=Buffer.from(base64,'base64');
      if(bytes.length>=4&&bytes.length<=1024*1024&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217)image=bytes;
     }
     let file;
     if(isFile&&typeof message.file==='string'&&message.file.length<=Math.ceil(CAMPAIGN_FILE_MAX/3)*4&&message.file.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(message.file)){
      const bytes=Buffer.from(message.file,'base64');
      if(bytes.toString('base64')===message.file&&validCampaignFile(bytes,message.mime,message.name))file=bytes;
     }
     if(typeof jid!=='string'||!/^[0-9-]{1,64}@g\.us$/.test(jid)
       ||typeof text!=='string'||text.length>2000||(isImage?!image:isFile?(!file||text.length>1000||typeof current.sendFile!=='function'):!text.trim())){
      output('send_result',{request_id:requestId,status:'rejected',reason:'Grupo ou texto inválido.'});return;
     }
     if(isFile&&(fileAttempts.has(requestId)||fileAttempts.size>=4096)){
      output('send_result',{request_id:requestId,status:'uncertain',reason:'Solicitação já processada ou limite da sessão. Confira o histórico antes de continuar.'});return;
     }
     if(isFile)fileAttempts.add(requestId);
     sending=true;const revision=generation,provider=current;
     try{
      const receipt=isImage?await provider.sendImage(jid,text,image):isFile?await provider.sendFile(jid,text,file,message.mime,message.name):await provider.sendText(jid,text);
      output('send_result',{request_id:requestId,status:revision===generation&&state==='conectado'?'accepted':'uncertain',
       message_id:String(receipt?.messageId??'').slice(0,160)});
     }catch{
      output('send_result',{request_id:requestId,status:'uncertain',reason:'O envio não pôde ser confirmado. Confira no WhatsApp antes de tentar novamente.'});
     }finally{sending=false;}
    }else if(message.action==='disconnect'){
     ++generation;const previous=current;current=null;update('desconectando');output('vault',null);
     const revoked=previous?await previous.forget():false;
     update(revoked?'desconectado':'limpeza_local');
    }
   }catch{
    output('error',message.action==='groups'?'grupos_indisponiveis':'operacao_indisponivel');
    if(message.action!=='groups')update('erro');
   }
  },
  async close(){closed=true;++generation;await current?.close();}
 };
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const bridge=createBridge({emit:message=>process.stdout.write(JSON.stringify(message)+'\n')});
 const lines=createInterface({input:process.stdin,terminal:false});
 const stop=async()=>{try{await bridge.close()}finally{process.exit(0)}};
 lines.on('close',()=>{void stop()});
 process.on('uncaughtException',()=>{void stop()});
 process.on('unhandledRejection',()=>{void stop()});
 let pending=Promise.resolve();
 lines.on('line',line=>{
  if(line.length>40*1024*1024)return;
  pending=pending.then(async()=>{try{await bridge.receive(JSON.parse(line));}catch{}});
 });
}
