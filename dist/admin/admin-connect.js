'use strict';

function mountNeoConnect(root,cloud){
 const rpc=(action,data)=>cloud.connectAdmin(action,data);
 const canManageUpdates=typeof cloud.connectUpdateAdmin==='function';
 const downloadable=release=>!release.distribution_state||['legacy','approved'].includes(release.distribution_state);
 let snapshot,groups=[],queue=[],loadVersion=0,savingRelease=false;
 const html=(node,value)=>{node.innerHTML=value;};
 const opt=(rows,label)=>rows.map(x=>`<option value="${esc(x.id)}">${esc(label(x))}</option>`).join('');
 const time=value=>value?new Date(value).toLocaleString('pt-BR'):'—';
 const actor=account=>snapshot.accounts.find(row=>row.id===account)?.identity||'—';
 const computer=id=>snapshot.devices.find(row=>row.id===id)?.label||'—';
 const group=id=>groups.find(row=>row.id===id)?.name||id;
 const job=id=>queue.find(row=>row.id===id)?.title||id;
 const releaseStates={draft:'Rascunho',approved:'Aprovada',blocked:'Bloqueada',legacy:'Legada'};
 const events={update_approve:'Aprovação de atualização',update_block:'Bloqueio de atualização',update_register:'Cadastro de rascunho de atualização',register:'Registro',approved:'Aprovado',approve:'Aprovação',revoke:'Revogação',priority:'Prioridade',leased:'Reserva',started:'Início',simulated:'Simulado',uncertain:'Incerto',queued:'Em fila',cancelled:'Cancelado'};
 root.innerHTML=`<p class="sub">Cliente Windows 10/11 x64. Instale a versão aprovada, entre com a conta administrativa e aprove o computador abaixo. Confira o SHA-256 antes de executar o instalador.</p>
 <p role="status" data-connect-status></p><div class="neo-campaign-actions"><button type="button" class="secondary" data-connect="refresh">Atualizar diagnóstico</button></div>
 <details data-wa-selected><summary>Meus grupos WhatsApp sincronizados</summary>
 <p role="status" data-wa-selected-status></p>
 <label>Conexão<select data-wa-connection aria-label="Conexão WhatsApp"></select></label>
 <ul data-wa-selected-groups></ul>
 <button type="button" class="secondary" data-wa-more hidden>Carregar mais</button>
 </details><div data-connect-content></div>`;
 let releaseInfo;
 const status=root.querySelector('[data-connect-status]'),body=root.querySelector('[data-connect-content]');
 const wa=root.querySelector('[data-wa-selected]'),waStatus=wa.querySelector('[data-wa-selected-status]');
 const waConnection=wa.querySelector('[data-wa-connection]'),waGroups=wa.querySelector('[data-wa-selected-groups]');
 const waMore=wa.querySelector('[data-wa-more]');
 let waRevision=0,waAfter=null;
 async function loadWaGroups(append=false){
  const request=++waRevision,id=waConnection.value;
  if(!append){waAfter=null;waGroups.replaceChildren();}
  waMore.hidden=true;
  if(!id)return;
  waStatus.textContent="Consultando grupos…";
  try{
   const rows=await cloud.connectWaGroups(id,waAfter);
   if(request!==waRevision||!wa.isConnected)return;
   for(const row of rows){
    const li=document.createElement('li');
    li.textContent=row.display_name+(row.participant_count==null?'':' · '+row.participant_count+' participantes');
    waGroups.append(li);
   }
   waAfter=rows.at(-1)?.group_jid??waAfter;
   waStatus.textContent=waGroups.childElementCount?'':'Nenhum grupo sincronizado nesta conexão.';
   waMore.hidden=rows.length<50;
  }catch{if(request===waRevision)waStatus.textContent="Não foi possível consultar os grupos.";}
 }
 async function loadWaConnections(){
  const request=++waRevision,chosen=waConnection.value;
  waStatus.textContent="Consultando conexões…";
  waMore.hidden=true;waGroups.replaceChildren();waConnection.replaceChildren();
  try{
   const rows=await cloud.connectWaConnections();
   if(request!==waRevision||!wa.isConnected)return;
   for(const row of rows){
    const option=document.createElement('option');
    option.value=row.id;option.textContent=row.label+' · '+time(row.last_synced_at);waConnection.append(option);
   }
   if(rows.some(row=>row.id===chosen))waConnection.value=chosen;
   if(!rows.length){waStatus.textContent="Nenhuma conexão sincronizada.";return;}
   await loadWaGroups();
  }catch{if(request===waRevision)waStatus.textContent="Sincronização de grupos indisponível neste ambiente.";}
 }
 wa.addEventListener('toggle',()=>{if(wa.open)void loadWaConnections();});
 waConnection.addEventListener('change',()=>{void loadWaGroups();});
 waMore.addEventListener('click',()=>{void loadWaGroups(true);});
 function note(text){status.textContent=text}
 async function load(){
  if(wa.open)void loadWaConnections();
  const version=++loadVersion;
  const result=await Promise.all([rpc('snapshot'),cloud.campaignWhatsApp('groups'),cloud.campaignWhatsApp('queue'),
   canManageUpdates?cloud.connectUpdateAdmin('list').catch(()=>null):null]);
  if(!root.isConnected||version!==loadVersion)return;
  [snapshot,groups,queue]=result;
  releaseInfo=result[3];
  const enabled=snapshot.accounts.filter(x=>x.enabled);
  const evidenceFor=r=>{
   const e=releaseInfo?.evidence?.[r.version];
   return e&&e.sha256===r.sha256&&Number(e.bytes)===Number(r.bytes)&&e.artifact===r.artifact&&
    /^[a-f0-9]{40}$/.test(e.commit_sha)&&/^\d+$/.test(e.run_id)&&e.verified_at?e:null;
  };
  const needsEvidence=r=>{const [major,minor,patch]=r.version.split('.').map(Number);return major>0||minor>2||minor===2&&patch>=5;};
  html(body,`<h4>Instaladores aprovados</h4>
   ${snapshot.releases.filter(downloadable).map(r=>`<article class="monitor-block"><p>Versão ${esc(r.version)} · ${esc(time(r.approved_at))} · ${Number(r.bytes).toLocaleString('pt-BR')} bytes</p>
   <p class="sub">SHA-256 <code>${esc(r.sha256)}</code></p><button class="secondary" type="button" data-connect="download" data-version="${esc(r.version)}">Preparar download privado</button></article>`).join('')||'<p>Nenhuma versão aprovada disponível.</p>'}
   <div data-connect-link></div>
   ${canManageUpdates?`<div data-connect-updates>
    <h4>Atualizações de Teste</h4>
    ${releaseInfo?`<form data-connect-form="update_import" class="space">
     <label>Manifesto assinado<input name="manifest" type="file" accept=".json,application/json" required></label>
     <button type="submit" class="secondary">Importar como rascunho</button>
    </form>
    <details><summary>Cadastro manual de contingência</summary>
    <form data-connect-form="update_register" class="space">
     <label>Versão<input name="version" required pattern="[0-9]{1,8}[.][0-9]{1,8}[.][0-9]{1,8}"></label>
     <label>Identificador do artefato<input name="artifact" required maxlength="120" pattern="[A-Za-z0-9._\\-]{1,120}"></label>
     <label>Tamanho em bytes<input name="bytes" type="number" required min="1" max="52428800" step="1"></label>
     <label>SHA-256<input name="sha256" required pattern="[0-9a-f]{64}" spellcheck="false"></label>
     <label>Assinatura do manifesto (Base64)<textarea name="signature" required minlength="344" maxlength="1024" spellcheck="false"></textarea></label>
     <label>Notas da atualização<textarea name="notes" maxlength="4000"></textarea></label>
     <button type="submit" class="secondary">Cadastrar rascunho</button>
    </form>
    </details>
    ${releaseInfo.approval_policy===1?'':'<p>Aprovação e bloqueio aguardam a atualização do servidor de Teste.</p>'}
    ${releaseInfo.releases.map(r=>{const e=evidenceFor(r);return `<article class="monitor-block">
     <p>Versão ${esc(r.version)} · ${esc(releaseStates[r.distribution_state]||r.distribution_state)}</p>
     <p class="sub">Artefato ${esc(r.artifact||'—')} · ${Number(r.bytes).toLocaleString('pt-BR')} bytes</p>
     <p>SHA-256 <code style="overflow-wrap:anywhere">${esc(r.sha256)}</code></p>
     <p>${esc(r.notes||'Sem notas da atualização.')}</p>
     <p>Cadastro ${esc(time(r.created_at))} · Aprovação ${esc(time(r.distribution_state==='draft'?null:r.approved_at))}</p>
     ${e?`<p>${r.distribution_state==='draft'?'Pronto para aprovar · ':''}assinatura e arquivo privado verificados · ${esc(time(e.verified_at))}</p>
      <p>Commit <code>${esc(e.commit_sha)}</code> · <a href="https://github.com/neopep/NeoPep-Connect-Build-Privado/actions/runs/${esc(e.run_id)}">Execução e testes de CI</a></p>`:
      r.distribution_state==='draft'&&needsEvidence(r)?'<p>Aguardando evidências de CI, assinatura e arquivo privado verificado.</p>':''}
     ${r.distribution_state==='draft'&&(!needsEvidence(r)||e)?`<form class="space" data-connect-form="update_approve" data-version="${esc(r.version)}">
      <label class="check"><input type="checkbox" name="required" ${releaseInfo.approval_policy===1?'':'disabled'}> Indicar como obrigatória</label>
      <button type="submit" class="secondary" ${releaseInfo.approval_policy===1?'':'disabled'}>Aprovar versão</button></form>`:''}
     ${r.distribution_state==='approved'?`<button type="button" class="secondary" data-connect="update_block" data-version="${esc(r.version)}" ${releaseInfo.approval_policy===1?'':'disabled'}>Bloquear versão</button>`:''}
     </article>`;}).join('')||'<p>Nenhuma versão cadastrada. Aguardando um build assinado e verificado.</p>'}
    <details><summary>Resultados dos computadores</summary>
     ${(releaseInfo.events||[]).map(e=>`<p>${esc(time(e.created_at))} · Versão ${esc(e.version)} · ${esc(({download_requested:'Download solicitado',installed:'Instalado',failed:'Falha na instalação',rollback:'Versão anterior restaurada'})[e.outcome]||e.outcome)} · ${esc(computer(e.device_id))}</p>`).join('')||'<p>Nenhum resultado recebido.</p>'}
    </details>
    <details><summary>Histórico de ações</summary>
     ${(releaseInfo.audit||snapshot.audit.filter(a=>['update_register','update_approve','update_block'].includes(a.event))).map(a=>
      `<p>${esc(time(a.created_at))} · ${esc(events[a.event]||a.event)} · Versão ${esc(a.release_version||'—')} · ${esc(a.release_result==='ok'?'Concluída':a.release_result==='rejected'?'Recusada':'—')} · Administrador ${esc(a.actor_id||'—')}</p>`).join('')||'<p>Nenhuma ação registrada.</p>'}
    </details>`:
    '<p>Canal de atualizações indisponível para esta sessão.</p>'}
   </div>`:''}
   <h4>Computadores</h4><p>Simulação ${snapshot.paused?'pausada':'habilitada'}. O painel registra apenas resultados fictícios.</p>
   <button type="button" class="secondary" data-connect="pause">${snapshot.paused?'Retomar simulação':'Pausar simulação'}</button>
   ${snapshot.devices.map(d=>{
    const online=d.state!=='revoked'&&d.last_seen&&Date.now()-new Date(d.last_seen)<70000;
    const sessions=snapshot.sessions.filter(s=>s.device_id===d.id);
    return `<article class="monitor-block"><h5>${esc(d.label)}</h5>
     <p>${esc(d.state)} · ${online?'Online':'Offline'} · versão ${esc(d.version||'—')} · ${esc(d.working_set_mb??'—')} MB</p>
     <p class="sub">Responsável ${esc(d.owner_id)} · Última atividade ${esc(time(d.last_seen))}</p>
     <p>${sessions.map(s=>esc(actor(s.account_id))+' · '+(s.connected&&online&&Date.now()-new Date(s.last_seen)<70000?'Conectada':'Desconectada')).join(' | ')||'Sem sessão'}</p>
     <div class="neo-campaign-actions">
     ${d.state==='pending'?`<button type="button" class="secondary" data-connect="approve" data-id="${esc(d.id)}">Aprovar</button>`:''}
     ${d.state!=='revoked'?`<button type="button" class="secondary" data-connect="revoke" data-id="${esc(d.id)}">Revogar</button>`:''}
     <form data-connect-form="priority" data-id="${esc(d.id)}"><label>Prioridade <input required name="priority" type="number" min="0" max="100" value="${Number(d.priority)}"></label><button class="secondary">Salvar</button></form>
     </div></article>`;
   }).join('')||'<p>Nenhum computador registrado.</p>'}
   <h4>Contas simuladas</h4>
   <form data-connect-form="create_account"><label>Identidade fictícia<input required name="identity" pattern="fixture-[A-Za-z0-9_-]{1,40}" placeholder="fixture-principal"></label><button class="secondary">Criar para minha conta administrativa</button></form>
   ${snapshot.accounts.map(a=>`<p>${esc(a.identity)} · ${a.enabled?'Disponível':'Revogada'} · ${esc(a.owner_id)}
   ${a.enabled&&a.owner_id===cloud.user?.id?`<button type="button" class="secondary" data-connect="disable_account" data-id="${esc(a.id)}">Revogar conexão</button>`:''}</p>`).join('')}
   <h4>Autorização por grupo</h4>
   <form data-connect-form="associate" class="space">
    <label>Grupo<select name="group" required><option value="">Selecione</option>${opt(groups,x=>x.name)}</select></label>
    <label>Conta simulada<select name="account" required><option value="">Selecione</option>${opt(enabled,x=>x.identity)}</select></label>
    <label>Prioridade como reserva<input name="priority" type="number" required min="0" max="100" value="0"></label>
    <label class="check"><input name="verified" type="checkbox">Participação verificada no cenário fictício</label>
    <label class="check"><input name="may_publish" type="checkbox">Publicação autorizada no cenário fictício</label>
    <button class="secondary">Salvar vínculo</button>
   </form>
   ${snapshot.groups.map(g=>`<p>${esc(group(g.group_id))} · ${esc(actor(g.account_id))} · ${g.verified&&g.may_publish?'Elegível':'Sem autorização'} · Prioridade ${Number(g.priority)}</p>`).join('')}
   <h4>Fila de simulação</h4>
   <form data-connect-form="queue" class="space">
    <label>Divulgação por grupo<select name="id" required><option value="">Selecione</option>${opt(queue.filter(x=>x.scheduled_at&&['scheduled','late'].includes(x.state)),x=>x.title+' · '+x.group_name)}</select></label>
    <label>Conta preferencial<select name="account" required><option value="">Selecione</option>${opt(enabled,x=>x.identity)}</select></label>
    <label>Seleção de remetente<select name="mode"><option value="fixed">Número fixo</option><option value="fallback">Principal e reservas autorizadas</option><option value="linked">Mesma conta em computadores vinculados</option></select></label>
    <button class="secondary">Enfileirar simulação</button>
   </form>
   ${snapshot.tasks.map(t=>`<p>${esc(job(t.publication_id))} · ${esc(events[t.state]||t.state)} · ${esc(actor(t.account_id))} · ${esc(computer(t.device_id))} · ${esc(time(t.occurrence))}</p>`).join('')}
   <details><summary>Tentativas e auditoria</summary>${snapshot.audit.map(a=>`<p>${esc(time(a.created_at))} · ${esc(events[a.event]||a.event)} · ${esc(computer(a.device_id))} · ${esc(actor(a.account_id))}</p>`).join('')}</details>`);
  if(typeof installNeoConnectNavigation==='function')installNeoConnectNavigation(root);
 }
 async function perform(action){
  try{note('Consultando NeoPep Connect…');await action();note('Atualizado.');}
  catch(error){note(error.message||'Não foi possível executar a operação.');}
 }
 async function changeDistribution(action,version,button,required=false){
  const expected=action==='approve'?'draft':'approved';
  if(savingRelease||releaseInfo?.approval_policy!==1||
     !releaseInfo.releases.some(r=>r.version===version&&r.distribution_state===expected))return;
  const message=action==='approve'
   ?`Aprovar a versão ${version} como ${required?'obrigatória':'opcional'} no canal de Teste? Confirme que você conferiu o SHA-256 do EXE e a assinatura do manifesto fora do painel.`
   :`Bloquear a versão ${version} para novas ofertas e autorizações de instalação?`;
  if(!confirm(message))return;
  savingRelease=true;
  button.disabled=true;
  note('Atualizando distribuição…');
  try{
   const result=await cloud.connectUpdateAdmin(action,action==='approve'?{version,required}:{version});
   if(result?.ok!==true){
    const message=result?.code==='release_state'?'O estado da versão mudou. Confira a lista atualizada.':
     'Operação recusada. Confira o objeto privado e os dados do manifesto.';
    await load();
    note(message);
    return;
   }
   const updatedState=action==='approve'?'approved':'blocked';
   const listed=releaseInfo?.releases.find(r=>r.version===version);
   if(listed)listed.distribution_state=updatedState;
   if(action==='block'){
    const release=snapshot.releases.find(r=>r.version===version);
    if(release)release.distribution_state=updatedState;
    body.querySelector('[data-connect-link]')?.replaceChildren();
   }
   try{await load();note(action==='approve'?'Versão aprovada.':'Versão bloqueada.');}
   catch{note('Operação concluída. Atualize o diagnóstico para revisar a lista.');}
  }catch(error){
   note(error.code==='42501'?'Uma sessão administrativa é necessária.':'Não foi possível confirmar a operação. Atualize o diagnóstico antes de tentar novamente.');
  }finally{
   savingRelease=false;
   button.disabled=false;
  }
 }
 root.addEventListener('submit',event=>{
  const form=event.target;if(!form.dataset.connectForm)return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form)),action=form.dataset.connectForm;
  if(action==='update_approve'){
   void changeDistribution('approve',form.dataset.version,form.querySelector('button[type="submit"]'),data.required==='on');
   return;
  }
  if(action==='update_import'){
   if(!canManageUpdates||!cloud.importConnectRelease||savingRelease)return;
   const button=form.querySelector('button[type="submit"]');
   savingRelease=true;button.disabled=true;
   void (async()=>{
    try{
     const file=data.manifest;
     if(!file?.size||file.size>16384)throw Error('Selecione um manifesto JSON de até 16 KiB.');
     let manifest;
     try{manifest=JSON.parse((await file.text()).replace(/^\uFEFF/,''));}catch{throw Error('O arquivo selecionado não contém JSON válido.');}
     if(!manifest||typeof manifest.version!=='string'||!/^\d{1,8}(\.\d{1,8}){2}$/.test(manifest.version)||
        manifest.profile!=='staging'||manifest.channel!=='stable'||! /^[a-f0-9]{64}$/.test(manifest.sha256))
      throw Error('Confira a versão, o perfil Teste, o canal e o SHA-256.');
     if(!confirm('Registrar como rascunho no Teste?\nArquivo: '+file.name+'\nVersão: '+manifest.version+'\nSHA-256: '+manifest.sha256))return;
     note('Verificando assinatura e instalador no bucket privado…');
     const result=await cloud.importConnectRelease(manifest);
     form.reset();
     try{await load();}catch{}
     note('Rascunho '+result.version+' • '+result.path+' • SHA-256 '+result.sha256);
    }catch(error){note(error.message||'Falha ao importar o manifesto.');}
    finally{savingRelease=false;button.disabled=false;}
   })();
   return;
  }
  if(action==='update_register'){
   if(!canManageUpdates||savingRelease)return;
   const signature=data.signature.trim();
   if(!/^[A-Za-z0-9+/]+={0,2}$/.test(signature)||signature.length<344||signature.length>1024||signature.length%4){
    note('Informe a assinatura Base64 do manifesto.');
    return;
   }
   const draft={version:data.version,artifact:data.artifact,bytes:Number(data.bytes),sha256:data.sha256,signature,notes:data.notes};
   const button=form.querySelector('button[type="submit"]');
   savingRelease=true;
   button.disabled=true;
   void (async()=>{
    note('Cadastrando rascunho…');
    try{
     await cloud.connectUpdateAdmin('register',draft);
     form.reset();
     try{await load();note('Rascunho cadastrado.');}
     catch{note('Rascunho cadastrado. Atualize o diagnóstico para revisar a lista.');}
    }catch(error){
     note(error.code==='42501'?'Uma sessão administrativa é necessária.':
      error.code==='23505'?'Essa versão já está cadastrada.':'Não foi possível cadastrar o rascunho. Confira os dados do manifesto.');
    }finally{
     savingRelease=false;
     button.disabled=false;
    }
   })();
   return;
  }
  if(action==='priority')data.id=form.dataset.id;
  if(action==='associate'){
   data.verified=Boolean(data.verified);data.may_publish=Boolean(data.may_publish);
  }
  void perform(async()=>{await rpc(action,data);await load();});
 });
 root.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-connect]');
  if(!button)return;
  const {connect:action,id,version}=button.dataset;
  if(action==='update_block'){
   void changeDistribution('block',version,button);
   return;
  }
  if(['revoke','disable_account'].includes(action)&&!confirm('Revogar acesso ao NeoPep Connect?'))return;
  void perform(async()=>{
   if(action==='download'){
    const release=snapshot.releases.find(x=>x.version===version&&downloadable(x));
    if(!release)return;
    const url=await cloud.connectReleaseURL(release.path);
    if(!root.isConnected||!snapshot.releases.some(r=>r.version===version&&downloadable(r)))return;
    const link=document.createElement('a');link.href=url;link.textContent='Baixar instalador aprovado (link válido por 2 minutos)';
    link.className='secondary';root.querySelector('[data-connect-link]').replaceChildren(link);return;
   }
   if(action!=='refresh')await rpc(action,action==='pause'?{paused:!snapshot.paused}:{id});
   await load();
  });
 });
 return {load:()=>perform(load)};
}
