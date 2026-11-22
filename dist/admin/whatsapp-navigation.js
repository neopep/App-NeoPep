'use strict';

function installNeoWhatsappNavigation(root){
 if(root.querySelector('[data-neo-wa-tabs]'))return;
 const tabs=[['publications','Publicações'],['groups','Grupos'],['connect','NeoPep Connect']];
 const nav=document.createElement('nav');nav.dataset.neoWaTabs='';
 nav.className='neo-connect-tabs';nav.setAttribute('aria-label','Etapas de campanhas WhatsApp');
 const panels={};
 tabs.forEach(function(tab){
  const b=document.createElement('button');b.type='button';b.className='secondary';
  b.dataset.neoWaView=tab[0];b.textContent=tab[1];b.setAttribute('aria-controls','neo-wa-'+tab[0]);nav.append(b);
  const p=document.createElement('section');p.id='neo-wa-'+tab[0];
  p.className='neo-connect-pane';p.dataset.neoWaPanel=tab[0];panels[tab[0]]=p;
 });
 const connect=root.querySelector('[data-wa-connect]');
 const group=root.querySelector('form[data-wa-group]')?.closest('details');
 const form=root.querySelector('form[data-wa-publication]');
 const queue=root.querySelector('[data-wa-queue]')?.closest('fieldset');
 const reminders=root.querySelector('[data-wa-reminders]');
 const state=root.querySelector('[data-wa-status]');
 if(!connect||!group||!form||!queue||!reminders||!state)return;
 const help=document.createElement('p');help.className='sub';
 help.textContent='Crie uma campanha ativa em “+ Nova campanha”, selecione os grupos e agende uma divulgação. Para processá-la pelo computador, acesse NeoPep Connect → Simulação.';
 panels.publications.append(help,form,queue);
 const groupInfo=document.createElement('p');groupInfo.className='sub';
 groupInfo.textContent='Cadastre os grupos antes de autorizar vínculos e programar divulgações. O convite não permite publicar automaticamente.';
 panels.groups.append(groupInfo,group);
 const connectInfo=document.createElement('p');connectInfo.className='sub';
 connectInfo.textContent='Gerencie computadores, identidades fictícias, vínculos, tarefas, resultados e ajuda em telas separadas.';
 panels.connect.append(connectInfo,connect);
 state.after(nav);
 tabs.forEach(function(tab){nav.after(panels[tab[0]]);});
 // Preserve the original ascending order of tabs in the DOM.
 panels.publications.after(panels.groups);panels.groups.after(panels.connect);
 root.addEventListener('click',function(event){
  const button=event.target.closest('[data-neo-wa-view]');
  if(!button||!root.contains(button))return;
  root.dataset.waPage=button.dataset.neoWaView;
  showNeoWhatsappNavigation(root);
 });
 showNeoWhatsappNavigation(root);
}
function showNeoWhatsappNavigation(root){
 const current=['publications','groups','connect'].includes(root.dataset.waPage)?root.dataset.waPage:'publications';
 root.dataset.waPage=current;
 root.querySelectorAll('[data-neo-wa-tabs] button').forEach(function(b){
  const selected=b.dataset.neoWaView===current;
  b.className=selected?'primary':'secondary';b.setAttribute('aria-pressed',String(selected));
 });
 root.querySelectorAll('[data-neo-wa-panel]').forEach(function(p){p.hidden=p.dataset.neoWaPanel!==current;});
 if(current==='groups'){
  const group=root.querySelector('form[data-wa-group]')?.closest('details');
  if(group&&!group.open)group.open=true;
 }
 if(current==='connect'){
  const details=root.querySelector('[data-wa-connect]');
  if(details&&!details.open)details.open=true;
 }
}