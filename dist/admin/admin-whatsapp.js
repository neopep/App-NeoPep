'use strict';
const whatsappHelp={
 name:['Nome do grupo','Use um nome que identifique o grupo no painel.'],
 invite:['Link do grupo','O convite serve para acessar o grupo. Ele não permite publicação automática.'],
 category:['Categoria','Organize os grupos por finalidade.'],
 notes:['Descrição e observações','Registre informações úteis para a divulgação.'],
 active:['Status ativo/inativo','Somente grupos ativos podem ser selecionados para novas divulgações.'],
 group_search:['Pesquisar grupos','Busque pelo nome ou pela categoria.'],
 campaign_id:['Campanha vinculada','Selecione uma campanha existente ou use Nova campanha para criar uma.'],
 title:['Título','Identifica a divulgação e é reutilizado da campanha vinculada.'],
 message:['Mensagem WhatsApp','Texto que será oferecido ao abrir o compartilhamento.'],
 image:['Imagem','Prepare a imagem reutilizada da campanha para compartilhar separadamente.'],
 attachments:['Anexos','Escolha arquivos da Biblioteca com compartilhamento autorizado.'],
 attachment_search:['Pesquisar anexos','Busque pelo nome do arquivo na Biblioteca.'],
 link:['Link de destino','Endereço que o destinatário poderá acessar conforme as permissões do destino.'],
 preview:['Prévia','Confira título, mensagem, imagem e destino antes de compartilhar.'],
 groups:['Seleção de grupos','Selecione os grupos para registrar uma divulgação por destinatário.'],
 share:['Compartilhar no WhatsApp','Abre o compartilhamento. Escolha WhatsApp e o grupo manualmente.'],
 copy_message:['Copiar mensagem','Copia o título, o texto e o endereço preparados.'],
 copy_link:['Copiar link','Copia somente o endereço de destino.'],
 confirm:['Confirmar publicação','Registre a conclusão somente depois de enviar no WhatsApp.'],
 day:['Data da divulgação','Data prevista de envio. Deixe vazia para criar uma publicação pendente.'],
 time:['Horário','Horário local previsto de compartilhamento.'],
 timezone:['Fuso horário','Referência do horário informado, como America/Sao_Paulo.'],
 repeat:['Recorrência','Escolha os dias da semana. A próxima ocorrência é criada após a confirmação manual.'],
 remind:['Lembrete','Mostra um aviso deduplicado no painel quando chega o horário.'],
 state:['Status','Indica se a publicação está pendente, programada, atrasada, concluída manualmente ou cancelada.'],
 cancel:['Cancelar publicação','Retira a ocorrência e sua recorrência da fila.'],
 media_share:['Compartilhar arquivo','Depois de preparar o arquivo, escolha o aplicativo e o destinatário na interface do aparelho.']
};

