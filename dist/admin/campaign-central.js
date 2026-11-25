'use strict';
(function () {
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const date=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';
 const local=value=>value?.replace('T',' ')||'';
 const button=(action,label,id='',kind='secondary')=>`<button type="button" class="${kind}" data-central="${action}" data-id="${escape(id)}">${label}</button>`;
 const labels={draft:'Rascunho',scheduled:'Agendada',waiting:'Aguardando',active:'Ativa',in_progress:'Em processamento',completed:'Concluída',accepted:'Aceita pelo cliente',refused:'Recusada',uncertain:'Incerta',cancelled:'Cancelada',archived:'Arquivada',legacy:'Manual legado'};
 function state(pub){
  const batch=pub.batches[0];
  if(!batch)return pub.legacy_dispatch?'legacy':'draft';
  const states=batch.states||[];
  if(states.includes('uncertain'))return 'uncertain';
  if(states.includes('leased')||states.includes('started'))return 'in_progress';
  if(states.includes('refused'))return 'refused';
  if(states.includes('waiting'))return new Date(batch.due_at)>new Date()?'scheduled':'waiting';
  if(states.includes('accepted'))return 'accepted';
  return 'cancelled';
 }
 function mount({root,cloud,legacy,openLegacy,recoverLegacy,onConnect}){
  let current=null, detail=null, rows=[], filter='', search='', view='agenda', screen='', busy=false, formKey='', page=0, more=false;
  const account=cloud.user.id;
  const active=()=>root.isConnected&&cloud.user?.id===account;
  const rpc=(action,values={})=>cloud.campaignCentral(action,{campaign_id:current,...values});
  let loadEpoch=0;
  let statusTimer=null,statusRefreshing=false;
  const legacyKey='neo-campaign-editor:'+account+':whatsapp:new';
  const pointer=()=> 'neo-campaign-central:'+account+':'+current;
  const getLocal=key=>{try{return localStorage.getItem(key);}catch{return null;}};
  const setLocal=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const removeLocal=key=>{try{localStorage.removeItem(key);}catch{}};
  function show(message){if(active())root.querySelector('[data-central-status]').textContent=message;}
  function status(pub){return labels[state(pub)];}
  function stopStatusPoll(){if(statusTimer!==null){clearTimeout(statusTimer);statusTimer=null;}}
  async function refreshVisibleStatus(force=false){
   if(statusRefreshing||!active()||screen!=='detail'||!current||(!force&&busy)||root.hidden||document.visibilityState==='hidden')return;
   const campaignId=current;
   statusRefreshing=true;
   try{
    const latest=await cloud.campaignCentral('get',{campaign_id:campaignId});
    if(!active()||current!==campaignId||screen!=='detail')return;
    detail=latest;
    for(const pub of latest.publications||[]){
     const node=[...root.querySelectorAll('[data-central-publication]')]
      .find(article=>article.dataset.centralPublication===pub.id);
     if(!node)continue;
     const badge=node.querySelector('.campaign-state');
     if(badge)badge.textContent=status(pub);
     if(!pub.batches[0]?.states?.includes('waiting'))node.querySelector('[data-central="cancel"]')?.remove();
    }
    if(force)show('Estados atualizados a partir do servidor.');
   }catch{if(force)show('Não foi possível atualizar os estados. Verifique a conexão e tente novamente.');}
   finally{statusRefreshing=false;}
  }
  function scheduleStatusPoll(){
   stopStatusPoll();
   if(!active()||screen!=='detail'||!detail)return;
   const states=detail.publications.map(pub=>state(pub));
   const interval=states.some(value=>value==='waiting'||value==='in_progress')?10000:
    states.includes('scheduled')?30000:null;
   if(interval===null)return;
   statusTimer=setTimeout(async()=>{
    statusTimer=null;
    await refreshVisibleStatus();
    if(active()&&screen==='detail')scheduleStatusPoll();
   },interval);
  }
  function campaignState(row){
   if(row.archived_at)return 'archived';
   if(row.legacy)return row.status==='archived'?'archived':row.status==='active'?'active':row.status==='draft'?'draft':'legacy';
   return row.next_at?'scheduled':row.pending||row.problems?'active':row.publications===row.drafts?'draft':row.drafts?'active':'completed';
  }
  function redraw(content){
   if(active())root.innerHTML='<p class="sub" role="status" data-central-status></p>'+content;
  }
  function list(){
   stopStatusPoll();
   screen='list';current=null;detail=null;
   const seen=new Set(rows.map(row=>row.campaign_id));
   const feed=[...rows,...legacy().filter(row=>row.whatsapp_enabled&&!seen.has(row.id)).map(row=>({...row,campaign_id:row.id,legacy:true}))];
   const visible=feed.filter(row=>(!filter||campaignState(row)===filter)&&(row.title||'').toLocaleLowerCase('pt-BR').includes(search));
   redraw(`<div class="between"><h2>Campanhas WhatsApp</h2>${button('new','+ Nova campanha','','primary')}</div>
    <div class="inline-actions"><label>Buscar campanha<input type="search" data-central-search value="${escape(search)}"></label><label>Estado<select data-central-filter>
    ${[['','Todas'],['draft','Rascunhos'],['active','Ativas'],['scheduled','Agendadas'],['completed','Concluídas'],['archived','Arquivadas'],['legacy','Legadas']].map(([value,label])=>`<option value="${value}" ${filter===value?'selected':''}>${label}</option>`).join('')}</select></label>
    ${getLocal(legacyKey)?button('recover','Continuar rascunho anterior'):''}</div><div data-central-feed>
    ${visible.map(row=>`<article class="monitor-block"><div class="between"><h3>${escape(row.title)}</h3><span class="campaign-state">${labels[campaignState(row)]}</span></div>
    <p class="sub">${row.legacy?'Campanha manual · fluxo legado':`${row.publications} publicação(ões) · ${row.drafts} rascunho(s) · ${row.pending||0} pendente(s) · ${row.problems||0} com problema${row.next_at?' · Próxima: '+date(row.next_at):''}`}</p>
    ${button(row.legacy?'legacy':'open',row.legacy?'Abrir campanha manual':'Abrir campanha',row.campaign_id)}</article>`).join('')||'<p>Nenhuma campanha com esse filtro.</p>'}
    </div>${more?button('more','Carregar mais campanhas'):''}`);
  }
  async function refresh(append=false){
   const epoch=++loadEpoch;
   const batch=await rpc('list',{offset:append?page:0});
   if(!active()||epoch!==loadEpoch)return;
   rows=append?[...rows,...batch]:batch;page=rows.length;more=batch.length===50;
   list();
  }
  async function creation(){
   screen='create';formKey=crypto.randomUUID();
   redraw(`${button('back','‹ Campanhas')}<h2>Nova campanha</h2><form data-central-form="create" class="campaign-central-form">
    <label>Nome da campanha<input name="title" required maxlength="120" autocomplete="off"></label>
    <p class="sub">Canal WhatsApp. Os horários são independentes por publicação.</p><div data-central-destination></div>
    <button type="submit" class="primary">Criar campanha</button></form>`);
   root.querySelector('[name=title]').focus();
   try{
    const groups=await cloud.campaignWhatsAppSync('catalog');
    const ready=groups.filter(item=>item.state==='eligible');
    if(active()&&screen==='create')root.querySelector('[data-central-destination]').textContent=
     ready.length+' grupo(s) sincronizado(s). Escolha até 30 destinos individualmente em cada publicação.';
   }catch{}

  }
  function details(){
   screen='detail';
   const editable=!detail.archived_at;
   const items=detail.publications;
   const ordered=[...items].sort((a,b)=>(a.batches[0]?.due_at||a.planned_local||'').localeCompare(b.batches[0]?.due_at||b.planned_local||''));
   const undated=ordered.filter(pub=>!pub.planned_local&&!pub.batches.length);
   const dated=ordered.filter(pub=>!undated.includes(pub));
   const cards=entries=>entries.map(pub=>{
    const batch=pub.batches[0],locked=pub.legacy_dispatch||Boolean(batch&&(batch.cancelled_at==null||batch.states?.some(value=>value!=='cancelled')));
    return `<article class="monitor-block" data-central-publication="${escape(pub.id)}"><div class="between"><strong>${escape(pub.title)}</strong><span class="campaign-state">${status(pub)}</span></div>
     <p class="sub">${batch?date(batch.due_at):local(pub.planned_local)||'Sem data'} · São Paulo · ${pub.kinds?.length||0} mensagem(ns)${pub.kinds?.length?' · '+escape(pub.kinds.join(', ')):''}</p>
     ${view==='agenda'&&editable&&pub.planned_local&&!locked?`<label class="check"><input type="checkbox" name="selected-publication" value="${escape(pub.id)}"> Selecionar para agendar</label>`:''}
     <div class="inline-actions">${button('edit',locked||!editable?'Ver publicação':'Editar publicação',pub.id)}
     ${editable?button('duplicate_form','Duplicar / distribuir',pub.id):''}
     ${batch?.states?.includes('waiting')&&editable?button('cancel','Cancelar pendências',pub.id):''}</div>
     ${view==='history'?`<div data-central-history="${escape(pub.id)}">${button('attempts','Ver tentativas e recibos',pub.id)}</div>`:''}</article>`;
   }).join('');
   redraw(`${button('back','‹ Campanhas')}<div class="between"><h2>${escape(detail.title)}</h2>${editable?button('rename','Renomear')+button('archive','Arquivar'):''}</div>
    <p class="sub">WhatsApp · ${items.length} publicação(ões)${editable?'':' · Arquivada'}</p>
    <div class="inline-actions">${button('agenda','Agenda','',view==='agenda'?'primary':'secondary')}${button('history','Histórico','',view==='history'?'primary':'secondary')}${button('refresh_status','Atualizar estados')}</div>
    ${view==='agenda'? `<label>Filtrar a partir de<input type="date" data-central-date></label><div data-central-date-list>${cards(dated)||'<p>Sem publicações com data.</p>'}</div>
     <h3>Rascunhos sem data</h3>${cards(undated)||'<p>Sem rascunhos sem data.</p>'}
     ${editable?`<div class="inline-actions">${getLocal(pointer())?'':button('add','+ Adicionar publicação','','primary')}
      ${getLocal(pointer())?button('resume','Continuar rascunho local')+button('discard','Descartar rascunho local'):''}
      ${dated.length?button('schedule_selected','Revisar e agendar selecionadas'):''}</div>`:''}`:
     `${cards(ordered)||'<p>Sem publicações registradas.</p>'}<h3>Eventos da campanha</h3><ul>${detail.events.map(event=>`<li>${date(event.recorded_at)} · ${({created:'Campanha criada',save:'Versão salva',duplicate:'Duplicada',schedule:'Agendada',publish:'Publicação solicitada',cancel:'Cancelamento solicitado',archived:'Arquivada',renamed:'Campanha renomeada'})[event.event]||escape(event.event)}${event.revision?' · versão '+escape(event.revision):''}</li>`).join('')}</ul>`}`);
   if(view==='agenda')root.querySelectorAll('[data-central-date-list] article').forEach((node,index)=>{node.dataset.day=(dated[index].batches[0]?.due_at?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(dated[index].batches[0].due_at)):dated[index].planned_local||'').slice(0,10);});
   scheduleStatusPoll();
  }
  async function load(id){
   current=id;
   const result=await rpc('get');
   if(active()&&current===id){detail=result;details();}
  }
  async function editor(id,trigger,options={}){
   const campaignId=current;
   const remote=options.new?null:await rpc('load',{publication_id:id});
   if(!active()||current!==campaignId)return;
   if(options.new)setLocal(pointer(),id);
   window.NeoCampaignEditor.open({cloud,channel:'whatsapp',remote,trigger,fresh:options.fresh,readOnly:options.readOnly,
    publication:{campaignId,id,title:detail.title,destination:options.new||!remote?detail.default_destination:null},onConnect,onClosed:()=>{if(active()&&current===campaignId)details();},onSaved:()=>{
     if(getLocal(pointer())===id)removeLocal(pointer());
     if(active()&&current===campaignId)void load(campaignId).catch(()=>show('Atualize para conferir a publicação salva.'));
    }});
  }
  function duplicateForm(pub){
   redraw(`${button('open','‹ Agenda',current)}<h2>Duplicar publicação</h2><p>${escape(pub.title)}</p>
    <form data-central-form="duplicate" data-id="${escape(pub.id)}" class="campaign-central-form">
    <div data-central-dates><label>Data e horário em São Paulo (opcionais)<input type="datetime-local" name="date" data-request="${crypto.randomUUID()}"></label></div>
    ${button('add_date','+ Outro dia')}<p class="sub">Cada data gera uma publicação em rascunho. Nenhum envio é agendado.</p>
    <button class="primary" type="submit">Criar rascunhos nas datas acima</button></form>`);
  }
  async function scheduleSelected(){
   const selected=[...root.querySelectorAll('[name=selected-publication]:checked')].map(element=>detail.publications.find(pub=>pub.id===element.value));
   if(!selected.length){show('Selecione uma ou mais publicações.');return;}
   const diagnostics=await cloud.campaignRich('diagnostics',{});
   if(!diagnostics.ready){show('Agendamento indisponível. Confirme o Connect de Produção e os grupos sincronizados.');return;}
   const hydrated=await Promise.all(selected.map(async pub=>({pub,revision:await rpc('load',{publication_id:pub.id})})));
   const groups=await cloud.campaignWhatsAppSync?.('catalog')||[];
   const authorized=Array.isArray(diagnostics.destinations)?diagnostics.destinations:[];
   const destinations=Array.isArray(groups)?groups.filter(group=>authorized.includes(group.id)):[];
   if(!active())return;
   if(!confirm(`Agendar em ${detail.title}? Os destinatários são os grupos selecionados em cada publicação (até ${Math.min(30,destinations.length)} autorizados nesta conexão).\n\n`+
    selected.map(pub=>`${pub.title} · ${local(pub.planned_local)} (São Paulo) · ${pub.kinds?.length||0} mensagem(ns)`).join('\n')))return;
   const outcomes=[];
   for(const {pub,revision} of hydrated){
    if(!active())return;
    try{
     if(!revision||revision.revision!==pub.revision||!Array.isArray(revision.draft.groups)||
        revision.draft.groups.length<1||revision.draft.groups.length>30||
        new Set(revision.draft.groups).size!==revision.draft.groups.length||
        !revision.draft.groups.every(id=>authorized.includes(id)&&groups.some(g=>g.id===id&&g.state==='eligible')))throw Error('revision');
     const key='neo-campaign-central-intent:'+account+':'+pub.id+':'+pub.revision+':'+pub.planned_local;
     const request=getLocal(key)||crypto.randomUUID();setLocal(key,request);
     await rpc('schedule',{publication_id:pub.id,revision:pub.revision,request_id:request,local_time:pub.planned_local,confirmed:true});
     outcomes.push(pub.title+': agendada');
    }catch{outcomes.push(pub.title+': sem confirmação. Consulte a agenda antes de repetir.');}
   }
   await load(current);show(outcomes.join(' · '));
  }
  root.addEventListener('submit',async event=>{
   const form=event.target.closest('[data-central-form]');
   if(!form)return;
   event.preventDefault();
   if(busy||!active())return;
   const submit=form.querySelector('[type=submit]');
   busy=true;submit.disabled=true;
   try{
    if(form.dataset.centralForm==='create'){
     const fields=new FormData(form);
     const result=await rpc('create',{title:fields.get('title'),destination:fields.get('destination'),request_id:formKey});
     if(active()){view='agenda';await load(result.campaign_id);}
    }else if(form.dataset.centralForm==='rename'){
     await rpc('rename',{title:new FormData(form).get('title')});await load(current);
    }else{
     const dates=[...form.querySelectorAll('[name=date]')];
     const values=dates.map(input=>input.value);
     if(dates.length>1&&(values.some(value=>!value)||new Set(values).size!==values.length)){show('Informe horários distintos para todas as ocorrências.');return;}
     for(const input of dates){
      if(!active())return;
      await rpc('duplicate',{publication_id:form.dataset.id,request_id:input.dataset.request,planned_local:input.value});
     }
     await load(current);show('Rascunhos criados. Nenhuma publicação agendada.');
    }
   }catch{show('O servidor não confirmou a operação. Confira os dados e tente novamente.');}
   finally{busy=false;submit.disabled=false;}
  });
  root.addEventListener('click',async event=>{
   const control=event.target.closest('[data-central]');
   if(!control||busy||!active())return;
   const id=control.dataset.id,action=control.dataset.central,pub=detail?.publications.find(row=>row.id===id);
   busy=true;
   try{
    if(action==='new')void creation();
    if(action==='back')await refresh();
    if(action==='more')await refresh(true);
    if(action==='open'){view='agenda';await load(id);}
    if(action==='legacy')openLegacy(id,control);
    if(action==='recover')recoverLegacy(control,async saved=>{
     if(!saved||!active())return;
     try{const adopted=await rpc('adopt',{campaign_id:saved.campaign_id});await load(adopted.campaign_id);}
     catch{show('O rascunho foi salvo. Consulte também as versões de revisão na aba Publicações.');}
    });
    if(action==='agenda'||action==='history'){view=action;await load(current);}
    if(action==='refresh_status')await refreshVisibleStatus(true);
    if(action==='add')await editor(crypto.randomUUID(),control,{new:true,fresh:true});
    if(action==='resume'&&getLocal(pointer()))await editor(getLocal(pointer()),control);
    if(action==='discard'&&confirm('Descartar a digitação local desta campanha?')){
     const id=getLocal(pointer());
     removeLocal('neo-campaign-editor:'+account+':whatsapp:'+current+':'+id);removeLocal(pointer());details();
    }
    if(action==='edit'&&pub)await editor(id,control,{readOnly:Boolean(detail.archived_at||pub.legacy_dispatch||pub.batches[0]&&
     (pub.batches[0].cancelled_at==null||pub.batches[0].states?.some(value=>value!=='cancelled')))});
    if(action==='duplicate_form'&&pub)duplicateForm(pub);
    if(action==='add_date'){
     const fields=root.querySelector('[data-central-dates]');
     if(fields.childElementCount<20)fields.insertAdjacentHTML('beforeend',`<label>Data e horário em São Paulo<input type="datetime-local" name="date" data-request="${crypto.randomUUID()}" required></label>`);
    }
    if(action==='rename')redraw(`${button('open','‹ Agenda',current)}<h2>Renomear campanha</h2>
     <form data-central-form="rename" class="campaign-central-form"><label>Nome da campanha<input name="title" required maxlength="120" value="${escape(detail.title)}"></label>
     <button class="primary" type="submit">Salvar nome</button></form>`);
    if(action==='archive'&&confirm('Arquivar esta campanha e manter seu histórico?')){await rpc('archive');await load(current);}
    if(action==='cancel'&&pub&&confirm('Cancelar somente as mensagens ainda pendentes desta publicação?')){
     await rpc('cancel',{publication_id:id,batch_id:pub.batches[0].id});await load(current);
    }
    if(action==='schedule_selected')await scheduleSelected();
    if(action==='attempts'&&pub){
     const rich=await cloud.campaignRich('status',{editor_id:pub.editor_id});
     const legacy=pub.legacy_dispatch?await cloud.campaignDispatch('status',{editor_id:pub.editor_id}):[];
     const history=[...rich,...legacy.map((row,index)=>({...row,sequence:index+1,has_receipt:row.attempts?.some(attempt=>Boolean(attempt.receipt_id))}))];
     const holder=control.parentElement;
     if(active()&&holder.isConnected)holder.innerHTML=history.map(row=>`<p class="sub">Mensagem ${escape(row.sequence)} · ${labels[row.dispatch_state]||escape(row.dispatch_state)} · ${escape(row.dispatch_attempts)} tentativa(s) · ${row.has_receipt?'Recibo registrado':'Sem recibo'} · ${date(row.scheduled_at)}</p>`).join('')||'<p>Sem tentativas de despacho.</p>';
    }
   }catch{show('Não foi possível concluir. Confira a autorização, o estado da publicação e o Connect de Teste.');}
   finally{busy=false;}
  });
  root.addEventListener('change',event=>{
   if(event.target.matches('[data-central-filter]')){filter=event.target.value;list();}
   if(event.target.matches('[data-central-search]')){search=event.target.value.trim().toLocaleLowerCase('pt-BR');list();root.querySelector('[data-central-search]').focus();}
   if(event.target.matches('[data-central-date]'))root.querySelectorAll('[data-central-date-list] article').forEach(node=>{node.hidden=Boolean(event.target.value&&node.dataset.day<event.target.value);});
  });
  return {async load(){if(!screen){screen='loading';redraw('<p>Consultando campanhas…</p>');try{await refresh();}catch{screen='failed';show('Central indisponível. Atualize o painel para tentar novamente.');}}},syncLegacy(){if(screen==='list'&&!busy)list();}};
 }
 window.NeoCampaignCentral={mount};
})();
