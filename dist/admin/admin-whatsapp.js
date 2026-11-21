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

function mountCampaignWhatsApp(root,{cloud,openManual}){
 const rpc=(action,id=null,data={})=>cloud.campaignWhatsApp(action,id,data);
 const q=selector=>root.querySelector(selector);
 const help=(area,prefix)=>addCampaignHelp(area,whatsappHelp,prefix);
 const field=(name,label,attrs='')=>'<label>'+label+'<input name="'+name+'" '+attrs+'></label>';
 const action=(key,label)=>'<button type="button" class="secondary" data-wa="'+key+'" name="'+key+'">'+label+'</button>';
 const dateLabel=(instant,timezone)=>instant?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:timezone}).format(new Date(instant))+' · '+timezone:'';
 const states={pending:'Pendente',scheduled:'Programada',late:'Atrasada',done:'Concluída manualmente',cancelled:'Cancelada'};
 const mayAct=row=>['pending','scheduled','late'].includes(row.state);
 const dayNames=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
 let groupRows=[],queueRows=[],campaigns=[],prepared=null,selectedJob=null,files=[],refreshToken=0,prepareToken=0,working=false,groupSearch='',reminderTimer;
 root.innerHTML=`<div class="between"><h3>WhatsApp</h3>${openManual?action('manual','<span aria-hidden="true">?</span> <span class="admin-pdf-accessible">Manual do WhatsApp</span>'):''}</div>
 <p class="sub">O grupo é escolhido no WhatsApp. Confirme a publicação no painel após o envio.</p>
 <p role="status" data-wa-status></p><p role="status" data-wa-reminders></p>
 <details class="space"><summary>Grupos cadastrados</summary>
 <form data-wa-group-search>${field('group_search','Pesquisar grupos','maxlength="100"')}<button type="submit" class="secondary">Pesquisar</button></form>
 <form class="space" data-wa-group>
 ${field('name','Nome do grupo','required maxlength="120"')}
 ${field('invite','Link de convite','type="url" maxlength="120"')}
 ${field('category','Categoria','maxlength="80"')}
 <label>Descrição e observações<textarea name="notes" maxlength="1000"></textarea></label>
 <label class="check"><input type="checkbox" name="active" checked> Grupo ativo</label>
 <div class="neo-campaign-actions"><button type="submit" class="primary">Salvar grupo</button>${action('clear_group','Limpar edição')}</div>
 </form><div data-wa-groups></div></details>
 <form class="space" data-wa-publication>
 <label>Campanha vinculada<select name="campaign_id" required><option value="">Selecione</option></select></label>
 <div data-wa-preview></div>
 <fieldset><legend data-campaign-legend="groups">Seleção de grupos</legend><div data-wa-recipients></div></fieldset>
 <fieldset><legend data-campaign-legend="attachments">Anexos autorizados</legend>
 ${field('attachment_search','Pesquisar anexos','maxlength="100"')}${action('attachments','Buscar arquivos')}<div data-wa-attachments></div></fieldset>
 <div class="form-grid">${field('day','Data da divulgação','type="date"')}${field('time','Horário','type="time"')}
 ${field('timezone','Fuso horário','required maxlength="80" value="America/Sao_Paulo"')}</div>
 <fieldset><legend data-campaign-legend="repeat">Recorrência</legend><div class="campaign-weekdays">
 ${dayNames.map((name,i)=>`<label class="check"><input type="checkbox" name="weekday" value="${i}">${name}</label>`).join('')}</div></fieldset>
 <label class="check"><input type="checkbox" name="remind"> Lembrete no painel</label>
 <button type="submit" class="primary">Salvar publicação</button></form>
 <fieldset class="space"><legend data-campaign-legend="state">Fila de publicações</legend><div data-wa-queue></div></fieldset>`;
 const groupForm=q('[data-wa-group]'),form=q('[data-wa-publication]'),select=form.querySelector('[name=campaign_id]');
 help(groupForm,'wa-group');help(q('[data-wa-group-search]'),'wa-search');help(form,'wa-form');help(q('[data-wa-queue]').parentElement,'wa-queue');
 const tell=message=>{q('[data-wa-status]').textContent=message};
 function setCampaigns(rows){
  campaigns=rows;
  const chosen=select.value;
  select.innerHTML='<option value="">Selecione</option>'+campaigns.filter(row=>row.whatsapp_enabled&&row.status!=='archived')
   .map(row=>`<option value="${esc(row.id)}">${esc(row.title)}</option>`).join('');
  if(chosen)select.value=chosen;
 }
 function renderGroups(){
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
 function renderQueue(){
  q('[data-wa-queue]').innerHTML=queueRows.map(row=>`<article class="monitor-block">
   <h4>${esc(row.title)} · ${esc(row.group_name)}</h4>
   <p>${states[row.state]} ${esc(dateLabel(row.scheduled_at,row.timezone))}</p>
   ${row.confirmed_at?`<p class="sub">Última confirmação ${esc(dateLabel(row.confirmed_at,row.timezone))}</p>`:''}
   ${mayAct(row)?`<div class="neo-campaign-actions"><button type="button" class="secondary" data-wa="prepare" data-id="${esc(row.id)}">Preparar compartilhamento</button></div>`:''}</article>`).join('')||'<p>Nenhuma publicação.</p>';
 }
 async function reminders(){
  if(!root.isConnected||root.hidden||document.visibilityState==='hidden')return;
  const rows=await rpc('reminders');
  if(rows.length)q('[data-wa-reminders]').textContent=rows.map(row=>row.title+' · '+row.group_name).join(' | ');
 }
 async function refresh(){
  const token=++refreshToken;
  const [groups,queue]=await Promise.all([rpc('groups',null,{search:groupSearch}),rpc('queue')]);
  if(token!==refreshToken||!root.isConnected)return;
  groupRows=groups;queueRows=queue;renderGroups();renderQueue();await reminders();
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
   <div data-wa-media></div></fieldset>`;
  help(pane,'wa-preview');
  const image=pane.querySelector('[data-wa-image]'),record=prepared;
  if(image){
   const url=record.image_path?cloud.campaignImageURL(record.image_path):Promise.resolve(record.image_url);
   void url.then(src=>{
    if(!image.isConnected||record!==prepared)return;
    const picture=document.createElement('img');picture.src=src;picture.alt='';image.append(picture);
   }).catch(()=>{});
  }
 }
 async function prepare(id,job=null){
  const token=++prepareToken;
  prepared=null;selectedJob=null;files=[];preview();
  if(!id)return;
  const campaign=await rpc('prepare',id,job?{publication:job.id}:{});
  if(token!==prepareToken||!root.isConnected)return;
  const target=campaign.link_url?new URL(campaign.link_url,location.origin):null;
  prepared={...campaign,link:target&&target.protocol==='https:'?target.href:''};
  files=[...(campaign.image_path||campaign.image_url?[{name:'campanha.jpg',mime:'image/jpeg',image:true}]:[]),...(campaign.attachments||[])];
  selectedJob=job;preview();
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
   resetGroup();await refresh();tell('Grupo salvo.');
  });
 });
 select.addEventListener('change',()=>{void protectedAction(()=>prepare(select.value))});
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(form),day=data.get('day'),time=data.get('time');
  if(Boolean(day)!==Boolean(time)){tell('Preencha data e horário juntos.');return;}
  void protectedAction(async()=>{
   await rpc('schedule',null,{campaign_id:data.get('campaign_id'),groups:data.getAll('group'),attachments:data.getAll('attachment'),
    local_time:day?day+'T'+time:null,timezone:data.get('timezone'),weekdays:data.getAll('weekday').map(Number),remind:data.has('remind')});
   await refresh();tell('Publicação salva na fila.');
  });
 });
 root.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-wa]');if(!button)return;
  const {wa,id}=button.dataset;
  const message=prepared?[prepared.title,prepared.message,prepared.link].filter(Boolean).join('\n\n'):'';
  if(wa==='share'&&prepared){
   if(navigator.share){void navigator.share({text:message}).catch(error=>{if(error.name!=='AbortError')tell('Use Copiar mensagem para compartilhar manualmente.');});}
   else window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
   return;
  }
  if(wa==='manual'){openManual?.(button);return;}
  void protectedAction(async()=>{
   if(wa==='clear_group'){resetGroup();return;}
   if(wa==='edit_group'){
    const group=groupRows.find(row=>row.id===id);if(!group)return;
    groupForm.dataset.id=group.id;
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
   if(wa==='prepare'){
    const row=queueRows.find(row=>row.id===id);if(row){select.value=row.campaign_id;await prepare(row.campaign_id,row);}return;
   }
   if(wa==='copy_message'||wa==='copy_link'){
    const value=wa==='copy_link'?prepared?.link:message;if(!value)return;
    await navigator.clipboard.writeText(value);tell(wa==='copy_link'?'Link copiado.':'Mensagem copiada.');return;
   }
   if((wa==='confirm'||wa==='cancel')&&selectedJob){
    if(!confirm(wa==='confirm'?'Você já publicou manualmente no WhatsApp?':'Cancelar a publicação e sua recorrência?'))return;
    await rpc(wa,selectedJob.id,{expected_at:selectedJob.scheduled_at});
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
 return {setCampaigns,show(id){
  if(!reminderTimer)reminderTimer=setInterval(()=>{
   if(!root.isConnected){clearInterval(reminderTimer);reminderTimer=null;return;}
   void reminders().catch(()=>{});
  },30000);
  void protectedAction(async()=>{await refresh();if(id){select.value=id;await prepare(id);}});
 }};
}