function neoWhatsappPayload(record={},route='web',origin=location.origin){
 let link='';
 try{const raw=record.link_url??record.link;if(raw){const url=new URL(raw,origin);if(url.protocol==='https:'&&!url.username&&!url.password)link=url.href;}}catch{}
 const message=record.message??(record.whatsapp_message||record.body||'');
 const cta=link?[record.link_label,link].filter(Boolean).join(' '):record.link_label;
 const caption=[record.title,message,cta&&cta.length<=240?cta:''].map(value=>String(value||'').trim()).filter(Boolean).join('\n\n');
 const media=record.image_path||record.image_url||record.file?.size;
 return {link,message,text:route==='connect'?caption:[record.title,message,link].filter(Boolean).join('\n\n'),
  imageInBubble:route==='connect'&&Boolean(media),separateMedia:route==='web'&&Boolean(media),
  attachments:record.attachments||[]};
}
function neoWhatsappEye(attributes=''){
 return `<button class="secondary neo-wa-eye" type="button" aria-label="Ver prévia no WhatsApp" title="Ver prévia no WhatsApp" ${attributes}>
 <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.7"/></svg> Ver prévia no WhatsApp</button>`;
}
function neoWhatsappPreview({cloud,read,trigger,form,onEdit,resolve}){
 if(window.NeoCampaignEditor?.preview){
  let stopped=false,close;
  const account=cloud.user?.id;
  void Promise.resolve().then(async()=>{
   if(resolve)try{await resolve();}catch{}
   if(stopped||!account||cloud.user?.id!==account)return;
   const row=read()||{};
   const safeLocal=/^\/(assets|campaign-media)\/[\w./-]+$/.test(row.image_url||'')&&!row.image_url.includes('..')?row.image_url:null;
   const image=row.file?.size?row.file:row.image_path&&cloud.campaignImageURL?cloud.campaignImageURL(row.image_path).catch(()=>safeLocal):safeLocal;
   const previewModes=mode=>{
    const payload=neoWhatsappPayload(row,mode),images=new Map(),blocks=[];
    if(payload.imageInBubble||payload.separateMedia){
     blocks.push({id:'legacy-image',type:'image',layout:payload.imageInBubble?'caption':'separate',text:payload.imageInBubble?payload.text:''});
     images.set('legacy-image',image);
    }
    if(payload.text&&!payload.imageInBubble)blocks.unshift({id:'legacy-text',type:'text',text:payload.text});
    for(const [index,item] of payload.attachments.entries())blocks.push({id:'legacy-file-'+index,type:'file',name:item.name});
    return {blocks,images};
   };
   close=window.NeoCampaignEditor.preview({cloud,trigger,row,previewModes,onEdit});
  });
  return ()=>{stopped=true;close?.();};
 }

 const modal=document.createElement('dialog');
 modal.className='neo-wa-dialog';modal.setAttribute('aria-label','Ver prévia no WhatsApp');
 modal.innerHTML=`<div class="neo-wa-dialog-tools"><button type="button" data-wa-close autofocus>← Voltar</button>
 <label>Modo<select data-wa-route><option value="web">Painel · compartilhamento manual</option><option value="connect">Connect · imagem com legenda</option></select></label>
 ${onEdit?'<button type="button" data-wa-edit>Editar conteúdo</button>':''}<button type="button" data-wa-close>Fechar</button></div>
 ${onEdit&&form?'<details class="neo-wa-live"><summary>Ajustar mensagem nesta prévia</summary><label>Mensagem WhatsApp<textarea data-wa-live-message maxlength="4000" placeholder="Usa o texto comum se ficar vazia."></textarea></label></details>':''}
 <div class="neo-wa-phone"><div class="neo-wa-camera" aria-hidden="true"></div>
 <header class="neo-wa-chat"><span aria-hidden="true">‹</span><span class="neo-wa-avatar" aria-hidden="true">◉</span><strong data-wa-contact></strong></header>
 <div class="neo-wa-thread"><article class="neo-wa-bubble"><div data-wa-inline-image></div><p data-wa-text></p><small>12:00 · prévia</small></article><div data-wa-separate></div></div><div class="neo-wa-home" aria-hidden="true"></div></div>
 <p class="sub">Simulação — a aparência pode variar no WhatsApp.</p>`;
 document.body.append(modal);
 let alive=true,version=0,objectUrl='',activeFile=null,activePath=null,source=null;
 const q=s=>modal.querySelector(s);
 const finish=()=>{if(!alive)return;alive=false;window.removeEventListener('popstate',close);if(objectUrl)URL.revokeObjectURL(objectUrl);form?.removeEventListener('input',render);form?.removeEventListener('change',render);modal.remove();if(trigger?.isConnected)trigger.focus();};
 const close=()=>{if(modal.open&&modal.close)modal.close();finish();};
 function drawImage(url,payload){
  const inline=q('[data-wa-inline-image]'),separate=q('[data-wa-separate]');
  inline.replaceChildren();separate.replaceChildren();
  if(url){
   const img=document.createElement('img');img.src=url;img.alt='Imagem da campanha';
   const target=payload.imageInBubble?inline:separate;
   if(payload.separateMedia){const text=document.createElement('p');text.textContent='Arquivo separado no painel. Anexe manualmente.';target.append(text);}
   target.append(img);
  }
  for(const attachment of payload.attachments){
   const label=document.createElement('p');label.textContent='Anexo manual: '+attachment.name;separate.append(label);
  }
 }
 async function render(){
  const id=++version,record=read()||{},route=q('[data-wa-route]').value,payload=neoWhatsappPayload(record,route);
  q('[data-wa-contact]').textContent=record.group_name||'Grupo de exemplo';
  const text=q('[data-wa-text]');text.replaceChildren();
  for(const part of (payload.text||'Sem texto nesta mensagem.').split(/(https?:\/\/[^\s]+)/i)){
   if(/^https?:\/\//i.test(part)){const span=document.createElement('span');span.className='neo-wa-link';span.textContent=part;text.append(span);}
   else text.append(document.createTextNode(part));
  }
  if(activeFile!==record.file){if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';activeFile=record.file;if(activeFile?.size)objectUrl=URL.createObjectURL(activeFile);}
  if(activePath!==record.image_path){activePath=record.image_path;source=activePath?cloud.campaignImageURL(activePath).catch(()=>null):null;}
  const local=/^\/(assets|campaign-media)\/[\w./-]+$/.test(record.image_url||'')&&!record.image_url.includes('..')?record.image_url:null;
  drawImage(objectUrl||local,payload);
  if(!objectUrl&&source){const signed=await source;if(alive&&id===version)drawImage(signed||local,payload);}
 }
 modal.addEventListener('close',finish);modal.addEventListener('cancel',event=>{event.preventDefault();close();});
 modal.addEventListener('click',event=>{if(event.target.closest('[data-wa-close]'))close();if(event.target.closest('[data-wa-edit]')){close();onEdit?.();}});
 modal.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key!=='Tab')return;
  const controls=[...modal.querySelectorAll('button,select,summary,textarea')].filter(control=>!control.closest('details:not([open])')||control.tagName==='SUMMARY');
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 });
 const draftMessage=form?.querySelector('[name=whatsapp_message]'),liveMessage=q('[data-wa-live-message]');
 if(liveMessage&&draftMessage){
  liveMessage.value=draftMessage.value;
  liveMessage.addEventListener('input',()=>{
   draftMessage.value=liveMessage.value;
   draftMessage.dispatchEvent(new Event('input',{bubbles:true}));
  });
 }
 window.addEventListener('popstate',close);
 q('[data-wa-route]').addEventListener('change',render);
 form?.addEventListener('input',render);form?.addEventListener('change',render);
 if(modal.showModal)modal.showModal();else modal.setAttribute('open','');
 void render();
 if(resolve)void resolve().then(()=>{if(alive)void render();}).catch(()=>{});
 return close;
}

