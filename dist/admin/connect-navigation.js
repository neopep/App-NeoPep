'use strict';

// Reorganiza os elementos já renderizados: não altera RPCs nem permissões.
function installNeoConnectNavigation(root){
 const body=root.querySelector('[data-connect-content]');
 if(!body)return;
 const views=[['overview','Visão geral'],['devices','Computadores'],['accounts','Contas'],['groups','Vínculos'],['simulation','Simulação'],['history','Histórico'],['help','Ajuda']];
 if(body.querySelector('[data-connect-updates]'))views.splice(2,0,['updates','Atualizações']);
 let nav=root.querySelector('[data-neo-connect-tabs]');
 if(!nav){
  nav=document.createElement('nav');nav.dataset.neoConnectTabs='';
  nav.className='neo-connect-tabs';nav.setAttribute('aria-label','Seções do NeoPep Connect');
  views.forEach(function(view){
   const b=document.createElement('button');b.type='button';b.className='secondary';
   b.dataset.neoConnectView=view[0];b.textContent=view[1];
   b.setAttribute('aria-controls','neo-connect-'+view[0]);nav.append(b);
  });
  body.before(nav);
  root.addEventListener('click',function(event){
   const b=event.target.closest('[data-neo-connect-view]');
   if(!b||!root.contains(b))return;
   root.dataset.neoConnectPage=b.dataset.neoConnectView;showNeoConnectNavigation(root);
  });
 }
 const panes={};
 views.forEach(function(view){
  const pane=document.createElement('section');pane.id='neo-connect-'+view[0];
  pane.className='neo-connect-pane';pane.dataset.neoConnectPanel=view[0];
  panes[view[0]]=pane;
 });
 panes.overview.innerHTML='<h4>Visão geral</h4>'+
  '<p>O painel cria campanhas e autoriza computadores. O programa Windows NeoPep Connect recebe e processa tarefas <strong>fictícias</strong> nesta versão.</p>'+
  '<div class="neo-connect-action-grid">'+
  '<button class="secondary" type="button" data-neo-connect-view="devices">1. Computadores</button>'+
  '<button class="secondary" type="button" data-neo-connect-view="accounts">2. Contas de teste</button>'+
  '<button class="secondary" type="button" data-neo-connect-view="groups">3. Vínculos de grupos</button>'+
  '<button class="secondary" type="button" data-neo-connect-view="simulation">4. Simulação</button></div>'+
  '<p class="sub">Para cadastrar grupos e programar divulgações use as abas Grupos e Publicações da área WhatsApp.</p>'+
  '<p class="sub">A versão Windows 0.1.1 não tem QR Code, sincronização de grupos ou envio real ao WhatsApp.</p>';
 panes.help.innerHTML='<h4>Para que serve o programa Windows?</h4>'+
  '<p><strong>Central administrativa:</strong> cria campanhas, autoriza computadores e gerencia tarefas.</p>'+
  '<p><strong>Windows:</strong> mantém uma identidade de teste conectada e processa tarefas enviadas pelo Supabase, registrando o resultado fictício.</p>'+
  '<h5>Primeiro acesso</h5><ol>'+
  '<li>Instale o cliente aprovado e confira a integridade do arquivo.</li>'+
  '<li>Entre com sua conta administrativa e somente com a chave publicável do Supabase de teste.</li>'+
  '<li>Em Computadores, aprove o novo dispositivo.</li>'+
  '<li>Em Contas, crie uma identidade começando com <code>fixture-</code> (prefixo em minúsculas) e selecione-a no Windows.</li>'+
  '<li>Cadastre o grupo na aba Grupos do WhatsApp e autorize-o em Vínculos.</li>'+
  '<li>Em Publicações, agende uma divulgação e depois coloque-a na fila de Simulação.</li>'+
  '<li>Retome a simulação somente durante o teste e pause ao terminar.</li></ol>'+
  '<p><strong>Em fila:</strong> aguardando. <strong>Simulado:</strong> processado ficticiamente. <strong>Incerto:</strong> exige revisão.</p>'+
  '<p class="sub">Nunca compartilhe senhas nem chaves secretas. Integração real com WhatsApp exige outra implementação e homologação.</p>';
 let page='devices';
 Array.from(body.children).forEach(function(child){
  if(child.tagName==='H4'){
   const title=child.textContent.trim();
   if(title==='Instaladores aprovados'||title==='Computadores')page='devices';
   else if(title==='Contas simuladas')page='accounts';
   else if(title==='Autorização por grupo')page='groups';
   else if(title==='Fila de simulação')page='simulation';
  }
  if(child.tagName==='DETAILS'&&child.querySelector('summary')?.textContent.trim()==='Tentativas e auditoria')page='history';
  panes[child.hasAttribute('data-connect-updates')?'updates':page].append(child);
 });
 // O controle de pausa pertence à tela de Simulação, onde o usuário espera encontrá-lo.
 const children=Array.from(panes.devices.children);
 const state=children.find(function(node){return node.tagName==='P'&&node.textContent.trim().startsWith('Simulação ');});
 const pause=children.find(function(node){return node.matches?.('button[data-connect="pause"]');});
 if(state)panes.simulation.prepend(state);
 if(pause){if(state)state.after(pause);else panes.simulation.prepend(pause);}
 const descriptions={
  devices:'Registre e autorize os computadores. Confira o estado Online e a última atividade.',
  accounts:'Identidades são fictícias, não números reais. Comece com fixture- em minúsculas. Depois selecione a conta no programa Windows.',
  groups:'Cadastre primeiro o grupo na aba Grupos da área WhatsApp. As permissões abaixo só valem para o cenário fictício.',
  simulation:'Selecione a publicação agendada e a conta autorizada. Retome o processamento apenas durante o teste e pause novamente depois.',
  history:'Registro de autorizações e processamento. Não representa mensagens reais enviadas.'
 };
 Object.keys(descriptions).forEach(function(key){
  const p=document.createElement('p');p.className='sub';p.textContent=descriptions[key];panes[key].prepend(p);
  const back=document.createElement('button');back.type='button';back.className='secondary neo-connect-back';
  back.textContent='← Voltar à visão geral';back.dataset.neoConnectView='overview';panes[key].append(back);
 });
 const back=document.createElement('button');back.type='button';back.className='secondary neo-connect-back';
 back.textContent='← Voltar à visão geral';back.dataset.neoConnectView='overview';panes.help.append(back);
 const audit=panes.history.querySelector('details');if(audit)audit.open=true;
 else{const p=document.createElement('p');p.textContent='Nenhum evento registrado.';panes.history.append(p);}
 views.forEach(function(view){body.append(panes[view[0]]);});
 showNeoConnectNavigation(root);
}
function showNeoConnectNavigation(root){
 const allowed=Array.from(root.querySelectorAll('[data-neo-connect-tabs] button'),button=>button.dataset.neoConnectView);
 const active=allowed.includes(root.dataset.neoConnectPage)?root.dataset.neoConnectPage:'overview';
 root.dataset.neoConnectPage=active;
 root.querySelectorAll('[data-neo-connect-tabs] button').forEach(function(button){
  const selected=button.dataset.neoConnectView===active;
  button.className=selected?'primary':'secondary';button.setAttribute('aria-pressed',String(selected));
 });
 root.querySelectorAll('[data-neo-connect-panel]').forEach(function(panel){
  panel.hidden=panel.dataset.neoConnectPanel!==active;
 });
}