// NeoPep Connect: laboratório local QR, sem envio de mensagens e sem acesso ao Supabase.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createBaileysProvider} from './whatsapp-provider.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const allowed=new Map([
 ['/', ['ui/index.html','text/html; charset=utf-8']],
 ['/app.js',['ui/app.js','text/javascript; charset=utf-8']],
 ['/style.css',['ui/style.css','text/css; charset=utf-8']]
]);
const headers={
 'Cache-Control':'no-store, max-age=0',
 'Pragma':'no-cache',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};
function send(res,status,value,type='application/json; charset=utf-8'){
 res.writeHead(status,{...headers,'Content-Type':type});
 res.end(type.startsWith('application/json')?JSON.stringify(value):value);
}
function errStatus(error){
 return String(error?.code||'')==='PROVIDER_UNAVAILABLE'?'dependencia_indisponivel':'operacao_indisponivel';
}
function safeGroups(rows){
 if(!Array.isArray(rows))return [];
 return rows.filter(x=>typeof x?.id==='string'&&x.id.endsWith('@g.us'))
  .map(x=>({id:x.id,name:String(x.name||'Sem nome').slice(0,120),members:Number.isSafeInteger(x.members)?x.members:null}))
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).slice(0,500);
}
export async function createLab({providerFactory=createBaileysProvider,qrRenderer,autoOpen=false}={}){
 const token=randomBytes(32).toString('base64url');
 let provider=null,starting=false,busy=false,closed=false;
 const state={connection:'desconectado',qr:null,groups:[],updatedAt:new Date().toISOString(),error:null};
 let hostOrigin='';
 function update(next){
  Object.assign(state,next,{updatedAt:new Date().toISOString()});
 }
 const server=createServer(async(req,res)=>{
  const target=new URL(req.url||'/', 'http://127.0.0.1');
  const host=req.headers.host||'';
  if(host!==hostOrigin.replace('http://','')||req.socket.remoteAddress!=='127.0.0.1'){
   send(res,403,{error:'acesso_negado'});return;
  }
  if(req.method==='GET'&&allowed.has(target.pathname)){
   const [name,type]=allowed.get(target.pathname);
   try{send(res,200,await readFile(join(here,name),'utf8'),type);}
   catch{send(res,500,{error:'interface_indisponivel'});}
   return;
  }
  if(!target.pathname.startsWith('/api/')){
   send(res,404,{error:'nao_encontrado'});return;
  }
  if(req.headers.authorization!=='Bearer '+token){
   send(res,401,{error:'nao_autorizado'});return;
  }
  if(req.method==='GET'&&target.pathname==='/api/status'){
   send(res,200,state);return;
  }
  if(req.method!=='POST'||req.headers.origin!==hostOrigin){
   send(res,403,{error:'origem_invalida'});return;
  }
  if(target.pathname==='/api/connect'){
   if(starting||['conectando','aguardando_qr','conectado'].includes(state.connection)){
    send(res,409,{error:'conexao_ja_iniciada'});return;
   }
   starting=true;update({connection:'conectando',qr:null,error:null});
   send(res,202,{started:true});
   void (async()=>{
    try{
     if(provider){await provider.close?.();provider=null;}
     const candidate=await providerFactory({
      onQr:async raw=>{
       const render=qrRenderer||(async qr=>{
        const qrcode=(await import('qrcode')).default;
        return qrcode.toDataURL(qr,{width:260,margin:2,errorCorrectionLevel:'M'});
       });
       const picture=await render(raw);
       if(!closed&&state.connection!=='conectado'&&state.connection!=='desconectado')update({connection:'aguardando_qr',qr:picture,error:null});
      },
      onState:next=>{
       if(closed)return;
       if(next==='conectado')update({connection:next,qr:null,error:null});
       else update({connection:next,qr:null,groups:[]});
      }
     });
     if(closed){await candidate.close?.();return;}
     provider=candidate;
     await provider.start();
    }catch(error){
     update({connection:'erro',qr:null,error:errStatus(error)});
    }finally{starting=false;}
   })();
   return;
  }
  if(target.pathname==='/api/groups'){
   if(state.connection!=='conectado'||!provider){
    send(res,409,{error:'nao_conectado'});return;
   }
   if(busy){send(res,409,{error:'consulta_em_andamento'});return;}
   busy=true;
   try{
    const groups=safeGroups(await provider.listGroups());
    update({groups,error:null});send(res,200,{groups});
   }catch(error){update({error:errStatus(error)});send(res,503,{error:'grupos_indisponiveis'});}
   finally{busy=false;}
   return;
  }
  if(target.pathname==='/api/forget'){
   if(busy||starting){send(res,409,{error:'ocupado'});return;}
   busy=true;
   try{
    await provider?.forget();
    provider=null;
    update({connection:'desconectado',qr:null,groups:[],error:null});
    send(res,200,{ok:true});
   }catch{send(res,503,{error:'desconexao_indisponivel'});}
   finally{busy=false;}
   return;
  }
  send(res,404,{error:'acao_desconhecida'});
 });
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolve);
 });
 const port=server.address().port;
 hostOrigin='http://127.0.0.1:'+port;
 const url=hostOrigin+'/#'+token;
 if(autoOpen&&process.platform==='win32'){
  try{const child=spawn('cmd.exe',['/d','/c','start','',url],{stdio:'ignore',windowsHide:true,detached:true});child.unref();}catch{}
 }
 return {url,origin:hostOrigin,token,state,async close(){
  closed=true;
  await provider?.close?.();
  await new Promise(resolve=>server.close(resolve));
 }};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 if(process.env.NEOPEP_WHATSAPP_LAB_ENABLE!=='1'){
  process.stderr.write('Laboratorio desabilitado. Exige ativacao explicita no ambiente de teste.\n');
  process.exitCode=2;
 }else{
  createLab({autoOpen:true}).then(lab=>{
   process.stdout.write('NeoPep Connect laboratorio aberto no navegador local: '+lab.origin+'/ (endereco com chave disponivel apenas na instancia em execucao)\n');
   process.stdout.write('Nenhuma mensagem sera enviada. Feche o processo para encerrar.\n');
  }).catch(()=>{process.stderr.write('Nao foi possivel iniciar a interface local.\n');process.exitCode=1;});
 }
}
