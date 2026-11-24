(() => {
 'use strict';
 const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const states={eligible:'Elegível',stale:'Desatualizado',disconnected:'Desconectado',unavailable:'Indisponível'};
 const labels={text:'Texto',image:'Imagem',file:'Documento',link:'Link',product:'Produto',document:'Biblioteca',community:'Comunidade · referência interna'};
 let stopOpen;
 const uuid=()=>crypto.randomUUID();
 const groupIdentity=id=>String(id).split(':').at(-1);
 const endpoint=(cloud,action,payload={})=>cloud.campaignEditor(action,payload);

 function formatted(text){
  const syntax=/(\`\`\`[^\`]+\`\`\`|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  return String(text||'').split(syntax).map(part=>{
   if(!/^(`{3}|\*|_|~)/.test(part)||!part.match(/^(\`\`\`[^\`]+\`\`\`|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)$/))return e(part);
   if(part.startsWith('`'))return '<code>'+e(part.slice(3,-3))+'</code>';
   const tag={'*':'strong','_':'em','~':'s'}[part[0]];
   return '<'+tag+'>'+e(part.slice(1,-1))+'</'+tag+'>';
  }).join('');
 }
 function validLink(value){
  try{
   const url=new URL(value);
   return url.protocol==='https:'&&!url.username&&!url.password&&!/\/storage\/v1\/object\/(sign|authenticated)\//i.test(url.pathname)
    &&![...url.searchParams.keys()].some(key=>/^(token|signature|apikey|x-amz-)/i.test(key))&&url.href.length<=2000 ? url.href : '';
  }catch{return '';}
 }
 function linkFor(block){
  if(block.type==='product')return '/?produto='+encodeURIComponent(block.ref)+'#loja';
  if(block.type==='document')return '/?material='+encodeURIComponent(block.ref)+'#comunidade';
  return validLink(block.url);
 }
 function storeMedia(mode,operation){
  return new Promise((resolve,reject)=>{
   const opening=indexedDB.open('neo-campaign-editor-media',1);
   opening.onupgradeneeded=()=>opening.result.createObjectStore('files');
   opening.onerror=()=>reject(opening.error);
   opening.onsuccess=()=>{
    const database=opening.result,txn=database.transaction('files',mode);
    let request;
    txn.oncomplete=()=>{database.close();resolve(request?.result);};
    txn.onerror=txn.onabort=()=>{database.close();reject(txn.error);};
    request=operation(txn.objectStore('files'));
   };
  });
 }

 const paths={
  back:'M19 12H5m7-7-7 7 7 7',group:'M15 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m9-12a3 3 0 1 1-6 0 3 3 0 0 1 6 0m5 5a3 3 0 0 1 4 3v4m-5-15a3 3 0 0 1 0 6',
  gear:'M3 6h18M3 12h18M3 18h18M7 4v4m10 2v4m-7 2v4',more:'M12 5v1m0 5v1m0 5v1',
  plus:'M12 5v14M5 12h14',send:'m3 4 18 8-18 8 4-8-4-8Zm4 8h14',
  text:'M5 6h14M12 6v13m-4 0h8',photo:'M4 4h16v16H4zM4 16l5-5 4 4 2-2 5 5m-4-9h.01',
  file:'M6 3h8l4 4v14H6zM9 12h6m-6 4h5',link:'m10 13 4-4m-5 6-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 2a3 3 0 0 0 4 0l4-4a3 3 0 0 0-4-4l-2 2',
  product:'M4 8h16v12H4zM8 8V6a4 4 0 0 1 8 0v2',book:'M12 6c-3-2-6-2-9-2v14c3 0 6 0 9 2 3-2 6-2 9-2V4c-3 0-6 0-9 2Zm0 0v14',
  clock:'M4 6h16v14H4zM8 3v5m8-5v5m-4 2v5l3 2',repeat:'M4 11a8 8 0 0 1 14-4l2 2m0-5v5h-5M20 13a8 8 0 0 1-14 4l-2-2m0 5v-5h5',
  audience:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2m1-8 2 2 3-4',
  save:'M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-7h8v7',audio:'M10 4h4v10h-4zM7 10v3a5 5 0 0 0 10 0v-3m-5 8v3'
 };
 const icon=name=>`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
 const iconButton=(name,label,attrs='')=>`<button type="button" class="structured-icon" aria-label="${label}" title="${label}" ${attrs}>${icon(name)}</button>`;
 function open({cloud,row={},channel='whatsapp',remote=null,trigger,onSaved,onConnect,fresh=false,readOnly=false,previewBlocks=[],previewImages=new Map(),onEdit,previewModes}){
  const account=cloud.user?.id;
  if(!account)return;
  stopOpen?.();
  const source=remote?remote.source_id:(row.id||null);
  const key='neo-campaign-editor:'+account+':'+channel+':'+(remote?.editor_id||source||'new');
  const initial={title:row.title||'',blocks:row.whatsapp_message||row.body?[{id:uuid(),type:'text',text:row.whatsapp_message||row.body}]:[],
   groups:[],timezone:'America/Sao_Paulo',planned_local:'',audience:'all'};
  const recovered=()=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
  const local=fresh||readOnly?null:recovered();
  const state=local&&(!remote||local.revision>=remote.revision)?local:{
   editorId:remote?.editor_id||uuid(),revision:remote?.revision||0,remoteId:remote?.campaign_id||null,
   draft:remote?.draft||initial
  };
  const draft=state.draft;
  if(readOnly&&previewBlocks.length)draft.blocks=previewBlocks;
  if(readOnly&&previewModes){const model=previewModes('web');draft.blocks=model.blocks;previewImages=model.images;}
  if(channel==='app')draft.groups=[];
  const dialog=document.createElement('dialog');
  dialog.className='neo-structured-editor';
  dialog.setAttribute('aria-labelledby','neo-campaign-structured-title');
  const pane=(name,title,body)=>`<section class="structured-pane" data-editor-pane="${name}" aria-label="${title}" hidden><h3>${title}</h3>${body}</section>`;
  const tile=(name,label,target,disabled=false)=>`<button type="button" data-pane-open="${target}" ${disabled?'disabled':''}>${icon(name)}<span>${label}</span></button>`;
  const tools=readOnly?'':`
   <aside class="structured-sheet" data-editor-sheet hidden>
    <div class="structured-sheet-top"><button type="button" class="text-btn" data-pane-open="menu">Ferramentas</button><button type="button" class="text-btn" data-editor="sheet_close">Fechar painel</button></div>
    ${pane('menu','Adicionar ou configurar',`<div class="structured-tiles">
      ${tile('text','Texto','compose')}${tile('photo','Foto','photo')}${tile('file','Documento','file')}${tile('link','Link','link')}
      ${tile('product','Produto','product')}${tile('book','Biblioteca','document')}${channel==='whatsapp'?tile('group','Grupos','groups'):tile('audience','Público','audience')}${tile('clock','Agendar','schedule')}
      ${channel==='whatsapp'?tile('repeat','Recorrência','recurrence'):''}${tile('text','Formatação','format')}${tile('gear','Ajustes','settings')}${tile('audio','Áudio indisponível','audio',true)}
      ${tile('group','Comunidade','community')}${tile('more','Destinos','destinations')}
    </div>`)}
    ${pane('settings','Configurações',`<label>Título administrativo<input name="title" maxlength="120" value="${e(draft.title)}"></label><p class="sub" data-structured-connection role="status">Conexão ainda não verificada.</p>
     <div class="inline-actions"><button type="button" class="secondary" data-editor="fresh">Novo rascunho</button>${channel==='whatsapp'?'<button type="button" class="secondary" data-editor="cross">Criar versão App</button>':''}</div>`)}
    ${channel==='app'?pane('audience','Público App','<label>Público App<select name="audience"><option value="all">Todos</option><option value="free">Free</option><option value="premium">Premium</option></select></label><label class="check"><input name="push" type="checkbox"> Solicitar push App para contas com consentimento</label>'):
    pane('groups','Grupos sincronizados','<div class="inline-actions"><button type="button" class="secondary" data-editor="groups">Atualizar grupos e diagnóstico</button><button type="button" class="secondary" data-editor="connect">Abrir NeoPep Connect</button></div><label>Pesquisar grupo ou conexão<input name="group_search" type="search"></label><p class="sub" data-editor-group-count></p><div data-editor-groups></div>')}
    ${pane('photo','Foto','<label>Modo da imagem<select name="layout"><option value="caption">Imagem com legenda</option><option value="separate">Imagem separada</option></select></label><label>Legenda<input name="caption" maxlength="4000"></label><button type="button" class="secondary" data-editor="choose_image">Selecionar foto</button>')}
    ${pane('file','Documento','<button type="button" class="secondary" data-editor="choose_document">Escolher PDF ou TXT</button>')}
    <input type="file" name="media" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" hidden>
    ${pane('link','Link','<label>Link HTTPS<input name="link" type="url" maxlength="2000"></label><button type="button" class="secondary" data-editor="link">Adicionar link</button>')}
    ${pane('catalog','Referências','<label>Buscar referências<input name="catalog_search" type="search" maxlength="100"></label><button type="button" class="secondary" data-editor="catalog_search">Buscar</button><div data-editor-catalog></div><p class="sub">As referências preservam as permissões de acesso e consentimento.</p>')}
    ${pane('schedule','Publicação e horário','<label>Horário planejado (São Paulo)<input name="planned_local" type="datetime-local" value="'+e(draft.planned_local)+'"></label><p data-editor-summary class="sub"></p><div class="inline-actions"><button type="button" class="secondary" data-editor="publish" disabled>Publicar agora</button><button type="button" class="secondary" data-editor="schedule" disabled>Programar</button></div><p class="sub" data-dispatch-gate></p>')}
    ${channel==='whatsapp'?pane('recurrence','Recorrência','<label>Ocorrências semanais<input name="weekly_count" type="number" min="1" max="6" step="1" value="1"></label>'):''}
    ${pane('format','Formatação do trecho selecionado','<div class="inline-actions"><button type="button" class="secondary" data-format="*">Negrito</button><button type="button" class="secondary" data-format="_">Itálico</button><button type="button" class="secondary" data-format="~">Riscado</button><button type="button" class="secondary" data-format="&#96;">Monoespaçado</button></div>')}
    ${pane('destinations','Acompanhar destinos','<button type="button" class="secondary" data-editor="dispatch_status">Atualizar tentativas</button><div data-dispatch-results></div>')}
   </aside>`;
  dialog.innerHTML=`
   <header class="structured-header">
    ${iconButton('back','Voltar','data-editor="close" autofocus')}<span class="structured-avatar">${icon('group')}</span>
    <div><h2 id="neo-campaign-structured-title">${channel==='app'?'Rascunho App':e(row.group_name||'Grupo de exemplo')}</h2>
    <p class="sub">Simulação de campanha · ${channel==='app'?'App':'WhatsApp'}</p></div>
    ${readOnly?(onEdit?iconButton('gear','Editar conteúdo','data-editor="edit_preview"'):''):iconButton('gear','Configurações','data-pane-open="settings"')+iconButton('more','Mais ações','data-pane-open="menu"')}
   </header>
   <main class="neo-structured-scroll"><div class="neo-structured-preview" aria-label="Conversa simulada" data-editor-preview></div><div class="structured-live" data-editor-live hidden></div></main>
   ${tools}
   ${readOnly?`<footer>${previewModes?'<label class="structured-preview-mode">Modo da simulação<select name="preview_mode"><option value="web">Painel · compartilhamento manual</option><option value="connect">Connect · imagem com legenda</option></select></label>':''}<p class="sub">Simulação visual. A disponibilidade de envio depende do canal e dos anexos.</p></footer>`:`<footer>
    <div class="structured-compose">${iconButton('plus','Adicionar conteúdo','data-pane-open="menu"')}
     <label><span class="sr-only">Compor texto</span><textarea name="message" maxlength="4000" rows="1" placeholder="Escreva sua mensagem…"></textarea></label>
     ${iconButton('send','Adicionar texto','data-editor="text"')}
    </div>
    <div class="structured-toolbar">
     ${iconButton('photo','Anexos','data-pane-open="photo"')}
     ${channel==='whatsapp'?iconButton('group','Grupos','data-pane-open="groups"'):iconButton('audience','Público','data-pane-open="audience"')}
     ${iconButton('clock','Publicação e agendamento','data-pane-open="schedule"')}
     ${iconButton('text','Formatação','data-pane-open="format"')}
     ${iconButton('save','Registrar rascunho na Central','data-editor="save"')}
     ${iconButton('more','Acompanhar destinos','data-pane-open="destinations"')}
     <button type="button" class="text-btn" data-editor="revert" hidden>Desfazer exclusão</button>
    </div><p role="status" class="sub" data-editor-status></p>
   </footer>`}`;
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s),field=name=>$('[name="'+name+'"]');
  const status=$('[data-editor-status]'),message=field('message')||document.createElement('textarea');
  const preview=$('[data-editor-preview]'),connection=$('[data-structured-connection]');
  const objectUrls=new Set(),sheet=$('[data-editor-sheet]');
  let sheetTrigger=null,catalogKind='document';
  let gates={},dispatching=false,groups=[],pending,active=true,editing=null,removed=null,saving=false,revision=0,loadToken=0,catalogToken=0,selection=[0,0],catalogRows=[];
  const current=()=>active&&cloud.user?.id===account;
  const mediaKey=id=>account+':'+state.editorId+':'+id;
  const tell=text=>{if(current()&&status)status.textContent=text;};
  if(field('audience'))field('audience').value=draft.audience;
  message.value=state.compose||'';editing=state.editing||null;
  if(field('weekly_count'))field('weekly_count').value=state.weeklyCount||1;
  if(field('push'))field('push').checked=state.push===true;
  function composeAction(){
   const action=$('[data-editor=text]');
   if(!action)return;
   action.setAttribute('aria-label',editing?'Atualizar bloco':'Adicionar texto');
   action.title=editing?'Atualizar bloco':'Adicionar texto à simulação';
  }
  composeAction();
  function closeSheet(focus=true){
   if(!sheet||sheet.hidden)return;
   sheet.hidden=true;if(focus)sheetTrigger?.focus({preventScroll:true});sheetTrigger=null;
  }
  function openPane(name,trigger){
   if(!sheet)return;
   const pane=$('[data-editor-pane="'+name+'"]');
   if(!pane)return;
   if(sheet.hidden)sheetTrigger=trigger;
   sheet.hidden=false;
   for(const section of sheet.querySelectorAll('[data-editor-pane]'))section.hidden=section!==pane;
   pane.scrollIntoView?.({block:'nearest'});
   const heading=pane.querySelector('h3');
   heading.tabIndex=-1;heading.focus({preventScroll:true});
  }
  function paintLive(scroll=false){
   const live=$('[data-editor-live]'),value=message.value;
   const selected=editing&&preview.querySelector('[data-block-id="'+CSS.escape(editing)+'"] [data-block-text]');
   if(selected)selected.innerHTML=formatted(value);
   live.hidden=Boolean(selected)||!value.trim();
   live.innerHTML=live.hidden?'':'<article class="neo-structured-bubble"><div class="neo-structured-text">'+formatted(value)+'</div><small>Em composição</small></article>';
   if(scroll&&!live.hidden){const log=$('.neo-structured-scroll');log.scrollTop=log.scrollHeight;}
  }
  const retainSelection=()=>{selection=[message.selectionStart,message.selectionEnd];};
  for(const type of ['select','keyup','pointerup','input','blur'])message.addEventListener(type,retainSelection);

  function saveLocal(){
   clearTimeout(pending);
   if(readOnly)return true;
   if(!current())return false;
   state.compose=message.value;state.editing=editing;state.weeklyCount=field('weekly_count')?.value;state.push=field('push')?.checked===true;
   try{
    const saved=JSON.stringify(state);
    localStorage.setItem(key,saved);
    localStorage.setItem('neo-campaign-editor:'+account+':'+channel+':'+state.editorId,saved);
    tell('Rascunho salvo neste dispositivo.');return true;}
   catch{tell('Falha ao salvar neste dispositivo. Mantenha o editor aberto.');return false;}
  }
  function changed(){
   paintLive();showGate();clearTimeout(pending);tell('Salvando rascunho…');pending=setTimeout(saveLocal,300);
  }
  function render(){
   const version=++revision;
   for(const url of objectUrls)URL.revokeObjectURL(url);
   objectUrls.clear();
   preview.innerHTML=draft.blocks.map((block,index)=>{
    const link=linkFor(block);
    return `<article class="neo-structured-bubble" data-block-id="${e(block.id)}">
     <small>${e(labels[block.type])}${block.type==='image'?' · '+(block.layout==='caption'?'com legenda':'separada'):''}</small>
     ${block.type==='image'?'<img data-editor-image="'+e(block.id)+'" alt="" hidden>':''}
     ${['image','file'].includes(block.type)?'<p class="sub" data-editor-media-status="'+e(block.id)+'">Verificando anexo local…</p>':''}
     ${block.name||block.label?`<strong>${e(block.name||block.label)}</strong>`:''}
     <div class="neo-structured-text" data-block-text>${formatted(block.text)}</div>
     ${link?`<span class="neo-wa-link">${e(link)}</span>`:''}
     ${readOnly?'':`<details class="structured-bubble-actions"><summary aria-label="Opções da mensagem">⋯</summary><div class="inline-actions">
      ${['text','image'].includes(block.type)?`<button type="button" class="text-btn" data-editor="edit" data-index="${index}">Editar</button>`:''}
      ${['duplicate','up','down','delete'].map((a,i)=>`<button type="button" class="text-btn" data-editor="${a}" data-index="${index}" ${a==='up'&&!index||a==='down'&&index===draft.blocks.length-1?'disabled':''}>${['Duplicar','Subir','Descer','Excluir'][i]}</button>`).join('')}
     </div></details>`}</article>`;
   }).join('')||'<p class="sub">Adicione um bloco para revisar a mensagem.</p>';
   for(const indicator of preview.querySelectorAll('[data-editor-media-status]')){
    const id=indicator.dataset.editorMediaStatus;
    const asset=previewImages.has(id)?Promise.resolve(previewImages.get(id)):readOnly?Promise.resolve(null):storeMedia('readonly',store=>store.get(mediaKey(id)));
    void asset.then(blob=>{
     if(!current()||version!==revision)return;
     indicator.textContent=blob?'Anexo de prévia · fora do despacho automático.':readOnly?'Arquivo indisponível nesta prévia.':'Arquivo indisponível neste dispositivo. Adicione-o novamente para revisar.';
     const image=indicator.parentElement.querySelector('[data-editor-image]');
     if(blob&&image){const url=typeof blob==='string'?blob:URL.createObjectURL(blob);if(typeof blob!=='string')objectUrls.add(url);image.src=url;image.hidden=false;}
    }).catch(()=>{if(current()&&version===revision)indicator.textContent='Não foi possível consultar o anexo local.';});
   }
   const revert=$('[data-editor=revert]');if(revert)revert.hidden=!removed;
   paintLive();
  }
  function add(block){
   if(draft.blocks.length>=32){tell('Limite de 32 blocos por rascunho.');return false;}
   draft.blocks.push({id:uuid(),...block});render();changed();return true;
  }
  function renderGroups(){
   const root=$('[data-editor-groups]');
   if(!root)return;
   const query=field('group_search').value.trim().toLocaleLowerCase('pt-BR');
   const entries=new Map(draft.groups.map(id=>[id,{id,name:'Grupo anteriormente selecionado',state:'unavailable'}]));
   for(const row of groups)entries.set(row.id,row);
   root.innerHTML=[...entries.values()].filter(row=>`${row.name} ${row.connection||''}`.toLocaleLowerCase('pt-BR').includes(query)).map(row=>{
    const chosen=draft.groups.includes(row.id);
    return `<label class="check"><input type="checkbox" data-editor-group="${e(row.id)}" ${chosen?'checked':''} ${!chosen&&row.state!=='eligible'?'disabled':''}>
    <span>${e(row.name)} · ${e(row.connection||'Conexão sem evidência')} · ${e(states[row.state]||'Estado desconhecido')}
    ${row.participant_count==null?'':' · '+e(row.participant_count)+' participantes'}
    ${row.last_synced_at?' · '+e(new Date(row.last_synced_at).toLocaleString('pt-BR')):''}</span></label>`;
   }).join('')||'<p class="sub">Nenhum grupo sincronizado no recorte.</p>';
   $('[data-editor-group-count]').textContent=draft.groups.length+' de até 30 selecionados.';
  }
  async function refreshGroups(){
   if(channel!=='whatsapp')return;
   const token=++loadToken;
   connection.textContent='Consultando grupos sincronizados…';
   try{
    const list=await cloud.campaignWhatsAppSync('catalog');
    if(!current()||token!==loadToken)return;
    groups=list;renderGroups();
    connection.textContent=groups.some(row=>row.state==='eligible')?'Grupos elegíveis encontrados. Despacho permanece bloqueado.':
     'Sem destino elegível na consulta atual. Despacho bloqueado.';
   }catch{if(current()&&token===loadToken){groups=[];renderGroups();connection.textContent='Diagnóstico indisponível. Despacho bloqueado.';}}
  }
  function showGate(){
   if(readOnly)return;
   const clean=state.remoteId&&state.savedDraft===JSON.stringify(draft)&&!message.value.trim()&&!editing;
   const enabled=channel==='app'?gates.app_enabled:gates.whatsapp_enabled;
   const textOnly=draft.blocks.length>0&&draft.blocks.every(block=>block.type==='text'&&!/(https?:\/\/|www\.)/i.test(block.text||''));
   const eligible=channel==='app'||draft.groups.length>0&&draft.groups.every(id=>groups.some(row=>row.id===id&&row.state==='eligible'));
   const allow=Boolean(enabled&&clean&&textOnly&&eligible);
   $('[data-editor=publish]').disabled=!allow||channel==='whatsapp'&&!gates.devices?.some(d=>d.ready);
   $('[data-editor=schedule]').disabled=!allow||!draft.planned_local;
   $('[data-editor-summary]').textContent=dispatchSummary(Boolean(draft.planned_local));
   $('[data-dispatch-gate]').textContent=enabled?
    'O despacho exige uma versão registrada, somente texto e destinos autorizados. Aceitação pelo cliente não confirma entrega.':
    'Envio e agendamento automáticos bloqueados. Somente texto no contrato de despacho.';
  }
  async function refreshGate(){
   if(typeof cloud.campaignDispatch!=='function')return;
   try{
    const result=await cloud.campaignDispatch('diagnostics',{});
    if(!current())return;
    gates=result||{};
    if(channel==='whatsapp'&&gates.devices?.length){
     connection.textContent=gates.devices.map(d=>`${d.label} · ${d.ready?'Sessão recente':'Offline ou não verificada'}
      ${d.bridge_version?' · '+d.bridge_version:''}`).join(' / ');
    }
   }catch{if(current())gates={};}
   if(current())showGate();
  }
  const outcomes={waiting:'Aguardando',leased:'Em preparação',started:'Em processamento',accepted:'Aceito pelo cliente',
   uncertain:'Resultado incerto · revisar',failed:'Falhou',cancelled:'Cancelado'};
  async function showDispatch(){
   const root=$('[data-dispatch-results]');
   root.textContent='Consultando destinos…';
   try{
    const rows=await cloud.campaignDispatch(channel==='app'?'app_status':'status',{editor_id:state.editorId});
    if(!current())return;
    if(channel==='app'){
     root.innerHTML=rows.map(row=>`<article class="monitor-block">
      <strong>${e(row.title)} · ${row.cancelled_at?'Cancelada':row.status==='active'&&new Date(row.starts_at)>new Date()?'Programada':e(row.status)}</strong>
      <p class="sub">${e(new Date(row.starts_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · Push ${row.push_requested?'solicitado':'desligado'}</p>
      ${row.status==='active'&&new Date(row.starts_at)>new Date()?'<button type="button" class="secondary" data-editor="reschedule" data-batch="'+e(row.id)+'">Mover horário App</button> <button type="button" class="secondary" data-editor="cancel_batch" data-batch="'+e(row.id)+'">Cancelar App</button>':''}</article>`).join('')||'Nenhuma publicação App registrada.';
     return;
    }
    root.innerHTML=rows.map(row=>`<article class="monitor-block">
     <strong>${e(row.dispatch_jid)} · ${e(outcomes[row.dispatch_state]||row.dispatch_state)}</strong>
     <p class="sub">${e(new Date(row.dispatch_due).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${e(row.dispatch_attempts)} tentativa(s)${row.dispatch_cancel_requested?' · Cancelamento solicitado':''}</p>
     <ul>${row.attempts.map(a=>`<li>${e(a.event)} · ${e(new Date(a.recorded_at).toLocaleString('pt-BR'))}</li>`).join('')}</ul>
     ${row.dispatch_state==='waiting'?'<button type="button" class="secondary" data-editor="reschedule" data-batch="'+e(row.dispatch_batch)+'" data-publication="'+e(row.id)+'">Mover para o horário planejado</button>':''}
     ${['waiting','leased','started'].includes(row.dispatch_state)?'<button type="button" class="secondary" data-editor="cancel_batch" data-batch="'+e(row.dispatch_batch)+'">Cancelar lote</button>':''}</article>`).join('')||'Nenhum destino agendado neste rascunho.';
   }catch{if(current())root.textContent='Histórico de despacho indisponível.';}
  }
  function dispatchSummary(scheduled){
   const destinations=channel==='app'?('Público: '+({all:'Todos',free:'Free',premium:'Premium'}[draft.audience]||'Todos')):`${draft.groups.length} grupo(s)`;
   const when=scheduled&&draft.planned_local?draft.planned_local.replace('T',' ')+' (São Paulo)':'Agora';
   const description=draft.blocks.map(block=>labels[block.type]||block.type).join(', ')||'Sem conteúdo';
   return [destinations,when,`${draft.blocks.length} bloco(s): ${description}`].join(' · ');
  }
  async function dispatch(scheduled){
   if(dispatching||!current())return;
   const action=channel==='app'?'publish_app':'schedule_whatsapp';
   const intent={editor_id:state.editorId,revision:state.revision,local_time:scheduled?draft.planned_local:null,
    weekly_count:channel==='app'||!scheduled?1:Number(field('weekly_count').value),push:field('push')?.checked===true};
   const fingerprint=JSON.stringify(intent);
   const request=state.dispatchAttempt?.fingerprint===fingerprint?state.dispatchAttempt:{fingerprint,id:uuid()};
   if(!window.confirm('Confirmar neste canal?\n'+dispatchSummary(scheduled)+'\n'+draft.blocks.map(block=>block.text||block.name||block.label||'').join(' ').slice(0,160)))return;
   state.dispatchAttempt=request;saveLocal();dispatching=true;
   try{
    await cloud.campaignDispatch(action,{...intent,request_id:request.id});
    if(!current())return;
    saveLocal();tell(channel==='app'?'Campanha App registrada.':'Ocorrências registradas. Confira os resultados por destino.');
    onSaved?.();
   }catch{tell('Não foi possível confirmar a operação. Repita os mesmos dados para reconciliar.');}
   finally{dispatching=false;}
  }
  async function saveRemote(){
   if(saving||!current())return;
   if(editing||message.value.trim()){tell('Adicione ou conclua o bloco em edição antes de registrar a versão.');return;}
   if(!draft.title.trim()){tell('Informe o título do rascunho.');return;}
   const snapshot=JSON.parse(JSON.stringify(draft));
   const fingerprint=JSON.stringify(snapshot);
   const attempt=state.attempt?.fingerprint===fingerprint?state.attempt:{fingerprint,id:uuid()};
   state.attempt=attempt;
   saveLocal();saving=true;tell('Registrando versão de revisão…');
   try{
    const result=await endpoint(cloud,'save',{editor_id:state.editorId,request_id:attempt.id,
     source_id:source,revision:state.revision,channel,draft:snapshot});
    if(!current())return;
    state.revision=result.revision;state.remoteId=result.campaign_id;state.attempt=null;
    state.savedDraft=fingerprint;showGate();
    saveLocal();tell('Versão '+state.revision+' registrada para revisão. Nenhum envio realizado.');
    onSaved?.(result);
   }catch(err){tell(err.code==='40001'?'A versão mudou. Reabra pela esteira para revisar.':'Não foi possível confirmar o registro. Repita sem alterar a versão para recuperar o resultado.');}
   finally{saving=false;}
  }
  const viewport=window.visualViewport;
  const resize=()=>{if(viewport){
   dialog.style.setProperty('--structured-height',viewport.height+'px');
   dialog.style.setProperty('--structured-top',viewport.offsetTop+'px');
  }};
  viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);resize();
  function finish(){
   if(!active)return;
   if(stopOpen===stop)stopOpen=null;
   viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);
   active=false;clearTimeout(pending);window.removeEventListener('pagehide',saveLocal);
   for(const url of objectUrls)URL.revokeObjectURL(url);
   dialog.remove();if(trigger?.isConnected)trigger.focus({preventScroll:true});
  }
  function close(){
   if(saving){tell('Aguarde a confirmação do registro.');return false;}
   if(!saveLocal()&&!window.confirm('O rascunho não foi salvo. Sair mesmo assim?'))return false;
   dialog.close();return true;
  }
  const stop=()=>{if(dialog.open)dialog.close();finish();};
  stopOpen=stop;
  dialog.addEventListener('close',finish,{once:true});
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(sheet&&!sheet.hidden)closeSheet();else close();});
  window.addEventListener('pagehide',saveLocal);
  dialog.addEventListener('input',event=>{
   const name=event.target.name;
   if(name==='group_search'){renderGroups();return;}
   if(['title','planned_local','audience'].includes(name)){draft[name]=event.target.value;changed();}
   if(name==='message'){changed();paintLive(true);}
   if(['weekly_count','push'].includes(name))changed();
  });
  dialog.addEventListener('change',async event=>{
   const input=event.target;
   if(readOnly&&input.name==='preview_mode'&&previewModes){
    const model=previewModes(input.value);draft.blocks=model.blocks;previewImages=model.images;render();return;
   }
   if(input.dataset.editorGroup){
    const id=input.dataset.editorGroup;
    if(!input.checked)draft.groups=draft.groups.filter(key=>key!==id);
    else if(groups.some(row=>row.id===id&&row.state==='eligible')&&draft.groups.length<30&&!draft.groups.some(key=>groupIdentity(key)===groupIdentity(id)))draft.groups.push(id);
    else{input.checked=false;tell('Selecione até 30 destinos elegíveis e distintos.');return;}
    renderGroups();changed();
   }
   if(input.name!=='media')return;
   const file=input.files?.[0];input.value='';
   if(!file)return;
   const image=/^image\/(jpeg|png|webp)$/.test(file.type);
   if((!image&&!['application/pdf','text/plain'].includes(file.type))||!file.size||file.size>5*1024*1024||draft.blocks.length>=32){
    tell('Selecione imagem, PDF ou TXT de até 5 MB, dentro do limite de blocos.');return;
   }
   const id=uuid(),caption=field('caption').value,layout=field('layout').value;
   try{
    if(file.type==='application/pdf'&&(await file.slice(0,5).text())!=='%PDF-'){tell('PDF inválido.');return;}
    await storeMedia('readwrite',store=>store.put(file,mediaKey(id)));
    if(!current())return;
    if(draft.blocks.length>=32){void storeMedia('readwrite',store=>store.delete(mediaKey(id))).catch(()=>{});return;}
    draft.blocks.push({id,type:image?'image':'file',name:file.name.slice(0,120),...(image?{layout,text:caption}:{})});
    render();changed();closeSheet();
   }catch{tell('Não foi possível guardar o arquivo neste dispositivo.');}
  });
  async function searchCatalog(){
   const action=catalogKind;
    const token=++catalogToken,box=$('[data-editor-catalog]');box.textContent='Buscando referências…';
    try{
     const results=await endpoint(cloud,'catalog',{kind:action,search:field('catalog_search').value});
     if(!current()||token!==catalogToken)return;
     catalogRows=results.map(row=>({...row,kind:action}));
     box.innerHTML=catalogRows.map((row,i)=>`<button type="button" class="secondary" data-editor="reference" data-index="${i}">${e(row.label)}${row.price_cents==null?'':' · '+e((row.price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))}</button>`).join('')||'Nenhuma referência disponível.';
    }catch{if(current()&&token===catalogToken)box.textContent='Catálogo indisponível.';}
   }
  dialog.addEventListener('pointerdown',event=>{if(event.target.closest('[data-format]'))retainSelection();});
  dialog.addEventListener('click',async event=>{
   if(!current())return;
   const control=event.target.closest('button');
   if(!control){
    const bubble=event.target.closest('[data-block-id]');
    if(bubble&&!event.target.closest('details')){const options=bubble.querySelector('details');if(options)options.open=!options.open;}
    return;
   }
   const target=control.dataset.paneOpen;
   if(target){
    if(target==='compose'){closeSheet(false);message.focus();return;}
    if(['product','document','community'].includes(target)){
     catalogKind=target;field('catalog_search').value='';openPane('catalog',control);void searchCatalog();return;
    }
    if(sheet&&!sheet.hidden&&target==='menu'&&control===sheetTrigger){closeSheet();return;}
    openPane(target,control);return;
   }
   const format=control.dataset.format;
   if(format){
    const [first,last]=selection;
    if(first===last){tell('Selecione um trecho antes de formatar.');return;}
    const wrap=format==='\`'?'\`\`\`':format,text=message.value.slice(first,last);
    if(text.includes(wrap)||message.value.length+wrap.length*2>4000){tell('O trecho já contém esta marcação ou excede o limite.');return;}
    message.setRangeText(wrap+text+wrap,first,last,'end');closeSheet(false);message.focus();message.setSelectionRange(first,last+wrap.length*2);
    retainSelection();changed();return;
   }
   const action=control.dataset.editor,index=Number(control.dataset.index),block=draft.blocks[index];
   if(action==='close')close();
   if(action==='sheet_close')closeSheet();
   if(readOnly){if(action==='edit_preview'&&close())onEdit?.();return;}
   if(action==='choose_image'||action==='choose_document'){
    field('media').accept=action==='choose_image'?'image/jpeg,image/png,image/webp':'application/pdf,text/plain';
    field('media').click();return;
   }
   if(action==='connect'&&close())onConnect?.();
   if(action==='save')void saveRemote();
   if(action==='fresh'){
    if(!state.remoteId&&!window.confirm('Iniciar outro rascunho e substituir a cópia local ao editar?'))return;
    if(close())open({cloud,channel,trigger,onSaved,onConnect,fresh:true});
   }
   if(action==='groups'){await refreshGroups();void refreshGate();}
   if(action==='publish'||action==='schedule')void dispatch(action==='schedule');
   if(action==='dispatch_status')void showDispatch();
   if(action==='cancel_batch'||action==='reschedule'){
    if(action==='cancel_batch'&&!window.confirm('Cancelar os destinos ainda pendentes do lote?'))return;
    if(action==='reschedule'&&!draft.planned_local){tell('Informe o novo horário planejado.');return;}
    try{
     await cloud.campaignDispatch((action==='cancel_batch'?'cancel':'reschedule')+(channel==='app'?'_app':''),{batch_id:control.dataset.batch,
      publication_id:control.dataset.publication,local_time:draft.planned_local});
     if(current())void showDispatch();
    }catch{tell('Não foi possível alterar o lote. Confira os estados e o horário.');}
   }
   if(action==='cross'){
    if(!state.remoteId){tell('Registre a versão WhatsApp antes de criar a versão App vinculada.');return;}
    if(close())open({cloud,channel:'app',row:{id:state.remoteId,title:draft.title,body:draft.blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n\n').slice(0,4000)},trigger,onSaved,onConnect});
   }
   if(action==='link'){
    const url=validLink(field('link').value);
    if(!url){tell('Informe um link HTTPS válido.');return;}
    if(add({type:'link',url})){field('link').value='';closeSheet();}
   }
   if(action==='catalog_search')void searchCatalog();
   if(action==='reference'&&catalogRows[index]){
    const row=catalogRows[index];if(add({type:row.kind,ref:row.id,label:row.label}))closeSheet();
   }
   if(action==='text'){
    const text=message.value.trim();
    if(!text){tell('Digite o texto do bloco.');return;}
    if(editing){
     const edited=draft.blocks.find(row=>row.id===editing);
     if(edited)edited.text=text;
     editing=null;message.value='';composeAction();render();changed();
    }else if(!add({type:'text',text}))return;
    message.value='';paintLive();message.focus();
   }
   if(action==='edit'&&block){editing=block.id;message.value=block.text||'';composeAction();message.focus();changed();}
   if(action==='duplicate'&&block){
    if(draft.blocks.length>=32){tell('Limite de 32 blocos por rascunho.');return;}
    const copy={...block,id:uuid()};
    if(['image','file'].includes(block.type)){
     try{
      const blob=await storeMedia('readonly',store=>store.get(mediaKey(block.id)));
      if(!blob){tell('Arquivo local indisponível para duplicar.');return;}
      await storeMedia('readwrite',store=>store.put(blob,mediaKey(copy.id)));
     }catch{tell('Falha ao duplicar o arquivo.');return;}
    }
    if(current()){const position=draft.blocks.findIndex(row=>row.id===block.id);if(position>=0&&draft.blocks.length<32){draft.blocks.splice(position+1,0,copy);render();changed();}}
   }
   if(['up','down'].includes(action)&&block){
    const to=index+(action==='up'?-1:1);
    if(to>=0&&to<draft.blocks.length){[draft.blocks[index],draft.blocks[to]]=[draft.blocks[to],draft.blocks[index]];render();changed();}
   }
   if(action==='delete'&&block){removed={block,index};draft.blocks.splice(index,1);if(editing===block.id){editing=null;message.value='';composeAction();}render();changed();}
   if(action==='revert'&&removed&&draft.blocks.length<32){draft.blocks.splice(removed.index,0,removed.block);removed=null;render();changed();}
  });
  if(remote&&!state.savedDraft&&state.revision===remote.revision)state.savedDraft=JSON.stringify(remote.draft);
  render();if(!readOnly)renderGroups();dialog.showModal();$('[data-editor=close]').focus();
  if(!readOnly){if(channel==='whatsapp')void refreshGroups().then(refreshGate);else void refreshGate();}
  return stop;
 }

 window.NeoCampaignEditor={open,preview:options=>open({...options,readOnly:true}),closeForSession:()=>stopOpen?.()};
})();
