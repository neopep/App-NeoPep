// Protocolo privado por pipes herdados. Nenhuma porta HTTP é aberta.
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createBaileysProvider} from './whatsapp-provider.mjs';

export function createBridge({emit,providerFactory=createBaileysProvider,renderQr}){
 let current,generation=0,qrVersion=0,state='desconectado',checking=false,closed=false;
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
  if(line.length>16*1024*1024)return;
  pending=pending.then(async()=>{try{await bridge.receive(JSON.parse(line));}catch{}});
 });
}
