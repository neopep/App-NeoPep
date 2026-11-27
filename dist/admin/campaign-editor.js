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

 // Keep the actual wire format unambiguous: media caption lives in text;
 // independent messages are real ordered text blocks, not a presentation flag.
 function mediaCaptionMode(blocks,index,mode,newId){
  const block=blocks[index];
  if(!block||!['image','file'].includes(block.type))return 'INVALID_MEDIA';
  const text=String(block.text||'');
  if(mode==='separate'){
   if(text.trim()&&blocks.length>=32)return 'BLOCK_LIMIT';
   if(text.trim())blocks.splice(index+1,0,{id:newId(),type:'text',text});
   block.text='';block.layout='separate';return null;
  }
  if(mode==='join'){
   const next=blocks[index+1];
   if(!next||next.type!=='text'||!String(next.text||'').trim())return 'NO_TEXT';
   const joined=[text,String(next.text)].filter(x=>x.trim()).join('\n\n');
   if(joined.length>1000)return 'CAPTION_LIMIT';
   block.text=joined;block.layout='caption';blocks.splice(index+1,1);return null;
  }
  return 'INVALID_MODE';
 }
 // Locally generated canvas covers are data URLs. Decode bytes without fetch:
 // img-src permits data: for previews, but connect-src intentionally does not.
 function localCoverBlob(source){
  if(typeof source!=='string'||!source.startsWith('data:'))return null;
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(source);
  if(!match||match[2].length>4*1024*1024)throw Error('A capa local não é uma imagem válida. Gere outra capa.');
  let raw;try{raw=atob(match[2]);}catch{throw Error('A capa local não pôde ser lida. Gere outra capa.');}
  if(!raw.length||raw.length>3*1024*1024)throw Error('A capa local está acima do limite.');
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  return new Blob([bytes],{type:match[1]});
 }
 async function referenceCoverBlob(reference,signal,origin){
  if(reference.coverBlob)return reference.coverBlob;
  const local=localCoverBlob(reference.image);
  if(local)return local;
  if(signal.aborted)throw Error('Editor fechado. Reabra a publicação.');
  let url;try{url=new URL(reference.image);}catch{throw Error('Capa indisponível. Selecione outra imagem.');}
  if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||!/^\/storage\/v1\/object\/sign\/(?:neo-campaign-images|neo-library|neo-campaign-thumbnails)\//.test(url.pathname))throw Error('Capa indisponível ou não autorizada.');
  try{
   const response=await fetch(url.href,{signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'});
   if(!response.ok)throw Error('cover_http');
   const blob=await response.blob();
   if(!/^image\/(jpeg|png|webp)$/.test(blob.type)||!blob.size||blob.size>10*1024*1024)throw Error('cover_invalid');
   return blob;
  }catch{throw Error('Não foi possível recuperar a capa autorizada. Reabra o material ou escolha outra capa. Seu rascunho foi mantido.');}
 }
 async function communityPhotoBlob(cloud,path,signal,origin){
  if(!path||signal.aborted||typeof cloud.communityPhotoURL!=='function')throw Error('Imagem da postagem indisponível.');
  const url=new URL(await cloud.communityPhotoURL(path));
  if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||!url.pathname.startsWith('/storage/v1/object/sign/neo-community/'))throw Error('Origem da imagem da comunidade não autorizada.');
  const response=await fetch(url.href,{signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  if(!response.ok||Number(response.headers.get('content-length'))>10*1024*1024)throw Error('Não foi possível recuperar a imagem publicada.');
  const blob=await response.blob();
  if(!/^image\/(jpeg|png|webp)$/.test(blob.type)||!blob.size||blob.size>10*1024*1024)throw Error('Imagem publicada inválida ou acima do limite.');
  return blob;
 }
 const communitySummaryChoices=[['change','Variação de peso'],['days','Dias de acompanhamento'],['current','Peso atual'],['goal','Meta de peso'],['initial','Peso inicial'],['height','Altura'],['weights','Peso · últimos 3 registros'],['measures','Medidas · últimos 3 registros'],['journal','Diário · últimos 3 registros'],['doses','Aplicações · últimos 3 registros'],['protocols','Protocolos · últimos 3 registros'],['reminders','Lembretes · últimos 3 registros']];
 const communitySummaryCard=s=>{if(!s||typeof s!=='object')return '';const labels={change_kg:'Variação de peso',current_kg:'Peso atual',goal_kg:'Meta de peso',days:'Dias de acompanhamento',initial_kg:'Peso inicial',height_cm:'Altura'};const names={date:'Data',value:'Peso (kg)',fat:'Gordura (%)',waist:'Cintura (cm)',hip:'Quadril (cm)',chest:'Tórax (cm)',arm:'Braço (cm)',thigh:'Coxa (cm)',note:'Observações',wellbeing:'Bem-estar',energy:'Energia',sleep:'Sono (h)',appetite:'Apetite',water:'Hidratação (L)',activity:'Atividade (min)',product:'Produto',amount:'Quantidade',unit:'Unidade',site:'Local',name:'Nome',end:'Fim',status:'Status',title:'Título',time:'Horário',repeat:'Repetição',weekday:'Dia da semana',enabled:'Ativo'};const value=v=>v==null?'Sem registro':typeof v==='boolean'?(v?'Sim':'Não'):typeof v==='object'?e(JSON.stringify(v)):e(String(v));return `<div class="chat-summary"><strong>Meu resumo de evolução</strong><dl>${Object.entries(labels).filter(([key])=>Object.hasOwn(s,key)).map(([key,label])=>`<div><dt>${label}</dt><dd>${s[key]==null?'Sem registro':e(key.endsWith('_kg')?window.NeoCore.formatWeight(s[key]):Number(s[key]).toLocaleString('pt-BR'))+(key==='days'?' dias':key==='height_cm'?' cm':' kg')}</dd></div>`).join('')}</dl>${communitySummaryChoices.filter(([key])=>Array.isArray(s[key])).map(([key,label])=>`<details class="shared-records" open><summary>${label}</summary>${s[key].map(row=>`<dl>${Object.entries(row).filter(([k])=>!['id','protocolId','_revision'].includes(k)).map(([k,v])=>`<div><dt>${e(names[k]||k)}</dt><dd>${key==='weights'&&k==='value'&&v!=null?e(window.NeoCore.formatWeight(v)):value(v)}</dd></div>`).join('')}</dl>`).join('')||'<p>Sem registros</p>'}</details>`).join('')}<small>Retrato de ${e(s.as_of||'')} · Selecionado pelo autor</small></div>`};
 function communityTextBlocks(text){
  const out=[];let remaining=String(text||'').trim();
  while(remaining.length>2000){
   let end=remaining.lastIndexOf('\n',2000);if(end<1000)end=remaining.lastIndexOf(' ',2000);
   if(end<1000)end=2000;
   if(/[\uD800-\uDBFF]/.test(remaining[end-1]))end--;
   out.push({type:'text',text:remaining.slice(0,end)});remaining=remaining.slice(end).trimStart();
  }
  if(remaining)out.push({type:'text',text:remaining});
  return out;
 }
 function validLink(value){
  try{
   const url=new URL(value);
   return url.protocol==='https:'&&!url.username&&!url.password&&!/\/storage\/v1\/object\/(sign|authenticated)\//i.test(url.pathname)
    &&![...url.searchParams.keys()].some(key=>/^(token|signature|apikey|x-amz-)/i.test(key))&&url.href.length<=2000 ? url.href : '';
  }catch{return '';}
 }
 function linkFor(block){
  if(block.type==='product')return '';
  if(block.type==='document')return new URL('/?material='+encodeURIComponent(block.ref)+'#comunidade',location.origin).href;
  if(block.type==='community')return new URL('/#comunidade',location.origin).href;
  return validLink(block.url);
 }
 async function prepareImage(file,quality){
  const native=/^image\/(jpeg|png|webp|avif)$/.test(file.type);
  const suffix=/\.(heic|heif)$/i.exec(file.name)?.[1].toLowerCase();
  const source=suffix&&!file.type.startsWith('image/')?new Blob([file],{type:'image/'+suffix}):file;
  const url=URL.createObjectURL(source);
  let bitmap;
  try{
   let image;
   try{
    image=await new Promise((resolve,reject)=>{
     const loader=new Image();loader.onload=()=>resolve(loader);loader.onerror=reject;loader.src=url;
    });
   }catch{if(typeof createImageBitmap==='function')try{image=bitmap=await createImageBitmap(source);}catch{}}
   if(!image)throw Error('Formato ilegível neste navegador. Exporte uma cópia em JPEG e tente novamente.');
   const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
   if(!width||!height||width*height>100000000)throw Error('Resolução da imagem acima do limite local.');
   if(quality==='original'&&native)return file;
   if(quality==='original')throw Error('Original indisponível para esse formato. Escolha HD ou Otimizada.');
   if(native&&file.size<=512000&&Math.max(width,height)<=1600)return file;
   const edge=quality==='hd'?2560:1600,scale=Math.min(1,edge/Math.max(width,height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Não foi possível preparar a imagem.')),'image/jpeg',quality==='hd'?.91:.82));
  }finally{bitmap?.close();URL.revokeObjectURL(url);}
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
  search:'M15 15l5 5M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0',back:'M19 12H5m7-7-7 7 7 7',group:'M15 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m9-12a3 3 0 1 1-6 0 3 3 0 0 1 6 0m5 5a3 3 0 0 1 4 3v4m-5-15a3 3 0 0 1 0 6',
  gear:'M3 6h18M3 12h18M3 18h18M7 4v4m10 2v4m-7 2v4',more:'M12 5v1m0 5v1m0 5v1',
  expand:'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',up:'M12 19V5m-6 6 6-6 6 6',plus:'M12 5v14M5 12h14',send:'m3 4 18 8-18 8 4-8-4-8Zm4 8h14',
  text:'M5 6h14M12 6v13m-4 0h8',photo:'M4 4h16v16H4zM4 16l5-5 4 4 2-2 5 5m-4-9h.01',
  file:'M6 3h8l4 4v14H6zM9 12h6m-6 4h5',link:'m10 13 4-4m-5 6-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 2a3 3 0 0 0 4 0l4-4a3 3 0 0 0-4-4l-2 2',
  product:'M4 8h16v12H4zM8 8V6a4 4 0 0 1 8 0v2',book:'M12 6c-3-2-6-2-9-2v14c3 0 6 0 9 2 3-2 6-2 9-2V4c-3 0-6 0-9 2Zm0 0v14',
  clock:'M4 6h16v14H4zM8 3v5m8-5v5m-4 2v5l3 2',repeat:'M4 11a8 8 0 0 1 14-4l2 2m0-5v5h-5M20 13a8 8 0 0 1-14 4l-2-2m0 5v-5h5',
  audience:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2m1-8 2 2 3-4',
  save:'M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-7h8v7',audio:'M10 4h4v10h-4zM7 10v3a5 5 0 0 0 10 0v-3m-5 8v3'
 };
 const icon=name=>`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
 const iconButton=(name,label,attrs='')=>`<button type="button" class="structured-icon" aria-label="${label}" title="${label}" ${attrs}>${icon(name)}</button>`;
 function open({cloud,row={},channel='whatsapp',remote=null,trigger,onSaved,onConnect,fresh=false,readOnly=false,previewBlocks=[],previewImages=new Map(),onEdit,previewModes,publication=null,onClosed}){
  const account=cloud.user?.id;
  const staging=window.NEO_CONFIG?.campaignTestEnabled===true;
  const testApp=staging&&channel==='app';
  const officialWA=window.NEO_CONFIG?.campaignOfficialCentralEnabled===true&&channel==='whatsapp'&&Boolean(publication);
  const testWA=(staging&&channel==='whatsapp')||officialWA;
  const authorizedDestination=()=>officialWA?gates.whatsapp_rich?.destination:gates.whatsapp_test?.destination;
  const officialDestinations=()=>officialWA&&Array.isArray(gates.whatsapp_rich?.destinations)?gates.whatsapp_rich.destinations:[];
  const groupSelectable=id=>!testWA||(officialWA?officialDestinations().includes(id):id===authorizedDestination());

  if(!account)return;
  stopOpen?.();
  const source=remote?remote.source_id:(row.id||null);
  const key='neo-campaign-editor:'+account+':'+channel+':'+(publication?publication.campaignId+':'+publication.id:(remote?.editor_id||source||'new'));
  const initial={title:row.title||'',blocks:row.whatsapp_message||row.body?[{id:uuid(),type:'text',text:row.whatsapp_message||row.body}]:[],
   groups:publication?.destination?[publication.destination]:[],timezone:'America/Sao_Paulo',planned_local:'',audience:'all'};
  const recovered=()=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
  const local=fresh||readOnly?null:recovered();
  const state=local&&(!remote||local.revision>=remote.revision)?local:{
   editorId:remote?.editor_id||publication?.id||uuid(),revision:remote?.revision||0,remoteId:remote?.campaign_id||null,
   draft:remote?.draft||initial
  };
  const draft=state.draft;
  if(readOnly&&previewBlocks.length)draft.blocks=previewBlocks;
  if(readOnly&&previewModes){const model=previewModes('web');draft.blocks=model.blocks;previewImages=model.images;}
  if(channel==='app')draft.groups=[];
  const advancedApp=channel==='app'&&Boolean(publication);
  const defaultsApp=()=>({audience:draft.audience==='all'?'all':'plan',targets:draft.audience==='all'?[]:[draft.audience||'free'],popup_enabled:true,push_requested:false,frequency_hours:24,max_views:1,priority:0,weekdays:[0,1,2,3,4,5,6],opens_at:'00:00',closes_at:'24:00',ends_local:''});
  const settingsApp=()=>({...defaultsApp(),...(draft.app_settings||{})});
  function appSettingsPane(){
   const a=settingsApp(),week=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
   return `<p class="sub">${testApp?'Em Teste, somente contas autorizadas recebem o pop-up; público e push ficam registrados para revisão, sem envio push.':'Configure a exibição e os destinos desta publicação.'}</p>
   <label>Público<select name="app_audience">${[['all','Todos'],['plan','Planos'],['segment','Segmentos']].map(([v,n])=>`<option value="${v}" ${a.audience===v?'selected':''}>${n}</option>`).join('')}</select></label>
   <label data-app-plans ${a.audience!=='plan'?'hidden':''}>Planos (códigos separados por vírgula)<input name="app_targets" maxlength="500" value="${e(a.audience==='plan'?a.targets.join(', '):'')}" placeholder="free, premium"></label>
   <fieldset data-app-segments ${a.audience!=='segment'?'hidden':''}><legend>Segmentos</legend>${[['recent','Cadastros recentes'],['established','Cadastros antigos'],['community','Membros da comunidade']].map(([v,n])=>`<label class="check"><input type="checkbox" name="app_segment" value="${v}" ${a.targets.includes(v)?'checked':''}> ${n}</label>`).join('')}</fieldset>
   <fieldset><legend>Exibição</legend><label class="check"><input type="checkbox" name="app_popup" ${a.popup_enabled?'checked':''}> Mostrar ao abrir o aplicativo</label>
   <label class="check"><input type="checkbox" name="app_push" ${a.push_requested?'checked':''}> Notificação push (quando autorizada)</label>
   <div class="form-grid"><label>Intervalo mínimo (horas)<input type="number" name="app_frequency" min="1" max="8760" value="${a.frequency_hours}"></label><label>Limite por conta<input type="number" name="app_views" min="1" max="100" value="${a.max_views}"></label></div>
   <label>Prioridade<input type="number" name="app_priority" min="0" max="100" value="${a.priority}"></label>
   <label>Encerramento (opcional)<input type="datetime-local" name="app_end" value="${e(a.ends_local)}"></label>
   <div class="form-grid"><label>A partir das<input type="time" name="app_open" value="${e(a.opens_at)}"></label><label>Até (vazio = meia-noite)<input type="time" name="app_close" value="${e(a.closes_at==='24:00'?'':a.closes_at)}"></label></div>
   <div class="inline-actions">${week.map((n,i)=>`<label class="check"><input type="checkbox" name="app_day" value="${i}" ${a.weekdays.includes(i)?'checked':''}> ${n}</label>`).join('')}</div></fieldset>`;
  }
  const dialog=document.createElement('dialog');
  dialog.className='neo-structured-editor';dialog.dataset.channel=channel;
  dialog.setAttribute('aria-labelledby','neo-campaign-structured-title');
  const pane=(name,title,body)=>`<section class="structured-pane" data-editor-pane="${name}" aria-label="${title}" hidden><h3>${title}</h3>${body}</section>`;
  const tile=(name,label,target,disabled=false)=>`<button type="button" data-pane-open="${target}" ${disabled?'disabled':''}>${icon(name)}<span>${label}</span></button>`;
  const tools=readOnly?'':`
   <aside class="structured-sheet" data-editor-sheet hidden>
    <div class="structured-sheet-top"><button type="button" class="text-btn" data-pane-open="menu">Ferramentas</button><button type="button" class="text-btn" data-editor="sheet_close">Fechar painel</button></div>
    ${pane('menu','Adicionar ou configurar',`<div class="structured-tiles">
      ${tile('text','Texto','compose')}${tile('photo','Foto','photo')}${tile('file','Documento','file')}${tile('link','Link','link')}
      ${tile('product','Produto','product')}${tile('book','Biblioteca','document')}${channel==='whatsapp'?tile('group','Grupos','groups'):tile('audience','Público','audience')}${tile('clock','Agendar','schedule')}
      ${channel==='whatsapp'&&!testWA?tile('repeat','Recorrência','recurrence'):''}${tile('gear','Ajustes','settings')}${tile('audio','Áudio indisponível','audio',true)}
      ${tile('group','Comunidade','community')}${tile('more','Destinos','destinations')}
    </div>`)}
    ${pane('settings','Configurações',`${publication?.paused?'<p class="central-pause-notice">Campanha desligada. Volte à Central para reativar.</p>':''}<label>${publication?'Nome da publicação':'Nome da campanha'}<input name="title" maxlength="120" value="${e(draft.title)}"></label><button type="button" class="secondary" data-editor="name_continue">Salvar nome e continuar</button><p class="sub" data-structured-connection role="status">Conexão ainda não verificada.</p>
     <div class="inline-actions">${publication?'':'<button type="button" class="secondary" data-editor="fresh">Novo rascunho</button>'}${channel==='whatsapp'&&!publication?'<button type="button" class="secondary" data-editor="cross">Criar versão App</button>':''}</div>`)}
    ${channel==='app'?pane('audience','Públicos, planos e exibição',advancedApp?appSettingsPane():testApp?'<p>Somente as contas de homologação autorizadas no servidor. Esta campanha não envia push.</p>':'<label>Público App<select name="audience"><option value="all">Todos</option><option value="free">Free</option><option value="premium">Premium</option></select></label><label class="check"><input name="push" type="checkbox"> Solicitar push App para contas com consentimento</label>'):
    pane('groups','Grupos sincronizados','<div class="inline-actions"><button type="button" class="secondary" data-editor="groups">Atualizar grupos e diagnóstico</button><button type="button" class="secondary" data-editor="connect">Abrir NeoPep Connect</button></div><label class="central-search editor-search"><input name="group_search" type="search" aria-label="Pesquisar grupo ou conexão" placeholder="Pesquisar grupo ou conexão"><span class="search-decoration" aria-hidden="true"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></span></label><p class="sub" data-editor-group-count></p><div data-editor-groups></div>')}
    ${pane('photo','Foto','<label>Modo da imagem<select name="layout"><option value="caption">Com legenda</option><option value="separate">Sem legenda / texto em outra mensagem</option></select></label><label>Qualidade local<select name="photo_quality"><option value="optimized">Otimizada</option><option value="hd">HD</option><option value="original">Original (quando legível)</option></select></label><button type="button" class="secondary" data-editor="hd" aria-label="Alternar qualidade da foto">HD</button><p class="sub">Escolha o modo de envio. O texto separado será uma mensagem independente. Salve e confira a prévia antes de publicar.</p><button type="button" class="secondary" data-editor="choose_image">Selecionar foto</button>')}
    ${pane('file','Documento','<label>Modo do anexo<select name="file_layout"><option value="caption">Com legenda</option><option value="separate">Sem legenda / texto em outra mensagem</option></select></label><button type="button" class="secondary" data-editor="choose_document">Escolher PDF, MP4 ou TXT</button>')}
    <input type="file" name="media" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,text/plain" hidden>
    ${pane('link','Link','<label>Link HTTPS<input name="link" type="url" maxlength="2000"></label><button type="button" class="secondary" data-editor="link">Adicionar link</button>')}
    ${pane('catalog','Referências','<div class="central-search editor-search"><input name="catalog_search" type="search" maxlength="100" aria-label="Buscar referências" placeholder="Buscar referências"><button type="button" class="structured-icon" data-editor="catalog_search" aria-label="Buscar referências" title="Buscar referências"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></button></div><div class="structured-catalog-tools"><button type="button" class="secondary" data-editor="prepare_thumbs" hidden>Preparar miniaturas faltantes</button><p class="sub" data-catalog-thumb-status role="status"></p></div><div data-editor-catalog></div><p class="sub">As referências preservam as permissões de acesso e consentimento.</p>')}
    ${pane('community_share','Publicação da Comunidade','<div data-community-share-preview></div><div class="inline-actions"><button type="button" class="secondary" data-editor="community_reference">Manter referência à publicação</button><button type="button" class="primary" data-editor="community_import">Importar texto e imagem editáveis</button></div><p class="sub">Use a referência para manter o acesso restrito à Comunidade. Para republicar conteúdo a outro público, confirme a autorização do autor. Nenhuma mensagem será enviada nesta etapa.</p><p class="sub" role="status" data-community-share-status></p>')}
    ${pane('library_share','Como deseja compartilhar?','<p class="sub" data-library-share-name></p><div class="inline-actions"><button type="button" class="secondary" data-editor="library_share_cover">Capa + link</button><button type="button" class="secondary" data-editor="library_share_preview" disabled>Prévia curta + link</button><button type="button" class="secondary" data-editor="library_share_original" disabled>Arquivo original</button></div><div data-library-share-policy hidden class="monitor-block"><strong>Compartilhamento em campanhas</strong><p class="sub" data-library-member-download></p><label>Autorização deste arquivo<select data-library-share-mode><option value="inherit">Usar permissão de download</option><option value="cover">Somente capa + link</option><option value="preview">Somente prévia curta + link</option><option value="original">Permitir arquivo completo</option></select></label><button type="button" class="secondary" data-editor="library_permission_apply">Salvar autorização</button><p class="sub">Esta opção não altera o download dos membros. Arquivos enviados ao WhatsApp podem ser salvos pelos destinatários.</p></div><div data-library-share-video></div><p class="sub" data-library-share-status role="status"></p>')}
    ${pane('file_help','Envio de arquivos','<p>O envio de arquivos originais e prévias em vídeo depende da liberação no servidor e de um NeoPep Connect compatível. O documento pode permanecer no rascunho sem ser enviado.</p><p>Use Capa + link para materiais disponíveis na Biblioteca. Para liberar a modalidade de arquivo, confira a configuração do canal e os dispositivos autorizados.</p><button type="button" class="secondary" data-editor="connect">Abrir NeoPep Connect</button>')}
    ${pane('schedule','Publicação e horário','<label>Horário planejado (São Paulo)<input name="planned_local" type="datetime-local" value="'+e(draft.planned_local)+'"></label><p data-editor-summary class="sub"></p><div class="inline-actions"><button type="button" class="secondary" data-editor="schedule" disabled>Programar</button><button type="button" class="secondary" data-editor="simulate">Ver prévia (sem enviar)</button></div><div class="structured-issues" data-editor-issues role="status"></div><p role="status" class="sub" data-editor-simulation></p><p class="sub">A prévia não envia mensagens. Para publicar, escolha os grupos e confirme o envio.</p><p class="sub" data-dispatch-gate></p>')}
    ${pane('confirmation','Confirmar campanha','<p data-confirm-question></p><p class="sub" data-confirm-summary></p><p class="structured-confirm-content" data-confirm-content></p><button type="button" class="primary" data-editor="confirm_dispatch">Confirmar</button> <button type="button" class="secondary" data-editor="sheet_close">Voltar à composição</button>')}
    ${channel==='whatsapp'&&!testWA?pane('recurrence','Recorrência','<label>Ocorrências semanais<input name="weekly_count" type="number" min="1" max="6" step="1" value="1"></label>'):''}
    ${pane('format','Formatação do trecho selecionado','<div class="inline-actions"><button type="button" class="secondary" data-format="*" aria-label="Aplicar negrito">Negrito</button><button type="button" class="secondary" data-format="_" aria-label="Aplicar itálico">Itálico</button><button type="button" class="secondary" data-format="~">Riscado</button><button type="button" class="secondary" data-format="&#96;">Monoespaçado</button></div>')}
    ${pane('destinations','Acompanhar destinos','<button type="button" class="secondary" data-editor="dispatch_status">Atualizar tentativas</button><div data-dispatch-results></div>')}
   </aside>`;
  dialog.innerHTML=`
   <header class="structured-header" ${publication?'title="'+e(publication.title)+' › '+e(draft.title||'Nova publicação')+'"':''}>
    ${iconButton('back','Voltar','data-editor="close" autofocus')}<span class="structured-avatar">${icon('group')}</span>
    <div><h2 id="neo-campaign-structured-title">${channel==='app'?'Rascunho App':e(row.group_name||(publication?'Publicação WhatsApp':'Grupo de exemplo'))}</h2>
    ${!readOnly&&channel==='whatsapp'?'<button type="button" class="text-btn structured-group-more" data-pane-open="groups" data-selected-groups>Selecionar grupos</button>':''}
    <p class="sub">${officialWA?'Campanha oficial · WhatsApp · Prévia':'Simulação de campanha · '+(channel==='app'?'App':'WhatsApp')+(staging?' · TESTE':'')}</p></div>
    ${readOnly?(onEdit?iconButton('gear','Editar conteúdo','data-editor="edit_preview"'):''):iconButton('save','Registrar rascunho na Central','data-editor="save"')}
   </header>
   <main class="neo-structured-scroll"><h3 class="structured-campaign-name" ${publication?'data-parent-campaign="'+e(publication.title)+'"':''} data-campaign-name>${e(draft.title)}</h3><div class="neo-structured-preview" aria-label="${channel==='app'?'Prévia da notificação no aplicativo':'Conversa simulada'}" data-editor-preview></div><div class="structured-live" data-editor-live hidden></div></main>
   ${readOnly?`<footer>${previewModes?'<label class="structured-preview-mode">Modo da simulação<select name="preview_mode"><option value="web">Painel · compartilhamento manual</option><option value="connect">Connect · imagem com legenda</option></select></label>':''}<p class="sub">Simulação visual. A disponibilidade de envio depende do canal e dos anexos.</p></footer>`:`<footer>
    <div class="structured-issues structured-issues-compact" data-editor-issues-compact aria-label="Pendências da publicação"></div><p role="status" class="sub structured-compose-status" data-editor-status></p>
    <button type="button" class="text-btn structured-revert" data-editor="revert" hidden>Desfazer exclusão</button>
    <div class="structured-compose">
     <div class="structured-compose-marks"><button type="button" class="structured-icon" data-editor="caption" aria-label="Editar legenda do conteúdo" aria-pressed="false" disabled>L</button><button type="button" class="structured-icon" data-format="*" aria-label="Negrito" aria-pressed="false"><b>B</b></button><button type="button" class="structured-icon" data-format="_" aria-label="Itálico" aria-pressed="false"><i>I</i></button><button type="button" class="structured-icon extended-mark" data-format="~" aria-label="Riscado"><s>S</s></button><button type="button" class="structured-icon extended-mark" data-format="&#96;" aria-label="Monoespaçado">M</button></div>
     <label><span class="sr-only">Compor texto</span><textarea name="message" maxlength="4000" rows="2" placeholder="Escreva sua mensagem…"></textarea></label>
     ${iconButton('expand','Expandir campo','data-editor="expand" aria-expanded="false"')}
     ${iconButton('up','Adicionar texto ou salvar legenda','data-editor="text"')}
    </div>
    ${tools}
    <div class="structured-toolbar">
     ${iconButton('plus','Adicionar conteúdo','data-pane-open="menu"')}
     ${iconButton('photo','Anexos','data-pane-open="photo"')}
     ${channel==='whatsapp'?iconButton('group','Grupos','data-pane-open="groups"'):iconButton('audience','Públicos, planos e exibição','data-pane-open="audience"')}
     ${iconButton('clock','Publicação e agendamento','data-pane-open="schedule"')}
     ${iconButton('gear','Configurações','data-pane-open="settings"')}
     ${iconButton('send','Publicar agora','data-editor="publish" disabled')}
    </div>
   </footer>`}`;
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s),field=name=>$('[name="'+name+'"]');
  const status=$('[data-editor-status]'),message=field('message')||document.createElement('textarea');
  const live=$('[data-editor-live]');
  const preview=$('[data-editor-preview]'),connection=$('[data-structured-connection]');
  const objectUrls=new Set(),sheet=$('[data-editor-sheet]');
  let sheetTrigger=null,catalogKind='document',captionTarget=state.captionTarget||null,pendingDispatch=null;
  const products=new Map(),contentPreviews=new Map(),previewAbort=new AbortController();let shopCatalog,communityFeed,openedReference=false;
  let testGate={};
  let gates={},dispatchReady={schedule:false,publish:false},dispatching=false,groups=[],pending,active=true,editing=null,removed=null,saving=false,revision=0,loadToken=0,catalogToken=0,selection=[0,0],catalogRows=[];
  let catalogController=null,catalogReady=false,catalogGenerating=false,libraryShare=null,communityShare=null;
  const current=()=>active&&cloud.user?.id===account;
  const mediaKey=id=>account+':'+state.editorId+':'+id;
  async function readDraftMedia(id){
   const blob=await storeMedia('readonly',store=>store.get(mediaKey(id)));
   if(blob||!state.recoveryEditorId||!current())return blob;
   const recovered=await storeMedia('readonly',store=>store.get(account+':'+state.recoveryEditorId+':'+id));
   if(recovered&&current())await storeMedia('readwrite',store=>store.put(recovered,mediaKey(id)));
   return current()?recovered:null;
  }
  const draftIsClean=()=>Boolean(state.remoteId&&state.savedDraft===JSON.stringify(draft)&&
   (editing?draft.blocks.some(b=>b.id===editing&&String(b.text||'').trim()===message.value.trim()):!message.value.trim()));
  let lastLocalWrite=null;
  function clearConfirmedLocal(){
   const alias='neo-campaign-editor:'+account+':'+channel+':'+state.editorId;
   for(const k of new Set([key,alias]))if(lastLocalWrite&&localStorage.getItem(k)===lastLocalWrite)localStorage.removeItem(k);
  }
  let noticeTimer,composing=false,provisional=Number.isInteger(state.provisional)?state.provisional:null;
  const captionTypes=['image','product','document','community','file','link'];
  const tell=text=>{
   if(!current()||!status)return;
   clearTimeout(noticeTimer);status.textContent=text;
   if(/^(Rascunho salvo|Versão .* registrada|Legenda atualizada)/.test(text))noticeTimer=setTimeout(()=>{if(current())status.textContent='';},5000);
  };
  function commitEdit(){
   const block=draft.blocks.find(row=>row.id===editing);
   if(!block)return false;
   const text=message.value.trim(),max=block.type==='link'?160:captionTypes.includes(block.type)?1000:4000;
   if(text.length>max){tell('O texto deste bloco deve ter até '+max+' caracteres.');return false;}
   block.text=text;
   if(['image','file'].includes(block.type))block.layout=text?'caption':'separate';
   editing=null;message.value='';return true;
  }
  function selectCaption(block,useCompose=false){
   if(!block||!captionTypes.includes(block.type))return false;
   let text=message.value;
   if(editing&&editing!==block.id){
    if(message.value!==(draft.blocks.find(row=>row.id===editing)?.text||'')){if(!commitEdit())return false;}
    else{editing=null;message.value='';}
    text='';
   }
   if(!editing&&text.trim()&&block.text&&text!==block.text){
    if(!useCompose){tell('Confirme o texto provisório antes de abrir uma legenda existente.');return false;}
    text=block.text+'\n'+text;
   }
   captionTarget=editing=block.id;
   message.value=text.trim()?text:block.text||'';
   composeAction();changed();message.focus({preventScroll:true});return true;
  }
  if(field('audience'))field('audience').value=draft.audience;
  message.value=state.compose||'';editing=state.editing||null;
  if(field('photo_quality'))field('photo_quality').value=state.photoQuality||'optimized';
  if(field('weekly_count'))field('weekly_count').value=state.weeklyCount||1;
  if(field('push'))field('push').checked=state.push===true;
  function composeAction(){
   const action=$('[data-editor=text]');
   if(!action)return;
   const target=draft.blocks.find(block=>block.id===captionTarget&&['image','product','document','community','file','link'].includes(block.type));
   const caption=$('[data-editor=caption]');
   caption.disabled=!target;
   caption.setAttribute('aria-pressed',String(Boolean(target&&editing===target.id)));
   caption.setAttribute('aria-label',target?'Editar legenda do bloco':'Selecionar um bloco para editar a legenda');
   for(const bubble of preview.querySelectorAll('[data-block-id]'))bubble.classList.toggle('structured-caption-target',bubble.dataset.blockId===captionTarget);
   message.placeholder=editing?(channel==='app'?'Escreva o texto deste conteúdo…':'Escreva a legenda deste bloco…'):(channel==='app'?'Escreva o texto da notificação…':'Escreva sua mensagem…');
   action.setAttribute('aria-label',editing?'Salvar legenda do bloco':'Adicionar texto');
   action.title=editing?'Salvar legenda no mesmo bloco':'Adicionar texto à simulação';
  }
  composeAction();
  function closeSheet(focus=true){
   if(!sheet||sheet.hidden)return;
   cancelCatalog();libraryShare=null;communityShare=null;$('[data-library-share-video]')?.replaceChildren();
   sheet.hidden=true;pendingDispatch=null;if(focus)sheetTrigger?.focus({preventScroll:true});sheetTrigger=null;
  }
  function openPane(name,trigger){
   if(!sheet)return;
   const pane=$('[data-editor-pane="'+name+'"]');
   if(!pane)return;
   if(name!=='catalog')cancelCatalog();
   if(name!=='community_share')communityShare=null;
   if(name!=='library_share'){libraryShare=null;$('[data-library-share-video]')?.replaceChildren();}
   if(sheet.hidden)sheetTrigger=trigger;
   sheet.hidden=false;
   sheet.dataset.activePane=name;
   sheet.scrollTop=0;
   for(const section of sheet.querySelectorAll('[data-editor-pane]'))section.hidden=section!==pane;
   if(document.activeElement!==message){const heading=pane.querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
  function paintLive(scroll=false){
   const value=message.value;
   const selected=editing&&preview.querySelector('[data-block-id="'+CSS.escape(editing)+'"] [data-block-text]');
   if(selected)selected.innerHTML=formatted(value);
   const index=Math.max(0,Math.min(provisional??draft.blocks.length,draft.blocks.length));
   const target=preview.querySelectorAll('[data-block-id]')[index];
   preview.insertBefore(live,target||null);
   live.hidden=Boolean(selected)||!value.trim();
   live.innerHTML=live.hidden?'':`<article class="neo-structured-bubble"><div class="neo-structured-text">${formatted(value)}</div><div class="structured-draft-actions">
    <button type="button" class="text-btn" data-editor="draft_up" aria-label="Subir texto provisório" ${index===0?'disabled':''}>↑</button>
    <button type="button" class="text-btn" data-editor="draft_down" aria-label="Descer texto provisório" ${index===draft.blocks.length?'disabled':''}>↓</button>
    ${captionTypes.includes(draft.blocks[index-1]?.type)?'<button type="button" class="text-btn" data-editor="draft_caption">Usar como legenda do bloco acima</button>':''}</div></article>`;
   if(scroll&&!live.hidden&&index===draft.blocks.length){const log=$('.neo-structured-scroll');log.scrollTop=log.scrollHeight;}
  }
  function boundary(value,position,mark){
   if(mark.length!==1)return null;
   let start=-1;
   for(let index=0;index<value.length;index++){
    if(value[index]!==mark)continue;
    if(start<0)start=index;
    else{
     if(position>start&&position<=index)return [start,index];
     start=-1;
    }
   }
   return null;
  }
  function retainSelection(){
   selection=[message.selectionStart,message.selectionEnd];
   for(const button of dialog.querySelectorAll('.structured-compose-marks [data-format]')){
    button.setAttribute('aria-pressed',String(Boolean(boundary(message.value,selection[0],button.dataset.format))));
   }
  }
  for(const type of ['select','keyup','pointerup','input','blur'])message.addEventListener(type,retainSelection);
  message.addEventListener('compositionstart',()=>{composing=true;});
  message.addEventListener('compositionend',()=>{composing=false;retainSelection();});
  function toggleFormat(mark){
   if(composing)return;
   const wrap=mark===String.fromCharCode(96)?String.fromCharCode(96).repeat(3):mark;
   const [first,last]=selection,value=message.value;
   const range=boundary(value,first,wrap),selected=value.slice(first,last);
   let left=first,right=last;
   if(first===last&&range){
    message.focus({preventScroll:true});
    if(range[1]===range[0]+1){message.setRangeText('',range[0],range[1]+1);left=right=range[0];}
    else left=right=range[1]+1;
   }else if(selected.startsWith(wrap)&&selected.endsWith(wrap)&&selected.length>=wrap.length*2){
    message.setRangeText(selected.slice(wrap.length,-wrap.length),first,last);right=last-wrap.length*2;
   }else if(first!==last&&value.slice(first-wrap.length,first)===wrap&&value.slice(last,last+wrap.length)===wrap){
    message.setRangeText(selected,first-wrap.length,last+wrap.length);left=first-wrap.length;right=last-wrap.length;
   }else{
    if(selected.includes(wrap)||value.length+wrap.length*2>4000){tell('A seleção já contém a marcação ou excede o limite.');return;}
    message.setRangeText(wrap+selected+wrap,first,last);left+=wrap.length;right+=wrap.length;
   }
   closeSheet(false);message.focus({preventScroll:true});message.setSelectionRange(left,right);retainSelection();changed();
  }

  function saveLocal(){
   clearTimeout(pending);
   if(readOnly)return true;
   if(!current())return false;
   state.compose=message.value;state.provisional=provisional;state.editing=editing;state.captionTarget=captionTarget;state.photoQuality=field('photo_quality')?.value;state.weeklyCount=field('weekly_count')?.value;state.push=field('push')?.checked===true;
   try{
    if(publication&&state.dispatchConfirmed&&draftIsClean()){
     clearConfirmedLocal();return true;
    }
    const saved=JSON.stringify(state);
    localStorage.setItem(key,saved);
    localStorage.setItem('neo-campaign-editor:'+account+':'+channel+':'+state.editorId,saved);
    lastLocalWrite=saved;
    tell('Rascunho salvo neste dispositivo.');return true;}
   catch{tell('Falha ao salvar neste dispositivo. Mantenha o editor aberto.');return false;}
  }
  function changed(){
   pendingDispatch=null;paintLive();showGate();clearTimeout(pending);tell('Salvando rascunho…');pending=setTimeout(saveLocal,300);
  }
  function productCard(block){
   const product=products.get(block.ref);
   if(!product)return `<strong>${e(block.label)}</strong><p class="sub">Detalhes públicos indisponíveis na simulação.</p>`;
   const price=(product.price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
   return `<section class="structured-product">
    ${product.image?`<img src="${e(product.image)}" alt="" referrerpolicy="no-referrer">`:''}
    <strong>${e(product.label)}</strong><span><strong>${e(price)}</strong> · Disponível</span>
    ${product.link?`<a href="${e(product.link)}" target="_blank" rel="noopener noreferrer">${e(product.link)}</a>`:''}</section>`;
  }
  function loadProduct(block,verified=null){
   if(products.has(block.ref))return;
   products.set(block.ref,null);
   void (async()=>{
    const approved=verified||(await endpoint(cloud,'catalog',{kind:'product',search:block.label||''})).find(row=>row.id===block.ref);
    if(!approved||!Number.isFinite(approved.price_cents)||!current())return;
    const origin=location.origin;
    const link=origin===(window.NEO_CONFIG?.campaignPublicOrigin||'https://app.neopep.com.br')
     ?new URL('/?produto='+encodeURIComponent(block.ref)+'#loja',origin).href:'';
    let image='';
    if(typeof cloud.shop==='function'&&typeof cloud.shopPhotoURL==='function'){
     try{
      const data=await (shopCatalog??=cloud.shop('catalog'));
      const row=(data.products||[]).find(item=>item.id===block.ref&&item.active&&item.shop_store_hidden!==true);
      const path=row?.photo_path||row?.photo_paths?.[0];
      const imageUrl=path?new URL(await cloud.shopPhotoURL(path)):null;
      if(imageUrl?.protocol==='https:'&&imageUrl.hostname.endsWith('.supabase.co'))image=imageUrl.href;
     }catch{}
    }
    if(!current())return;
    products.set(block.ref,{...approved,link,image});render();
   })().catch(()=>{});
  }
  function communityRows(){
   if(typeof cloud.communityInboxV2!=='function')return Promise.resolve([]);
   return communityFeed??=cloud.communityInboxV2().then(async data=>{
    const posts=(data?.posts||[]).filter(row=>row.status==='published');
    if(posts.some(row=>row.own&&!row.photo_path&&row.body==='Foto compartilhada')&&typeof cloud.community==='function'){
     try{const own=await cloud.community('export',{});const byId=new Map((own?.posts||[]).filter(row=>row.photo_path).map(row=>[row.id,row]));
      return posts.map(row=>row.own&&!row.photo_path&&byId.has(row.id)?{...row,photo_path:byId.get(row.id).photo_path,snapshot:row.snapshot??byId.get(row.id).snapshot}:row);
     }catch{}
    }
    return posts;
   });
  }
  function referenceCard(block){
   const model=contentPreviews.get(block.ref);
   if(!model)return block.type==='community'?'<p class="sub">Carregando publicação ou conteúdo indisponível.</p>':'';
   if(block.type==='community')return `<section class="structured-reference structured-community-reference">
    <strong class="structured-community-author">${e(model.meta||'Comunidade')}</strong>
    ${model.snapshot?communitySummaryCard(model.snapshot):''}
    ${model.image?`<img src="${e(model.image)}" alt="Imagem original da publicação" referrerpolicy="no-referrer">`:model.hasPhoto?'<p class="sub">Imagem da publicação indisponível.</p>':''}
    ${model.communityFile?`<div class="chat-document">📄 ${e(model.communityFile)}</div>`:''}
    <p class="structured-community-body">${e(model.excerpt||'')}</p>
    <a href="/#comunidade" target="_blank" rel="noopener noreferrer">Abrir Comunidade</a>
   </section>`;
   return `<section class="structured-reference">
    ${model.image?`<img src="${e(model.image)}" alt="" referrerpolicy="no-referrer">`:''}
    <p class="sub">${e(model.meta==='Vídeo'?'Capa estática do vídeo · link para a Biblioteca':model.meta==='PDF'?'Capa do PDF · link para a Biblioteca':model.meta||'')}${model.excerpt?' · '+e(model.excerpt):''}</p>
    ${model.file?`<button type="button" class="text-btn" data-editor="open_reference" data-ref="${e(block.ref)}">Abrir na Biblioteca</button>`:''}
    ${!readOnly&&['PDF','Vídeo'].includes(model.meta)&&!model.image?
      `<label class="sub">Capa automática indisponível: escolher imagem alternativa<input type="file" name="reference_cover" data-ref="${e(block.ref)}" accept="image/jpeg,image/png,image/webp"></label>`:''}
    ${block.type==='community'?'<a href="/#comunidade" target="_blank" rel="noopener noreferrer">Abrir Comunidade</a>':''}
   </section>`;
  }
  async function videoCover(src,signal=previewAbort.signal){
   // Evitar a capa preta do quadro inicial: capturar um frame após os primeiros segundos.
   // O material permanece na Biblioteca; só a capa JPEG e o link seguem ao WhatsApp.
   const video=document.createElement('video');
   video.crossOrigin='anonymous';video.muted=true;video.playsInline=true;video.preload='auto';
   const until=(eventName,timeout,action)=>new Promise((resolve,reject)=>{
    const clean=()=>{clearTimeout(timer);video.removeEventListener(eventName,done);video.removeEventListener('error',failed);signal.removeEventListener('abort',abort);};
    const done=()=>{clean();resolve();};
    const failed=()=>{clean();reject(Error('Vídeo indisponível para gerar a capa.'));};
    const abort=()=>{clean();reject(signal.reason);};
    const timer=setTimeout(()=>{clean();reject(Error('Não foi possível ler um quadro do vídeo.'));},timeout);
    if(signal.aborted){abort();return;}
    signal.addEventListener('abort',abort,{once:true});
    video.addEventListener(eventName,done,{once:true});
    video.addEventListener('error',failed,{once:true});
    try{action?.();}catch(error){clean();reject(error);}
   });
   try{
    await until('loadedmetadata',12000,()=>{video.src=src;video.load();});
    if(!Number.isFinite(video.videoWidth)||video.videoWidth<1||video.videoHeight<1)throw Error('Vídeo sem dimensões válidas.');
    if(video.readyState<2)await until('loadeddata',8000);
    const duration=video.duration;
    const offsets=Number.isFinite(duration)&&duration>.35?[.15,.38,.63].map(fraction=>
     Math.min(duration-.06,Math.max(.15,duration*fraction))):[0];
    const scale=Math.min(1,720/Math.max(video.videoWidth,video.videoHeight));
    const canvas=document.createElement('canvas'),sample=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
    canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
    sample.width=sample.height=16;
    const context=canvas.getContext('2d'),probe=sample.getContext('2d');
    for(const offset of offsets){
     if(Math.abs(video.currentTime-offset)>.01)
      await until('seeked',8000,()=>{video.currentTime=offset;});
     if(video.readyState<2)continue;
     probe.drawImage(video,0,0,16,16);
     const pixels=probe.getImageData(0,0,16,16).data;
     let lit=0;
     for(let i=0;i<pixels.length;i+=4)if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>24)lit++;
     if(lit<13)continue;
     context.drawImage(video,0,0,canvas.width,canvas.height);
     return canvas.toDataURL('image/jpeg',.82);
    }
    throw Error('Nenhum quadro visível foi encontrado neste vídeo.');
   }finally{video.pause();video.removeAttribute('src');video.load();}
  }
  function loadReference(block){
   if(contentPreviews.has(block.ref)){
    const existing=contentPreviews.get(block.ref);
    if(block.type!=='community'||!existing?.imageExpires||Date.now()<existing.imageExpires)return;
   }
   contentPreviews.set(block.ref,null);
   void (async()=>{
    let model;
    if(block.type==='community'){
     const row=(await communityRows()).find(item=>item.id===block.ref);
     if(!current()||!row)return;
     model={meta:[row.alias,row.created_at&&new Date(row.created_at).toLocaleString('pt-BR')].filter(Boolean).join(' · '),excerpt:row.body||'',snapshot:row.snapshot,hasPhoto:Boolean(row.photo_path||row.body==='Foto compartilhada'),communityFile:row.file?.name};
     if(row.photo_path&&typeof cloud.communityPhotoURL==='function')try{model.image=await cloud.communityPhotoURL(row.photo_path);model.imageExpires=Date.now()+40000;}catch{}
    }else{
     if(typeof cloud.library!=='function')return;
     const row=(await cloud.library('get',{id:block.ref}))?.material;
     if(!current()||!row)return;
     const file=row.attachments?.find(item=>item.mime==='application/pdf'||item.mime?.startsWith('video/'))||row.attachments?.[0],mime=file?.mime||'';
     model={meta:mime==='application/pdf'?'PDF':mime==='text/plain'?'Documento':mime.startsWith('image/')?'Imagem':mime.startsWith('video/')?'Vídeo':row.url?'Link':'Material',excerpt:(row.body||row.description||'').slice(0,220)};
     if(file)model.file={...file};
     if(file&&typeof cloud.libraryMediaURL==='function')try{
      const src=await cloud.libraryMediaURL(file,false);
      model.file={...file,view_url:src};
      if(mime.startsWith('image/'))model.image=src;
      else if(mime.startsWith('video/')){
       if(block.media_path&&cloud.campaignImageURL)try{model.image=await cloud.campaignImageURL(block.media_path);}catch{}
       if(!model.image)model.image=await videoCover(src);
      }
      else if(mime==='application/pdf'&&window.NeoLibraryFiles?.pdfCover)model.image=await window.NeoLibraryFiles.pdfCover(src,previewAbort.signal);
      else if(mime==='text/plain'&&!model.excerpt&&Number(file.size)>0&&file.size<=262144){
       const response=await fetch(src,{cache:'no-store',signal:previewAbort.signal});
       if(response.ok)model.excerpt=(await response.text()).slice(0,220);
      }
     }catch{}
    }
    if(!current())return;
    contentPreviews.set(block.ref,model);render();
   })().catch(()=>{});
  }
  function render(){
   const version=++revision;
   for(const url of objectUrls)URL.revokeObjectURL(url);
   objectUrls.clear();
   preview.innerHTML=draft.blocks.map((block,index)=>{
    const link=linkFor(block);
    return `<article class="neo-structured-bubble" data-block-id="${e(block.id)}">
     ${block.type==='image'?'<img data-editor-image="'+e(block.id)+'" alt="Imagem da campanha" role="button" tabindex="0" aria-label="Ampliar imagem da campanha" hidden>':''}
     ${block.type==='image'?'<p class="sub" data-editor-media-status="'+e(block.id)+'" hidden></p>':''}
     ${block.type!=='product'&&(block.label||block.type==='file'&&block.name)?`<strong>${e(block.label||'Documento')}</strong>`:''}
     ${block.type==='product'?productCard(block):''}
     ${block.type==='file'?'<div class="structured-file-preview" data-local-file="'+e(block.id)+'"><p class="sub">Carregando prévia do documento…</p></div>':''}
     ${['document','community'].includes(block.type)?referenceCard(block):''}
     ${['product','document','community','file','link'].includes(block.type)&&block.text?
       '<p class="sub">Legenda adicional:</p>':''}
     ${['image','file'].includes(block.type)?`<p class="sub">${String(block.text||'').trim()?'Com legenda':'Sem legenda'}</p>`:''}
     <div class="neo-structured-text" data-block-text>${formatted(block.text)}</div>
     ${link?`<span class="neo-wa-link">${e(link)}</span>`:''}
     ${readOnly?'':`<details class="structured-bubble-actions"><summary aria-label="Opções da mensagem">⋯</summary><div class="inline-actions">
      ${['text','image','product','document','community','file','link'].includes(block.type)?`<button type="button" class="text-btn" data-editor="edit" data-index="${index}">${block.type==='text'?'Editar texto':'Editar legenda'}</button>`:''}
      ${['image','file'].includes(block.type)?`<button type="button" class="text-btn" data-editor="caption_split" data-index="${index}">${block.text?'Separar legenda em outra mensagem':'Manter sem legenda'}</button>${draft.blocks[index+1]?.type==='text'?'<button type="button" class="text-btn" data-editor="caption_join" data-index="'+index+'">Usar texto seguinte como legenda</button>':''}`:''}
      ${['duplicate','up','down','delete'].map((a,i)=>`<button type="button" class="text-btn" data-editor="${a}" data-index="${index}" ${a==='up'&&!index||a==='down'&&index===draft.blocks.length-1?'disabled':''}>${['Duplicar','Subir','Descer','Excluir'][i]}</button>`).join('')}
     </div></details>`}</article>`;
   }).join('')||'<p class="sub">Adicione um bloco para revisar a mensagem.</p>';
   if(channel==='app'){
    const title=document.createElement('h2');title.className='structured-app-popup-title';title.textContent=draft.title||'Título da notificação';preview.prepend(title);
    const end=document.createElement('div');end.className='structured-app-popup-footer';end.innerHTML='<button type="button" class="secondary" disabled>Fechar</button>';preview.append(end);
   }
   for(const indicator of preview.querySelectorAll('[data-editor-media-status]')){
    const id=indicator.dataset.editorMediaStatus;
    const block=draft.blocks.find(item=>item.id===id);
    const stored=()=>block?.media_path&&cloud.campaignImageURL?cloud.campaignImageURL(block.media_path):null;
    const asset=previewImages.has(id)?Promise.resolve(previewImages.get(id)):readOnly?Promise.resolve().then(stored):
     readDraftMedia(id).catch(()=>null).then(blob=>blob||stored());
    void asset.then(blob=>{
     if(!current()||version!==revision)return;
     indicator.hidden=Boolean(blob);indicator.textContent=blob?'':'Imagem indisponível neste dispositivo.';
     const image=indicator.parentElement.querySelector('[data-editor-image]');
     if(blob&&image){const url=typeof blob==='string'?blob:URL.createObjectURL(blob);if(typeof blob!=='string')objectUrls.add(url);image.src=url;image.hidden=false;}
    }).catch(()=>{if(current()&&version===revision){indicator.hidden=false;indicator.textContent='Imagem indisponível neste dispositivo.';}});
   }
   for(const holder of preview.querySelectorAll('[data-local-file]')){
    const id=holder.dataset.localFile,block=draft.blocks.find(item=>item.id===id);
    void (async()=>{
     const file=await readDraftMedia(id).catch(()=>null)||(block?.media_path&&cloud.campaignOriginalDownload?await cloud.campaignOriginalDownload(block.media_path):null);
     if(!current()||version!==revision)return;
     if(!file){holder.textContent='Arquivo original indisponível neste dispositivo.';return;}
     const url=URL.createObjectURL(file);objectUrls.add(url);
     const label=document.createElement('p');label.className='sub';label.textContent=(file.type==='application/pdf'?'PDF':file.type==='video/mp4'?'MP4':'TXT')+' · '+Math.ceil(file.size/1024)+' KB · '+(block.name||'Documento');
     holder.replaceChildren(label);
     if(file.type==='application/pdf'&&window.NeoLibraryFiles?.pdfCover){
      try{const cover=await window.NeoLibraryFiles.pdfCover(file,previewAbort.signal);if(current()&&version===revision&&cover){const img=document.createElement('img');img.className='structured-document-cover';img.src=cover;img.alt='Primeira página do PDF';holder.append(img);}else if(current()&&version===revision){const note=document.createElement('p');note.className='sub';note.textContent='Não foi possível gerar a capa deste PDF. O arquivo continua disponível.';holder.append(note);}}catch{if(current()&&version===revision){const note=document.createElement('p');note.className='sub';note.textContent='Prévia do PDF indisponível. O arquivo foi preservado.';holder.append(note);}}
     }else if(file.type==='video/mp4'){
      const video=document.createElement('video');video.src=url;video.controls=true;video.preload='metadata';video.playsInline=true;video.style.maxWidth='100%';if(block.name?.startsWith('previa-neopep-')){video.muted=true;video.loop=true;video.autoplay=!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;label.textContent='Prévia curta · '+Math.ceil(file.size/1024)+' KB';}holder.append(video);
     }else if(file.type==='text/plain'){
      const excerpt=await file.slice(0,4096).text();if(current()&&version===revision){const pre=document.createElement('p');pre.className='sub';pre.textContent=excerpt.slice(0,400);holder.append(pre);}
     }
     if(!current()||version!==revision)return;
     const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir arquivo original';holder.append(link);
    })().catch(()=>{if(current()&&version===revision)holder.textContent='Prévia indisponível.';});
   }
   const revert=$('[data-editor=revert]');if(revert)revert.hidden=!removed;
   paintLive();
   composeAction();window.NeoLibraryFiles?.scan(preview);
   for(const block of draft.blocks){if(block.type==='product')loadProduct(block);if(['document','community'].includes(block.type))loadReference(block);}
  }
  function add(block){
   if(draft.blocks.length>=32){tell('Limite de 32 blocos por rascunho.');return false;}
   draft.blocks.splice(block.type==='text'?(provisional??draft.blocks.length):draft.blocks.length,0,{id:uuid(),...block});if(block.type==='text')provisional=null;render();changed();return true;
  }
  function renderGroups(){
   const root=$('[data-editor-groups]');
   if(!root)return;
   const query=field('group_search').value.trim().toLocaleLowerCase('pt-BR');
   const entries=new Map(draft.groups.map(id=>[id,{id,name:'Grupo anteriormente selecionado',state:'unavailable'}]));
   const allowed=officialWA?null:authorizedDestination();
   for(const row of groups)if(!testWA||!allowed||row.id===allowed)entries.set(row.id,row);
   root.innerHTML=[...entries.values()].filter(row=>`${row.name} ${row.connection||''}`.toLocaleLowerCase('pt-BR').includes(query)).map(row=>{
    const chosen=draft.groups.includes(row.id);
    return `<label class="check"><input type="checkbox" data-editor-group="${e(row.id)}" ${chosen?'checked':''} ${!chosen&&(row.state!=='eligible'||!groupSelectable(row.id))?'disabled':''}>
    <span>${e(row.name)} · ${e(row.connection||'Conexão sem evidência')} · ${e(states[row.state]||'Estado desconhecido')}
    ${row.participant_count==null?'':' · '+e(row.participant_count)+' participantes'}
    ${row.last_synced_at?' · '+e(new Date(row.last_synced_at).toLocaleString('pt-BR')):''}</span></label>`;
   }).join('')||'<p class="sub">Nenhum grupo sincronizado no recorte.</p>';
   const selected=$('[data-selected-groups]');
   if(selected){
    const first=entries.get(draft.groups[0]);
    $('#neo-campaign-structured-title').textContent=first?.name||'Grupo de exemplo';
    selected.textContent=draft.groups.length>1?'+'+(draft.groups.length-1)+' grupos ▾':draft.groups.length===1?'Gerenciar grupo ▾':'Selecionar grupos ▾';
   }
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
    connection.textContent=groups.some(row=>row.state==='eligible')?'Grupos sincronizados disponíveis. Escolha os destinos, salve a versão e confira a autorização de envio.':
     'Sem grupo elegível na consulta atual. Atualize o NeoPep Connect.';
   }catch{if(current()&&token===loadToken){groups=[];renderGroups();connection.textContent='Diagnóstico indisponível. Despacho bloqueado.';}}
  }
  const richMode=()=>testWA&&(Boolean(publication)||draft.blocks.length!==1||draft.blocks.some(block=>block.type!=='text'||/(https?:\/\/|www\.)/i.test(block.text||''))||
   draft.blocks.map(block=>block.text||'').join('\n\n').trim().length>160);
  let checkDispatch=false,checkScheduled=false;
  function dispatchIssues(scheduled){
   const issues=[],add=(key,label,pane,severity='warning')=>issues.push({key,label,pane,severity});
   if(publication?.paused)add('paused','Campanha desligada: reative na Central','settings','blocked');
   if(!draft.title.trim())add('title','Nome da publicação','settings');
   if(channel==='whatsapp'&&(!draft.groups.length||!draft.groups.every(id=>groups.some(g=>g.id===id&&g.state==='eligible'))))add('groups','Selecione grupos autorizados','groups');
   if(scheduled&&!draft.planned_local)add('time','Defina data e horário','schedule');
   if(editing||message.value.trim())add('text','Confirme o texto ou legenda','compose');
   if(!draft.blocks.length)add('content','Adicione conteúdo','menu');
   if(channel==='whatsapp'&&draft.blocks.length>6)add('limit','Limite de 6 blocos por grupo','menu');
   if(draft.blocks.some(b=>b.type==='file')&&!libraryOriginalReady())add('file','Envio de arquivos bloqueado neste canal','file_help','blocked');
   if(channel==='whatsapp'&&(!gates.whatsapp_rich?.ready&&richMode()))add('connect','Confira conexão e autorização','groups','blocked');
   if(testApp&&draft.app_settings?.popup_enabled===false)add('popup','Ative a exibição no App','audience');
   return issues;
  }
  function paintIssues(){
   const items=dispatchIssues(checkScheduled);
   const render=rows=>rows.map(i=>`<button type="button" class="structured-issue ${i.severity}" data-pane-open="${i.pane}" aria-label="Corrigir: ${e(i.label)}"><span aria-hidden="true">${i.severity==='blocked'?'⊘':'!'}</span><span>${e(i.label)}</span><span aria-hidden="true">›</span></button>`).join('');
   const panel=$('[data-editor-issues]'),compact=$('[data-editor-issues-compact]');if(panel)panel.innerHTML=render(items);if(compact)compact.innerHTML=checkDispatch?render(items):'';
  }
  function showGate(){
   if(readOnly)return;
   paintIssues();
   const clean=state.remoteId&&state.savedDraft===JSON.stringify(draft)&&!message.value.trim()&&!editing;
   const rich=richMode();
   const enabled=publication&&channel==='whatsapp'?gates.whatsapp_rich?.ready===true:testApp?testGate.enabled&&testGate.destinations>0&&testGate.destinations<=30&&Boolean(testGate.audience_key):
    testWA?(rich?gates.whatsapp_rich?.ready===true:gates.whatsapp_test?.ready===true):channel==='app'?gates.app_enabled:gates.whatsapp_enabled;
   const textOnly=draft.blocks.length>0&&draft.blocks.every(block=>block.type==='text'&&!/(https?:\/\/|www\.)/i.test(block.text||''));
   const richBlocks=draft.blocks.length>0&&draft.blocks.length<=6&&draft.blocks.every(block=>
    ['text','image','link','product','document','community','file'].includes(block.type)&&
     (block.type!=='file'||(gates.whatsapp_rich?.originals_enabled===true&&Boolean(block.media_path)&&/\.(pdf|mp4)$/.test(block.media_path)))&&
     (block.type!=='image'||Boolean(block.media_path))&&
     (block.type!=='link'||Boolean(validLink(block.url)))&&
     (!['product','document','community'].includes(block.type)||Boolean(block.ref))&&
     (block.type==='link'?(block.text||'').length<=160:
      ['image','product','document','community','file'].includes(block.type)?(block.text||'').length<=1000:
      (block.text||'').length<=2000));
   const eligible=channel==='app'||draft.groups.length>0&&draft.groups.every(id=>groups.some(row=>row.id===id&&row.state==='eligible'));
   const pinned=!testWA||(officialWA?draft.groups.length<=30&&draft.groups.every(id=>officialDestinations().includes(id)):
     draft.groups.length===1&&draft.groups[0]===authorizedDestination());
   const short=!testWA||draft.blocks.map(block=>block.text||'').join('\n\n').trim().length<=160;
   const appRich=channel==='app'&&(testApp?testGate.rich_popup===true:gates.app_rich_popup===true);
   const appBlocks=draft.blocks.length>0&&draft.blocks.length<=12&&draft.blocks.every(b=>['text','image','file','link','product','document','community'].includes(b.type)
    &&(b.text||'').length<=2000&&!/(https?:\/\/|www\.)/i.test(b.text||'')
    &&(!['image','file'].includes(b.type)||Boolean(b.media_path))
    &&(b.type!=='file'||/\.(pdf|mp4)$/.test(b.media_path||''))
    &&(b.type!=='link'||Boolean(validLink(b.url)))
    &&(!['product','document','community'].includes(b.type)||Boolean(b.ref)));
   const allow=Boolean(!(publication&&state.dispatchConfirmed)&&!publication?.paused&&(!publication||channel==='app'||rich)&&enabled&&clean&&eligible&&pinned&&(appRich?appBlocks:rich?richBlocks:textOnly&&short));
   dispatchReady.publish=Boolean(allow&&!(channel==='whatsapp'&&!testWA&&!gates.devices?.some(d=>d.ready)));
   dispatchReady.schedule=Boolean(allow&&draft.planned_local&&!(testWA&&!(rich?gates.whatsapp_rich?.ready:gates.whatsapp_test?.schedule_ready)));
   $('[data-editor=publish]').disabled=dispatching||saving;
   $('[data-editor=schedule]').disabled=dispatching||saving;
   $('[data-editor-summary]').textContent=dispatchSummary(Boolean(draft.planned_local));
   $('[data-dispatch-gate]').textContent=testApp?
    (enabled?'Homologação App · '+testGate.destinations+' conta(s) autorizada(s) · somente no aplicativo, sem push.':'Homologação App indisponível. Use a simulação enquanto a lista e a ativação aguardam aprovação.'):
    testWA?(enabled?(rich?(officialWA?'Produção · até 6 blocos por grupo. Somente os destinos selecionados e sincronizados serão considerados. ':'Homologação rica · até 6 blocos: texto, imagem JPEG, produto, Biblioteca, Comunidade e link HTTPS, com legendas editáveis, somente no grupo autorizado. '):
     'Homologação WhatsApp · somente o grupo autorizado e texto sem links de até 160 caracteres. ')+
     ((rich?gates.whatsapp_rich?.ready:gates.whatsapp_test.schedule_ready)?'Agendamento disponível.':'Agendamento indisponível.'):
     (officialWA?'Produção aguardando confirmação do Connect e autorização do servidor.':'WhatsApp em simulação. Confira o Connect e o grupo autorizado.')):enabled?
    (appRich?'Notificações App com múltiplos conteúdos. Confira público, canais, frequência e horário.':'O despacho exige uma versão registrada, somente texto e destinos autorizados. Aceitação pelo cliente não confirma entrega.'):
    'Envio e agendamento automáticos bloqueados. Somente texto no contrato de despacho.';
  }
  async function refreshGate(){
   if(testApp){
    try{const result=await cloud.campaignTest?.('diagnostics');if(current())testGate=result||{};}
    catch{if(current())testGate={};}
    if(current())showGate();
    return;
   }
   if(typeof cloud.campaignDispatch!=='function')return;
   try{
    const result=await cloud.campaignDispatch('diagnostics',{});
    if(!current())return;
    gates=result||{};
    if(testWA&&typeof cloud.campaignRich==='function'){
     try{gates.whatsapp_rich=await cloud.campaignRich('diagnostics');}
     catch{gates.whatsapp_rich={ready:false};}
     if(!current())return;
    }
    if(channel==='whatsapp'&&gates.devices?.length){
     connection.textContent=gates.devices.map(d=>`${d.label} · ${d.ready?'Sessão recente':'Offline ou não verificada'}
      ${d.bridge_version?' · '+d.bridge_version:''}`).join(' / ');
    }
   }catch{if(current())gates={};}
   if(current()){if(testWA)renderGroups();showGate();}
  }
  const outcomes={waiting:'Aguardando',leased:'Em preparação',started:'Em processamento',accepted:'Aceito pelo cliente',
   uncertain:'Resultado incerto · revisar',failed:'Falhou',cancelled:'Cancelado'};
  async function showDispatch(){
   const root=$('[data-dispatch-results]');
   root.textContent='Consultando destinos…';
   try{
    const rows=testApp?await cloud.campaignTest('status',{editor_id:state.editorId}):await cloud.campaignDispatch(channel==='app'?'app_status':'status',{editor_id:state.editorId});
    let richRows=[];
    if(testWA&&typeof cloud.campaignRich==='function'){
     try{richRows=await cloud.campaignRich('status',{editor_id:state.editorId});}catch{}
    }
    if(!current())return;
    if(testApp){
     const labels={available:'Disponível no aplicativo',scheduled:'Programada',offered:'Oferecida ao aplicativo',displayed:'Exibição confirmada',cancelled:'Cancelada',revoked:'Conta removida',paused:'Pausada',expired:'Expirada'};
     root.innerHTML=rows.map(row=>`<article class="monitor-block"><strong>${e(row.title)}</strong>
      <p class="sub">${e(new Date(row.starts_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · somente homologação</p>
      <ul>${row.recipients.map(recipient=>`<li>${e(recipient.account_id)} · ${e(labels[recipient.status]||recipient.status)}</li>`).join('')}</ul>
      ${row.cancelled_at?'':`<button type="button" class="secondary" data-editor="cancel_batch" data-batch="${e(row.id)}">Cancelar campanha de Teste</button>`}</article>`).join('')||'Nenhuma campanha de homologação registrada.';
     return;
    }
    if(channel==='app'){
     root.innerHTML=rows.map(row=>`<article class="monitor-block">
      <strong>${e(row.title)} · ${row.cancelled_at?'Cancelada':row.status==='active'&&new Date(row.starts_at)>new Date()?'Programada':e(row.status)}</strong>
      <p class="sub">${e(new Date(row.starts_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · Push ${row.push_requested?'solicitado':'desligado'}</p>
      ${row.status==='active'&&new Date(row.starts_at)>new Date()?'<button type="button" class="secondary" data-editor="reschedule" data-batch="'+e(row.id)+'">Mover horário App</button> <button type="button" class="secondary" data-editor="cancel_batch" data-batch="'+e(row.id)+'">Cancelar App</button>':''}</article>`).join('')||'Nenhuma publicação App registrada.';
     return;
    }
    const richHtml=richRows.map(row=>`<article class="monitor-block">
     <strong>Bloco ${e(row.sequence)} · ${e(labels[row.kind]||row.kind)} · ${e(outcomes[row.dispatch_state]||row.dispatch_state)}</strong>
     <p class="sub">Programado: ${e(new Date(row.scheduled_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${e(row.dispatch_attempts)} tentativa(s) · ${row.has_receipt?'Recibo registrado':'Sem recibo'}</p>
     ${row.dispatch_state==='waiting'?'<button type="button" class="secondary" data-editor="rich_cancel_batch" data-batch="'+e(row.batch_id)+'">Cancelar blocos pendentes</button>':''}</article>`).join('');
    root.innerHTML=richHtml+rows.map(row=>`<article class="monitor-block">
     <strong>${e(row.dispatch_jid)} · ${e(outcomes[row.dispatch_state]||row.dispatch_state)}</strong>
     <p class="sub">Operação ${e(row.id)} · ${e(new Date(row.dispatch_due).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${e(row.dispatch_attempts)} tentativa(s)${row.dispatch_cancel_requested?' · Cancelamento solicitado':''}</p>
     <ul>${row.attempts.map(a=>`<li>${e(a.event)} · ${e(new Date(a.recorded_at).toLocaleString('pt-BR'))}${a.receipt_id?' · Recibo '+e(a.receipt_id):''}</li>`).join('')}</ul>
     ${row.dispatch_state==='waiting'&&!testWA?'<button type="button" class="secondary" data-editor="reschedule" data-batch="'+e(row.dispatch_batch)+'" data-publication="'+e(row.id)+'">Mover para o horário planejado</button>':''}
     ${['waiting','leased','started'].includes(row.dispatch_state)?'<button type="button" class="secondary" data-editor="cancel_batch" data-batch="'+e(row.dispatch_batch)+'">Cancelar lote</button>':''}</article>`).join('')||'Nenhum destino agendado neste rascunho.';
   }catch{if(current())root.textContent='Histórico de despacho indisponível.';}
  }
  function dispatchSummary(scheduled){
   const names=draft.groups.map(id=>groups.find(group=>group.id===id)?.name||'Grupo indisponível');
   const destinations=testApp?'Somente '+(testGate.destinations||0)+' conta(s) de homologação · sem push':channel==='app'?('Público: '+(draft.app_settings?(draft.app_settings.audience==='all'?'Todos':draft.app_settings.targets.join(', '))+' · '+(draft.app_settings.popup_enabled?'Pop-up':'Sem pop-up')+(draft.app_settings.push_requested?' · Push':''):({all:'Todos',free:'Free',premium:'Premium'}[draft.audience]||'Todos'))):`${names.length} grupo(s)${names.length?' · '+names.join(', '):''}`;
   const when=scheduled&&draft.planned_local?draft.planned_local.replace('T',' ')+' (São Paulo)':'Agora';
   const description=draft.blocks.map(block=>labels[block.type]||block.type).join(', ')||'Sem conteúdo';
   return [destinations,when,`${draft.blocks.length} bloco(s): ${description}`].join(' · ');
  }
  async function requestDispatch(scheduled,trigger){
   if(saving||dispatching||!current())return;
   if(publication&&state.dispatchConfirmed){tell('Esta publicação já foi registrada. Volte à Central para editar e republicar.');return;}
   checkDispatch=true;checkScheduled=scheduled;paintIssues();
   openPane('schedule',trigger);
   const explain=text=>{$('[data-editor-simulation]').textContent=text;tell(text);};
   if(publication?.paused){explain('Campanha desligada. Volte à Central e reative antes de publicar.');return;}
   if(!draft.title.trim()){explain('Informe o nome da publicação em Ajustes.');return;}
   if(scheduled&&!draft.planned_local){explain('Selecione a data e o horário do agendamento.');return;}
   if(channel==='whatsapp'&&!draft.groups.length){explain('Selecione pelo menos um grupo sincronizado.');return;}
   if(editing||message.value.trim()){explain('Confirme o texto ou a legenda com a seta antes de continuar.');return;}
   if(!draft.blocks.length){explain('Adicione conteúdo antes de continuar.');return;}
   if(testApp&&draft.app_settings?.popup_enabled===false){explain('Em Teste, somente o pop-up está disponível. Marque a exibição interna para homologar.');return;}
   if(draft.blocks.some(b=>b.type==='file')&&!libraryOriginalReady()){explain('Envio de arquivo original desativado no servidor. O rascunho foi preservado; use Capa + link quando disponível.');return;}
   if(!state.remoteId||state.savedDraft!==JSON.stringify(draft)){
    explain('Salvando a versão antes da confirmação. Nenhuma mensagem será enviada.');
    await saveRemote();
   }
   if(!current())return;
   showGate();
   if(!dispatchReady[scheduled?'schedule':'publish']){
    explain(state.savedDraft!==JSON.stringify(draft)?lastSaveError||'Não foi possível confirmar a versão salva. Confira a conexão e tente novamente.':'A publicação ainda não está liberada: confira os destinos, o tipo de conteúdo e a disponibilidade do canal.');
    return;
   }
   pendingDispatch=scheduled;
   $('[data-confirm-question]').textContent=scheduled?'Confirmar o agendamento desta campanha?':'Tem certeza de que deseja publicar esta campanha agora?';
   $('[data-confirm-summary]').textContent=draft.title+' · '+(channel==='app'?'App':'WhatsApp')+' · '+dispatchSummary(scheduled);
   $('[data-confirm-content]').textContent=draft.blocks.map(block=>block.text||block.label||block.name||'').filter(Boolean).join('\n\n');
   openPane('confirmation',trigger);
  }
  async function dispatch(scheduled){
   if(dispatching||saving||!current()||state.dispatchConfirmed&&publication)return;
   showGate();if(!dispatchReady[scheduled?'schedule':'publish']){tell('A versão ou a autorização mudou. Confira antes de confirmar.');return;}
   const rich=testWA&&richMode();
   if(publication&&channel==='whatsapp'&&!rich){tell('O envio exige Connect compatível e destinos sincronizados autorizados.');return;}
    const action=rich?'publish':channel==='app'?'publish_app':'schedule_whatsapp';
   const base={editor_id:state.editorId,revision:state.revision,local_time:scheduled?draft.planned_local:null};
   const intent=testApp?{...base,confirmed:true,destination_count:testGate.destinations,audience_key:testGate.audience_key}:{...base,
    weekly_count:channel==='app'||testWA||!scheduled?1:Number(field('weekly_count').value),push:field('push')?.checked===true,
    ...(testWA?{confirmed:true,...(officialWA?{}:{homologation:true})}:channel==='app'?{confirmed:true}:{})};
   const fingerprint=JSON.stringify(intent);
   const request=state.dispatchAttempt?.fingerprint===fingerprint?state.dispatchAttempt:{fingerprint,id:uuid()};
   state.dispatchAttempt=request;saveLocal();dispatching=true;
   try{
    const result=publication?await cloud.campaignCentral(scheduled?'schedule':'publish',{...intent,request_id:request.id,campaign_id:publication.campaignId,publication_id:publication.id}):testApp?await cloud.campaignTest('publish',{...intent,request_id:request.id}):
     rich?await cloud.campaignRich('publish',{...intent,request_id:request.id}):
     await cloud.campaignDispatch(action,{...intent,request_id:request.id});
    if(!current())return;
    if(publication){state.dispatchConfirmed=true;state.dispatchAttempt=null;}
    const persisted=saveLocal();tell(testApp?'Campanha App de homologação registrada. Confirme a exibição em Acompanhar destinos.':channel==='app'?'Campanha App registrada.':'Ocorrência registrada'+(result?.batch_id?' · '+result.batch_id:'')+'. Confira os resultados por destino.');
    onSaved?.();
    if(publication&&persisted&&draftIsClean()){dialog.close();}
   }catch{tell('Não foi possível confirmar a operação. Repita os mesmos dados para reconciliar.');}
   finally{dispatching=false;}
  }
  // Use the remotely advertised executor limit; absent/old capability stays at 1 MiB.
  const dispatchImageLimit=()=>channel==='whatsapp'&&gates.whatsapp_rich?.max_image_bytes===5242880?5242880:1048576;
  async function jpegForDispatch(blob){
   const limit=dispatchImageLimit();
   const url=URL.createObjectURL(blob),img=new Image();
   try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Imagem ilegível. Selecione um JPEG.'));img.src=url;});
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>100000000)throw Error('Resolução da imagem acima do limite local.');
    if(blob.type==='image/jpeg'&&blob.size>=4&&blob.size<=limit){
     const header=new Uint8Array(await blob.slice(0,3).arrayBuffer());
     if(header[0]===255&&header[1]===216&&header[2]===255)return blob;
    }
    for(const edge of (limit===5242880?[4096,3200,2560,1920,1280,960]:[1280,960,720,480])){
     const scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
     const canvas=document.createElement('canvas');
     canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
     canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
     const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
     for(const quality of (limit===5242880?[.95,.91,.86,.78,.68]:[.82,.68,.52])){
      const file=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Erro convertendo JPEG.')),'image/jpeg',quality));
      if(file.size>=4&&file.size<=limit)return file;
     }
    }
    throw Error('Imagem acima do limite de '+Math.round(limit/1048576)+' MB após otimização.');
   }finally{URL.revokeObjectURL(url);}
  }
  async function uploadRichImages(){
   for(const block of draft.blocks){
    if(!['image','document'].includes(block.type)||block.media_path)continue;
    const reference=block.type==='document'?contentPreviews.get(block.ref):null;
    let localImage;
    if(block.type==='document'){
     if(!reference)throw Error('Aguarde a prévia autorizada da Biblioteca antes de salvar.');
     const mime=reference.file?.mime||'';
     if(mime!=='application/pdf'&&!mime.startsWith('video/'))continue;
     if(!reference.image&&!reference.coverBlob)throw Error('A capa não pôde ser gerada. Selecione a capa deste material antes de salvar.');
     localImage=await referenceCoverBlob(reference,previewAbort.signal,window.NEO_CONFIG?.supabaseUrl);
    }else localImage=await readDraftMedia(block.id);
    if(!localImage)throw Error('Imagem não encontrada neste dispositivo. Anexe novamente.');
    const jpeg=await jpegForDispatch(localImage);
    const path=account+'/'+block.id+'.jpg';
    // O SDK oficial e regenerado a partir de src/cloud.js. Aceitar tambem o
    // uploader legado enquanto abas PWA com um bundle antigo estiverem abertas.
    let stored;
    if(typeof cloud.campaignMediaUpload==='function'){
     stored=await cloud.campaignMediaUpload(path,jpeg);
    }else if(typeof cloud.uploadCampaignImage==='function'){
     stored=await cloud.uploadCampaignImage(jpeg);
    }else{
     throw Error('Versão antiga do aplicativo carregada. Reabra o NeoPep e tente salvar novamente.');
    }
    if(!current())throw Error('Sua conta mudou durante o upload.');
    if(typeof stored!=='string'||!new RegExp('^[a-f0-9-]{36}/[a-f0-9-]{36}\\.jpg$').test(stored)
      ||stored.split('/')[0]!==account)throw Error('O upload não retornou um caminho privado válido.');
    block.media_path=stored;saveLocal();
   }
  }
  async function uploadOriginalFiles(){
   for(const block of draft.blocks){
    if(block.type!=='file'||block.media_path)continue;
    const file=await readDraftMedia(block.id);
    if(!file)throw Error('Anexe novamente o arquivo original antes de salvar.');
    if(file.type==='text/plain')continue; // TXT remains local, never dispatched as an original.
    if(!['application/pdf','video/mp4'].includes(file.type)||typeof cloud.campaignOriginalUpload!=='function')throw Error('Atualize o aplicativo para guardar o arquivo original.');
    const path=account+'/'+uuid()+(file.type==='application/pdf'?'.pdf':'.mp4');
    const stored=await cloud.campaignOriginalUpload(path,file);
    if(!current()||stored!==path)throw Error('Não foi possível confirmar o armazenamento privado.');
    block.media_path=stored;saveLocal();
   }
  }
  let lastSaveError='';
  async function saveRemote(){
   if(saving||dispatching||!current())return;
   if(publication&&state.dispatchConfirmed){tell('Esta publicação já foi registrada. Volte à Central para editar e republicar.');return;}
   lastSaveError='';
   const editingBlock=editing&&draft.blocks.find(block=>block.id===editing);
   if(editingBlock&&['image','product','document','community','link','file'].includes(editingBlock.type)){
    const caption=message.value.trim();
    const max=editingBlock.type==='link'?160:1000;
    if(caption.length>max){tell('A legenda deste item deve ter no máximo '+max+' caracteres.');return;}
    editingBlock.text=caption;if(['image','file'].includes(editingBlock.type))editingBlock.layout=caption?'caption':'separate';editing=null;message.value='';
    composeAction();render();changed();
   }
   if(editing||message.value.trim()){tell('Conclua o bloco de texto em edição antes de registrar a versão.');return;}
   if(!draft.title.trim()){tell('Informe o título do rascunho.');return;}
   if(advancedApp&&draft.app_settings){const a=draft.app_settings;if((!a.popup_enabled&&!a.push_requested)||(a.audience!=='all'&&!a.targets.length)||!a.weekdays.length||!a.opens_at||a.opens_at>=a.closes_at||!Number.isInteger(a.frequency_hours)||a.frequency_hours<1||a.frequency_hours>8760||!Number.isInteger(a.max_views)||a.max_views<1||a.max_views>100||!Number.isInteger(a.priority)||a.priority<0||a.priority>100){tell('Confira público, dias, horário, canais e limites de exibição.');return;}}
   if((testWA||testApp||channel==='app'&&gates.app_rich_popup===true)&&draft.blocks.some(b=>['image','document'].includes(b.type)&&!b.media_path)){
    saveLocal();saving=true;tell('Preparando mídia privada para homologação…');
    try{await uploadRichImages();}catch(error){if(current()){saveLocal();tell(/^(Load failed|Failed to fetch|NetworkError)$/i.test(error.message||'')?'Falha ao preparar ou enviar a capa. Seu rascunho foi mantido. Tente novamente.':error.message||'Não foi possível preparar a imagem. Seu rascunho foi mantido.');}saving=false;return;}
    saving=false;
   }
   if((channel==='app'&&(testApp?testGate.rich_popup===true:gates.app_rich_popup===true)||testWA&&Object.prototype.hasOwnProperty.call(gates.whatsapp_rich||{},'originals_enabled'))&&draft.blocks.some(b=>b.type==='file'&&!b.media_path)){
    saving=true;try{await uploadOriginalFiles();}catch(error){lastSaveError='Não foi possível enviar o documento ao armazenamento privado. '+(/no content provided/i.test(String(error?.message))?'O servidor recebeu o arquivo vazio. ': /Não foi possível ler o arquivo completo|Anexe novamente|Atualize o aplicativo/.test(String(error?.message))?error.message+' ':'')+'Seu rascunho foi preservado. Tente novamente.';if(current()){saveLocal();tell(lastSaveError);}return;}finally{saving=false;if(current())showGate();}
   }
   if(!current())return;
   const snapshot=JSON.parse(JSON.stringify(draft));
   const fingerprint=JSON.stringify(snapshot);
   const attempt=state.attempt?.fingerprint===fingerprint?state.attempt:{fingerprint,id:uuid()};
   state.attempt=attempt;
   saveLocal();saving=true;tell('Registrando versão de revisão…');
   try{
    const payload={editor_id:state.editorId,request_id:attempt.id,source_id:source,revision:state.revision,channel,draft:snapshot};
    const result=publication?await cloud.campaignCentral('save',{...payload,campaign_id:publication.campaignId,publication_id:publication.id}):
     await endpoint(cloud,'save',payload);
    if(!current())return;
    state.revision=result.revision;state.remoteId=result.campaign_id;state.attempt=null;
    state.savedDraft=fingerprint;showGate();
    saveLocal();tell('Versão '+state.revision+' registrada para revisão. Nenhum envio realizado.');
    onSaved?.(result);
   }catch(err){lastSaveError=err.code==='40001'?'A versão mudou. Reabra pela esteira para revisar.':'Não foi possível confirmar o registro. Repita sem alterar a versão para recuperar o resultado.';tell(lastSaveError);}
   finally{saving=false;if(current())showGate();}
  }
  const viewport=window.visualViewport;
  // Preserve the layout of the preview; translate only the composer.
  let frameHeight=viewport?.height||window.innerHeight,frameWidth=document.documentElement.clientWidth;
  const resize=()=>{
   const visible=viewport?.height||window.innerHeight,width=document.documentElement.clientWidth;
   const layout=Math.max(document.documentElement.clientHeight,window.innerHeight,visible);
   if(width!==frameWidth){frameWidth=width;frameHeight=layout;}
   const focused=dialog.contains(document.activeElement)&&document.activeElement?.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=button]),[contenteditable=true]');
   const full=Math.max(frameHeight,layout);
   const keyboard=!readOnly&&Math.abs((viewport?.scale||1)-1)<.02&&(full-visible>120)&&(focused||dialog.classList.contains('structured-keyboard-open'));
   if(!keyboard)frameHeight=visible;
   dialog.classList.toggle('structured-keyboard-open',keyboard);
   dialog.style.setProperty('--structured-height',Math.round(visible)+'px');
   dialog.style.setProperty('--structured-frame-height',Math.round(frameHeight)+'px');
   dialog.style.setProperty('--structured-top',Math.round(keyboard?(viewport?.offsetTop||0):0)+'px');
   dialog.style.setProperty('--structured-keyboard',Math.round(keyboard?Math.max(0,frameHeight-visible):0)+'px');
  };
  viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize);dialog.addEventListener('focusin',resize);resize();
  function finish(){
   if(!active)return;
   if(stopOpen===stop)stopOpen=null;
   viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize);dialog.removeEventListener('focusin',resize);
   active=false;cancelCatalog();previewAbort.abort();if(openedReference)window.NeoLibraryFiles?.close();clearTimeout(pending);clearTimeout(noticeTimer);window.removeEventListener('pagehide',saveLocal);
   for(const url of objectUrls)URL.revokeObjectURL(url);
   dialog.remove();onClosed?.();if(trigger?.isConnected)trigger.focus({preventScroll:true});
  }
  function close(){
   if(saving||dispatching){tell('Aguarde a confirmação do registro.');return false;}
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
   if(advancedApp&&name.startsWith('app_')){
    const audience=field('app_audience').value;
    const checked=key=>[...dialog.querySelectorAll('[name="'+key+'"]:checked')].map(x=>x.value);
    dialog.querySelector('[data-app-plans]').hidden=audience!=='plan';dialog.querySelector('[data-app-segments]').hidden=audience!=='segment';
    draft.app_settings={audience,targets:audience==='plan'?[...new Set(field('app_targets').value.split(',').map(x=>x.trim()).filter(Boolean))]:audience==='segment'?checked('app_segment'):[],popup_enabled:field('app_popup').checked,push_requested:field('app_push').checked,frequency_hours:Number(field('app_frequency').value),max_views:Number(field('app_views').value),priority:Number(field('app_priority').value),weekdays:checked('app_day').map(Number),opens_at:field('app_open').value,closes_at:field('app_close').value||'24:00',ends_local:field('app_end').value};
    changed();return;
   }
   if(['title','planned_local','audience'].includes(name)){draft[name]=event.target.value;if(name==='title')$('[data-campaign-name]').textContent=draft.title;changed();}
   if(name==='message'){changed();paintLive(!dialog.classList.contains('structured-keyboard-open'));}
   if(['weekly_count','push','photo_quality'].includes(name))changed();
  });
  dialog.addEventListener('change',async event=>{
   const input=event.target;
   if(readOnly&&input.name==='preview_mode'&&previewModes){
    const model=previewModes(input.value);draft.blocks=model.blocks;previewImages=model.images;render();return;
   }
   if(input.dataset.editorGroup){
    const id=input.dataset.editorGroup;
    if(!input.checked)draft.groups=draft.groups.filter(key=>key!==id);
    else if(groupSelectable(id)&&groups.some(row=>row.id===id&&row.state==='eligible')&&draft.groups.length<30&&!draft.groups.some(key=>groupIdentity(key)===groupIdentity(id)))draft.groups.push(id);
    else{input.checked=false;tell('Selecione até 30 grupos elegíveis, distintos e sincronizados no Connect.');return;}
    renderGroups();changed();
   }
   if(input.name==='reference_cover'){
    const model=contentPreviews.get(input.dataset.ref),file=input.files?.[0];
    if(!model||!file||!current())return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){
     tell('Escolha uma imagem JPEG, PNG ou WebP de até 10 MB.');return;
    }
    try{
     const jpeg=await jpegForDispatch(file);
     const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(jpeg);
     });
     if(current()){model.coverBlob=jpeg;model.image=data;render();changed();}
    }catch{if(current())tell('Não foi possível preparar a capa selecionada.');}
    return;
   }
   if(input.name!=='media')return;
   const file=input.files?.[0];input.value='';
   if(!file)return;
   const image=/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.type)||/\.(heic|heif)$/i.test(file.name);
   if((!image&&!['application/pdf','video/mp4','text/plain'].includes(file.type))||!file.size||file.size>(image?25:5)*1024*1024||draft.blocks.length>=32){
    tell('Selecione foto de até 25 MB ou PDF/MP4/TXT de até 5 MB, dentro do limite de blocos.');return;
   }
   const id=uuid(),layout=field(image?'layout':'file_layout')?.value||'caption';
   try{
    if(file.type==='application/pdf'&&(await file.slice(0,5).text())!=='%PDF-'){tell('PDF inválido.');return;}
    const asset=image?await prepareImage(file,field('photo_quality').value):file;
    if(!current())return;
    await storeMedia('readwrite',store=>store.put(asset,mediaKey(id)));
    if(!current())return;
    if(draft.blocks.length>=32){void storeMedia('readwrite',store=>store.delete(mediaKey(id))).catch(()=>{});return;}
    draft.blocks.push({id,type:image?'image':'file',name:(image?file.name:file.name.replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,'_')).slice(0,120),layout,text:''});
    if(image||['application/pdf','video/mp4'].includes(file.type)){captionTarget=id;if(layout==='caption'&&!message.value.trim()&&!editing)editing=id;composeAction();}
    render();changed();closeSheet();
   }catch(error){tell(error.message||'Não foi possível guardar o arquivo neste dispositivo.');}
  });
  function cancelCatalog(){catalogController?.abort();catalogController=null;catalogToken++;catalogGenerating=false;catalogReady=false;}
  function catalogCurrent(token,signal){return current()&&token===catalogToken&&!signal.aborted&&!sheet.hidden&&sheet.dataset.activePane==='catalog';}
  const catalogPrice=row=>Number.isSafeInteger(row.price_cents)&&row.price_cents>=0?(row.price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Preço indisponível';
  async function catalogPool(rows,work,valid){let next=0;await Promise.all(Array.from({length:Math.min(3,rows.length)},async()=>{while(valid()&&next<rows.length){const i=next++;try{await work(rows[i],i);}catch{}}}));}
  function catalogStatus(){const button=$('[data-editor="prepare_thumbs"]'),status=$('[data-catalog-thumb-status]');if(!button||!status)return;
   if(catalogKind==='community'){button.hidden=true;status.textContent='';return;}
   const missing=catalogRows.filter(row=>row.thumbSource&&!row.thumb).length;
   button.hidden=!catalogReady||!missing;button.disabled=catalogGenerating;
   status.textContent=catalogGenerating?'Preparando miniaturas faltantes…':!catalogReady?'Miniaturas serão disponibilizadas após a atualização do armazenamento.':missing?missing+' miniatura(s) ainda não preparadas.':'';
  }
  function showCatalogThumb(box,row,i,token,signal){if(!catalogCurrent(token,signal)||!row.thumb)return;const holder=box.querySelector('[data-catalog-thumb="'+i+'"]');if(!holder)return;
   const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.width=160;img.height=160;
   img.onerror=()=>{if(catalogCurrent(token,signal)){row.thumb='';holder.innerHTML=icon(row.kind==='product'?'product':row.kind==='community'?'group':'file');if(row.kind!=='community')catalogStatus();}};
   img.src=row.thumb;holder.replaceChildren(img);
  }
  async function smallCatalogJpeg(src,signal){
   if(!src||signal.aborted)throw Error('Prévia indisponível.');
   const img=new Image();img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';
   try{
    await new Promise((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);img.onload=img.onerror=null;};const abort=()=>{cleanup();reject(Error('Cancelado'));};const timer=setTimeout(abort,12000);signal.addEventListener('abort',abort,{once:true});img.onload=()=>{cleanup();resolve();};img.onerror=abort;img.src=src;});
    if(signal.aborted||!img.naturalWidth||!img.naturalHeight)throw Error('Prévia indisponível.');
    const scale=Math.min(1,160/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.64));if(!blob||blob.size>65536)throw Error('Miniatura acima do limite.');return blob;
   }finally{img.removeAttribute('src');}
  }
  async function prepareCatalogThumbs(){
   const controller=catalogController,token=catalogToken,box=$('[data-editor-catalog]');if(!controller||!catalogReady||catalogGenerating)return;const {signal}=controller,valid=()=>catalogCurrent(token,signal);if(!valid())return;
   catalogGenerating=true;catalogStatus();
   // Explicit, one-time preparation. The normal catalog never downloads original files.
   const rows=catalogRows.map((row,i)=>({row,i})).filter(({row})=>row.thumbSource&&!row.thumb);
   let failures=0;
   // Single original at a time to avoid simultaneous large video/PDF requests.
   try{for(const {row,i} of rows){if(!valid())return;try{
    const {kind,path,file}=row.thumbSource;let src=kind==='shop'?await cloud.shopPhotoURL(path):await cloud.libraryMediaURL(file,false);if(!valid())return;
    if(file?.mime==='application/pdf')src=await window.NeoLibraryFiles?.pdfCover?.(src,signal);
    else if(file?.mime?.startsWith('video/'))src=await videoCover(src,signal);
    if(!valid())return;const blob=await smallCatalogJpeg(src,signal);if(!valid())return;
    row.thumb=await cloud.campaignThumbnailUpload(kind,path,blob);if(!valid())return;showCatalogThumb(box,row,i,token,signal);
   }catch{failures++;}}}finally{if(valid()){catalogGenerating=false;catalogStatus();if(failures)$('[data-catalog-thumb-status]').textContent=failures+' miniatura(s) indisponíveis. Tente novamente.';}}
  }
  function libraryFileDraftReady(){
   // Storage preparation is separate from the explicit dispatch gate. No dispatch is performed here.
   return libraryOriginalReady()||channel==='whatsapp'&&testWA&&Object.prototype.hasOwnProperty.call(gates.whatsapp_rich||{},'originals_enabled')&&typeof cloud.campaignOriginalUpload==='function';
  }
  function libraryOriginalReady(){
   return channel==='app'?(testApp?testGate.rich_popup===true:gates.app_rich_popup===true):testWA&&gates.whatsapp_rich?.originals_enabled===true;
  }
  function libraryShareActive(s){return current()&&libraryShare===s&&!sheet.hidden&&sheet.dataset.activePane==='library_share';}
  function addCatalogReference(row){
   const keepText=!editing&&Boolean(message.value.trim());
   if(editing&&!commitEdit())return;
   const id=uuid();
   if(draft.blocks.length>=32){tell('Limite de 32 blocos por rascunho.');return;}
   draft.blocks.push({id,type:row.kind,ref:row.id,label:row.kind==='community'?'Publicação da Comunidade':row.label,text:''});
   captionTarget=id;if(!keepText){editing=id;message.value='';}
   render();changed();composeAction();closeSheet();
   tell(keepText?'Item adicionado. Seu texto provisório continua em edição.':'Item adicionado. Escreva a legenda e confirme com a seta.');
   message.focus({preventScroll:true});
  }
  async function chooseCommunityShare(row,trigger){
    openPane('community_share',trigger);
    const session=communityShare={row,busy:false,post:null};
    const status=$('[data-community-share-status]'),box=$('[data-community-share-preview]');
    const button=$('[data-editor="community_import"]');
    button.disabled=true;box.replaceChildren();status.textContent='Carregando publicação…';
    try{
     communityFeed=null;
     const post=(await communityRows()).find(p=>p.id===row.id);
     if(!communityShareActive(session))return;
     if(!post)throw Error('A publicação não está mais disponível.');
     session.post=post;
     const model={meta:[post.alias,post.created_at&&new Date(post.created_at).toLocaleString('pt-BR')].filter(Boolean).join(' · '),excerpt:post.body||'',snapshot:post.snapshot,hasPhoto:Boolean(post.photo_path||post.body==='Foto compartilhada'),communityFile:post.file?.name};
     if(post.photo_path&&typeof cloud.communityPhotoURL==='function')try{model.image=await cloud.communityPhotoURL(post.photo_path);model.imageExpires=Date.now()+40000;}catch{}
     if(!communityShareActive(session))return;
     contentPreviews.set(post.id,model);
     box.innerHTML=referenceCard({type:'community',ref:post.id});
     button.disabled=false;status.textContent=post.file?'O documento permanece na referência original; texto e foto são editáveis.':'';
    }catch(error){if(communityShareActive(session))status.textContent=error.message||'Não foi possível consultar a publicação.';}
   }
   function communityShareActive(session){return current()&&communityShare===session&&!sheet.hidden&&sheet.dataset.activePane==='community_share';}
   async function importCommunity(){
    const session=communityShare;if(!session?.post||session.busy||!communityShareActive(session))return;
    const status=$('[data-community-share-status]'),button=$('[data-editor="community_import"]');
    if(!window.confirm('Confirme que você tem autorização para reutilizar esta publicação com o público escolhido para a campanha. A foto já compartilhada será copiada para o rascunho, sem envio automático. Continuar?'))return;
    session.busy=true;button.disabled=true;status.textContent='Preparando conteúdo editável…';
    let storedId=null,committed=false;
    try{
     communityFeed=null;
     const post=(await communityRows()).find(p=>p.id===session.row.id);
     if(!communityShareActive(session))return;
     if(!post)throw Error('A publicação não está mais disponível.');
     const blocks=[];
     if(post.snapshot){
      const holder=document.createElement('div');holder.innerHTML=communitySummaryCard(post.snapshot);
      const lines=Array.from(holder.querySelectorAll('dl>div')).map(item=>[item.querySelector('dt')?.textContent,item.querySelector('dd')?.textContent].filter(Boolean).join(': '));
      if(lines.length)blocks.push(...communityTextBlocks(['Resumo de evolução compartilhado',...lines].join('\n')));
     }
     if(post.photo_path)blocks.push({type:'image',layout:'caption',text:'',name:'publicacao-comunidade.jpg'});
     else if(post.body==='Foto compartilhada')throw Error('A imagem original não está disponível. Use a referência ou tente novamente.');
     if(post.body&&!(post.photo_path&&post.body==='Foto compartilhada'))blocks.push(...communityTextBlocks(post.body));
     if(post.file)blocks.push({type:'link',url:linkFor({type:'community',ref:post.id}),text:'Documento da publicação original — acesse na Comunidade'});
     if(!blocks.length)throw Error('Não há conteúdo editável disponível.');
     if(draft.blocks.length+blocks.length>32)throw Error('Limite de 32 blocos por rascunho.');
     const prepared=blocks.map(block=>({id:uuid(),...block})),image=prepared.find(b=>b.type==='image');
     if(image){
      const blob=await communityPhotoBlob(cloud,post.photo_path,previewAbort.signal,window.NEO_CONFIG?.supabaseUrl);
      if(!communityShareActive(session))return;
      storedId=image.id;
      await storeMedia('readwrite',store=>store.put(blob,mediaKey(image.id)));
     }
     if(!communityShareActive(session))return;
     if(draft.blocks.length+prepared.length>32)throw Error('Limite de 32 blocos por rascunho.');
     if(editing&&!commitEdit())throw Error('Confirme a legenda em edição antes de importar.');
     draft.blocks.push(...prepared);committed=true;
     if(image)captionTarget=image.id;
     render();changed();closeSheet();
     if(saveLocal())tell('Publicação importada. Edite, mova ou exclua cada bloco; nenhum envio realizado.');
    }catch(error){if(communityShareActive(session))status.textContent=error.message||'Não foi possível importar a publicação.';}
    finally{
     if(storedId&&!committed)await storeMedia('readwrite',store=>store.delete(mediaKey(storedId))).catch(()=>{});
     session.busy=false;if(communityShareActive(session))button.disabled=false;
    }
   }
   async function chooseLibraryShare(row,trigger){
    if(row.kind==='community'){await chooseCommunityShare(row,trigger);return;}
   if(row.kind!=='document'||typeof cloud.library!=='function'){addCatalogReference(row);return;}
   openPane('library_share',trigger);
   const s=libraryShare={row,file:null,preview:null,policy:null,busy:false};
   $('[data-library-share-name]').textContent=row.label;
   $('[data-library-share-video]').replaceChildren();
   $('[data-library-share-policy]').hidden=true;
   const status=$('[data-library-share-status]'),p=$('[data-editor="library_share_preview"]'),o=$('[data-editor="library_share_original"]');
   p.disabled=o.disabled=true;p.hidden=o.hidden=false;$('[data-editor="library_share_cover"]').disabled=false;status.textContent='Consultando material autorizado…';
   try{
    const material=(await cloud.library('get',{id:row.id}))?.material;
    if(!libraryShareActive(s))return;
    if(!material)throw Error('Material indisponível.');
    const file=material.attachments?.find(f=>f.mime==='application/pdf'||f.mime?.startsWith('video/'))||material.attachments?.[0];
    if(!file||(!file.mime?.startsWith('video/')&&file.mime!=='application/pdf')){addCatalogReference(row);return;}
    s.file=file;const video=file.mime.startsWith('video/');
    if(typeof cloud.libraryCampaignShare==='function')s.policy=await cloud.libraryCampaignShare('get',row.id,file.path);
    if(!libraryShareActive(s))return;
    if(s.policy?.can_manage===true){
     const panel=$('[data-library-share-policy]'),mode=$('[data-library-share-mode]');
     panel.hidden=false;mode.querySelector('[value="preview"]').disabled=!video;
     mode.querySelector('[value="original"]').disabled=!['video/mp4','application/pdf'].includes(file.mime)||!(Number(file.size)>0&&Number(file.size)<=5242880);
     mode.value=s.policy.mode;$('[data-library-member-download]').textContent='Download dos membros: '+(s.policy.member_download?'permitido':'desativado')+' (não será alterado).';
    }
    p.hidden=!video;
    const permitted=file.allow_download===true&&libraryFileDraftReady();
    const originalAllowed=s.policy?s.policy.original===true&&libraryFileDraftReady():permitted;
    const previewAllowed=s.policy?s.policy.preview===true&&libraryFileDraftReady():permitted;
    o.disabled=!originalAllowed||!['video/mp4','application/pdf'].includes(file.mime)||!Number.isFinite(Number(file.size))||Number(file.size)<=0||Number(file.size)>5242880;
    if(video&&typeof cloud.libraryVideoPreview==='function'&&previewAllowed){
     try{s.preview=await cloud.libraryVideoPreview(row.id,file.path);}catch{}
    }
    if(!libraryShareActive(s))return;
    p.disabled=!previewAllowed||s.preview?.state!=='ready'||!s.preview.url;
    if(s.preview?.state==='ready'&&s.preview.url){
     const v=document.createElement('video');v.src=s.preview.url;v.muted=true;v.playsInline=true;v.loop=true;v.autoplay=!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;v.controls=true;v.preload='metadata';v.style.maxWidth='100%';v.setAttribute('aria-label','Prévia curta sem áudio');$('[data-library-share-video]').append(v);
    }
    status.textContent=!originalAllowed&&!previewAllowed&&file.allow_download!==true?'Download dos membros desativado. '+(s.policy?.can_manage?'Escolha acima uma autorização exclusiva para campanhas, se desejar.':'O responsável pelo arquivo pode autorizar o compartilhamento.'):!libraryFileDraftReady()?'Preparação de arquivos indisponível neste canal. Use capa + link.':video&&s.preview?.state!=='ready'?'Prévia curta ainda não disponível. Confira o processamento no NeoPep Connect e reabra este material.':o.disabled?'Original acima de 5 MB ou formato não suportado.':!libraryOriginalReady()?'Você pode adicionar o arquivo ou prévia ao rascunho. O envio continua desativado no servidor.':'Selecione como compartilhar.';
   }catch{if(libraryShareActive(s))status.textContent='Não foi possível consultar o arquivo. Você pode tentar capa + link.';}
  }
  async function applyLibrarySharePermission(){
   const s=libraryShare;if(!s||!libraryShareActive(s)||s.busy||s.policy?.can_manage!==true)return;
   const mode=$('[data-library-share-mode]').value;
   if(mode===s.policy.mode)return;
   if(!confirm(mode==='original'?'Autorizar o envio do arquivo completo em campanhas? Os destinatários do WhatsApp poderão salvar e encaminhar o arquivo.':mode==='preview'?'Autorizar somente a prévia curta e o link em campanhas, sem liberar o original?':'Alterar a autorização de compartilhamento deste arquivo?'))return;
   s.busy=true;const button=$('[data-editor="library_permission_apply"]');button.disabled=true;
   try{
    await cloud.libraryCampaignShare('set',s.row.id,s.file.path,{mode,expected_mode:s.policy.mode,confirmed:true});
    if(libraryShareActive(s))await chooseLibraryShare(s.row,button);
   }catch(error){if(libraryShareActive(s))$('[data-library-share-status]').textContent=error.message||'Não foi possível alterar a autorização.';}
   finally{button.disabled=false;s.busy=false;}
  }
  async function addLibraryFile(mode){
   const s=libraryShare;if(!s||!libraryShareActive(s)||s.busy)return;
   if(mode==='cover'){addCatalogReference(s.row);return;}
   const file=s.file,short=mode==='preview';
   if(!file||(s.policy?(short?s.policy.preview!==true:s.policy.original!==true):file.allow_download!==true)||!libraryFileDraftReady()||short&&s.preview?.state!=='ready'||!short&&(!['video/mp4','application/pdf'].includes(file.mime)||!(Number(file.size)>0&&Number(file.size)<=5242880)))return;
   if(draft.blocks.length+(short?2:1)>32){tell('Limite de 32 blocos por rascunho.');return;}
   s.busy=true;const status=$('[data-library-share-status]');status.textContent='Preparando arquivo autorizado…';
   for(const b of sheet.querySelectorAll('[data-editor^="library_share_"]'))b.disabled=true;
   try{
    // Revalidate the attachment and renew the signed URL before each download.
    const latest=(await cloud.library('get',{id:s.row.id}))?.material?.attachments?.find(f=>f.path===file.path);
    if(!libraryShareActive(s))return;
    if(!latest||latest.mime!==file.mime||Number(latest.size)!==Number(file.size)||!libraryFileDraftReady())throw Error('O material mudou ou não permite mais este envio.');
    const policy=typeof cloud.libraryCampaignShare==='function'?await cloud.libraryCampaignShare('get',s.row.id,file.path):null;
    if(!policy&&s.policy||policy&&(short?policy.preview!==true:policy.original!==true)||!policy&&latest.allow_download!==true)throw Error('O material não permite mais este envio.');
    if(policy)await cloud.libraryCampaignShare('authorize',s.row.id,file.path,{mode:short?'preview':'original'});
    if(!libraryShareActive(s))return;
    const refreshed=short?await cloud.libraryVideoPreview(s.row.id,file.path):null;
    if(short&&(refreshed?.state!=='ready'||!refreshed.url))throw Error('Prévia indisponível. Reabra o material para consultar novamente.');
    const url=short?refreshed.url:policy?await cloud.libraryCampaignOriginalURL(s.row.id,latest):await cloud.libraryMediaURL(file,true);
    if(!libraryShareActive(s))return;
    const address=new URL(url),origin=window.NEO_CONFIG?.supabaseUrl;
    if(address.origin!==origin||address.protocol!=='https:'||!address.pathname.startsWith('/storage/v1/object/sign/'+(short?'neo-library-video-previews':'neo-library')+'/'))throw Error('Origem não autorizada.');
    const limit=short?512000:5242880,mime=short?'video/mp4':file.mime;
    const response=await fetch(address.href,{signal:previewAbort.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
    if(!response.ok||Number(response.headers.get('content-length'))>limit||response.headers.get('content-type')?.split(';')[0]!==mime||!response.body?.getReader)throw Error('Arquivo indisponível.');
    const reader=response.body.getReader(),parts=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit||!libraryShareActive(s))throw Error('Arquivo acima do limite ou operação cancelada.');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
    if(!size||!libraryShareActive(s))return;
    const blob=new Blob(parts,{type:mime});
    const id=uuid(),name=(short?'previa-neopep-':'')+String(s.row.label||'Material').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,'_').slice(0,88)+(mime==='application/pdf'?'.pdf':'.mp4');
    await storeMedia('readwrite',store=>store.put(blob,mediaKey(id)));
    if(!libraryShareActive(s))return;
    if(draft.blocks.length+(short?2:1)>32)throw Error('Limite de 32 blocos por rascunho.');
    if(editing&&!commitEdit())throw Error('Confirme a legenda antes de adicionar o arquivo.');
    draft.blocks.push({id,type:'file',name,text:''});
    if(short)draft.blocks.push({id:uuid(),type:'link',url:linkFor({type:'document',ref:s.row.id}),text:'Assista ao vídeo completo no NeoPep'});
    render();changed();closeSheet();tell(short?'Prévia curta e link adicionados. Nenhum envio realizado.':'Arquivo original adicionado. Nenhum envio realizado.');
   }catch(error){if(libraryShareActive(s)){status.textContent=error.message||'Não foi possível preparar o arquivo.';$('[data-editor="library_share_cover"]').disabled=false;}}
   finally{s.busy=false;}
  }
  async function searchCatalog(){
   const action=catalogKind;cancelCatalog();const controller=catalogController=new AbortController(),{signal}=controller;
   const token=catalogToken,box=$('[data-editor-catalog]'),valid=()=>catalogCurrent(token,signal);box.textContent='Buscando referências…';catalogRows=[];catalogStatus();
   try{
    const search=field('catalog_search').value.trim();
    const normalize=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
    const results=action==='community'&&typeof cloud.communityInboxV2==='function'?(await communityRows())
     .filter(row=>normalize([row.body,row.alias].join(' ')).includes(normalize(search)))
     .slice(0,30).map(row=>({id:row.id,label:[row.alias,row.created_at&&new Date(row.created_at).toLocaleDateString('pt-BR'),row.body?.slice(0,120)].filter(Boolean).join(' · ')||'Publicação',photoPath:row.photo_path})):
     await endpoint(cloud,'catalog',{kind:action,search});
    if(!valid())return;
    catalogRows=results.map(row=>({...row,kind:action}));
    box.classList.add('structured-catalog-grid');
    box.innerHTML=catalogRows.map((row,i)=>`<button type="button" class="structured-catalog-card" data-editor="reference" data-index="${i}"><span class="structured-catalog-thumb" data-catalog-thumb="${i}">${icon(action==='product'?'product':action==='community'?'group':'file')}</span><strong>${e(row.label)}</strong>${action==='product'?'<strong class="structured-catalog-price">'+e(catalogPrice(row))+'</strong>':''}<small data-catalog-kind="${i}">${action==='product'?'Produto':action==='community'?'Comunidade':'Material da Biblioteca'}</small></button>`).join('')||'Nenhuma referência disponível.';
    if(action==='community'){
     if(typeof cloud.communityPhotoURL==='function')await catalogPool(catalogRows,async(row,i)=>{
      if(!row.photoPath)return;
      const thumb=await cloud.communityPhotoURL(row.photoPath);
      if(!valid())return;
      row.thumb=thumb;showCatalogThumb(box,row,i,token,signal);
     },valid);
     return;
    }
    if(!['product','document'].includes(action))return;
    catalogReady=typeof cloud.campaignThumbnailReady==='function'&&await cloud.campaignThumbnailReady().catch(()=>false);
    if(!valid())return;
    let shopRows=[];
    if(action==='product'&&typeof cloud.shop==='function'){try{shopRows=(await cloud.shop('catalog')).products||[];}catch{}}
    if(!valid())return;
    await catalogPool(catalogRows,async(row,i)=>{
     if(action==='product'){
      const product=shopRows.find(item=>item.id===row.id&&item.active&&item.shop_store_hidden!==true);
      const path=product?.photo_paths?.[0]||product?.photo_path;
      if(path)row.thumbSource={kind:'shop',path};
      if(!Number.isSafeInteger(row.price_cents)&&Number.isSafeInteger(product?.price_cents)){
       row.price_cents=product.price_cents;const price=box.querySelector('[data-index="'+i+'"] .structured-catalog-price');if(valid()&&price)price.textContent=catalogPrice(row);
      }
     }else if(typeof cloud.library==='function'){
      const material=(await cloud.library('get',{id:row.id}))?.material;
      if(!valid())return;
      const file=material?.attachments?.find(item=>item.mime==='application/pdf'||item.mime?.startsWith('video/'))||material?.attachments?.[0],mime=file?.mime||'';
      const kind=mime==='application/pdf'?'PDF':mime.startsWith('video/')?'Vídeo':mime.startsWith('image/')?'Imagem':mime==='text/plain'?'Texto':material?.url?'Link':'Material';
      const label=box.querySelector('[data-catalog-kind="'+i+'"]');if(label)label.textContent=kind;
      if(file?.path&&(mime==='application/pdf'||mime.startsWith('video/')||mime.startsWith('image/')))row.thumbSource={kind:'library',path:file.path,file};
     }
     if(!valid()||!catalogReady||!row.thumbSource)return;
     row.thumb=await cloud.campaignThumbnailURL(row.thumbSource.kind,row.thumbSource.path);
     if(valid())showCatalogThumb(box,row,i,token,signal);
    },valid);
    if(valid())catalogStatus();
   }catch{if(valid())box.textContent='Catálogo indisponível.';}
  }
  dialog.addEventListener('keydown',event=>{
   if(event.key==='Enter'&&event.target.name==='catalog_search'){event.preventDefault();void searchCatalog();return;}
   if(['Enter',' '].includes(event.key)&&event.target.matches('[data-editor-image]')){
    event.preventDefault();event.target.click();
   }
  });
  dialog.addEventListener('pointerdown',event=>{
   if(event.target.closest('[data-format],.structured-draft-actions button,[data-editor=caption]')&&document.activeElement===message){retainSelection();event.preventDefault();}
   if(sheet&&!sheet.hidden&&!sheet.contains(event.target)&&!event.target.closest('[data-pane-open],[data-editor=publish],[data-editor=save]'))closeSheet(false);
  });
  dialog.addEventListener('click',async event=>{
   if(!current())return;
   const control=event.target.closest('button');
   if(!control){
    const image=event.target.closest('[data-editor-image]');
    if(image&&!image.hidden){
     const zoom=document.createElement('dialog');zoom.className='structured-image-zoom';zoom.setAttribute('aria-label','Imagem da campanha');
     const photo=image.cloneNode();for(const attr of ['data-editor-image','role','tabindex','aria-label'])photo.removeAttribute(attr);
     const exit=document.createElement('button');exit.type='button';exit.textContent='Fechar imagem';exit.onclick=()=>zoom.close();
     if(!readOnly){
      const select=document.createElement('button');select.type='button';select.textContent='Editar legenda';
      select.onclick=()=>{

       const selected=draft.blocks.find(block=>block.id===image.dataset.editorImage);
       if(!selected)return;
       zoom.close();selectCaption(selected);
      };
      zoom.append(select);
     }
     zoom.append(exit,photo);dialog.append(zoom);zoom.addEventListener('close',()=>zoom.remove(),{once:true});zoom.showModal();return;
    }
    const bubble=event.target.closest('[data-block-id]');
    if(bubble&&!event.target.closest('details,a')){const item=draft.blocks.find(block=>block.id===bubble.dataset.blockId);if(!readOnly&&captionTypes.includes(item?.type)){captionTarget=item.id;composeAction();}const options=bubble.querySelector('details');if(options)options.open=!options.open;}
    return;
   }
   const target=control.dataset.paneOpen;
   if(target){
    if(target==='compose'){closeSheet(false);message.focus({preventScroll:true});return;}
    if(['product','document','community'].includes(target)){
     catalogKind=target;field('catalog_search').value='';openPane('catalog',control);void searchCatalog();return;
    }
    if(sheet&&!sheet.hidden&&target==='menu'&&control===sheetTrigger){closeSheet();return;}
    openPane(target,control);if(control.classList.contains('structured-issue')){if(target==='settings')field('title')?.focus();if(target==='schedule')field('planned_local')?.focus();}return;
   }
   const format=control.dataset.format;
   if(format){toggleFormat(format);return;}
   const action=control.dataset.editor,index=Number(control.dataset.index),block=draft.blocks[index];
   if(action==='close')close();
   if(action==='sheet_close')closeSheet();
   if(action==='open_reference'){
    const item=contentPreviews.get(control.dataset.ref)?.file;
    if(item&&window.NeoLibraryFiles){openedReference=true;void window.NeoLibraryFiles.open(item,control).catch(()=>tell('Não foi possível abrir o material.'));}
   }
   if(readOnly){if(action==='edit_preview'&&close())onEdit?.();return;}
   if(action==='choose_image'||action==='choose_document'){
    field('media').accept=action==='choose_image'?'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.heic,.heif':'application/pdf,video/mp4,text/plain';
    field('media').click();return;
   }
   if(action==='name_continue'){
    if(!draft.title.trim()){tell('Informe o nome da campanha.');field('title').focus();return;}
    saveLocal();closeSheet(false);message.focus({preventScroll:true});return;
   }
   if(action==='expand'){
    const expanded=control.getAttribute('aria-expanded')!=='true';
    control.setAttribute('aria-expanded',String(expanded));dialog.classList.toggle('structured-expanded',expanded);message.rows=expanded?10:2;message.focus({preventScroll:true});return;
   }
   if(action==='hd'){
    const quality=field('photo_quality');
    const modes=['optimized','hd','original'];
    quality.value=modes[(modes.indexOf(quality.value)+1)%modes.length];changed();return;
   }
   if(action==='caption'){
    const selected=draft.blocks.find(row=>row.id===captionTarget);
    if(!selected)return;
    if(editing===selected.id){
     // Toggling out with an empty field preserves the stored caption. The arrow can explicitly clear it.
     if(message.value.trim()){if(!commitEdit())return;}
     else{editing=null;message.value='';}
     render();changed();message.focus({preventScroll:true});return;
    }
    selectCaption(selected);return;
   }
   if(['draft_up','draft_down','draft_caption'].includes(action)){
    const index=provisional??draft.blocks.length;
    if(action==='draft_caption'){if(selectCaption(draft.blocks[index-1],true))provisional=null;}
    else{provisional=Math.max(0,Math.min(draft.blocks.length,index+(action==='draft_up'?-1:1)));changed();}
    message.focus({preventScroll:true});message.setSelectionRange(...selection);return;
   }
   if(action==='connect'&&close())onConnect?.();
   if(action==='save')void saveRemote();
   if(action==='fresh'){
    if(!state.remoteId&&!window.confirm('Iniciar outro rascunho e substituir a cópia local ao editar?'))return;
    if(close())open({cloud,channel,trigger,onSaved,onConnect,fresh:true});
   }
   if(action==='groups'){await refreshGroups();void refreshGate();}
   if(action==='simulate'){
    const simulation=$('[data-editor-simulation]');
    simulation.textContent='Prévia local (sem envio) · '+draft.title+' · '+dispatchSummary(Boolean(draft.planned_local))+'. Nenhuma mensagem foi enviada ou agendada.';
   }
   if(action==='publish'||action==='schedule')void requestDispatch(action==='schedule',control);
   if(action==='confirm_dispatch'&&pendingDispatch!==null){
    const scheduled=pendingDispatch;closeSheet();void dispatch(scheduled);
   }
   if(action==='dispatch_status')void showDispatch();
   if(action==='rich_cancel_batch'){
    if(!window.confirm('Cancelar as mensagens ricas ainda aguardando envio?'))return;
    try{
     if(publication)await cloud.campaignCentral('cancel',{campaign_id:publication.campaignId,publication_id:publication.id,batch_id:control.dataset.batch});
     else await cloud.campaignRich('cancel',{batch_id:control.dataset.batch});
     if(current()){void showDispatch();onSaved?.();}
    }
    catch{tell('Não foi possível cancelar. Atualize o diagnóstico.');}
    return;
   }
   if(action==='cancel_batch'||action==='reschedule'){
    if(action==='cancel_batch'&&!window.confirm('Cancelar os destinos ainda pendentes do lote?'))return;
    if(action==='reschedule'&&!draft.planned_local){tell('Informe o novo horário planejado.');return;}
    try{
     if(testApp)await cloud.campaignTest('cancel',{batch_id:control.dataset.batch});
     else await cloud.campaignDispatch((action==='cancel_batch'?'cancel':'reschedule')+(channel==='app'?'_app':''),{batch_id:control.dataset.batch,
      publication_id:control.dataset.publication,local_time:draft.planned_local});
     if(current())void showDispatch();
    }catch{tell('Não foi possível alterar o lote. Confira os estados e o horário.');}
   }
   if(action==='cross'){
    if(!state.remoteId){tell('Registre a versão WhatsApp antes de criar a versão App vinculada.');return;}
    if(!window.confirm('Esta função atual copia somente o texto desta publicação. A campanha completa, os anexos e a agenda ainda não são duplicados. Continuar?'))return;
    if(close())open({cloud,channel:'app',row:{id:state.remoteId,title:draft.title,body:draft.blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n\n').slice(0,4000)},trigger,onSaved,onConnect});
   }
   if(action==='link'){
    const url=validLink(field('link').value);
    if(!url){tell('Informe um link HTTPS válido.');return;}
    if(add({type:'link',url})){field('link').value='';closeSheet();}
   }
   if(action==='prepare_thumbs'){void prepareCatalogThumbs();return;}
   if(action==='catalog_search')void searchCatalog();
   if(action==='reference'&&catalogRows[index]){await chooseLibraryShare(catalogRows[index],control);return;}
   if(action==='community_reference'&&communityShare?.post&&!communityShare.busy){addCatalogReference(communityShare.row);return;}
    if(action==='community_import'){await importCommunity();return;}
    if(action==='library_permission_apply'){await applyLibrarySharePermission();return;}
   if(action?.startsWith('library_share_')){await addLibraryFile(action.slice('library_share_'.length));return;}
   if(action==='text'){
    const text=message.value.trim();
    if(editing){
     const activeBlock=draft.blocks.find(row=>row.id===editing);
     if(activeBlock&&['image','product','document','community','file'].includes(activeBlock.type)&&text.length>1000){
      tell('A legenda deste bloco pode ter até 1.000 caracteres.');return;
     }
     if(activeBlock?.type==='link'&&text.length>160){tell('A legenda do link pode ter até 160 caracteres.');return;}
    }
    if(!text&&!editing){tell('Digite o texto do bloco.');return;}
    if(editing){
     const edited=draft.blocks.find(row=>row.id===editing);
     if(edited)edited.text=text;
     if(edited&&['image','file'].includes(edited.type))edited.layout=text?'caption':'separate';
     editing=null;message.value='';composeAction();render();changed();
    }else if(!add({type:'text',text}))return;
    message.value='';paintLive();message.focus({preventScroll:true});
   }
   if(['caption_split','caption_join'].includes(action)&&block){
    if(editing||message.value.trim()){tell('Confirme o texto ou a legenda em edição antes de mudar o modo.');return;}
    const problem=mediaCaptionMode(draft.blocks,index,action==='caption_split'?'separate':'join',uuid);
    if(problem){tell(({BLOCK_LIMIT:'Limite de 32 blocos por rascunho.',CAPTION_LIMIT:'A legenda pode ter até 1.000 caracteres.',NO_TEXT:'Não há texto seguinte para usar como legenda.'})[problem]||'Modo indisponível.');return;}
    captionTarget=block.id;render();changed();return;
   }
   if(action==='edit'&&block){
    if(captionTypes.includes(block.type)){selectCaption(block);return;}
    if(editing!==block.id&&message.value.trim()){tell('Conclua o texto em edição antes de trocar de bloco.');return;}
    editing=block.id;message.value=block.text||'';
    composeAction();message.focus({preventScroll:true});changed();
   }
   if(action==='duplicate'&&block){
    if(draft.blocks.length>=32){tell('Limite de 32 blocos por rascunho.');return;}
    const copy={...block,id:uuid()};
    if(['image','file'].includes(block.type)){
     try{
      const blob=await readDraftMedia(block.id);
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
   if(action==='delete'&&block){if(captionTarget===block.id){captionTarget=null;composeAction();}removed={block,index};draft.blocks.splice(index,1);if(editing===block.id){editing=null;message.value='';composeAction();}render();changed();}
   if(action==='revert'&&removed&&draft.blocks.length<32){draft.blocks.splice(removed.index,0,removed.block);removed=null;render();changed();}
  });
  if(remote&&!state.savedDraft&&state.revision===remote.revision)state.savedDraft=JSON.stringify(remote.draft);
  render();if(!readOnly)renderGroups();dialog.showModal();$('[data-editor=close]').focus();
  if(!readOnly&&!draft.title.trim()){openPane('settings',$('[data-pane-open=settings]'));field('title').focus();}
  if(!readOnly){if(channel==='whatsapp')void refreshGroups().then(refreshGate);else void refreshGate();}
  return stop;
 }

 window.NeoCampaignEditor={open,preview:options=>open({...options,readOnly:true}),closeForSession:()=>stopOpen?.()};
})();