function mountSyncedCampaignGroups(root,{cloud,picking=false}){
 const states={eligible:'Elegível',stale:'Sincronização desatualizada',disconnected:'Desconectado',unavailable:'Indisponível'};
 root.innerHTML=`<div class="form-grid"><label class="central-search"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input type="search" maxlength="100" aria-label="Pesquisar grupos sincronizados" placeholder="Pesquisar grupos sincronizados"></label>
 <label>Estado<select><option value="">Todos</option>${Object.entries(states).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label></div>
 <button type="button" class="secondary" data-sync-refresh>Atualizar grupos</button><p role="status" data-sync-status></p><div data-sync-rows></div>`;
 const search=root.querySelector('input'),filter=root.querySelector('select'),status=root.querySelector('[data-sync-status]');
 const destination=root.querySelector('[data-sync-rows]');
 let catalog=[],selected=new Map(),revision=0,current=null,ready=false,initialized=false;
 function render(){
  const query=search.value.trim().toLocaleLowerCase('pt-BR');
  const records=new Map([...selected,...catalog.map(row=>[row.id,row])]);
  const rows=[...records.values()].filter(row=>(!filter.value||filter.value===row.state)&&
   (row.name+' '+(row.connection||'')).toLocaleLowerCase('pt-BR').includes(query));
  destination.innerHTML=rows.map(row=>{
   const checked=selected.has(row.id);
   const label=`<strong>${esc(row.name)}</strong><small class="sub"> · ${esc(row.connection||'Conexão indisponível')} · ${esc(states[row.state]||'Estado desconhecido')}${row.participant_count==null?'':' · '+Number(row.participant_count)+' participantes'}${row.last_synced_at?' · sincronizado em '+esc(new Date(row.last_synced_at).toLocaleString('pt-BR')):''}</small>`;
   return picking?`<label class="check"><input type="checkbox" data-sync-id="${esc(row.id)}" ${checked?'checked':''} ${row.state!=='eligible'&&!checked?'disabled':''}><span>${label}</span></label>`:
    `<article class="monitor-block">${label}</article>`;
  }).join('')||'<p>Nenhum grupo encontrado. Sincronize os grupos selecionados no NeoPep Connect.</p>';
  status.textContent=picking?`${selected.size} de até 30 grupos selecionados.`:'';
 }
 async function load(campaign=null,{preserve=false}={}){
  const token=++revision;
  ready=false;current=campaign;
  if(!preserve){selected=new Map();catalog=[];initialized=false;}
  destination.replaceChildren();status.textContent='Consultando grupos sincronizados…';
  try{
   const [rows,initial]=await Promise.all([
    cloud.campaignWhatsAppSync('catalog'),
    campaign&&picking&&!preserve?cloud.campaignWhatsAppSync('recipients',campaign):[]
   ]);
   if(token!==revision||!root.isConnected)return false;
   catalog=rows;
   if(!preserve)selected=new Map(initial.map(row=>[row.id,row]));
   for(const [key,row] of selected)selected.set(key,catalog.find(item=>item.id===key)||{...row,state:'unavailable'});
   ready=true;initialized=true;render();return true;
  }catch{
   if(token===revision)status.textContent='Grupos sincronizados indisponíveis. Confira a conexão e a implantação da integração, ou tente atualizar.';
   return false;
  }
 }
 search.addEventListener('input',()=>{if(ready)render();});
 filter.addEventListener('change',()=>{if(ready)render();});
 destination.addEventListener('change',event=>{
  const input=event.target.closest('[data-sync-id]');
  if(!input||!ready)return;
  const id=input.dataset.syncId,row=catalog.find(item=>item.id===id);
  if(!input.checked){selected.delete(id);if(row?.state!=='eligible')input.disabled=true;}
  else if(!row||row.state!=='eligible'||selected.size>=30||[...selected.keys()].some(key=>key.split(':')[1]===id.split(':')[1])){
   input.checked=false;status.textContent='Selecione até 30 grupos distintos e elegíveis.';return;
  }else selected.set(id,row);
  status.textContent=`${selected.size} de até 30 grupos selecionados.`;
 });
 root.querySelector('[data-sync-refresh]').addEventListener('click',()=>{void load(current,{preserve:initialized});});
 return {load,ready:()=>ready,values:()=>[...selected.keys()]};
}

