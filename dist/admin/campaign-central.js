'use strict';
(function () {
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const date=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';
 const local=value=>value?.replace('T',' ')||'';
 const saoPauloDay=value=>{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value).reduce((o,p)=>({...o,[p.type]:p.value}),{});
  return parts.year+'-'+parts.month+'-'+parts.day;
 };
 const dateBadge=pub=>{
  const stamp=pub.batches[0]?.due_at;
  const day=stamp?saoPauloDay(new Date(stamp)):pub.planned_local?.slice(0,10);
  if(!day)return '<strong>Sem data</strong>';
  const d=new Date(day+'T12:00:00Z');
  if(!Number.isFinite(d.getTime()))return '<strong>Sem data</strong>';
  const month=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',month:'short'}).format(d).replace('.','').toUpperCase();
  const hour=stamp?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(stamp)):pub.planned_local.slice(11,16);
  return '<strong class="central-date-day">'+d.getUTCDate()+'</strong><small>'+month+' '+d.getUTCFullYear()+'</small><span class="central-date-hour">'+escape(hour)+'</span>';
 };
 const button=(action,label,id='',kind='secondary')=>`<button type="button" class="${kind}" data-central="${action}" data-id="${escape(id)}">${label}</button>`;
 const symbols={rename:'<path d="m4 16 12-12 4 4L8 20H4z"/><path d="m14 6 4 4"/>',archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v12h14V8M9 12h6"/>',delete:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>'};
 const icon=name=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name]}</svg>`;
 const iconAction=(action,label)=>`<button type="button" class="secondary central-icon" data-central="${action}" aria-label="${label}" title="${label}">${icon(action)}</button>`;
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
 function mount({root,cloud,legacy,openLegacy,recoverLegacy,onConnect,channel='whatsapp',onCross}){
  const isApp=channel==='app',channelLabel=isApp?'App':'WhatsApp';
  const testEnvironment=window.NEO_CONFIG?.campaignTestEnabled===true;
  let current=null, detail=null, weekly=[], rows=[], filter='', search='', view='agenda', screen='', busy=false, formKey='', page=0, more=false;
  const account=cloud.user.id;
  const active=()=>root.isConnected&&cloud.user?.id===account;
  const rpc=(action,values={})=>cloud.campaignCentral(action,{campaign_id:current,...values});
  const weeklyRpc=(action,values={})=>cloud.campaignWeekly(action,{campaign_id:current,...values});
  const weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  function weeklyDates(rule){
   const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
    .formatToParts(new Date()).reduce((result,part)=>({...result,[part.type]:part.value}),{});
   const today=`${parts.year}-${parts.month}-${parts.day}`, now=today+'T'+parts.hour+':'+parts.minute;
   const start=Date.parse(rule.start+'T00:00:00Z'),horizon=Date.parse(today+'T00:00:00Z')+89*86400000;
   const end=rule.end?Date.parse(rule.end+'T00:00:00Z'):horizon;
   if(!Number.isFinite(start)||!Number.isFinite(end)||end>horizon||start>end||rule.start<today||rule.count<1||rule.count>24)return [];
   const times=[...new Set(rule.times)].sort();
   if(times.length!==rule.times.length||!times.length||times.length>8||times.some(time=>!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)))return [];
   const perDay=rule.day_times;
   const validTime=t=>typeof t==='string'&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t);
   if(perDay!==undefined&&(rule.frequency!=='weekly'||!perDay||typeof perDay!=='object'||Array.isArray(perDay)||!rule.days.length||Object.keys(perDay).length!==rule.days.length||rule.days.some(d=>!validTime(perDay[d]))||Object.keys(perDay).some(d=>!rule.days.includes(Number(d))||String(Number(d))!==d)))return [];
   const dates=[];
   for(let at=start;at<=end&&dates.length<rule.count;at+=86400000){
    const day=new Date(at);
    if(rule.frequency!=='daily'&&!rule.days.includes(day.getUTCDay()))continue;
    for(const time of perDay?[perDay[day.getUTCDay()]]:times){
     const occurrence=day.toISOString().slice(0,10)+'T'+time;
     if(occurrence>now&&dates.length<rule.count)dates.push(occurrence);
    }
   }
   return dates;
  }
  let loadEpoch=0;
  const legacyStates=new Map();
  let statusTimer=null,statusRefreshing=false;
  const legacyKey='neo-campaign-editor:'+account+':'+channel+':new';
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
     if(badge)badge.textContent=pub.deleted_at?'Excluída':status(pub);
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
   const feed=[...rows,...legacy().filter(row=>(isApp?(row.popup_enabled!==false||row.push_requested):row.whatsapp_enabled)&&!row.structured_review_only&&!seen.has(row.id)&&!legacyStates.get(row.id)?.deleted).map(row=>({...row,campaign_id:row.id,legacy:true}))];
   const visible=feed.filter(row=>(!filter||campaignState(row)===filter)&&(row.title||'').toLocaleLowerCase('pt-BR').includes(search));
   redraw(`<div class="between"><h2>Campanhas ${channelLabel}</h2>${button('new','+ Nova campanha','','primary')}</div>
    <div class="central-filters"><label class="central-search">${icon('search')}<input type="search" aria-label="Buscar campanha" placeholder="Buscar campanha" data-central-search value="${escape(search)}"></label><label>Estado<select data-central-filter>
    ${[['','Todas'],['draft','Rascunhos'],['active','Ativas'],['scheduled','Agendadas'],['completed','Concluídas'],['archived','Arquivadas'],['legacy','Legadas']].map(([value,label])=>`<option value="${value}" ${filter===value?'selected':''}>${label}</option>`).join('')}</select></label>
    ${!isApp&&getLocal(legacyKey)?button('recover','Continuar rascunho anterior'):''}</div><div data-central-feed>
    ${visible.map(row=>`<article class="monitor-block"><div class="between"><h3>${escape(row.title)}</h3><span class="campaign-state">${labels[campaignState(row)]}</span></div>
    <p class="sub">${row.legacy?(isApp?'Campanha App existente · fluxo anterior':'Campanha manual · fluxo legado'):`${row.publications} publicação(ões) · ${row.drafts} rascunho(s) · ${row.pending||0} pendente(s) · ${row.problems||0} com problema${row.next_at?' · Próxima: '+date(row.next_at):''}`}</p>
    ${row.origin_channel?'<p class="sub">Criada a partir do '+(row.origin_channel==='app'?'App':'WhatsApp')+'</p>':''}${button(row.legacy?'legacy':'open',row.legacy?'Abrir campanha existente':'Abrir campanha',row.campaign_id)}
    ${!isApp&&row.legacy&&legacyStates.get(row.id)?.can_delete?button('delete_legacy','Excluir campanha manual',row.id):''}</article>`).join('')||'<p>Nenhuma campanha com esse filtro.</p>'}
    </div>${more?button('more','Carregar mais campanhas'):''}`);
  }
  async function refreshLegacy(){
   if(isApp)return;
   const ids=[...new Set(legacy().filter(row=>row.whatsapp_enabled).map(row=>row.id))];
   for(let i=0;i<ids.length;i+=50){
    const batch=await rpc('legacy_states',{ids:ids.slice(i,i+50)}).catch(()=>null);
    if(!active()||!Array.isArray(batch))return;
    for(const id of ids.slice(i,i+50))legacyStates.delete(id);
    for(const entry of batch)legacyStates.set(entry.id,entry);
   }
  }
  async function refresh(append=false){
   const epoch=++loadEpoch;
   const [batch]=await Promise.all([rpc('list',{offset:append?page:0}),refreshLegacy()]);
   if(!active()||epoch!==loadEpoch)return;
   rows=append?[...rows,...batch]:batch;page=rows.length;more=batch.length===50;
   list();
  }
  async function creation(){
   screen='create';formKey=crypto.randomUUID();
   redraw(`${button('back','‹ Campanhas')}<h2>Nova campanha</h2><form data-central-form="create" class="campaign-central-form">
    <label>Nome da campanha<input name="title" required maxlength="120" autocomplete="off"></label>
    <p class="sub">Canal ${channelLabel}. Os horários são independentes por publicação.</p><div data-central-destination></div>
    <button type="submit" class="primary">Criar campanha</button></form>`);
   root.querySelector('[name=title]').focus();
   if(isApp)return;
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
   const items=view==='history'?detail.publications:detail.publications.filter(pub=>!pub.deleted_at);
   const ordered=[...items].sort((a,b)=>(a.batches[0]?.due_at||a.planned_local||'').localeCompare(b.batches[0]?.due_at||b.planned_local||''));
   const undated=ordered.filter(pub=>!pub.planned_local&&!pub.batches.length);
   const dated=ordered.filter(pub=>!undated.includes(pub));
   const cards=entries=>entries.map(pub=>{
    const batch=pub.batches[0],locked=Boolean(pub.deleted_at)||pub.legacy_dispatch||Boolean(batch&&(batch.cancelled_at==null||batch.states?.some(value=>value!=='cancelled')));
    return `<article class="monitor-block central-publication" data-central-publication="${escape(pub.id)}"><div class="central-date-badge">${dateBadge(pub)}</div><div class="central-publication-body"><div class="central-publication-title"><strong>${escape(pub.title)}</strong><span class="campaign-state">${pub.deleted_at?'Excluída':status(pub)}</span></div>
     <p class="sub">${pub.kinds?.length||0} ${isApp?'bloco(s)':'mensagem(ns)'}${pub.kinds?.length?' · '+escape(pub.kinds.join(', ')):''}</p>
     ${view==='agenda'&&editable&&pub.planned_local&&!locked?`<label class="check"><input type="checkbox" name="selected-publication" value="${escape(pub.id)}" aria-label="Selecionar para agendar"> Agendar</label>`:''}
     <details class="central-action-menu"><summary aria-label="Opções da publicação">⋯</summary><div class="central-action-popover">${button('edit',locked||!editable?'Ver publicação':'Editar publicação',pub.id)}
     ${editable&&!pub.deleted_at?button('duplicate_form','Duplicar / distribuir',pub.id)+(!isApp&&typeof cloud.campaignWeekly==='function'?button('weekly_form','Programar repetição',pub.id):''):''}
     ${batch?.states?.includes('waiting')&&editable&&!pub.deleted_at?button('cancel','Cancelar pendências',pub.id):''}
     ${editable&&!pub.deleted_at?button('delete_publication','Excluir publicação',pub.id):''}</div></details>
     ${view==='history'?`<div data-central-history="${escape(pub.id)}">${button('attempts','Ver tentativas e recibos',pub.id)}</div>`:''}</div></article>`;
   }).join('');
   redraw(`${button('back','‹ Campanhas')}<section class="central-campaign-heading"><h2>${escape(detail.title)}</h2><div class="central-campaign-icons">${editable?iconAction('rename','Renomear')+iconAction('archive','Arquivar'):''}${iconAction('delete','Excluir campanha')}${editable&&onCross?button('copy_channel',isApp?'Copiar para WhatsApp':'Copiar para App'):''}</div></section>
    <p class="sub">${channelLabel} · ${items.length} publicação(ões)${editable?'':' · Arquivada'}${detail.origin_channel?' · Criada no '+(detail.origin_channel==='app'?'App':'WhatsApp'):''}</p>
    ${detail.copied_rules?.length?`<details class="space"><summary>Recorrências da campanha de origem · ${detail.copied_rules.length}</summary><p class="sub">Datas copiadas como rascunhos. As regras originais são referência e não estão ativas neste canal.</p>${detail.copied_rules.map(r=>`<p class="sub">${escape((r.dates||[]).map(local).join(' · '))}</p>`).join('')}</details>`:''}
    <div class="inline-actions">${button('agenda','Agenda','',view==='agenda'?'primary':'secondary')}${button('history','Histórico','',view==='history'?'primary':'secondary')}${button('refresh_status','Atualizar estados')}</div>
    ${view==='agenda'? `<div class="central-publication-head"><h3>Publicações</h3>${editable&&!getLocal(pointer())?button('add','+ Adicionar publicação','','primary'):''}</div><label class="central-date-filter">A partir de<input type="date" data-central-date></label><div data-central-date-list>${cards(dated)||'<p>Sem publicações com data.</p>'}</div>
     <h3>Rascunhos sem data</h3>${cards(undated)||'<p>Sem rascunhos sem data.</p>'}
     ${weekly.length?`<h3>Repetições programadas</h3>${weekly.map(item=>`<article class="monitor-block">
      <strong>${escape(items.find(pub=>pub.id===item.publication_id)?.title||'Publicação')}</strong>
      <p class="sub">${({scheduled:'Agendada',paused:'Pausada',cancelled:'Cancelada'})[item.state]} · ${escape(item.dates.map(local).join(' · '))}</p>
      <div class="inline-actions">${editable&&item.state!=='cancelled'?button('weekly_edit','Editar datas',item.id)+
       (item.state==='scheduled'?button('weekly_pause','Pausar',item.id):'')+button('weekly_cancel','Cancelar repetição',item.id):''}</div></article>`).join('')}`:''}
     ${editable?`<div class="inline-actions">
      ${getLocal(pointer())?button('resume','Continuar rascunho local')+button('discard','Descartar rascunho local'):''}
      ${dated.length?button('schedule_selected','Revisar e agendar selecionadas'):''}</div>`:''}`:
     `${cards(ordered)||'<p>Sem publicações registradas.</p>'}<h3>Eventos da campanha</h3><ul>${detail.events.map(event=>`<li>${date(event.recorded_at)} · ${({created:'Campanha criada',save:'Versão salva',duplicate:'Duplicada',schedule:'Agendada',publish:'Publicação solicitada',cancel:'Cancelamento solicitado',archived:'Arquivada',renamed:'Campanha renomeada'})[event.event]||escape(event.event)}${event.revision?' · versão '+escape(event.revision):''}</li>`).join('')}</ul>`}`);
   if(view==='agenda')root.querySelectorAll('[data-central-date-list] article').forEach((node,index)=>{node.dataset.day=(dated[index].batches[0]?.due_at?saoPauloDay(new Date(dated[index].batches[0].due_at)):dated[index].planned_local||'').slice(0,10);});
   scheduleStatusPoll();
  }
  async function load(id){
   ++loadEpoch;current=id;
   const result=await rpc('get');
   const series=!isApp&&typeof cloud.campaignWeekly==='function'?await weeklyRpc('list').catch(()=>[]):[];
   if(active()&&current===id){detail=result;weekly=series;details();}
  }
  async function editor(id,trigger,options={}){
   const campaignId=current;
   const remote=options.new?null:await rpc('load',{publication_id:id});
   if(!active()||current!==campaignId)return;
   if(options.new)setLocal(pointer(),id);
   window.NeoCampaignEditor.open({cloud,channel,remote,trigger,fresh:options.fresh,readOnly:options.readOnly,
    publication:{campaignId,id,title:detail.title,destination:options.new||!remote?detail.default_destination:null},onConnect,onClosed:()=>{if(active()&&current===campaignId)details();},onSaved:()=>{
     if(getLocal(pointer())===id)removeLocal(pointer());
     if(active()&&current===campaignId)void load(campaignId).catch(()=>show('Atualize para conferir a publicação salva.'));
    }});
  }
  function weeklyForm(pub,existing){
   const rule=existing?.rule||{};
   const today=saoPauloDay(new Date());
   const start=rule.start||(pub.planned_local?.slice(0,10)>today?pub.planned_local.slice(0,10):today);
   const defaultDay=new Date(start+'T12:00:00Z').getUTCDay();
   const legacyWeekly=Boolean(existing&&rule.frequency!=='daily'&&rule.times?.length>1);
   redraw(`${button('open','‹ Agenda',current)}<h2>Programar repetição</h2><p>${escape(pub.title)}</p>
    <form data-central-form="weekly" data-id="${escape(pub.id)}" data-request="${crypto.randomUUID()}" data-replace="${escape(existing?.id)}" data-legacy-weekly="${legacyWeekly}" class="campaign-central-form">
    <label>Frequência<select name="frequency"><option value="weekly">Semanal</option><option value="daily" ${rule.frequency==='daily'?'selected':''}>Diária</option></select></label>
    <fieldset><legend>Dias da semana (repetição semanal)</legend><div class="inline-actions">${weekdays.map((day,i)=>`<label class="check"><input type="checkbox" name="days" value="${i}" ${(rule.days||[defaultDay]).includes(i)?'checked':''}> ${day}</label>`).join('')}</div></fieldset>
    <fieldset class="central-time-picker"><legend>Horários em São Paulo</legend><div data-central-times>${(rule.times?.length?rule.times:[rule.time||pub.planned_local?.slice(11,16)||'09:00']).map(time=>`<div class="central-time-chip"><input type="time" name="time" value="${escape(time)}" required aria-label="Horário"><button type="button" class="text-btn" data-remove-time aria-label="Remover horário">×</button></div>`).join('')}</div><button type="button" class="secondary" data-add-time>+ Horário</button><p class="sub">Na frequência diária, adicione até 8 horários. Na semanal, escolha um horário para os dias selecionados.${legacyWeekly?' Os horários de uma regra antiga foram preservados.':''}</p></fieldset>
    <fieldset data-weekday-custom><legend>Horário por dia da semana</legend><label class="check"><input type="checkbox" name="custom_times" ${rule.day_times?'checked':''}> Personalizar horário de cada dia selecionado</label><div data-weekday-times>${weekdays.map((day,i)=>`<label class="central-weekday-time" data-weekday="${i}">${day}<input type="time" name="weekday_${i}" value="${escape(rule.day_times?.[i]||rule.times?.[0]||rule.time||pub.planned_local?.slice(11,16)||'09:00')}" aria-label="Horário de ${day}" required></label>`).join('')}</div></fieldset>
    <label>Início<input type="date" name="start" value="${escape(start)}" required></label>
    <label>Término (opcional)<input type="date" name="end" value="${escape(rule.end)}"></label>
    <label>Número máximo de ocorrências<input type="number" name="count" min="1" max="24" value="${rule.count||4}" required></label>
    <p class="sub">Até 24 ocorrências nos próximos 89 dias. As publicações em andamento mantêm o histórico.</p>
    <button type="submit" class="primary">Conferir próximas datas</button></form>`);
   syncTimeControls(root.querySelector('[data-central-form="weekly"]'));
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
   if(isApp){
    const diag=testEnvironment?await cloud.campaignTest('diagnostics'):await cloud.campaignDispatch('diagnostics',{});
    if(testEnvironment?(!diag.enabled||!diag.audience_key||diag.destinations<1||diag.destinations>30):!diag.app_enabled){show('Agendamento App indisponível. Confira as autorizações.');return;}
    const hydrated=await Promise.all(selected.map(async pub=>({pub,revision:await rpc('load',{publication_id:pub.id})})));
    if(!active()||hydrated.some(({pub,revision})=>!revision||revision.revision!==pub.revision)){show('Uma publicação mudou. Atualize a agenda.');return;}
    const audience=({revision})=>{const a=revision.draft.app_settings;return a?(a.audience==='all'?'Todos':a.targets.join(', '))+' · '+(a.popup_enabled?'Pop-up':'Sem pop-up')+(a.push_requested?' · Push':''):revision.draft.audience||'Todos';};
    if(!confirm((testEnvironment?'Agendar somente para as '+diag.destinations+' contas autorizadas de Teste?':'Confirmar agendamento para os públicos abaixo?')+'\n\n'+hydrated.map(row=>row.pub.title+' · '+local(row.pub.planned_local)+' · '+audience(row)).join('\n')))return;
    const outcomes=[];
    for(const pub of selected){if(!active())return;try{const v=hydrated.find(row=>row.pub.id===pub.id)?.revision;if(!v||v.revision!==pub.revision)throw Error('revision');const key='neo-campaign-app-intent:'+account+':'+pub.id+':'+pub.revision+':'+pub.planned_local;const request=getLocal(key)||crypto.randomUUID();setLocal(key,request);await rpc('schedule',{publication_id:pub.id,revision:pub.revision,local_time:pub.planned_local,request_id:request,confirmed:true,...(testEnvironment?{destination_count:diag.destinations,audience_key:diag.audience_key}:{})});outcomes.push(pub.title+': agendada');}catch{outcomes.push(pub.title+': não confirmada');}}
    await load(current);show(outcomes.join(' · '));return;
   }
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
    }else if(form.dataset.centralForm==='weekly'){
     const fields=new FormData(form),source=await rpc('load',{publication_id:form.dataset.id});
     const rule={start:fields.get('start'),end:fields.get('end'),frequency:fields.get('frequency'),times:fields.getAll('time').map(time=>String(time).trim()),count:Number(fields.get('count')),
      days:fields.getAll('days').map(Number)};
     if(rule.frequency==='weekly'&&fields.has('custom_times')){
      rule.day_times=Object.fromEntries(rule.days.map(d=>[String(d),String(fields.get('weekday_'+d)||'')]));
      // Mantém a chave times exigida pelo contrato legado; horários individuais são validados separadamente.
      rule.times=[rule.day_times[rule.days[0]]||''];
     }
     const dates=weeklyDates(rule),groups=source?.draft?.groups||[];
     if(!dates.length||!groups.length){show('Confira datas e horários e selecione destinos na publicação.');return;}
     const catalog=await cloud.campaignWhatsAppSync('catalog');
     const names=groups.map(id=>catalog.find(group=>group.id===id)?.name||'Destino selecionado');
     if(!active()||!confirm('Agendar para '+names.join(', ')+'?\n\n'+dates.map(local).join('\n')+'\n\nHorário de São Paulo'))return;
     await weeklyRpc('schedule',{...rule,dates,publication_id:form.dataset.id,source_revision:source.revision,request_id:form.dataset.request,
      replace_id:form.dataset.replace||null,confirmed:true});
     await load(current);show('Repetição registrada com '+dates.length+' ocorrência(s).');
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
  root.addEventListener('click',event=>{
   const add=event.target.closest('[data-add-time]'),remove=event.target.closest('[data-remove-time]');
   if(!add&&!remove)return;
   const form=event.target.closest('[data-central-form="weekly"]'),list=form?.querySelector('[data-central-times]');
   if(!list)return;
   if(remove&&list.childElementCount>1)remove.closest('.central-time-chip').remove();
   if(add&&form.elements.frequency.value==='daily'&&list.childElementCount<8){
    list.insertAdjacentHTML('beforeend','<div class="central-time-chip"><input type="time" name="time" required aria-label="Horário"><button type="button" class="text-btn" data-remove-time aria-label="Remover horário">×</button></div>');
    const picker=list.lastElementChild.querySelector('input');picker.focus();try{picker.showPicker?.();}catch{}
   }
   syncTimeControls(form);
  });
  function syncTimeControls(form){
   const daily=form.elements.frequency.value==='daily',list=form.querySelector('[data-central-times]');
   form.querySelector('[data-add-time]').hidden=!daily;
   const multiple=daily||form.dataset.legacyWeekly==='true';
   for(const chip of [...list.children].slice(1)){chip.hidden=!multiple;chip.querySelector('input').disabled=!multiple;}
   for(const day of form.querySelectorAll('[name=days]'))day.disabled=daily;
   const custom=form.elements.custom_times;
   const personalized=!daily&&custom.checked;
   custom.disabled=daily;form.querySelector('[data-weekday-custom]').hidden=daily;
   for(const chip of list.children){if(personalized){chip.hidden=true;chip.querySelector('input').disabled=true;}else if(chip===list.firstElementChild){chip.hidden=false;chip.querySelector('input').disabled=false;}}
   for(const row of form.querySelectorAll('[data-weekday]')){const selected=personalized&&form.querySelector('[name=days][value="'+row.dataset.weekday+'"]').checked;row.hidden=!selected;row.querySelector('input').disabled=!selected;}
  }
  root.addEventListener('click',async event=>{
   const control=event.target.closest('[data-central]');
   if(!control||busy||!active())return;
   const id=control.dataset.id,action=control.dataset.central,pub=detail?.publications.find(row=>row.id===id);
   control.closest('details.central-action-menu')?.removeAttribute('open');
   busy=true;
   try{
    if(action==='new')void creation();
    if(action==='back')await refresh();
    if(action==='more')await refresh(true);
    if(action==='open'){view='agenda';await load(id);}
    if(action==='legacy')openLegacy(id,control);
    if(action==='delete_legacy'&&legacyStates.get(id)?.can_delete&&confirm('Excluir a campanha manual e cancelar os lembretes pendentes? O histórico será preservado.')){
     await rpc('delete_legacy',{campaign_id:id,confirmed:true});
     legacyStates.set(id,{deleted:true});
     await refresh();
    }
    if(action==='recover')recoverLegacy(control,async saved=>{
     if(!saved||!active())return;
     try{const adopted=await rpc('adopt',{campaign_id:saved.campaign_id});await load(adopted.campaign_id);}
     catch{show('O rascunho foi salvo. Consulte também as versões de revisão na aba Publicações.');}
    });
    if(action==='agenda'||action==='history'){view=action;await load(current);}
    if(action==='refresh_status')await refreshVisibleStatus(true);
    if(action==='copy_channel'){
     if(getLocal(pointer())){show('Salve ou descarte o rascunho local antes de copiar a campanha.');return;}
     const target=isApp?'WhatsApp':'App';
     if(!confirm('Copiar todas as publicações salvas para '+target+'? Os conteúdos e datas serão copiados como rascunhos, sem envio. Os destinos precisarão de revisão.'))return;
     const key='neo-campaign-cross:'+account+':'+current+':'+channel;
     const request=getLocal(key)||crypto.randomUUID();setLocal(key,request);
     const copied=await rpc('copy_channel',{channel,request_id:request,confirmed:true});
     if(!active())return;
     removeLocal(key);show('Campanha copiada para '+target+' como rascunho.');onCross?.(copied.channel,copied.campaign_id);return;
    }
    if(action==='add')await editor(crypto.randomUUID(),control,{new:true,fresh:true});
    if(action==='resume'&&getLocal(pointer()))await editor(getLocal(pointer()),control);
    if(action==='discard'&&confirm('Descartar a digitação local desta campanha?')){
     const id=getLocal(pointer());
     removeLocal('neo-campaign-editor:'+account+':'+channel+':'+current+':'+id);removeLocal(pointer());details();
    }
    if(action==='delete_publication'&&pub&&!pub.deleted_at&&confirm('Excluir esta publicação e cancelar as pendências que ainda não começaram? O histórico será preservado.')){
     await rpc('delete_publication',{publication_id:pub.id,confirmed:true});
     await load(current);
    }
    if(action==='edit'&&pub)await editor(id,control,{readOnly:Boolean(detail.archived_at||pub.deleted_at||pub.legacy_dispatch||pub.batches[0]&&
     (pub.batches[0].cancelled_at==null||pub.batches[0].states?.some(value=>value!=='cancelled')))});
    if(action==='duplicate_form'&&pub)duplicateForm(pub);
    if(action==='weekly_form'&&pub)weeklyForm(pub);
    if(action==='weekly_edit'){
     const item=weekly.find(row=>row.id===id),source=detail.publications.find(row=>row.id===item?.publication_id);
     if(item&&source)weeklyForm(source,item);
    }
    if(['weekly_pause','weekly_cancel'].includes(action)&&confirm('Cancelar os envios pendentes desta repetição?')){
     await weeklyRpc(action==='weekly_pause'?'pause':'cancel',{request_id:id,confirmed:true});await load(current);
    }

    if(action==='add_date'){
     const fields=root.querySelector('[data-central-dates]');
     if(fields.childElementCount<20)fields.insertAdjacentHTML('beforeend',`<label>Data e horário em São Paulo<input type="datetime-local" name="date" data-request="${crypto.randomUUID()}" required></label>`);
    }
    if(action==='rename')redraw(`${button('open','‹ Agenda',current)}<h2>Renomear campanha</h2>
     <form data-central-form="rename" class="campaign-central-form"><label>Nome da campanha<input name="title" required maxlength="120" value="${escape(detail.title)}"></label>
     <button class="primary" type="submit">Salvar nome</button></form>`);
    if(action==='delete'&&confirm('Excluir esta campanha e cancelar os envios futuros? O histórico será preservado.')){await rpc('delete',{confirmed:true});await refresh();}
    if(action==='archive'&&confirm('Arquivar esta campanha e manter seu histórico?')){await rpc('archive');await load(current);}
    if(action==='cancel'&&pub&&confirm('Cancelar somente as mensagens ainda pendentes desta publicação?')){
     await rpc('cancel',{publication_id:id,batch_id:pub.batches[0].id});await load(current);
    }
    if(action==='schedule_selected')await scheduleSelected();
    if(action==='attempts'&&pub&&isApp){
     const batches=testEnvironment?await cloud.campaignTest('status',{editor_id:pub.editor_id}):await cloud.campaignDispatch('app_status',{editor_id:pub.editor_id});
     if(active()&&control.parentElement.isConnected)control.parentElement.innerHTML=batches.map(b=>'<p class="sub">'+date(b.starts_at)+' · '+(b.cancelled_at?'Cancelada':(testEnvironment?(b.recipients||[]).filter(r=>r.status==='displayed').length+' exibição(ões) confirmada(s)':escape(b.status||'Registrada')))+'</p>').join('')||'<p>Sem histórico de publicação.</p>';
    }
    if(action==='attempts'&&pub&&!isApp){
     const rich=await cloud.campaignRich('status',{editor_id:pub.editor_id});
     const legacy=pub.legacy_dispatch?await cloud.campaignDispatch('status',{editor_id:pub.editor_id}):[];
     const history=[...rich,...legacy.map((row,index)=>({...row,sequence:index+1,has_receipt:row.attempts?.some(attempt=>Boolean(attempt.receipt_id))}))];
     const holder=control.parentElement;
     if(active()&&holder.isConnected)holder.innerHTML=history.map(row=>`<p class="sub">Mensagem ${escape(row.sequence)} · ${labels[row.dispatch_state]||escape(row.dispatch_state)} · ${escape(row.dispatch_attempts)} tentativa(s) · ${row.has_receipt?'Recibo registrado':'Sem recibo'} · ${date(row.scheduled_at)}</p>`).join('')||'<p>Sem tentativas de despacho.</p>';
    }
   }catch(error){show(action==='copy_channel'?'Não foi possível copiar integralmente. Confira se todos os anexos originais estão disponíveis e as publicações salvas. Nenhuma cópia parcial é mantida.':'Não foi possível concluir. Confira a autorização, o estado da publicação e a conexão do NeoPep Connect.');}
   finally{busy=false;}
  });
  root.addEventListener('change',event=>{
   if(event.target.matches('[name=frequency],[name=days],[name=custom_times]')&&event.target.closest('[data-central-form="weekly"]'))syncTimeControls(event.target.form);
   if(event.target.matches('[data-central-filter]')){filter=event.target.value;list();}
   if(event.target.matches('[data-central-search]')){search=event.target.value.trim().toLocaleLowerCase('pt-BR');list();root.querySelector('[data-central-search]').focus();}
   if(event.target.matches('[data-central-date]'))root.querySelectorAll('[data-central-date-list] article').forEach(node=>{node.hidden=Boolean(event.target.value&&node.dataset.day<event.target.value);});
  });
  return {async open(id){view='agenda';try{await load(id);}catch{screen='failed';redraw('<p>Não foi possível abrir a campanha copiada. Atualize a central.</p>');}},async reload(){try{await refresh();}catch{screen='failed';show('Central indisponível. Atualize o painel.');}},async load(){if(!screen){screen='loading';redraw('<p>Consultando campanhas…</p>');try{await refresh();}catch{screen='failed';show('Central indisponível. Atualize o painel para tentar novamente.');}}},syncLegacy(){if(screen==='list'&&!busy){list();void refreshLegacy().then(()=>{if(screen==='list'&&!busy)list();});}}};
 }
 window.NeoCampaignCentral={mount};
})();
