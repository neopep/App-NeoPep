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

 function open({cloud,row={},channel='whatsapp',remote=null,trigger,onSaved,onConnect,fresh=false}){
  const account=cloud.user?.id;
  if(!account)return;
  const source=remote?remote.source_id:(row.id||null);
  const key='neo-campaign-editor:'+account+':'+channel+':'+(remote?.editor_id||source||'new');
  const initial={title:row.title||'',blocks:row.whatsapp_message||row.body?[{id:uuid(),type:'text',text:row.whatsapp_message||row.body}]:[],
   groups:[],timezone:'America/Sao_Paulo',planned_local:'',audience:'all'};
  const recovered=()=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
  const local=fresh?null:recovered();
  const state=local&&(!remote||local.revision>=remote.revision)?local:{
   editorId:remote?.editor_id||uuid(),revision:remote?.revision||0,remoteId:remote?.campaign_id||null,
   draft:remote?.draft||initial
  };
  const draft=state.draft;
  if(channel==='app')draft.groups=[];
  const dialog=document.createElement('dialog');
  dialog.className='neo-structured-editor';
  dialog.setAttribute('aria-labelledby','neo-campaign-structured-title');
  dialog.innerHTML=`
   <header class="between"><div><h2 id="neo-campaign-structured-title">${channel==='app'?'Rascunho App':'Editor WhatsApp'}</h2>
    <p class="sub" data-structured-connection role="status">Conexão ainda não verificada.</p></div>
    <button type="button" class="secondary" data-editor="close">Voltar</button></header>
   <main class="neo-structured-scroll">
    <label>Título administrativo<input name="title" maxlength="120" value="${e(draft.title)}"></label>
    <div class="neo-structured-preview" aria-label="Prévia de revisão" data-editor-preview></div>
    ${channel==='app'?'<label>Público App<select name="audience"><option value="all">Todos</option><option value="free">Free</option><option value="premium">Premium</option></select></label>':
    `<details class="space"><summary>Grupos sincronizados</summary>
     <div class="inline-actions"><button type="button" class="secondary" data-editor="groups">Atualizar grupos e diagnóstico</button>
      <button type="button" class="secondary" data-editor="connect">Abrir NeoPep Connect</button></div>
     <label>Pesquisar grupo ou conexão<input name="group_search" type="search"></label><p class="sub" data-editor-group-count></p><div data-editor-groups></div>
    </details>`}
    <details class="space"><summary>Anexos e referências</summary>
     <label>Imagem (JPEG, PNG ou WebP) ou documento (PDF ou TXT)<input type="file" name="media" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"></label>
     <label>Modo da imagem<select name="layout"><option value="caption">Imagem com legenda</option><option value="separate">Imagem separada</option></select></label>
     <label>Legenda<input name="caption" maxlength="4000"></label>
     <label>Link HTTPS<input name="link" type="url" maxlength="2000"></label>
     <button type="button" class="secondary" data-editor="link">Adicionar link</button>
     <div class="inline-actions"><button type="button" class="secondary" data-editor="product">Buscar produtos</button>
      <button type="button" class="secondary" data-editor="document">Buscar na Biblioteca</button>
      <button type="button" class="secondary" data-editor="community">Buscar na Comunidade</button></div>
     <label>Buscar referências<input name="catalog_search" type="search" maxlength="100"></label><div data-editor-catalog></div>
     <p class="sub">Comunidade: seleção para republicação depende de consentimento verificável. Materiais da Biblioteca são referências internas com acesso pelo aplicativo.</p>
    </details>
    <label>Horário planejado (São Paulo)<input name="planned_local" type="datetime-local" value="${e(draft.planned_local)}"></label>
    ${channel==='app'?'<label class="check"><input name="push" type="checkbox"> Solicitar push App para contas com consentimento</label>':
       '<label>Ocorrências semanais<input name="weekly_count" type="number" min="1" max="6" step="1" value="1"></label>'}
    <details class="space"><summary>Acompanhar destinos</summary>
     <button type="button" class="secondary" data-editor="dispatch_status">Atualizar tentativas</button>
     <div data-dispatch-results></div>
    </details>
   </main>
   <footer><label>Compor texto<textarea name="message" maxlength="4000" rows="2"></textarea></label>
    <div class="inline-actions" aria-label="Formatação do trecho selecionado">
     <button type="button" class="secondary" data-format="*">Negrito</button><button type="button" class="secondary" data-format="_">Itálico</button>
     <button type="button" class="secondary" data-format="~">Riscado</button><button type="button" class="secondary" data-format="&#96;">Monoespaçado</button>
     <button type="button" class="secondary" data-editor="text">Adicionar texto</button><button type="button" class="secondary" data-editor="revert" hidden>Desfazer exclusão</button>
    </div>
    <div class="inline-actions space">
     <button type="button" class="primary" data-editor="save">Registrar rascunho na Central</button>
     <button type="button" class="secondary" data-editor="fresh">Novo rascunho</button>
     ${channel==='whatsapp'?'<button type="button" class="secondary" data-editor="cross">Criar versão App</button>':''}
     <button type="button" class="secondary" data-editor="publish" disabled>Publicar agora</button><button type="button" class="secondary" data-editor="schedule" disabled>Programar</button>
    </div><p class="sub" data-dispatch-gate>Envio e agendamento automáticos bloqueados. Somente texto no contrato de despacho.</p>
    <p role="status" class="sub" data-editor-status></p>
   </footer>`;
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s),field=name=>$('[name="'+name+'"]');
  const status=$('[data-editor-status]'),message=field('message');
  const preview=$('[data-editor-preview]'),connection=$('[data-structured-connection]');
  const objectUrls=new Set();
  let gates={},dispatching=false,groups=[],pending,active=true,editing=null,removed=null,saving=false,revision=0,loadToken=0,catalogToken=0,selection=[0,0],catalogRows=[];
  const current=()=>active&&cloud.user?.id===account;
  const mediaKey=id=>account+':'+state.editorId+':'+id;
  const tell=text=>{if(current())status.textContent=text;};
  if(field('audience'))field('audience').value=draft.audience;
  message.value=state.compose||'';editing=state.editing||null;
  if(editing)$('[data-editor=text]').textContent='Atualizar bloco';
  const retainSelection=()=>{selection=[message.selectionStart,message.selectionEnd];};
  for(const type of ['select','keyup','pointerup','input','blur'])message.addEventListener(type,retainSelection);

  function saveLocal(){
   clearTimeout(pending);
   if(!current())return false;
   state.compose=message.value;state.editing=editing;
   try{
    const saved=JSON.stringify(state);
    localStorage.setItem(key,saved);
    localStorage.setItem('neo-campaign-editor:'+account+':'+channel+':'+state.editorId,saved);
    tell('Rascunho salvo neste dispositivo.');return true;}
   catch{tell('Falha ao salvar neste dispositivo. Mantenha o editor aberto.');return false;}
  }
  function changed(){
   showGate();clearTimeout(pending);tell('Salvando rascunho…');pending=setTimeout(saveLocal,300);
  }
  function render(){
   const version=++revision;
   for(const url of objectUrls)URL.revokeObjectURL(url);
   objectUrls.clear();
   preview.innerHTML=draft.blocks.map((block,index)=>{
    const link=linkFor(block);
    return `<article class="neo-structured-bubble">
     <small>${e(labels[block.type])}${block.type==='image'?' · '+(block.layout==='caption'?'com legenda':'separada'):''}</small>
     ${block.type==='image'?'<img data-editor-image="'+e(block.id)+'" alt="" hidden>':''}
     ${['image','file'].includes(block.type)?'<p class="sub" data-editor-media-status="'+e(block.id)+'">Verificando anexo local…</p>':''}
     ${block.name||block.label?`<strong>${e(block.name||block.label)}</strong>`:''}
     <div class="neo-structured-text">${formatted(block.text)}</div>
     ${link?`<span class="neo-wa-link">${e(link)}</span>`:''}
     <div class="inline-actions">
      ${['text','image'].includes(block.type)?`<button type="button" class="text-btn" data-editor="edit" data-index="${index}">Editar</button>`:''}
      ${['duplicate','up','down','delete'].map((a,i)=>`<button type="button" class="text-btn" data-editor="${a}" data-index="${index}" ${a==='up'&&!index||a==='down'&&index===draft.blocks.length-1?'disabled':''}>${['Duplicar','Subir','Descer','Excluir'][i]}</button>`).join('')}
     </div></article>`;
   }).join('')||'<p class="sub">Adicione um bloco para revisar a mensagem.</p>';
   for(const indicator of preview.querySelectorAll('[data-editor-media-status]')){
    const id=indicator.dataset.editorMediaStatus;
    void storeMedia('readonly',store=>store.get(mediaKey(id))).then(blob=>{
     if(!current()||version!==revision)return;
     indicator.textContent=blob?'Anexo disponível neste dispositivo.':'Arquivo indisponível neste dispositivo. Adicione-o novamente para revisar.';
     const image=indicator.parentElement.querySelector('[data-editor-image]');
     if(blob&&image){const url=URL.createObjectURL(blob);objectUrls.add(url);image.src=url;image.hidden=false;}
    }).catch(()=>{if(current()&&version===revision)indicator.textContent='Não foi possível consultar o anexo local.';});
   }
   $('[data-editor=revert]').hidden=!removed;
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
   const clean=state.remoteId&&state.savedDraft===JSON.stringify(draft)&&!message.value.trim()&&!editing;
   const enabled=channel==='app'?gates.app_enabled:gates.whatsapp_enabled;
   const textOnly=draft.blocks.length>0&&draft.blocks.every(block=>block.type==='text'&&!/(https?:\/\/|www\.)/i.test(block.text||''));
   const eligible=channel==='app'||draft.groups.length>0&&draft.groups.every(id=>groups.some(row=>row.id===id&&row.state==='eligible'));
   const allow=Boolean(enabled&&clean&&textOnly&&eligible);
   $('[data-editor=publish]').disabled=!allow||channel==='whatsapp'&&!gates.devices?.some(d=>d.ready);
   $('[data-editor=schedule]').disabled=!allow||!draft.planned_local;
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
  async function dispatch(scheduled){
   if(dispatching||!current())return;
   const action=channel==='app'?'publish_app':'schedule_whatsapp';
   const intent={editor_id:state.editorId,revision:state.revision,local_time:scheduled?draft.planned_local:null,
    weekly_count:channel==='app'||!scheduled?1:Number(field('weekly_count').value),push:field('push')?.checked===true};
   const fingerprint=JSON.stringify(intent);
   const request=state.dispatchAttempt?.fingerprint===fingerprint?state.dispatchAttempt:{fingerprint,id:uuid()};
   if(!window.confirm('Confirmar neste canal? Confira os destinos, o horário e o conteúdo registrado.'))return;
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
  const resize=()=>{if(viewport)dialog.style.setProperty('--structured-height',viewport.height+'px');};
  viewport?.addEventListener('resize',resize);resize();
  function finish(){
   if(!active)return;
   if(stopOpen===stop)stopOpen=null;
   viewport?.removeEventListener('resize',resize);
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
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  window.addEventListener('pagehide',saveLocal);
  dialog.addEventListener('input',event=>{
   const name=event.target.name;
   if(name==='group_search'){renderGroups();return;}
   if(['title','planned_local','audience'].includes(name)){draft[name]=event.target.value;changed();}
   if(name==='message')changed();
  });
  dialog.addEventListener('change',async event=>{
   const input=event.target;
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
    render();changed();
   }catch{tell('Não foi possível guardar o arquivo neste dispositivo.');}
  });
  dialog.addEventListener('pointerdown',event=>{if(event.target.closest('[data-format]'))retainSelection();});
  dialog.addEventListener('click',async event=>{
   const control=event.target.closest('button');if(!control||!current())return;
   const format=control.dataset.format;
   if(format){
    const [first,last]=selection;
    if(first===last){tell('Selecione um trecho antes de formatar.');return;}
    const wrap=format==='\`'?'\`\`\`':format,text=message.value.slice(first,last);
    if(text.includes(wrap)||message.value.length+wrap.length*2>4000){tell('O trecho já contém esta marcação ou excede o limite.');return;}
    message.setRangeText(wrap+text+wrap,first,last,'end');message.focus();message.setSelectionRange(first,last+wrap.length*2);
    retainSelection();changed();return;
   }
   const action=control.dataset.editor,index=Number(control.dataset.index),block=draft.blocks[index];
   if(action==='close')close();
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
    if(add({type:'link',url}))field('link').value='';
   }
   if(['product','document','community'].includes(action)){
    const token=++catalogToken,box=$('[data-editor-catalog]');box.textContent='Buscando referências…';
    try{
     const results=await endpoint(cloud,'catalog',{kind:action,search:field('catalog_search').value});
     if(!current()||token!==catalogToken)return;
     catalogRows=results.map(row=>({...row,kind:action}));
     box.innerHTML=catalogRows.map((row,i)=>`<button type="button" class="secondary" data-editor="reference" data-index="${i}">${e(row.label)}${row.price_cents==null?'':' · '+e((row.price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))}</button>`).join('')||'Nenhuma referência disponível.';
    }catch{if(current()&&token===catalogToken)box.textContent='Catálogo indisponível.';}
   }
   if(action==='reference'&&catalogRows[index]){
    const row=catalogRows[index];add({type:row.kind,ref:row.id,label:row.label});
   }
   if(action==='text'){
    const text=message.value.trim();
    if(!text){tell('Digite o texto do bloco.');return;}
    if(editing){
     const edited=draft.blocks.find(row=>row.id===editing);
     if(edited)edited.text=text;
     editing=null;control.textContent='Adicionar texto';render();changed();
    }else if(!add({type:'text',text}))return;
    message.value='';message.focus();
   }
   if(action==='edit'&&block){editing=block.id;message.value=block.text||'';$('[data-editor=text]').textContent='Atualizar bloco';message.focus();changed();}
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
   if(action==='delete'&&block){removed={block,index};draft.blocks.splice(index,1);if(editing===block.id){editing=null;message.value='';$('[data-editor=text]').textContent='Adicionar texto';}render();changed();}
   if(action==='revert'&&removed&&draft.blocks.length<32){draft.blocks.splice(removed.index,0,removed.block);removed=null;render();changed();}
  });
  if(remote&&!state.savedDraft&&state.revision===remote.revision)state.savedDraft=JSON.stringify(remote.draft);
  render();renderGroups();dialog.showModal();field('title').focus();
  if(channel==='whatsapp')void refreshGroups().then(refreshGate);else void refreshGate();
 }

 window.NeoCampaignEditor={open,closeForSession:()=>stopOpen?.()};
})();