function mountCampaignWhatsApp(root,{cloud,openManual,embedded=false}){
 const rpc=(action,id=null,data={})=>cloud.campaignWhatsApp(action,id,data);
 const q=selector=>root.querySelector(selector);
 const help=(area,prefix)=>addCampaignHelp(area,whatsappHelp,prefix);
 const field=(name,label,attrs='')=>'<label>'+label+'<input name="'+name+'" '+attrs+'></label>';
 const action=(key,label)=>'<button type="button" class="secondary" data-wa="'+key+'" name="'+key+'">'+label+'</button>';
 const dateLabel=(instant,timezone)=>instant?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:timezone}).format(new Date(instant))+' · '+timezone:'';
 const states={paused:'Pausada',pending:'Pendente',scheduled:'Programada',late:'Atrasada',done:'Concluída manualmente',cancelled:'Cancelada'};
 const mayAct=row=>['pending','scheduled','late'].includes(row.state);
 const sharedQueueEnabled=window.NEO_CONFIG?.supabaseUrl==='https://qnuluspqfazdppciermw.supabase.co'&&typeof cloud.campaignCentral==='function';
 const dayNames=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
 let groupRows=[],queueRows=[],campaigns=[],prepared=null,selectedJob=null,files=[],refreshToken=0,prepareToken=0,working=false,groupSearch='',reminderTimer;
 let claimEnabled=false,claims=new Map();
 const claimKey=row=>'neo-campaign-manual-claim:'+cloud.user?.id+':'+row.id+':'+(row.scheduled_at||'unscheduled');
 const claimToken=row=>{try{return localStorage.getItem(claimKey(row));}catch{return null;}};
 function clearClaim(row){try{localStorage.removeItem(claimKey(row));}catch{}}
 async function reserve(row){
  let token=claimToken(row);if(!token){token=crypto.randomUUID();localStorage.setItem(claimKey(row),token);}
  try{const result=await rpc('reserve_manual',row.id,{claim_id:token,expected_at:row.scheduled_at??null});if(result?.claim_id!==token)throw Error('Reserva não confirmada.');return token;}
  catch(error){throw Error('Não foi possível reservar. A publicação pode estar em revisão por outro administrador ou dispositivo. Atualize a fila.');}
 }
 root.innerHTML=`<div class="between" ${embedded?'hidden':''}><h3>WhatsApp</h3>${openManual?action('manual','<span aria-hidden="true">?</span> <span class="admin-pdf-accessible">Manual do WhatsApp</span>'):''}</div>
 <p class="sub" data-wa-channel-notice>O grupo é escolhido no WhatsApp. Confirme a publicação no painel após o envio.</p>
 <details class="space" data-wa-connect><summary>NeoPep Connect</summary><div data-connect-root></div></details><p role="status" data-wa-status></p><p role="status" data-wa-reminders></p>
 <details class="space"><summary>Grupos cadastrados</summary>
 <form data-wa-group-search class="central-search editor-search"><input name="group_search" type="search" maxlength="100" aria-label="Pesquisar grupos" placeholder="Pesquisar grupos"><button type="submit" class="structured-icon" aria-label="Pesquisar" title="Pesquisar"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></button></form>
 <form class="space" data-wa-group>
 ${field('name','Nome do grupo','required maxlength="120"')}
 ${field('invite','Link de convite','type="url" maxlength="120"')}
 ${field('category','Categoria','maxlength="80"')}
 <label>Descrição e observações<textarea name="notes" maxlength="1000"></textarea></label>
 <label class="check"><input type="checkbox" name="active" checked> Grupo ativo</label>
 <div class="neo-campaign-actions"><button type="submit" class="primary">Salvar grupo</button>${action('clear_group','Limpar edição')}</div>
 </form><div data-wa-groups></div><div data-wa-sync-catalog></div></details>
 <form class="space" data-wa-publication>
 <label>Campanha vinculada<select name="campaign_id" required><option value="">Selecione</option></select></label>
 <div data-wa-preview></div>
 <fieldset><legend data-campaign-legend="groups">Seleção de grupos</legend><div data-wa-recipients></div><div data-wa-sync-recipients></div></fieldset>
 <fieldset><legend data-campaign-legend="attachments">Anexos autorizados</legend>
 <div class="central-search editor-search"><input name="attachment_search" type="search" maxlength="100" aria-label="Pesquisar anexos" placeholder="Pesquisar anexos"><button type="button" data-wa="attachments" class="structured-icon" aria-label="Buscar arquivos" title="Buscar arquivos"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></button></div><div data-wa-attachments></div></fieldset>
 <div class="form-grid">${field('day','Data da divulgação','type="date"')}${field('time','Horário','type="time"')}
 ${field('timezone','Fuso horário','required maxlength="80" value="America/Sao_Paulo"')}</div>
 <fieldset><legend data-campaign-legend="repeat">Recorrência</legend><div class="campaign-weekdays">
 ${dayNames.map((name,i)=>`<label class="check"><input type="checkbox" name="weekday" value="${i}">${name}</label>`).join('')}</div></fieldset>
 <label class="check"><input type="checkbox" name="remind"> Lembrete no painel</label>
 <button type="submit" class="primary">Salvar publicação</button></form>
 <fieldset class="space"><legend data-campaign-legend="state">Fila de publicações</legend>${sharedQueueEnabled?`<section class="shared-campaign-queue"><div class="between"><h3>Fila central · administradores</h3>${action('refresh_shared','Atualizar')}</div><p class="sub">Acompanhamento de mensagens automáticas e manuais. Ações de envio continuam sujeitas às permissões do responsável.</p><label>Estado<select data-shared-filter><option value="">Todos</option><option value="waiting">Aguardando</option><option value="paused">Pausadas</option><option value="review_pending">Aguardando aprovação</option><option value="review_rejected">Recusada na revisão</option><option value="scheduled">Agendada</option><option value="in_progress">Processando</option><option value="accepted">Aceita pelo cliente</option><option value="manual_done">Confirmada manualmente</option><option value="uncertain">Incerta</option><option value="refused">Recusada</option><option value="cancelled">Cancelada</option></select></label><div data-shared-queue role="status">Carregando fila…</div><section data-review-section hidden><h4>Revisão independente</h4><div data-review-list></div></section><h4>Fluxo manual</h4></section>`:''}<div data-wa-queue></div></fieldset>`;
 const connect=q('[data-wa-connect]');
 const syncCatalog=embedded?mountSyncedCampaignGroups(q('[data-wa-sync-catalog]'),{cloud}):null;
 const syncPicker=embedded?mountSyncedCampaignGroups(q('[data-wa-sync-recipients]'),{cloud,picking:true}):null;
 if(cloud.connectTestEnabled===false)connect.querySelector('[data-connect-root]').textContent='Canal Windows indisponível neste ambiente.';
 let connectPanel;
 function loadConnect(){
  if(cloud.connectTestEnabled===false||typeof mountNeoConnect!=='function')return;
  connectPanel??=mountNeoConnect(q('[data-connect-root]'),cloud);
  void connectPanel.load();
 }
 connect.addEventListener('toggle',()=>{if(!embedded&&connect.open)loadConnect();});
 const groupForm=q('[data-wa-group]'),form=q('[data-wa-publication]'),select=form.querySelector('[name=campaign_id]');
 help(groupForm,'wa-group');help(q('[data-wa-group-search]'),'wa-search');help(form,'wa-form');help(q('[data-wa-queue]').parentElement,'wa-queue');
 const queue=q('[data-wa-queue]').parentElement,groupList=q('[data-wa-groups]'),groupSearchForm=q('[data-wa-group-search]');
 const groupContainer=groupForm.closest('details');
 let currentView='publications',openEditor='',unsaved=false;
 const tool=document.createElement('div');
 tool.className='neo-campaign-actions';
 if(embedded){
  tool.innerHTML=`<button class="primary" type="button" data-wa="new_item">Nova divulgação</button><button class="secondary" type="button" data-wa="back_item" hidden>← Voltar à lista</button>`;
  q('[data-wa-status]').after(tool);
  groupContainer.open=true;groupContainer.querySelector('summary').hidden=true;
  const filter=document.createElement('label');filter.innerHTML='<span>Status da divulgação</span><select data-wa-queue-filter><option value="">Todos</option>'+Object.entries(states).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')+'</select>';
  queue.prepend(filter);filter.addEventListener('change',renderQueue);
 }
 function canLeave(){
  if(!unsaved)return true;
  if(!confirm('Descartar as alterações não salvas nesta tela?'))return false;
  unsaved=false;return true;
 }
 function setView(next,force=false){
  if(!embedded)return;
  if(!force&&next!==currentView&&!canLeave())return;
  if(next!==currentView){openEditor='';unsaved=false;}
  const previousView=currentView;currentView=next;
  const groups=next==='groups',pub=next==='publications';
  q('[data-wa-channel-notice]').hidden=!pub;
  connect.hidden=next!=='connect';
  if(!connect.hidden){
   connect.open=true;
   connect.querySelector('summary').hidden=true;
   if(next!==previousView||!connectPanel)loadConnect();
  }
  if(groups&&syncCatalog&&next!==previousView)void syncCatalog.load();
  groupContainer.hidden=!groups;
  groupForm.hidden=Boolean(syncCatalog)||!groups||openEditor!=='groups';
  groupSearchForm.hidden=groupList.hidden=Boolean(syncCatalog)||!groups||openEditor==='groups';
  form.hidden=!pub||openEditor!=='publications';queue.hidden=!pub||openEditor==='publications';
  tool.hidden=!pub&&(Boolean(syncCatalog)||!groups);
  const add=tool.querySelector('[data-wa=new_item]'),back=tool.querySelector('[data-wa=back_item]');
  add.hidden=Boolean(openEditor);back.hidden=!openEditor;add.textContent=groups?'Novo grupo':'Nova divulgação';
 }
 function showEditor(pane){
  if(embedded){openEditor=pane;setView(pane,true);}
 }
 groupForm.addEventListener('input',()=>{unsaved=true;});form.addEventListener('input',()=>{unsaved=true;});
 groupForm.addEventListener('change',()=>{unsaved=true;});form.addEventListener('change',()=>{unsaved=true;});
 const tell=message=>{q('[data-wa-status]').textContent=message};
 function setCampaigns(rows){
  campaigns=rows;
  const chosen=select.value;
  select.innerHTML='<option value="">Selecione</option>'+campaigns.filter(row=>row.whatsapp_enabled&&row.status!=='archived'&&row.status!=='paused')
   .map(row=>`<option value="${esc(row.id)}">${esc(row.title)}</option>`).join('');
  if(chosen)select.value=chosen;
 }
 function renderGroups(){
  if(syncPicker)return;
  q('[data-wa-groups]').innerHTML=groupRows.map(gr=>`<div class="between"><p>${esc(gr.name)} <small>${esc(gr.category)} · ${gr.active?'Ativo':'Inativo'}</small>
    ${gr.invite?`<a href="${esc(gr.invite)}" target="_blank" rel="noopener noreferrer">Abrir convite</a>`:''}</p>
    <button type="button" class="secondary" data-wa="edit_group" data-id="${esc(gr.id)}">Editar</button></div>`).join('');
  const destination=q('[data-wa-recipients]');
  const selected=[...destination.querySelectorAll('label')].filter(label=>label.querySelector('input').checked);
  const existing=new Set(selected.map(label=>label.querySelector('input').value));
  const retained=groupSearch?selected.filter(label=>!groupRows.some(row=>row.id===label.querySelector('input').value)):[];
  destination.innerHTML=groupRows.filter(gr=>gr.active).map(gr=>`<label class="check"><input type="checkbox" name="group" value="${esc(gr.id)}" ${existing.has(gr.id)?'checked':''}>${esc(gr.name)}</label>`).join('')||'<p>Cadastre um grupo ativo para programar a divulgação.</p>';
  destination.prepend(...retained);
 }
 let sharedRows=[],sharedToken=0,sharedFailed=false;
 const sharedLabels={paused:'Pausada',waiting:'Aguardando',review_pending:'Aguardando aprovação',review_rejected:'Recusada na revisão',scheduled:'Agendada',in_progress:'Processando',accepted:'Aceita pelo cliente',manual_done:'Confirmada manualmente',uncertain:'Resultado incerto · revisar',refused:'Recusada',cancelled:'Cancelada'};
 function renderSharedQueue(){
  const holder=q('[data-shared-queue]');if(!holder)return;
  if(sharedFailed){holder.textContent='Fila consolidada indisponível; use a fila manual abaixo.';return;}
  const filter=q('[data-shared-filter]').value;
  holder.innerHTML=sharedRows.filter(row=>!filter||row.state===filter).map(row=>`<article class="monitor-block"><div class="between"><strong>${esc(row.title)}</strong><span class="campaign-state">${esc(sharedLabels[row.state]||'Estado desconhecido')}</span></div><p class="sub">${esc(dateLabel(row.due_at,'America/Sao_Paulo'))} · ${row.channel==='connect'?'NeoPep Connect':'Manual'} · ${row.own?'Minha publicação':'Outra conta / fluxo compartilhado'} · ${Number(row.messages)||0} bloco(s)</p></article>`).join('')||'<p class="sub">Nenhuma publicação neste filtro.</p>';
 }
 let reviewRows=[],reviewEpoch=0,reviewAccount=null;
 function reviewCanDecide(row){return Boolean(row&&row.can_review===true&&row.own===false&&row.state==='pending'&&!row.cancelled_at&&reviewAccount===cloud.user?.id&&reviewAccount&&root.isConnected);}
 function reviewCanApprove(row){return Boolean(reviewCanDecide(row)&&Array.isArray(row.groups)&&row.groups.length&&row.groups.every(g=>typeof g==='string'&&g.trim())&&Array.isArray(row.blocks)&&row.blocks.length&&row.blocks.every(b=>b&&((b.type==='text'&&typeof b.text==='string'&&b.text.trim())||(b.type==='link'&&typeof b.url==='string'&&/^https:\/\//i.test(b.url)))));}
 async function refreshReviews(){
  const holder=q('[data-review-section]');if(!holder)return;
  const epoch=++reviewEpoch,account=cloud.user?.id;
  reviewRows=[];reviewAccount=null;holder.hidden=true;q('[data-review-list]').textContent='Verificando autorização…';
  try{
   const caps=await cloud.campaignCentral('review_capabilities',{});
   if(epoch!==reviewEpoch||!root.isConnected||cloud.user?.id!==account||caps?.enabled!==true)return;
   const rows=await cloud.campaignCentral('review_list',{});
   if(epoch!==reviewEpoch||!root.isConnected||cloud.user?.id!==account)return;
   reviewRows=Array.isArray(rows)?rows:[];reviewAccount=account;holder.hidden=false;
   q('[data-review-list]').innerHTML=reviewRows.map(row=>`<article class="monitor-block"><strong>${esc(row.title||'Publicação')}</strong><p class="sub">${row.cancelled_at?'Cancelada':({pending:'Aguardando aprovação',approved:'Aprovada',rejected:'Recusada'})[row.state]||'Estado desconhecido'} · ${esc(dateLabel(row.due_at,'America/Sao_Paulo'))}</p><p class="sub">Grupos: ${esc((row.groups||[]).join(', ')||'Não disponíveis')}</p><details><summary>Conferir conteúdo</summary>${(Array.isArray(row.blocks)?row.blocks:[]).map(b=>b?.type==='text'||b?.type==='link'?`<p>${esc(b.text||'')}${b.url?' · '+esc(b.url):''}</p>`:'<p>Conteúdo não disponível para revisão segura.</p>').join('')}</details>${reviewCanDecide(row)?`<div class="inline-actions">${reviewCanApprove(row)?`<button type="button" class="primary" data-wa="review_approve" data-id="${esc(row.batch_id)}">Aprovar envio</button>`:'<p class="sub">Aprovação bloqueada: conteúdo ou destinos incompletos.</p>'}<button type="button" class="secondary" data-wa="review_reject" data-id="${esc(row.batch_id)}">Recusar</button></div>`:''}</article>`).join('')||'<p class="sub">Nenhuma solicitação.</p>';
  }catch{if(epoch===reviewEpoch&&root.isConnected&&cloud.user?.id===account){reviewRows=[];if(!holder.hidden)q('[data-review-list]').textContent='Revisões indisponíveis. Atualize antes de decidir.';}}
 }
 async function refreshSharedQueue(){
  if(!sharedQueueEnabled)return;
  void refreshReviews();
  const token=++sharedToken,account=cloud.user?.id;
  try{const rows=await cloud.campaignCentral('shared_queue',{});if(token!==sharedToken||!root.isConnected||cloud.user?.id!==account)return;sharedRows=Array.isArray(rows)?rows:[];sharedFailed=false;renderSharedQueue();}
  catch{if(token===sharedToken&&root.isConnected&&cloud.user?.id===account){sharedRows=[];sharedFailed=true;renderSharedQueue();}}
 }
 q('[data-shared-filter]')?.addEventListener('change',renderSharedQueue);
 function renderQueue(){
  q('[data-wa-queue]').innerHTML=queueRows.filter(row=>!q('[data-wa-queue-filter]')?.value||q('[data-wa-queue-filter]').value===row.state).map(row=>`<article class="monitor-block">
   <h4>${esc(row.title)} · ${esc(row.group_name)}</h4>
   <p>${states[row.state]} ${esc(dateLabel(row.scheduled_at,row.timezone))}</p>
   ${row.confirmed_at?`<p class="sub">Última confirmação ${esc(dateLabel(row.confirmed_at,row.timezone))}</p>`:''}
   ${claimEnabled&&claims.has(row.id)?`<p class="sub">${claims.get(row.id).own&&claimToken(row)?'Reservada neste dispositivo':'Reservada por outro administrador ou dispositivo'}</p>`:''}
   ${mayAct(row)&&(!claimEnabled||!claims.has(row.id)||(claims.get(row.id).own&&claimToken(row)))?`<div class="neo-campaign-actions"><button type="button" class="secondary" data-wa="prepare" data-id="${esc(row.id)}">${claimEnabled?'Revisar e reservar':'Preparar compartilhamento'}</button>${claimEnabled&&claims.has(row.id)&&claimToken(row)?`<button type="button" class="secondary" data-wa="release_manual" data-id="${esc(row.id)}">Liberar sem envio</button>`:''}</div>`:''}</article>`).join('')||'<p>Nenhuma publicação.</p>';
 }
 async function reminders(){
  if(!root.isConnected||root.hidden||document.visibilityState==='hidden')return;
  const rows=await rpc('reminders');
  if(rows.length)q('[data-wa-reminders]').textContent=rows.map(row=>row.title+' · '+row.group_name).join(' | ');
 }
 async function refresh(){
  const token=++refreshToken;
  const [groups,queue]=await Promise.all([syncCatalog?[]:rpc('groups',null,{search:groupSearch}),rpc('queue')]);
  if(token!==refreshToken||!root.isConnected)return;
  const account=cloud.user?.id;
  let reservations=null;
  if(sharedQueueEnabled)try{reservations=await rpc('claim_status');}catch{}
  if(token!==refreshToken||!root.isConnected||cloud.user?.id!==account)return;
  claimEnabled=Array.isArray(reservations);claims=new Map((reservations||[]).map(row=>[row.publication_id,row]));
  groupRows=groups;queueRows=queue;renderGroups();renderQueue();void refreshSharedQueue();await reminders();
 }
 function preview(){
  const pane=q('[data-wa-preview]');
  pane.replaceChildren();
  if(!prepared)return;
  pane.innerHTML=`<fieldset><legend data-campaign-legend="preview">Prévia</legend>
   <label>Título<input name="title" readonly value="${esc(prepared.title)}"></label>
   <label>Mensagem WhatsApp<textarea name="message" readonly>${esc(prepared.message)}</textarea></label>
   <label>Link de destino<input name="link" readonly value="${esc(prepared.link||'')}"></label>
   ${prepared.image_path||prepared.image_url?`<fieldset><legend data-campaign-legend="image">Imagem da campanha</legend><div data-wa-image></div></fieldset>`:''}
   <div class="neo-campaign-actions">${['share','copy_message','copy_link',...(selectedJob?['confirm','cancel']:[])].map(key=>
   `<fieldset><legend data-campaign-legend="${key}">${action(key,{share:'Compartilhar no WhatsApp',copy_message:'Copiar mensagem',copy_link:'Copiar link',confirm:'Confirmar publicação',cancel:'Cancelar publicação'}[key])}</legend></fieldset>`).join('')}</div>
   ${selectedJob?`<div data-wa-file-actions>${files.map((file,i)=>`<button type="button" class="secondary" data-wa="file" data-id="${i}">Preparar ${esc(file.name)}</button>`).join('')}</div>`:''}
   ${neoWhatsappEye('data-wa="show_preview"')}<div data-wa-media></div></fieldset>`;
  help(pane,'wa-preview');
  const image=pane.querySelector('[data-wa-image]'),record=prepared;
  if(image){
   const url=record.image_path?cloud.campaignImageURL(record.image_path):Promise.resolve(record.image_url);
   void url.then(src=>{
    if(!image.isConnected||record!==prepared)return;
    if(!src)return;
   const picture=document.createElement('img');picture.src=src;picture.alt='';image.append(picture);
   }).catch(()=>{});
  }
 }
 async function prepare(id,job=null){
  const token=++prepareToken;
  prepared=null;selectedJob=null;files=[];preview();
  if(syncPicker)void syncPicker.load(id||null);
  if(!id)return;
  const reservation=job&&claimEnabled?await reserve(job):null;
  const campaign=await rpc('prepare',id,job?{publication:job.id,...(reservation?{claim_id:reservation,expected_at:job.scheduled_at??null}:{})}:{});
  if(token!==prepareToken||!root.isConnected)return;
  const target=campaign.link_url?new URL(campaign.link_url,location.origin):null;
  prepared={...campaign,link:target&&target.protocol==='https:'?target.href:''};
  files=[...(campaign.image_path||campaign.image_url?[{name:'campanha.jpg',mime:'image/jpeg',image:true}]:[]),...(campaign.attachments||[])];
  selectedJob=job?{...job,claim_id:reservation}:null;preview();
  if(job)q('[data-wa-preview]').scrollIntoView?.({block:'nearest'});
 }
 function resetGroup(){groupForm.reset();delete groupForm.dataset.id;}
 async function protectedAction(run){
  if(working)return;
  working=true;
  try{await run()}catch(error){tell(error.message||'Não foi possível concluir.')}
  finally{working=false;}
 }
 q('[data-wa-group-search]').addEventListener('submit',event=>{
  event.preventDefault();groupSearch=new FormData(event.target).get('group_search');
  void protectedAction(refresh);
 });
 groupForm.addEventListener('submit',event=>{
  event.preventDefault();const data=new FormData(groupForm);
  void protectedAction(async()=>{
   await rpc('group_save',groupForm.dataset.id||null,{name:data.get('name'),invite:data.get('invite'),category:data.get('category'),notes:data.get('notes'),active:data.has('active')});
   unsaved=false;openEditor='';resetGroup();setView('groups',true);await refresh();tell('Grupo salvo.');
  });
 });
 select.addEventListener('change',()=>{
  void prepare(select.value).catch(()=>tell('Não foi possível preparar a campanha selecionada.'));
 });
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(form),day=data.get('day'),time=data.get('time');
  if(Boolean(day)!==Boolean(time)){tell('Preencha data e horário juntos.');return;}
  void protectedAction(async()=>{
   const settings={attachments:data.getAll('attachment'),local_time:day?day+'T'+time:null,
    timezone:data.get('timezone'),weekdays:data.getAll('weekday').map(Number),remind:data.has('remind')};
   if(syncPicker){
    if(!syncPicker.ready()||!syncPicker.values().length){tell('Selecione os grupos sincronizados antes de salvar.');return;}
    await cloud.campaignWhatsAppSync('schedule',data.get('campaign_id'),{...settings,recipients:syncPicker.values()});
   }else{
    await rpc('schedule',null,{...settings,campaign_id:data.get('campaign_id'),groups:data.getAll('group')});
   }
   unsaved=false;openEditor='';setView('publications',true);form.reset();selectedJob=null;prepared=null;files=[];preview();
   await refresh();tell('Publicação salva na fila. Para criar outra, selecione novamente a campanha e o grupo.');
  });
 });
 root.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-wa]');if(!button)return;
  const {wa,id}=button.dataset;
  const message=prepared?neoWhatsappPayload(prepared).text:'';
  if(wa==='share'&&prepared){
   if(navigator.share){void navigator.share({text:message}).catch(error=>{if(error.name!=='AbortError')tell('Use Copiar mensagem para compartilhar manualmente.');});}
   else window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
   return;
  }
  if(wa==='new_item'){
   if(currentView==='groups'){resetGroup();showEditor('groups');groupForm.elements.name.focus();}
   else{form.reset();prepared=null;selectedJob=null;files=[];preview();showEditor('publications');void syncPicker?.load();select.focus();}
   return;
  }
  if(wa==='back_item'){
   if(canLeave()){openEditor='';setView(currentView,true);tool.querySelector('[data-wa=new_item]')?.focus();}
   return;
  }
  if(wa==='show_preview'&&prepared){
   neoWhatsappPreview({cloud,trigger:button,form,read:()=>({...prepared,group_name:selectedJob?.group_name||
    form.querySelector('[name=group]:checked')?.closest('label')?.textContent.trim()})});return;
  }
  if(wa==='manual'){openManual?.(button);return;}
  if(wa==='refresh_shared'){void refreshSharedQueue();return;}
  void protectedAction(async()=>{
   if(wa==='review_approve'||wa==='review_reject'){
    const row=reviewRows.find(r=>r.batch_id===id);
    if(!reviewCanDecide(row)||(wa==='review_approve'&&!reviewCanApprove(row))){tell('Revisão indisponível ou conteúdo incompleto. Atualize antes de decidir.');return;}
    if(!row||!confirm((wa==='review_approve'?'Aprovar o envio':'Recusar o envio')+' de '+(row.title||'publicação')+'? Confira o conteúdo e os grupos antes de confirmar.'))return;
    if(!reviewCanDecide(row)||(wa==='review_approve'&&!reviewCanApprove(row)))return;
    const result=await cloud.campaignCentral(wa,{batch_id:id,confirmed:true});
    if(!['approved','rejected'].includes(result?.state))throw Error('A decisão não foi confirmada.');
    tell(result.state==='approved'?'Aprovação registrada. O Connect autorizado poderá processar no horário previsto.':'Recusa registrada. O envio permanece bloqueado.');
    await refreshReviews();return;
   }
   if(wa==='clear_group'){resetGroup();return;}
   if(wa==='edit_group'){
    const group=groupRows.find(row=>row.id===id);if(!group)return;
    showEditor('groups');groupForm.dataset.id=group.id;
    for(const name of ['name','invite','category','notes'])groupForm.elements[name].value=group[name]||'';
    groupForm.elements.active.checked=group.active;groupForm.elements.name.focus();return;
   }
   if(wa==='attachments'){
    const chosen=new Set([...root.querySelectorAll('[name=attachment]:checked')].map(input=>input.value));
    const rows=await rpc('attachments',null,{search:form.elements.attachment_search.value});
    const list=q('[data-wa-attachments]');
    // Preserve selected files across searches.
    const retained=[...list.querySelectorAll('label')].filter(label=>label.querySelector('input').checked&&!rows.some(row=>row.path===label.querySelector('input').value));
    list.innerHTML=rows.map(row=>`<label class="check"><input type="checkbox" name="attachment" value="${esc(row.path)}" ${chosen.has(row.path)?'checked':''}>${esc(row.name)}</label>`).join('')||'<p>Nenhum anexo autorizado encontrado.</p>';
    list.prepend(...retained);return;
   }
   if(wa==='release_manual'){
    const row=queueRows.find(row=>row.id===id);if(!row||!claimEnabled||!claimToken(row))return;
    if(!confirm('Confirma que nenhuma mensagem ou arquivo desta ocorrência foi enviado? Outro administrador poderá preparar a publicação. Se houver dúvida, não libere.'))return;
    await rpc('release_manual',row.id,{claim_id:claimToken(row),expected_at:row.scheduled_at??null,not_sent:true});
    clearClaim(row);if(selectedJob?.id===row.id){prepared=null;selectedJob=null;files=[];preview();}await refresh();tell('Reserva liberada. A publicação continua pendente.');return;
   }
   if(wa==='prepare'){
    const row=queueRows.find(row=>row.id===id);if(row){if(embedded)showEditor('publications');else {root.dataset.waPage='publications';if(typeof showNeoWhatsappNavigation==='function')showNeoWhatsappNavigation(root);}select.value=row.campaign_id;await prepare(row.campaign_id,row);}return;
   }
   if(wa==='copy_message'||wa==='copy_link'){
    const value=wa==='copy_link'?prepared?.link:message;if(!value)return;
    await navigator.clipboard.writeText(value);tell(wa==='copy_link'?'Link copiado.':'Mensagem copiada.');return;
   }
   if((wa==='confirm'||wa==='cancel')&&selectedJob){
    if(!confirm(wa==='confirm'?'Você já publicou manualmente no WhatsApp?':'Cancelar a publicação e sua recorrência?'))return;
    const result=await rpc(wa,selectedJob.id,{expected_at:selectedJob.scheduled_at??null,...(selectedJob.claim_id?{claim_id:selectedJob.claim_id}:{})});
    if(result?.saved!==true)throw Error('O servidor não confirmou a operação. Atualize a fila.');
    if(selectedJob.claim_id)clearClaim(selectedJob);
    prepared=null;selectedJob=null;preview();await refresh();tell(wa==='confirm'?'Publicação confirmada manualmente.':'Publicação cancelada.');return;
   }
   if(wa==='file'){
    const file=files[Number(id)];if(!file||!prepared)return;
    const target=q('[data-wa-media]');
    // Revalida autorização da Biblioteca antes de obter a URL assinada.
    const url=file.image?(prepared.image_path?await cloud.campaignImageURL(prepared.image_path):prepared.image_url):await cloud.libraryMediaURL(file,true);
    const response=await fetch(url);if(!response.ok)throw Error('Arquivo indisponível.');
    const payload=new File([await response.blob()],file.name,{type:file.mime});
    if(!target.isConnected)return;
    if(!navigator.canShare?.({files:[payload]})){
     const url=URL.createObjectURL(payload),download=document.createElement('a');
     download.href=url;download.download=payload.name;download.textContent='Salvar arquivo para anexar no WhatsApp';download.className='secondary';
     target.replaceChildren(download);setTimeout(()=>URL.revokeObjectURL(url),120000);
     tell('Salve e anexe o arquivo manualmente neste navegador.');return;
    }
    const share=document.createElement('button');share.type='button';share.className='secondary';share.textContent='Compartilhar arquivo';
    share.addEventListener('click',()=>{void navigator.share({files:[payload]}).catch(error=>{if(error.name!=='AbortError')tell('Não foi possível abrir o compartilhamento.');});});
    target.replaceChildren(share);
    share.name='media_share';help(target,'wa-media');
   }
  });
 });
 if(!embedded&&typeof installNeoWhatsappNavigation==='function')installNeoWhatsappNavigation(root);
 if(!syncCatalog)q('[data-wa-sync-catalog]').hidden=true;
 if(!syncPicker)q('[data-wa-sync-recipients]').hidden=true;
 if(embedded)setView('publications',true);
 return {setCampaigns,setView,canLeave,dirty:()=>unsaved,show(id){
  if(!reminderTimer)reminderTimer=setInterval(()=>{
   if(!root.isConnected){clearInterval(reminderTimer);reminderTimer=null;return;}
   void reminders().catch(()=>{});
  },30000);
  void protectedAction(async()=>{await refresh();if(id){if(embedded)showEditor('publications');else {root.dataset.waPage='publications';if(typeof showNeoWhatsappNavigation==='function')showNeoWhatsappNavigation(root);}select.value=id;await prepare(id);}});
 }};
}
