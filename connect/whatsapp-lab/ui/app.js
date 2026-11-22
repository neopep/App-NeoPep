'use strict';
const token=location.hash.slice(1);
const stateEl=document.getElementById('state'),qrArea=document.getElementById('qr-area'),qr=document.getElementById('qr');
const connect=document.getElementById('connect'),refresh=document.getElementById('refresh'),forget=document.getElementById('forget'),groups=document.getElementById('groups');
const labels={desconectado:'Desconectado',conectando:'Preparando conexão…',aguardando_qr:'Aguardando leitura do QR Code',conectado:'WhatsApp conectado — somente leitura',erro:'Conexão indisponível'};
let current='',busy=false;
function note(value){stateEl.textContent=value;}
async function request(path,method='GET'){
 const response=await fetch(path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/json'}:{})}});
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||'falha_de_conexao');
 return data;
}
function showGroups(rows){
 groups.replaceChildren();
 if(!rows.length){const li=document.createElement('li');li.textContent='Nenhum grupo retornado para esta conta.';groups.append(li);return;}
 for(const row of rows){
  const li=document.createElement('li');
  const name=document.createElement('strong');name.textContent=row.name;
  const count=document.createElement('span');count.textContent=row.members===null?'Quantidade não disponível':row.members+' participantes';
  li.append(name,count);groups.append(li);
 }
}
async function poll(){
 if(!token){note('Acesso local inválido. Abra a interface pelo processo NeoPep Connect.');return;}
 try{
  const data=await request('/api/status');
  current=data.connection;
  note((labels[current]||current)+(data.error?' · Verifique o ambiente de teste.':''));
  connect.disabled=busy||['conectado','aguardando_qr','conectando'].includes(current);
  refresh.disabled=busy||current!=='conectado';
  forget.disabled=busy||!['conectado','aguardando_qr','desconectado','erro'].includes(current);
  qrArea.hidden=!data.qr||current!=='aguardando_qr';
  if(!qrArea.hidden)qr.src=data.qr;else qr.removeAttribute('src');
  if(current!=='conectado'&&groups.children.length&&groups.children[0].dataset.loaded==='true'){
   showGroups([]);
  }
 }catch{note('Não foi possível consultar o serviço local.');}
}
connect.addEventListener('click',async()=>{
 busy=true;connect.disabled=true;
 try{await request('/api/connect','POST');note('Conectando…');}
 catch{note('Não foi possível iniciar o pareamento.');}
 finally{busy=false;await poll();}
});
refresh.addEventListener('click',async()=>{
 busy=true;refresh.disabled=true;
 try{
  const data=await request('/api/groups','POST');
  showGroups(data.groups);
  groups.firstElementChild.dataset.loaded='true';
 }catch{note('Falha ao consultar grupos. Tente novamente após confirmar a conexão.');}
 finally{busy=false;await poll();}
});
forget.addEventListener('click',async()=>{
 if(!confirm('Desconectar e apagar a sessão local deste laboratório?'))return;
 busy=true;forget.disabled=true;
 try{await request('/api/forget','POST');showGroups([]);note('Sessão local apagada.');}
 catch{note('Não foi possível apagar a sessão.');}
 finally{busy=false;await poll();}
});
if(token){void poll();setInterval(()=>{if(!document.hidden)void poll();},2500);}
else note('Abra o laboratório pelo link gerado localmente pelo programa.');