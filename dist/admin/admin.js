'use strict';
const $=s=>document.querySelector(s),esc=window.NeoCore.escape;let generation=0,loading=false,authorized=false,tab=(typeof location==='undefined'?null:new URL(location.href).searchParams.get('admin'))==='campaigns'?'campaigns':'overview',platform=null,dirty=false,authConfirmation=null;
const adminTabs={overview:'Visão Geral',signups:'Cadastros',audience:'Estatísticas de público',
 engagement:'Engajamento',operations:'Inteligência operacional',health:'Saúde do sistema',campaigns:'Campanhas',settings:'Configurações'};
function adminAgentTrigger(context,label){
 return `<button type="button" class="icon-btn admin-agent-trigger" data-report-agent="${context}" aria-label="${label}">✦</button>`;
}
function adminSectionHeading(title,context,buttons=''){
 const names={signups:'Agente de análise de cadastros',audience:'Agente de análise de público',system_health:'Agente de monitoramento',operations_insights:'Agente de planejamento'};
 return `<div class="admin-section-heading"><h2>${title}</h2><div>${buttons}${adminAgentTrigger(context,names[context])}</div></div>`;
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-report-agent]');
 if(!button)return;
 const group=button.parentElement;
 let note=group.querySelector('[data-agent-placeholder]');
 if(!note){note=document.createElement('span');note.dataset.agentPlaceholder='';note.setAttribute('role','status');note.className='sub';group.append(note)}
 note.textContent=button.dataset.reportAgent==='system_health'?'Agente de monitoramento — em breve':button.dataset.reportAgent==='operations_insights'?'Agente de planejamento — em breve':'Agente de análise — em breve';
});
function overview(d){const metrics=[['Usuários cadastrados',d.users_total],['Cadastros em 7 dias',d.signups_7d],['Ativos em 24 horas',d.active_24h],['Ativos em 7 dias',d.active_7d],['Ativos em 30 dias',d.active_30d],['Perfis configurados',d.profiles_total],['Registros totais',d.records_total],['Fotos armazenadas',d.photos_total]];return `<div class="admin-overview"><button type="button" class="card admin-campaign-shortcut" data-admin-tab="campaigns"><span class="admin-campaign-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h4l11-5v16L7 15H3zM7 15l2 5h3l-2-4M21 9v6"/></svg></span><span class="admin-campaign-shortcut-copy"><strong>Campanhas</strong><span>Gerencie campanhas do App e WhatsApp</span></span><svg class="admin-campaign-shortcut-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg></button><div class="stats">${metrics.map(([title,value])=>`<article class="card stat"><div class="stat-label">${title}</div><div class="stat-value">${Number.isFinite(value)?value.toLocaleString('pt-BR'):'—'}</div></article>`).join('')}</div><div data-admin-signups></div>
 <section class="card">${adminSectionHeading('Estatísticas de público','audience','<button type="button" class="secondary" data-admin-tab="audience">Abrir estatísticas</button>')}
 <p class="sub">Distribuição de cadastros, atividade e campanhas por período.</p></section>
 <details class="card"><summary>Saúde do sistema</summary><p class="sub">Diagnóstico parcial baseado na consulta administrativa e nos erros enviados pelo app.</p>
 <p>Banco: ${d.database_status==='reachable'?'consulta respondeu':'sem confirmação'} · Storage privado: ${d.private_storage===true?'confirmado':'sem confirmação'}</p>
 <p>Schema: ${esc(d.schema_version)} · Servidor: ${esc(d.server_time)}</p>
 <p>Erros do aplicativo em 7 dias: ${esc(d.app_errors_7d.map(x=>x.code+' '+x.count).join(', ')||'nenhum reportado')}</p>
 <div class="admin-section-heading"><button type="button" class="secondary" data-admin-tab="health">Abrir saúde e capacidade</button>${adminAgentTrigger('system_health','Agente de monitoramento')}</div></details></div>`;}
function adminCsvText(rows){
 const cell=value=>{
  let text=String(value??'');
  if(typeof value==='string'&&/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
 };
 return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
function adminCsv(name,rows){
 const csv=adminCsvText(rows);
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
 a.href=url;a.download=name+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function signupExport(cloud,filters,current){
 const result=[['Identificador','Nome','E-mail','Cadastro','Método','Último acesso','Cidade inicial','Estado inicial','País inicial',
  'Cidade recente','Estado recente','País recente','Dispositivo inicial','SO inicial','Dispositivo recente','SO recente','Campanha inicial','Campanha recente']];
 const bulk=typeof cloud.adminSignupExport==='function',size=bulk?250:20,maxBatches=bulk?80:250;
 let cursor=null;
 for(let n=0;n<maxBatches;n++){
  const payload={...filters,p_before:cursor?.created_at??null,p_before_id:cursor?.id??null};
  const page=bulk?await cloud.adminSignupExport(payload):await cloud.adminSignups('page',payload);
  if(!current())return null;
  const rows=page.rows.slice(0,size);
  const metrics=!bulk&&rows.length&&cloud.adminAudience?await cloud.adminAudience({p_users:rows.map(x=>x.id)}):{};
  if(!current())return null;
  for(const row of rows){
   const o=bulk?row:(metrics?.[row.id]||{});
   const before=row.first_location||{},after=row.last_location||{};
   result.push([row.id,row.full_name,row.email,row.created_at,row.provider,row.last_access,
    before.city,before.region,before.country,after.city,after.region,after.country,
    o.first_device?.category,o.first_device?.os,o.last_device?.category,o.last_device?.os,
    o.first_campaign?audienceCampaignSummary(o.first_campaign,false):'',o.last_campaign?audienceCampaignSummary(o.last_campaign,false):'']);
  }
  if(page.rows.length<=size)return result;
  cursor=rows.at(-1);
 }
 throw Error('A exportação excedeu '+(size*maxBatches).toLocaleString('pt-BR')+' registros. Reduza o intervalo.');
}
function input(name,label,value='',extra=''){return `<label>${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;}
function settingsView(p){const c=p.config,s=p.shop||{},publicCfg=window.NEO_CONFIG||{};return `<section class="card space"><h2>Cadastro e confirmação de e-mail</h2><p class="sub">Controle exclusivo do administrador principal. Desativar permite criar conta e entrar sem confirmar a propriedade do e-mail. Recuperação de senha ainda depende de envio de e-mail. Reativar vale para novos cadastros.</p><p id="authSettingsStatus" role="status">Estado ainda não consultado no Supabase.</p><button class="secondary" type="button" id="authSettingsRead">Consultar estado atual</button><form id="authSettingsForm" class="space"><label class="check"><input type="checkbox" id="requireEmailConfirmation" disabled> Exigir confirmação de e-mail nos novos cadastros</label><button class="primary" type="submit" disabled>Aplicar no Supabase</button></form></section><form id="platformForm"><section class="card space"><h2>Configurações gerais</h2><p class="sub">Referências operacionais do suporte. Alterar a URL aqui não conecta um domínio nem muda as permissões do CAPTCHA.</p>${input('support_email','E-mail operacional de atendimento',c.support_email||publicCfg.privacyContact||'','type="email" maxlength="254"')}${input('site_url','Endereço público de referência',c.site_url||'','type="url" maxlength="2000" placeholder="https://…"')}<label class="check"><input type="checkbox" name="require_approval" ${p.require_approval?'checked':''}> Exigir aprovação das novas mensagens do Grupo</label></section><button class="primary full space" type="submit">Salvar configurações</button></form><div data-agent-admin></div><section class="card space"><h2>Pagamentos e entrega</h2><p class="sub">Mercado Pago: ${s.payments_ready?'habilitado no ambiente '+esc(s.payment_environment):'configuração e homologação pendentes'}. Retorno do navegador não confirma pagamento.</p><details class="admin-secret-help"><summary>Integração com Mercado Pago</summary><p class="sub">As credenciais MP_ACCESS_TOKEN, MP_COLLECTOR_ID, MP_WEBHOOK_SECRET, MP_MODE e SHOP_APP_URL ficam nos Secrets do Supabase. Teste completo e webhook são necessários antes de ativar pagamentos. Não coloque essas chaves no formulário.</p><p class="sub">Webhook: <code>${esc(publicCfg.supabaseUrl||'')}/functions/v1/mercadopago-webhook</code></p></details><form id="adminShopForm" class="space">${input('seller_name','Responsável pela loja',s.seller_name||'','required maxlength="120"')}${input('seller_document','CPF ou CNPJ',s.seller_document||'','required maxlength="14" inputmode="numeric"')}${input('business_address','Endereço comercial',s.business_address||'','required maxlength="250"')}${input('support_email','E-mail de atendimento da loja',s.support_email||'','required type="email" maxlength="254"')}<label>Condições de troca<textarea name="returns_policy" rows="4" required maxlength="4000">${esc(s.returns_policy||'')}</textarea></label><div class="form-grid">${input('shipping','Frete fixo (R$)',String((s.shipping_cents??0)/100).replace('.',','),'required inputmode="decimal"')}${input('delivery_min','Prazo mínimo em dias úteis',s.delivery_min??3,'required type="number" min="1" max="90"')}${input('delivery_max','Prazo máximo em dias úteis',s.delivery_max??10,'required type="number" min="1" max="120"')}</div><label class="check"><input type="checkbox" name="shipping_ready" ${s.shipping_ready?'checked':''}> Entrega e prazo conferidos</label><button class="secondary full" type="submit">Salvar entrega e condições</button></form></section>`;}
async function refresh(){if(loading)return;if(!campaignExitAllowed())return;if(tab!=='overview'&&tab!=='signups')clearSignupToast();window.NeoAgent?.reset();authConfirmation=null;const gen=++generation;loading=true;$('#adminContent').innerHTML='';$('#adminStatus').textContent='Verificando autorização no servidor…';$('#adminRefresh').disabled=true;try{if(!window.NeoCloud.configured)throw Error('Supabase não configurado. O painel não apresenta métricas fictícias.');if(!window.NeoCloud.user)throw Error('Entre na sua conta pelo aplicativo e abra novamente o painel.');const d=await window.NeoCloud.adminSummary();if(gen!==generation)return;authorized=true;void acknowledgeSignups(window.NeoCloud,window.NeoCloud.user.id);$('#adminTabs').hidden=false;$('#adminTitle').textContent=adminTabs[tab]||adminTabs.overview;$('#adminSubtitle').textContent='Autorização verificada no servidor.';for(const button of document.querySelectorAll('[data-admin-tab]')){const active=button.dataset.adminTab===tab;button.className=active?'primary':'secondary';button.setAttribute('aria-pressed',String(active));}if(tab==='settings'){try{platform=await window.NeoCloud.platform();if(gen!==generation)return;$('#adminContent').innerHTML=settingsView(platform);window.NeoAgent?.mount($('#adminContent [data-agent-admin]'));}catch(err){$('#adminContent').innerHTML='<section class="card"><h2>Ativação das configurações</h2><p class="sub">Execute a atualização de Biblioteca e integrações no Supabase. As configurações são autorizadas pelo servidor e não são simuladas neste painel.</p></section>';throw err;}}else if(tab==='overview'){
 $('#adminContent').innerHTML=overview(d);
 void mountAdminSignups($('[data-admin-signups]'),true);
 }else if(tab==='signups'){
 $('#adminContent').innerHTML='<div data-admin-signups></div>';
 void mountAdminSignups($('[data-admin-signups]'));
 }else if(tab==='audience'||tab==='engagement'){
 $('#adminContent').innerHTML='<div data-admin-audience></div>';
 mountAdminAudience($('[data-admin-audience]'),tab==='engagement');
 }else if(tab==='health')mountSystemHealth($('#adminContent'),d);else if(tab==='operations')mountOperations($('#adminContent'),d);else if(tab==='campaigns'){const root=document.createElement('div');$('#adminContent').append(root);void mountCampaigns(root);}$('#adminStatus').textContent='Consulta autorizada. Atualizado agora.';dirty=false;}catch(err){if(gen!==generation)return;$('#adminStatus').textContent='Acesso não disponível: '+err.message;if(!authorized){$('#adminTabs').hidden=true;$('#adminContent').innerHTML='<div class="notice">Somente uma permissão concedida pelo responsável no banco habilita este painel. Editar perfil ou dados do navegador não concede acesso.</div>';}}finally{loading=false;$('#adminRefresh').disabled=false;}}
async function integration(action){if(loading||!authorized)return;if(action==='test_ai'&&dirty){$('#adminStatus').textContent='Salve as configurações antes de testar a conexão.';return;}const gen=generation;loading=true;try{const r=await window.NeoCloud.integrations(action);if(gen!==generation)return;if(action==='test_ai'){loading=false;await refresh();$('#adminStatus').textContent='Conexão com IA validada. Você já pode ativar as respostas automáticas.';}else $('#integrationStatus').textContent=`Chave OpenAI: ${r.openai_key_present?'presente':'pendente'} · Mercado Pago: ${r.mercadopago_keys_present?'chaves presentes, homologação deve ser conferida':'chaves pendentes'} · Rotina da IA: ${r.ai_worker_secret_present?'segredo presente; agendamento deve ser conferido':'pendente'}`;}catch{if(gen===generation)$('#adminStatus').textContent='Não foi possível conferir a integração. Verifique a função publicada, as chaves e o modelo no Supabase.';}finally{loading=false;}}
async function authSettings(save=false){if(loading||!authorized)return;const status=$('#authSettingsStatus'),box=$('#requireEmailConfirmation'),button=$('#authSettingsForm [type=submit]'),gen=generation;if(!status||!box||!button)return;const desired=box.checked;if(save&&authConfirmation===null)return;if(save&&!confirm(desired?'Exigir confirmação de e-mail nos novos cadastros? Confira o SMTP antes de ativar.':'Permitir novos cadastros sem confirmar a propriedade do e-mail?'))return;loading=true;box.disabled=true;button.disabled=true;$('#authSettingsRead').disabled=true;status.textContent=save?'Aplicando e conferindo no Supabase…':'Consultando o Supabase…';try{const r=await window.NeoCloud.authSettings(save?'set':'status',save?{require_email_confirmation:desired,expected_confirmation:authConfirmation}:{});if(gen!==generation)return;if(typeof r.require_email_confirmation!=='boolean')throw Error('invalid_state');authConfirmation=r.require_email_confirmation;box.checked=authConfirmation;box.disabled=false;button.disabled=false;status.textContent=(save?'Alteração confirmada no Supabase. ':'Estado conferido no Supabase. ')+(authConfirmation?'Confirmação de e-mail ativada.':'Confirmação de e-mail desativada.');}catch{if(gen===generation){authConfirmation=null;box.checked=false;status.textContent='Não foi possível confirmar o estado. Consulte novamente. A função auth-settings e os Secrets precisam estar configurados, e sua conta deve ser administrador principal.';}}finally{loading=false;if(gen===generation)$('#authSettingsRead').disabled=false;}}
document.addEventListener('submit',event=>{if(event.target.id==='authSettingsForm'){event.preventDefault();authSettings(true);}});
document.addEventListener('click',event=>{if(event.target.closest('#authSettingsRead'))authSettings();const tabButton=event.target.closest('[data-admin-tab]');if(tabButton&&!loading&&campaignExitAllowed()){
  campaignRouteGuard=null;tab=tabButton.dataset.adminTab;
  if(globalThis.history){const url=new URL(location.href);
   for(const p of ['admin','channel','campaignView','campaign','campaignTab'])url.searchParams.delete(p);
   if(tab==='campaigns')url.searchParams.set('admin','campaigns');
   history.pushState(history.state,'',url);}
  refresh();
 }if(event.target.closest('#testAI'))integration('test_ai');if(event.target.closest('#integrationRefresh'))integration('status');});
document.addEventListener('input',event=>{if(event.target.closest('#platformForm'))dirty=true;});
document.addEventListener('change',event=>{if(event.target.matches('[name=ai_provider],[name=ai_model]')){const form=document.querySelector('#platformForm'),box=form?.querySelector('[name=ai_enabled]');if(box){box.checked=false;box.disabled=true;}}});
document.addEventListener('submit',async event=>{const form=event.target;if(!form.matches('#platformForm,#adminShopForm'))return;event.preventDefault();if(loading||!authorized||!form.reportValidity())return;const values=Object.fromEntries(new FormData(form)),gen=generation;loading=true;const button=form.querySelector('[type=submit]');button.disabled=true;try{if(form.id==='platformForm')await window.NeoCloud.platform('save',{support_email:values.support_email,site_url:values.site_url,require_approval:values.require_approval==='on'});else await window.NeoCloud.shop('settings',{...values,shipping_cents:window.NeoShopCore.cents(values.shipping,true),delivery_min:Number(values.delivery_min),delivery_max:Number(values.delivery_max),shipping_ready:values.shipping_ready==='on'});if(gen!==generation)return;dirty=false;loading=false;await refresh();$('#adminStatus').textContent='Configurações salvas no servidor.';}catch(err){if(gen===generation)$('#adminStatus').textContent=err.message;}finally{loading=false;button.disabled=false;}});
let paymentConfig=null,paymentBusy=false,paymentMessage='',paymentSelected='test';
function paymentPanel(){
 const base=window.NEO_CONFIG?.supabaseUrl;
 if(!base||!window.NeoCloud.shopPaymentIntegration)return '<section class="card space"><h2>Pagamento · Mercado Pago</h2><p class="sub">Integração indisponível nesta sessão.</p></section>';
 const root=paymentConfig||{},active=root.active_environment||root.environment||'test',c=root.environments?.[paymentSelected]||(root.environment===paymentSelected?root:{}),url=root.webhook_url||new URL('/functions/v1/mercadopago-webhook',base).href,saved=c.configured?' <span class="tag">✓ Salvo</span>':'',label=paymentSelected==='production'?'Produção':'Teste',message=paymentMessage||(c.validated_at?'Conexão validada · conta '+c.collector_id:c.configured?'Credenciais salvas. Teste esta conexão antes de ativar.':'Cadastre as credenciais de '+label+'.');return `<section class="card space"><div class="between"><div><h2>Pagamento · Mercado Pago</h2><p class="sub">Teste e Produção ficam salvos separadamente. Somente o ambiente ativo recebe novas compras.</p></div><span class="tag">Ativo: ${active==='production'?'Produção':'Teste'}</span></div><div class="segmented shop-payment-environments" role="tablist"><button type="button" data-admin-payment-environment="test" class="${paymentSelected==='test'?'active':''}" aria-selected="${paymentSelected==='test'}">Teste</button><button type="button" data-admin-payment-environment="production" class="${paymentSelected==='production'?'active':''}" aria-selected="${paymentSelected==='production'}">Produção</button></div><form id="adminPaymentForm" class="space"><input type="hidden" name="environment" value="${paymentSelected}"><label>Access Token${saved}<input name="access_token" type="password" autocomplete="new-password" placeholder="${c.configured?'Salvo · deixe vazio para manter':'Cole o Access Token deste ambiente'}"></label><label>Assinatura secreta do webhook${saved}<input name="webhook_secret" type="password" autocomplete="new-password" placeholder="${c.configured?'Salva · deixe vazio para manter':'Cole a assinatura secreta deste ambiente'}"></label><label>URL de notificação<input data-admin-webhook readonly value="${esc(url)}"></label><button class="secondary" type="button" data-admin-copy-webhook>Copiar URL do webhook</button><p class="notice" data-payment-status>${esc(message)}</p><div class="shop-admin-actions"><button class="secondary" ${paymentBusy?'disabled':''}>Salvar credenciais</button><button class="secondary" type="button" data-admin-payment-test ${!c.configured||paymentBusy?'disabled':''}>Testar conexão</button><button class="primary" type="button" data-admin-payment-activate ${!c.validated_at||active===paymentSelected||paymentBusy?'disabled':''}>${active===paymentSelected?'Ambiente ativo':'Ativar '+label}</button></div></form></section>`}
const originalSettingsView=settingsView;settingsView=p=>{const html=originalSettingsView(p).replace('<div data-agent-admin></div>','<div data-agent-admin></div><div data-admin-payment>'+paymentPanel()+'</div>').replace(/<p class="sub">Mercado Pago:[\s\S]*?<\/details>/,'').replace('<h2>Pagamentos e entrega</h2>','<h2>Entrega e condições da loja</h2>');if(!paymentConfig&&!paymentBusy&&window.NEO_CONFIG?.supabaseUrl&&window.NeoCloud.shopPaymentIntegration)setTimeout(loadPaymentConfig);return html};
function redrawPayment(){const box=document.querySelector('[data-admin-payment]');if(box)box.innerHTML=paymentPanel()}
async function loadPaymentConfig(){if(paymentBusy||!authorized||tab!=='settings')return;paymentBusy=true;redrawPayment();try{const first=!paymentConfig;paymentConfig=await window.NeoCloud.shopPaymentIntegration('status');if(first)paymentSelected=paymentConfig.active_environment||paymentConfig.environment||paymentSelected;paymentMessage=''}catch(err){paymentMessage=err.message}finally{paymentBusy=false;redrawPayment()}}
document.addEventListener('submit',event=>{const form=event.target;if(form.id!=='adminPaymentForm')return;event.preventDefault();event.stopImmediatePropagation();if(paymentBusy||!form.reportValidity())return;const values=Object.fromEntries(new FormData(form));paymentBusy=true;paymentMessage='Salvando credenciais…';redrawPayment();window.NeoCloud.shopPaymentIntegration('save',values).then(()=>{paymentBusy=false;paymentMessage='Credenciais salvas no servidor.';return loadPaymentConfig()}).catch(err=>{paymentBusy=false;paymentMessage=err.message;redrawPayment()})},true);
document.addEventListener('click',event=>{const environment=event.target.closest('[data-admin-payment-environment]');if(environment&&!paymentBusy){paymentSelected=environment.dataset.adminPaymentEnvironment;paymentMessage='';redrawPayment();return}const copy=event.target.closest('[data-admin-copy-webhook]');if(copy){navigator.clipboard?.writeText(document.querySelector('[data-admin-webhook]')?.value||'').then(()=>{paymentMessage='URL copiada.';redrawPayment()});return}const activate=event.target.closest('[data-admin-payment-activate]');if(activate&&!paymentBusy){paymentBusy=true;paymentMessage='Ativando '+(paymentSelected==='production'?'Produção':'Teste')+'…';redrawPayment();window.NeoCloud.shopPaymentIntegration('activate',{environment:paymentSelected}).then(()=>{paymentBusy=false;paymentMessage=(paymentSelected==='production'?'Produção':'Teste')+' ativado para novas compras.';return loadPaymentConfig()}).catch(err=>{paymentBusy=false;paymentMessage=err.message;redrawPayment()});return}if(event.target.closest('[data-admin-payment-test]')&&!paymentBusy){paymentBusy=true;paymentMessage='Testando conexão '+(paymentSelected==='production'?'de Produção':'de Teste')+'…';redrawPayment();window.NeoCloud.shopPaymentIntegration('test',{environment:paymentSelected}).then(()=>{paymentBusy=false;paymentMessage='Conexão '+(paymentSelected==='production'?'de Produção':'de Teste')+' validada.';return loadPaymentConfig()}).catch(err=>{paymentBusy=false;paymentMessage=err.message;redrawPayment()})}});
let signupVisit=null;
let activeSignupToast=null;
function clearSignupToast(){activeSignupToast?.()}
function showSignupToast(pending){
 if(activeSignupToast)return;
 const toast=document.createElement('aside'),amount=Number(pending.count);
 toast.className='admin-signup-toast';
 toast.dataset.signupNotice='';
 toast.innerHTML=`<div class="admin-signup-toast-main"><div role="status">
  <strong>${amount.toLocaleString('pt-BR')} ${amount===1?'novo cadastro':'novos cadastros'}</strong>
  <ul>${pending.rows.slice(0,5).map(row=>`<li>${esc(row.full_name||row.email||'Nome não informado')} · ${signupDate(row.created_at,signupHour)}</li>`).join('')}</ul>
  ${amount>pending.rows.length?'<small>Veja os demais na lista de cadastros.</small>':''}
 </div><div class="admin-signup-toast-actions"><button type="button" aria-label="Fechar aviso" class="icon-btn">×</button><span aria-hidden="true" data-signup-seconds>9 s</span></div></div>
 <progress value="9000" max="9000" aria-label="Tempo restante do aviso"></progress>`;
 const seconds=toast.querySelector('[data-signup-seconds]'),progress=toast.querySelector('progress');
 let timer=null,fade=null,remaining=9000,started=null;
 function dispose(){
  clearTimeout(timer);clearTimeout(fade);
  document.removeEventListener('visibilitychange',update);
  toast.remove();
  if(activeSignupToast===dispose)activeSignupToast=null;
 }
 function close(){
  if(fade!==null)return;
  clearTimeout(timer);
  document.removeEventListener('visibilitychange',update);
  toast.classList.add('is-closing');
  fade=setTimeout(dispose,200);
 }
 function update(){
  clearTimeout(timer);
  if(!toast.isConnected){dispose();return}
  const now=Date.now();
  if(started!==null)remaining=Math.max(0,remaining-(now-started));
  started=null;
  seconds.textContent=Math.ceil(remaining/1000)+' s';
  progress.value=remaining;
  if(!remaining){close();return}
  if(document.visibilityState==='hidden')return;
  started=now;
  timer=setTimeout(update,Math.min(100,remaining));
 }
 activeSignupToast=dispose;
 toast.querySelector('button').addEventListener('click',close,{once:true});
 document.addEventListener('visibilitychange',update);
 document.body.append(toast);
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{if(activeSignupToast===dispose)update()});
 else update();
}
window.addEventListener?.('pagehide',clearSignupToast);
const signupFullTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium'});
const signupShortTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});
const signupHour=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'});
function signupDate(value,formatter){
 const time=value?new Date(value):null;
 return time&&Number.isFinite(+time)?formatter.format(time):'Ainda não registrado';
}
function signupLocation(value){
 if(!value?.country)return 'Localização não disponível';
 const source=value.source==='device_city'?'Localização do aparelho (cidade/estado)':'Vercel (estimativa pela conexão)';
 return esc([value.city,value.region,value.country].filter(Boolean).join(', '))+
  ' · '+source+' · '+esc(signupDate(value.observed_at,signupFullTime));
}
function signupRow(row,observed={},geo={}){
 const name=esc(row.full_name||'Nome não informado'),email=esc(row.email||'E-mail não informado');
 const method={email:'E-mail',google:'Google',apple:'Apple'}[row.provider]||'Não informado';
 return `<details class="admin-signup"><summary>
  <span class="admin-signup-person"><strong>${name}</strong><small>${email}</small></span>
  <time title="${esc(signupDate(row.created_at,signupFullTime))}">${signupDate(row.created_at,signupShortTime)}</time>
  ${row.is_new?'<span class="admin-signup-new">Novo</span>':''}<span aria-hidden="true" class="admin-signup-chevron">⌄</span>
 </summary><dl>
  <div><dt>Nome completo</dt><dd>${name}</dd></div><div><dt>E-mail</dt><dd>${email}</dd></div>
  <div><dt>Primeiro local observado</dt><dd>${signupLocation(geo.first_location)}</dd></div>
  <div><dt>Último local observado</dt><dd>${signupLocation(geo.last_location)}</dd></div><div><dt>Método</dt><dd>${method}</dd></div>
  <div><dt>Cadastro</dt><dd>${signupDate(row.created_at,signupFullTime)}</dd></div>
  <div><dt>Último acesso</dt><dd>${signupDate(row.last_access,signupFullTime)}</dd></div>
  <div><dt>Identificador</dt><dd>${esc(row.id)}</dd></div>
  <div><dt>Primeiro dispositivo observado</dt><dd>${audienceDeviceSummary(observed.first_device)}</dd></div>
  <div><dt>Primeiro uso como PWA observado</dt><dd>${observed.pwa_first_observed_at?signupDate(observed.pwa_first_observed_at,signupFullTime):'Não observado'}</dd></div>
  <div><dt>Instalação sinalizada pelo navegador</dt><dd>${observed.pwa_native_confirmed_at?signupDate(observed.pwa_native_confirmed_at,signupFullTime):'Não confirmada pelo navegador'}</dd></div>
  <div><dt>Plataforma PWA</dt><dd>${esc(observed.pwa_os||'Não observada')}</dd></div>
  <div><dt>Sessões web observadas</dt><dd>${observed.web_visit_count==null?'—':esc(observed.web_visit_count)}</dd></div>
  <div><dt>Último dispositivo observado</dt><dd>${audienceDeviceSummary(observed.last_device)}</dd></div>
  <div><dt>Primeira origem / campanha observada</dt><dd>${audienceCampaignSummary(observed.first_campaign)}</dd></div>
  <div><dt>Última origem / campanha observada</dt><dd>${audienceCampaignSummary(observed.last_campaign)}</dd></div>
 </dl></details>`;
}
function acknowledgeSignups(cloud,account){
 if(!cloud.adminSignups||!account)return;
 if(signupVisit?.account!==account)signupVisit={account,batch:null,opening:null,filters:{},values:{}};
 const visit=signupVisit;
 if(visit.opening)return visit.opening;
 visit.opening=Promise.resolve().then(()=>cloud.adminSignups('open')).then(opened=>{
  if(signupVisit!==visit||cloud.user?.id!==account)return;
  if(opened.read_count>0){
   visit.batch=opened.batch;
   showSignupToast({count:opened.read_count,rows:opened.rows});
  }
 }).catch(()=>{visit.opening=null});
 return visit.opening;
}
async function mountAdminSignups(root,preview=false){
 const cloud=window.NeoCloud,account=cloud.user?.id;
 if(!root||!account||!cloud.adminSignups)return;
 const visit=signupVisit,current=()=>root.isConnected&&cloud.user?.id===account&&signupVisit===visit;
 root.innerHTML=`<section class="card">${adminSectionHeading(preview?'Cadastros recentes':'Cadastros','signups',
  preview?'<button type="button" class="primary" data-admin-tab="signups">Ver todos os usuários</button>'
   :'<button type="button" class="secondary" data-admin-tab="overview">Voltar à Visão Geral</button> <button type="button" class="secondary" data-signup-export>Exportar CSV</button>')}
  <form class="admin-signup-filters space">
   <label>Buscar nome ou e-mail<input name="query" type="search" maxlength="120"></label>
   <label>Exibir<select name="scope"><option value="all">Todos</option><option value="new">Novos</option></select></label>
   <label>De<input name="from" type="date"></label><label>Até<input name="until" type="date"></label>
   <button class="secondary" type="submit">Filtrar</button>
  </form>
  <p class="sub">Horário local (${esc(signupFullTime.resolvedOptions().timeZone)})</p>
  <p data-signup-status class="sub" role="status">Carregando cadastros…</p>
  <div data-signup-rows></div><button type="button" class="secondary space" data-signup-more hidden>Carregar mais</button>
 </section>`;

 const find=selector=>root.querySelector(selector);
 const form=find('form'),status=find('[data-signup-status]'),list=find('[data-signup-rows]');
 const more=find('[data-signup-more]');
 let sequence=0,cursor=null,filters=preview?{}:(visit?.filters||{});
 form.hidden=preview;
 if(!preview)for(const [key,value] of Object.entries(visit?.values||{})){
  const field=form.querySelector('[name='+key+']');if(field)field.value=value;
 }
 find('[data-signup-export]')?.addEventListener('click',async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  try{
   const rows=await signupExport(cloud,{...filters,p_batch:visit?.batch??null},current);
   if(rows)adminCsv('neopep-cadastros',rows);
  }catch(error){if(current())status.textContent=error.message||'Não foi possível exportar.'}
  finally{button.disabled=false}
 });
 async function load(next=false){
  const request=++sequence;
  more.disabled=true;
  status.textContent='Carregando cadastros…';
  try{
   const page=await cloud.adminSignups('page',{...filters,p_batch:visit?.batch??null,
    p_before:next?cursor?.created_at:null,p_before_id:next?cursor?.id:null});
   if(!current()||request!==sequence)return;
   const rows=page.rows.slice(0,preview?5:20);
   let observations={},geo={};
   if(!preview&&rows.length){
    const ids=rows.map(row=>row.id);
    const [a,b]=await Promise.allSettled([cloud.adminAudience?.({p_users:ids}),cloud.adminGeo?.(ids)]);
    observations=a.value||{};geo=b.value||{};
   }
   if(!current()||request!==sequence)return;
   cursor=rows.at(-1);
   if(!next)list.replaceChildren();
   list.insertAdjacentHTML('beforeend',rows.map(row=>preview?`<div class="admin-preview-user"><strong>${esc(row.full_name||'Nome não informado')}</strong><small>${esc(row.email||'E-mail não informado')}</small><time>${signupDate(row.created_at,signupShortTime)}</time></div>`:signupRow(row,observations?.[row.id],geo?.[row.id])).join(''));
   more.hidden=preview||page.rows.length<=20;
   status.textContent=rows.length?'':'Nenhum cadastro encontrado.';
  }catch{
   if(current()&&request===sequence)status.textContent='Não foi possível carregar os cadastros.';
  }finally{if(request===sequence)more.disabled=false}
 }
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const values=new FormData(form);
  const from=values.get('from'),until=values.get('until');
  if(from&&until&&from>until){status.textContent='Confira o intervalo selecionado.';return}
  const end=until?new Date(until+'T00:00:00'):null;
  if(end)end.setDate(end.getDate()+1);
  filters={p_query:values.get('query'),p_new:values.get('scope')==='new',
   p_from:from?new Date(from+'T00:00:00').toISOString():null,p_until:end?.toISOString()||null};
  if(visit){visit.filters=filters;visit.values=Object.fromEntries(values)}
  more.hidden=true;
  void load();
 });
 more.addEventListener('click',()=>void load(true));
 await visit?.opening;
 if(!current())return;
 void load();
}
const audienceLabels={mobile:'Celular',tablet:'Tablet',desktop:'Desktop',pwa:'PWA',browser:'Navegador'};
function audienceDeviceSummary(d){
 if(!d)return 'Não disponível';
 return esc([audienceLabels[d.category],d.os,d.browser&&[d.browser,d.major].filter(Boolean).join(' '),audienceLabels[d.context],
  signupDate(d.at,signupFullTime)].filter(Boolean).join(' · '));
}
function audienceCampaignSummary(c,escape=true){
 if(!c)return 'Não disponível';
 const value=[c.referrer,c.utm_source,c.utm_medium,c.utm_campaign,c.utm_content,c.utm_term,
  signupDate(c.at,signupFullTime)].filter(Boolean).join(' · ');
 return escape?esc(value):value;
}
function audienceChart(title,rows){
 const shown=rows.filter(row=>Number.isFinite(row.count));
 const max=Math.max(1,...shown.map(row=>row.count));
 return `<details class="audience-chart"><summary>${title}</summary>${
  shown.length?shown.map(row=>`<div class="audience-bar"><span>${esc(row.label)}</span>
   <meter value="${row.count}" max="${max}" aria-label="${esc(row.label)}"></meter><b>${row.count}${row.total?' · '+Math.round(row.count/row.total*100)+'%':''}</b></div>`).join('')
  :'<p class="sub">Dados insuficientes no período.</p>'}</details>`;
}
function mountAdminAudience(root,engagementOnly=false){
 const cloud=window.NeoCloud,account=cloud.user?.id;
 if(!root||!account||!(engagementOnly?cloud.adminEngagement:cloud.adminAudience))return;
 root.innerHTML=`<section class="card">${engagementOnly?'':adminSectionHeading('Estatísticas de público','audience','<button type="button" class="secondary" data-audience-export disabled>Exportar CSV</button>')}
  <form class="admin-signup-filters space"><label>Período<select name="window"><option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option><option value="custom">Personalizado</option></select></label>
  <label>De<input type="date" name="from"></label><label>Até<input type="date" name="to"></label><button type="submit" class="secondary">Aplicar</button></form>
  <p data-audience-message role="status" class="sub"></p><div data-audience-results></div><div data-engagement-report></div></section>`;
 const form=root.querySelector('form'),message=root.querySelector('[data-audience-message]'),results=root.querySelector('[data-audience-results]');
 let latest=null;
 const exportButton=root.querySelector('[data-audience-export]');
 exportButton?.addEventListener('click',()=>{
  if(!latest||!root.isConnected||cloud.user?.id!==account)return;
  const {d,kpis}=latest;
  adminCsv('neopep-estatisticas-publico',[
   ['Período inicial UTC',d.from],['Período final UTC',d.to],['Data da exportação',new Date().toISOString()],
   ['Início da coleta técnica',d.collection_started_at||'Não disponível'],
   ['Fonte','Supabase Auth, atividade registrada e observações autorizadas'],
   ['Definições','Ativos pelo último acesso; segmentos técnicos abaixo de cinco contas omitidos.'],
   ['Categoria','Indicador','Valor'],...kpis.map(([label,n])=>['Resumo',label,n]),
   ...d.daily.filter(x=>Number.isFinite(x.count)).map(x=>['Cadastros por dia',x.label,x.count]),
   ...d.monthly.filter(x=>Number.isFinite(x.count)).map(x=>['Cadastros por mês',x.label,x.count]),
   ...d.groups.map(x=>[x.kind,x.label,x.n])
  ]);
 });
 let sequence=0;
 async function load(windowDays=30,customFrom=null,customTo=null){
  const request=++sequence,today=new Date(),end=today.toISOString().slice(0,10);
  today.setUTCDate(today.getUTCDate()-windowDays+1);
  const from=customFrom||today.toISOString().slice(0,10),to=customTo||end;
  message.textContent='Carregando estatísticas…';
  if(engagementOnly){
   message.textContent='Período: '+from+' a '+to+' (UTC).';
   void mountEngagementReport(root.querySelector('[data-engagement-report]'),from,to);
   return;
  }
  latest=null;exportButton.disabled=true;
  try{
   const d=await cloud.adminAudience({p_from:from,p_to:to});
   if(request!==sequence||!root.isConnected||cloud.user?.id!==account)return;
   const kpis=[['Cadastros hoje (UTC)',d.today],['Cadastros em 7 dias',d.signups_7],['Cadastros em 30 dias',d.signups_30],
    ['Cadastros no período',d.period_signups],['Ativos em 24 h',d.active_1],['Ativos em 7 dias',d.active_7],['Ativos em 30 dias',d.active_30]];
   if(d.web_statistics)kpis.push(['Contas PWA observadas (janela de consentimento)',d.web_statistics.pwa_accounts],['Instalações sinalizadas (contas)',d.web_statistics.native_accounts],['Sessões web observadas',d.web_statistics.sessions]);
   const group=(kind,title)=>audienceChart(title,d.groups.filter(row=>row.kind===kind).map(row=>({label:audienceLabels[row.label]||row.label,count:row.n,total:row.visible_total})));
   results.innerHTML=`<div class="audience-kpis">${kpis.map(([label,count])=>`<div><small>${label}</small><strong>${count==null?'—':Number(count).toLocaleString('pt-BR')}</strong></div>`).join('')}</div>
   <p class="sub">Último acesso registrado: ${signupDate(d.last_access,signupFullTime)}.</p>
   <div class="audience-charts">${audienceChart('Cadastros por dia',d.daily)}${audienceChart('Cadastros por mês',d.monthly)}
   ${audienceChart('Último acesso no período', [{label:'Contas criadas no período',count:d.new_active},{label:'Contas anteriores',count:d.returning_active}])}
   ${group('device','Tipos de dispositivo')}${group('os','Sistemas operacionais')}${group('browser','Navegadores')}${group('context','PWA e navegador')}
   ${group('referral','Referências identificadas')}${group('campaign','Campanhas identificadas')}</div>
   <p class="sub">Dispositivos e campanhas usam observações autorizadas das contas cadastradas no período. PWA e sessões web são observações autenticadas com consentimento vigente, não o total de instalações ou visitantes anônimos. No iPhone, a abertura pelo ícone é a evidência observável. Grupos pequenos são omitidos, e os percentuais representam os grupos exibidos.</p>
   <p class="sub">Geografia: localização indisponível para os cadastros. Conversão, frequência e retenção dependem de dados adicionais.</p>`;
   message.textContent='Período: '+d.from+' a '+d.to+' (UTC).';
   latest={d,kpis};exportButton.disabled=false;
  }catch(error){
   if(request!==sequence||!root.isConnected||cloud.user?.id!==account)return;
   if(error.code==='42501')root.replaceChildren();
   else{results.replaceChildren();message.textContent='Não foi possível carregar as estatísticas para esse período.'}
  }
 }
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const values=new FormData(form),period=values.get('window');
  if(period==='custom'){
   const from=values.get('from'),to=values.get('to');
   if(!from||!to||from>to){message.textContent='Informe as datas do período personalizado.';return}
   void load(30,from,to);
  }else void load(Number(period));
 });
 void load();
}
const engagementAreaLabels={inicio:'Início',evolucao:'Evolução',registros:'Registros',diario:'Diário',aplicacoes:'Aplicações',
 protocolos:'Protocolos',calculadora:'Calculadora',relatorios:'Relatórios',calendario:'Calendário',lembretes:'Lembretes',
 fotos:'Fotos',perfil:'Perfil',comunidade:'Comunidade',loja:'Loja',suporte:'Atendimento',onboarding:'Onboarding'};
const engagementFormat=value=>value==null?'—':Number(value).toLocaleString('pt-BR');
const engagementDuration=value=>value==null?'—':Math.floor(value/60)+' min '+Math.round(value%60)+' s';
function engagementFunnel(f){
 const labels={evolution_view:'Abriu Evolução',weight_record_started:'Iniciou pesagem',weight_record_created:'Salvou pesagem',
  photos_view:'Abriu Fotos',photo_selected:'Selecionou outra foto',photo_comparison_started:'Abriu comparação',
  photo_comparison_export_success:'Acionou download',product_detail_view:'Abriu produto',cart_add:'Adicionou ao carrinho',
  checkout_started:'Iniciou checkout',order_created:'Pedido criado'};
 return `<details class="audience-chart"><summary>${esc(f.name)}</summary><ol>${f.steps.map((step,i)=>{
  const count=f.counts[i],previous=f.counts[i-1];
  const conversion=count!=null&&previous>0?Math.round(100*count/previous):null;
  return `<li>${esc(labels[step]||step)} · ${engagementFormat(count)}${conversion===null?'':` · ${conversion}% avançaram · ${100-conversion}% de abandono`}</li>`;
 }).join('')}</ol></details>`;
}
async function mountEngagementReport(root,from,to){
 const cloud=window.NeoCloud,account=cloud.user?.id;
 if(!root||!account||!cloud.adminEngagement)return;
 root.innerHTML='<section class="space"><h2>Engajamento por funcionalidade</h2><p role="status" data-engagement-progress>Carregando eventos…</p><div data-engagement-data></div></section>';
 const status=root.querySelector('[data-engagement-progress]'),data=root.querySelector('[data-engagement-data]');
 const current=()=>root.isConnected&&status.isConnected&&cloud.user?.id===account;
 const filters={p_from:from,p_to:to};
 try{
  const summary=await cloud.adminEngagement(filters);
  if(!current())return;
  status.textContent=summary.started_at?'Primeiro evento disponível: '+signupDate(summary.started_at,signupFullTime)+'.':'Nenhum evento de uso recebido.';
  const rate=summary.returning==null||!summary.users?null:Math.round(100*summary.returning/summary.users)+'%';
  const kpis=[['Usuários ativos',engagementFormat(summary.users)],['Sessões',engagementFormat(summary.sessions)],
   ['Tempo médio',engagementDuration(summary.mean)],['Mediana',engagementDuration(summary.median)],
   ['Áreas por sessão',engagementFormat(summary.areas)],['Usuários com retorno',rate||'—']];
  const options=summary.ranking.map(row=>`<option value="${esc(row.area)}">${esc(engagementAreaLabels[row.area]||row.area)}</option>`).join('');
  data.innerHTML=`<div class="audience-kpis">${kpis.map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('')}</div>
   <p class="sub">Somente contas que autorizaram medição. As sessões de retorno são observadas no próprio período. Áreas e etapas com menos de cinco contas são omitidas.</p>
   ${summary.ranking.length?`<div class="engagement-table" tabindex="0"><table><caption>Ranking por área</caption>
   <thead><tr><th>Área</th><th>Usuários</th><th>Acessos</th><th>Sessões</th><th>Tempo ativo</th><th>Ações concluídas</th><th>% ativos</th><th>Variação de usuários</th></tr></thead>
   <tbody>${summary.ranking.map(r=>`<tr><th>${esc(engagementAreaLabels[r.area]||r.area)}</th><td>${r.users}</td><td>${r.visits}</td><td>${r.sessions}</td>
    <td>${engagementDuration(r.active)}</td><td>${r.completed}</td><td>${Math.round(100*r.users/summary.users)}%</td>
    <td>${r.previous_users?Math.round(100*(r.users-r.previous_users)/r.previous_users)+'%':'—'}</td></tr>`).join('')}</tbody></table></div>
   <form data-engagement-compare class="admin-signup-filters space"><label>Área<select name="first">${options}</select></label>
   <label>Comparar com<select name="second"><option value="">Nenhuma</option>${options}</select></label><button class="secondary">Consultar</button></form>
   <div data-engagement-details aria-live="polite"></div>`:'<p class="sub">Nenhuma área com dados suficientes neste período.</p>'}
   <h3 class="space">Funis na mesma sessão</h3>${summary.funnels.length?summary.funnels.map(engagementFunnel).join(''):'<p class="sub">Ainda não há sequências suficientes para exibir funis.</p>'}`;
  const form=data.querySelector('[data-engagement-compare]');
  if(!form)return;
  const details=data.querySelector('[data-engagement-details]');
  let revision=0;
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const request=++revision,values=new FormData(form),first=values.get('first'),second=values.get('second');
   details.textContent='Carregando áreas…';
   try{
    const selected=[...new Set([first,second].filter(Boolean))];
    const reports=await Promise.all(selected.map(p_area=>cloud.adminEngagement({...filters,p_area})));
    if(!current()||request!==revision)return;
    details.innerHTML=reports.map((report,i)=>{
     const area=summary.ranking.find(r=>r.area===selected[i]);
     const funnelName={evolucao:'Evolução',fotos:'Fotografias',loja:'Loja'}[selected[i]];
     const funnel=report.funnels.find(row=>row.name===funnelName);
     return `<section class="space"><h3>${esc(engagementAreaLabels[selected[i]]||selected[i])}</h3>
      <p>${area.users} usuários · ${area.sessions} sessões · ${engagementDuration(area.active)} · ${engagementFormat(report.area_returning)} retornaram</p>
      <p class="sub">Usuários do período anterior: ${engagementFormat(area.previous_users)}</p>
      ${funnel?engagementFunnel(funnel):''}
      ${audienceChart('Acessos diários',report.days.map(d=>({label:d.day,count:d.n})))}
      ${audienceChart('Eventos mais frequentes',report.actions.map(a=>({label:a.event,count:a.n})))}
      ${audienceChart('Dispositivos e aquisição',report.dimensions.map(d=>({label:d.kind+' · '+d.label,count:d.n})))}</section>`;
    }).join('');
   }catch{if(current()&&request===revision)details.textContent='Não foi possível carregar os detalhes.'}
  });
 }catch{if(current())status.textContent='Não foi possível carregar o relatório de engajamento.'}
}
const healthSections=[
 ['overview','Visão consolidada'],['supabase','Supabase'],['vercel','Vercel'],['github','GitHub'],
 ['ai','IA · Consumo e custos'],['costs','Custos e capacidade'],['errors','Erros e segurança'],['history','Histórico e alertas']
];
const monitorNumber=value=>value==null?'Não disponível':Number(value).toLocaleString('pt-BR',{maximumFractionDigits:5});
function monitorBytes(value){
 if(value==null)return 'Não disponível';
 let size=Number(value),i=0;const names=['B','KiB','MiB','GiB','TiB'];
 while(size>=1024&&i<names.length-1){size/=1024;i++}
 return size.toLocaleString('pt-BR',{maximumFractionDigits:2})+' '+names[i];
}
function monitorMetric(label,value,explanation){
 return `<div class="monitor-metric"><small>${esc(label)}</small><strong>${esc(value??'Não disponível')}</strong>
 <details><summary aria-label="${esc('Sobre '+label)}">ⓘ</summary><p>${esc(explanation)}</p></details></div>`;
}
function monitorUnavailable(text){
 return `<p class="sub">${esc(text)}</p>`;
}
function monitorProjection(history,key,current,limit){
 if(history.length<3||current==null)return null;
 const first=history[0],last=history.at(-1),days=(Date.parse(last.day)-Date.parse(first.day))/86400000;
 if(days<7||first[key]==null||last[key]==null)return null;
 const daily=(last[key]-first[key])/days;
 return {daily,monthly:daily*30,forecast:[30,60,90].map(n=>Math.max(0,current+n*daily)),
  until:limit&&daily>0?Math.max(0,Math.ceil((limit-current)/daily)):null};
}
function monitorTable(head,rows){
 if(!rows.length)return monitorUnavailable('Ainda não há observações nessa fonte.');
 return `<div class="engagement-table" tabindex="0"><table><thead><tr>${head.map(x=>'<th>'+esc(x)+'</th>').join('')}</tr></thead>
 <tbody>${rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x??'—')+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;
}
function monitorLimitForm(){
 return `<form data-monitor-config="limit" class="admin-signup-filters space">
  <label>Recurso<select name="resource"><option value="database_bytes">Banco (bytes)</option><option value="storage_bytes">Storage (bytes)</option>
  <option value="egress_cached_bytes">Egress em cache (bytes)</option><option value="egress_uncached_bytes">Egress sem cache (bytes)</option>
  <option value="auth_mau">Usuários ativos mensais (Auth)</option><option value="realtime_messages">Mensagens Realtime</option>
  <option value="edge_invocations">Invocações Edge</option><option value="ai_budget_usd">Orçamento mensal IA (USD)</option><option value="ai_budget_brl">Orçamento mensal IA (BRL)</option></select></label>
  <label>Limite <input type="number" name="amount" min="0.00001" step="any" required></label>
  <label>Atenção (%)<input type="number" name="attention" value="70" min="1" max="100" required></label>
  <label>Alerta (%)<input type="number" name="warning" value="85" min="1" max="100" required></label>
  <label>Crítico (%)<input type="number" name="critical" value="95" min="1" max="100" required></label>
  <button class="secondary">Salvar limite</button></form>`;
}
function monitorCapacity(snapshot){
 const data=snapshot.data;
 return ['database_bytes','storage_bytes'].map(key=>{
  const title=key==='database_bytes'?'Banco PostgreSQL':'Storage';
  const limit=snapshot.limits.find(x=>x.resource===key);
  const used=key==='storage_bytes'&&data.storage_sized_objects<data.storage_objects?null:data[key];
  const pct=limit&&used!=null?used/limit.amount*100:null;
  const projection=monitorProjection(snapshot.history,key,used,limit?.amount);
  const severity=pct==null?'':pct>=limit.critical?'Crítico':pct>=limit.warning?'Alerta':pct>=limit.attention?'Atenção':'Dentro do limite informado';
  return `<section class="monitor-block"><h4>${title}</h4>
   ${monitorMetric('Consumo observado',monitorBytes(used),'Instantâneo técnico interno, sem dados de faturamento. Observe crescimento contínuo e compare com o limite informado.')}
   <p>${limit?'Limite informado pelo administrador: '+monitorBytes(limit.amount):'Limite ainda não informado.'}</p>
   ${pct==null?'':`<progress max="100" value="${Math.min(100,pct)}" aria-label="Percentual utilizado"></progress>
    <p>${monitorNumber(pct)}% · ${severity} · saldo ${monitorBytes(Math.max(0,limit.amount-used))}</p>`}
   <p class="sub">${projection?'Estimativa linear: '+projection.forecast.map((x,i)=>[(i+1)*30+' dias',monitorBytes(x)].join(' ')).join(' · ')+
    '. Crescimento médio: '+monitorBytes(projection.daily)+' por dia e '+monitorBytes(projection.monthly)+' por 30 dias.'+
    (projection.until==null?'':' Limite estimado em '+projection.until+' dias.'):'Histórico insuficiente para projeção.'}</p></section>`;
 }).join('');
}
function monitorAI(data){
 const kpis=[
  ['Chamadas',data.calls,'Chamadas que o adaptador conseguiu registrar no mês UTC.'],
  ['Concluídas',data.completed,'Respostas úteis retornadas pelo provedor.'],
  ['Erros',data.errors,'Falhas registradas no adaptador, sem conteúdo de resposta.'],
  ['Cancelamentos',data.cancelled,'Chamadas interrompidas antes da conclusão.'],
  ['Timeouts',data.timeouts,'Chamadas que excederam o tempo limite.'],
  ['Taxa de falhas',data.calls?monitorNumber(100*(data.errors+data.timeouts)/data.calls)+'%':null,'Erros e timeouts divididos por chamadas observadas. Confira a cobertura antes de interpretar.'],
  ['Duração média (ms)',data.average_ms,'Média no adaptador, em milissegundos.'],
  ['P50 / P95 / P99 (ms)',[data.p50,data.p95,data.p99].map(monitorNumber).join(' / '),'Percentis do mês, liberados somente com amostras suficientes.'],
  ['Tokens de entrada',data.input_tokens,'Entrada declarada pelo provedor. Cache pode estar incluído.'],
  ['Tokens de saída',data.output_tokens,'Saída declarada pelo provedor. O raciocínio pode estar incluído.'],
  ['Entrada em cache',data.cached_tokens,'Subconjunto informado como cache pelo provedor.'],
  ['Entrada sem cache',data.uncached_tokens,'Diferença entre entrada e cache apenas onde a cobertura está disponível.'],
  ['Raciocínio',data.reasoning_tokens,'Subconjunto informado separadamente. Não somado ao total.'],
  ['Tokens totais',data.total_tokens,'Total declarado pelos provedores. Não é a soma dos cartões.'],
  ['Tokens médios por chamada medida',data.average_tokens,'Média apenas de chamadas com total informado.'],
  ['Cache sobre entrada medida',data.measured_cache_input?monitorNumber(100*data.cached_tokens/data.measured_cache_input)+'%':null,
   'Tokens em cache divididos pela entrada das chamadas que informaram cache.']
 ];
 return `<p class="sub">Mês UTC desde ${esc(data.from)} · Fonte: chamadas registradas pelo adaptador de atendimento. ${data.metered}/${data.calls} com entrada medida e ${data.estimated_count} precificadas.</p>
  <div class="audience-kpis">${kpis.map(([label,n,note])=>monitorMetric(label,typeof n==='number'?monitorNumber(n):n,note)).join('')}</div>
  ${monitorTable(['Provedor','Modelo','Agente','Funcionalidade','Ambiente','Chamadas','Entrada','Saída','Total'],data.models.map(x=>[x.provider,x.model,x.agent_id,x.feature,x.environment,x.calls,x.input_tokens,x.output_tokens,x.total_tokens]))}
  ${monitorTable(['Moeda','Chamadas precificadas','Estimado','Sem cache (estimativa)','Economia estimada'],data.costs.map(x=>
   [x.currency,x.priced_calls,monitorNumber(x.estimated),monitorNumber(x.no_cache),monitorNumber(x.no_cache-x.estimated)]))}
  <h4>Custo diário estimado</h4>
  ${monitorTable(['Dia UTC','Moeda','Estimativa'],data.daily.map(x=>[x.day,x.currency,monitorNumber(x.estimated)]))}
  <h4>Preços versionados · OpenAI</h4>
  ${monitorTable(['Modelo','Vigência (UTC)','Moeda','Entrada / milhão','Saída / milhão','Cache / milhão'],
   data.prices.map(p=>[p.model,p.effective_from,p.currency,p.input_per_million,p.output_per_million,p.cached_per_million]))}
  <form data-monitor-config="price" class="admin-signup-filters space">
   <input type="hidden" name="provider" value="openai">
   <label>Modelo<input name="model" required maxlength="100"></label>
   <label>Vigência UTC<input name="effective_from" type="date" required></label>
   <label>Moeda<select name="currency"><option>USD</option><option>BRL</option></select></label>
   <label>Entrada / milhão<input name="input_per_million" type="number" min="0" step="any" required></label>
   <label>Saída / milhão<input name="output_per_million" type="number" min="0" step="any" required></label>
   <label>Cache / milhão<input name="cached_per_million" type="number" min="0" step="any"></label>
   <button class="secondary">Cadastrar preço</button>
  </form><p class="sub">Valores estimados pela tabela manual vigente no dia da observação. Faturamento, créditos e impostos dependem da fonte oficial do provedor.</p>`;
}
function mountSystemHealth(root,summary){
 const cloud=window.NeoCloud,account=cloud.user?.id;
 if(!root||!account)return;
 root.innerHTML=`<section class="card">${adminSectionHeading('Saúde e capacidade do sistema','system_health',
  '<button type="button" class="secondary" data-system-export>Exportar dados consultados (CSV)</button>')}
  <p data-system-status class="sub" role="status">Selecione uma fonte para consultar.</p>
  <div class="admin-overview">${healthSections.map(([id,title])=>`<details class="monitor-section" data-system-source="${id}">
   <summary>${title}</summary><div data-system-body></div></details>`).join('')}</div></section>`;
 const status=root.querySelector('[data-system-status]'),payloads=new Map(),jobs=new Map(),loaded=new Set();
 const current=()=>status.isConnected&&tab==='health'&&cloud.user?.id===account;
 let snapshot=null,snapshotJob=null,ai=null,aiJob=null;
 async function internal(){
  if(snapshot)return snapshot;
  snapshotJob??=cloud.adminSystem().then(value=>snapshot=value).finally(()=>snapshotJob=null);
  return snapshotJob;
 }
 async function aiData(){
  if(ai)return ai;
  aiJob??=cloud.adminSystem('ai').then(data=>ai=data).finally(()=>aiJob=null);
  return aiJob;
 }
 function saveRows(source,rows){payloads.set(source,rows)}
 async function load(part,body){
  if(loaded.has(part)||jobs.has(part))return;
  jobs.set(part,true);body.textContent='Consultando…';
  try{
   if(part==='github'||part==='vercel'){
    const data=await cloud.adminMonitor(part);
    if(!current())return;
    const build=window.NEO_CONFIG?.stagingBuild;
    if(part==='github'){
     const values=[['Branch',data.branch],['Último commit',data.commit],['Data do commit',data.date],['Autor público',data.author],
      ['Commits à frente da main',data.ahead],['Commits atrás da main',data.behind],['PRs abertos para staging',data.open_prs],
      ['Issues abertas (repositório)',data.open_issues],['Issues fechadas (repositório)',data.closed_issues],['Workflows (30 dias)',data.actions_30d],
      ['Sucessos na amostra',data.sampled_success],['Falhas na amostra',data.sampled_failures]];
     body.innerHTML=data.connected?'<div class="audience-kpis">'+values.map(([label,value])=>
      monitorMetric(label,value,'API pública ou leitura autorizada do GitHub. Workflows por resultado usam até 30 execuções recentes.')).join('')+'</div>':
      monitorUnavailable('Integração pendente. Confira acesso de leitura ao repositório ou o token no backend.');
     body.insertAdjacentHTML('beforeend',monitorUnavailable('Cotas, artefatos, minutos faturáveis e alertas de segurança dependem de credenciais e permissões específicas.'));
     saveRows(part,[['Atualização',data.observed_at],['Fonte','GitHub REST API'],...values]);
    }else{
     body.innerHTML=(build?monitorMetric('Build em execução',build.commit,'Metadados do build Vercel de homologação em '+build.builtAt+'. Branch '+build.branch+'.'):'')+
      (data.connected?monitorTable(['Estado','Criação','Branch','Commit','Duração (ms)'],data.deployments.map(row=>
       [row.state,row.created?new Date(row.created).toISOString():null,row.branch,row.commit,row.build_ms])):
       monitorUnavailable('Histórico de deploys pendente. Configure uma fonte de leitura para o ambiente.'))+
      monitorUnavailable('Tráfego, egress, invocações, latência e faturamento aguardam fonte oficial de consumo.');
     saveRows(part,[['Atualização',data.observed_at],['Fonte',data.connected?'Vercel REST API de homologação':'Metadados do build'],
      ...(build?[['Build',build.commit,build.branch,build.builtAt]]:[]),
      ...(data.deployments||[]).map(row=>[row.state,row.created?new Date(row.created).toISOString():null,row.branch,row.commit,row.build_ms])]);
    }
   }else if(part==='ai'){
    const data=await aiData();
    if(!current())return;
    body.innerHTML=monitorAI(data);
    saveRows(part,[['Fonte','Telemetria interna do adaptador de atendimento'],['Mês UTC',data.from],['Atualização',data.observed_at],
     ...Object.entries(data).filter(([,v])=>typeof v==='number'),['Moeda','Chamadas precificadas','Estimativa','Estimativa sem cache'],
     ...data.costs.map(x=>[x.currency,x.priced_calls,x.estimated,x.no_cache]),
     ...data.daily.map(x=>[x.day,x.currency,x.estimated]),...data.models.map(x=>[x.provider,x.model,x.agent_id,x.feature,x.environment,x.calls,x.input_tokens,x.output_tokens,x.total_tokens])]);
   }else{
    const result=await internal(),d=result.data;
    if(!current())return;
    const stamp=`<p class="sub">Observação: ${signupDate(result.observed_at,signupFullTime)} · PostgreSQL e eventos internos</p>`;
    if(part==='overview'){
     body.innerHTML=stamp+'<div class="audience-kpis">'+[
      ['Banco',monitorBytes(d.database_bytes),'Tamanho efetivo do PostgreSQL no momento da amostra.'],
      ['Storage com tamanho informado',monitorBytes(d.storage_bytes),'Soma de metadados de objetos; não mede transferência ou operações.'],
      ['Consulta administrativa',summary.database_status==='reachable'?'Respondeu':'Não disponível','Resultado da consulta desta sessão, sem teste de disponibilidade completo.'],
      ['Bucket privado',summary.private_storage===true?'Confirmado':'Não confirmado','Configuração detectada pela consulta administrativa.'],
      ['Schema informado',summary.schema_version,'Versão declarada pelo resumo administrativo do aplicativo.'],
      ['Servidor',summary.server_time,'Horário da consulta do resumo administrativo.']
     ].map(args=>monitorMetric(...args)).join('')+'</div>';
     saveRows(part,[['Fonte','Resumo administrativo e amostra interna'],['Amostra',result.observed_at],['Banco em bytes',d.database_bytes],
      ['Storage em bytes',d.storage_bytes],['Banco respondeu',summary.database_status],['Schema informado',summary.schema_version]]);
    }else if(part==='supabase'){
     body.innerHTML=stamp+`<details class="monitor-block"><summary>Banco de dados</summary><div class="audience-kpis">
      ${monitorMetric('Tamanho do banco',monitorBytes(d.database_bytes),'Bytes medidos por pg_database_size. Inclui tabelas e índices.')}
      ${monitorMetric('Conexões / máximo PostgreSQL',d.connections+' / '+d.connection_max,'Backends de cliente no momento da amostra. O máximo configurado não é a franquia ou a capacidade do pool.')}</div>
      ${monitorTable(['Schema','Relação','Total','Índices'],d.relations.map(x=>[x.schema_name,x.relation,monitorBytes(x.bytes),monitorBytes(x.index_bytes)]))}</details>
      <details class="monitor-block"><summary>Armazenamento</summary><div class="audience-kpis">
      ${monitorMetric('Objetos',monitorNumber(d.storage_objects),'Contagem de objetos do Storage, sem listar arquivos.')}
      ${monitorMetric('Cobertura de tamanho',d.storage_sized_objects+' / '+d.storage_objects,'Objetos com tamanho válido em metadata do Storage. A cobertura incompleta não é usada para calcular saldo.')}
      ${monitorMetric('Tamanho médio medido',d.storage_sized_objects?monitorBytes(d.storage_bytes/d.storage_sized_objects):null,'Média apenas dos objetos com tamanho informado.')}</div>
      ${monitorTable(['Bucket','Objetos','Com tamanho','Bytes medidos'],d.buckets.map(x=>[x.bucket,x.objects,x.sized_objects,x.bytes]))}
      <p class="sub">Transferência e operações dependem da fonte oficial.</p></details>
      <details class="monitor-block"><summary>Autenticação</summary><div class="audience-kpis">
      ${monitorMetric('Usuários cadastrados',monitorNumber(summary.users_total),'Contagem de contas no resumo administrativo, independente do faturamento.')}
      ${monitorMetric('Novos em 7 dias',monitorNumber(summary.signups_7d),'Cadastros criados nos últimos sete dias.')}
      ${monitorMetric('Ativos em 30 dias',monitorNumber(summary.active_30d),'Contas com atividade autenticada registrada recentemente.')}</div></details>
      <details class="monitor-block"><summary>Realtime</summary><p>Não conectado à fonte de consumo.</p></details>
      <details class="monitor-block"><summary>Edge Functions</summary><p>Não conectado à fonte de consumo.</p></details>`;
     saveRows(part,[['Fonte','PostgreSQL e metadados do Storage'],['Amostra',result.observed_at],['Banco bytes',d.database_bytes],
      ['Conexões',d.connections],['Máximo PostgreSQL',d.connection_max],['Usuários cadastrados',summary.users_total],['Novos em 7 dias',summary.signups_7d],
      ...d.buckets.map(x=>[x.bucket,x.objects,x.sized_objects,x.bytes]),...d.relations.map(x=>[x.schema_name,x.relation,x.bytes,x.index_bytes])]);
    }else if(part==='costs'){
     body.innerHTML=stamp+'<h4>Capacidade dos planos</h4>'+monitorCapacity(result)+
      '<p class="sub">Plano Free da organização, verificado em 21/11/2026. Franquias oficiais de referência, sem preenchimento automático de limites.</p>'+
      monitorTable(['Recurso','Franquia oficial Free'],[['Banco','500 MB por projeto'],['Storage','1 GB'],['Egress','5 GB em cache e 5 GB sem cache'],
       ['Auth','50.000 MAU'],['Realtime','2 milhões de mensagens e pico de 200 conexões'],['Edge Functions','500.000 invocações']])+
      '<p class="sub"><a href="https://supabase.com/docs/guides/platform/billing-on-supabase" target="_blank" rel="noopener noreferrer">Fonte oficial das franquias</a></p>'+
      monitorTable(['Limite informado','Valor'],result.limits.map(x=>[x.resource,monitorNumber(x.amount)]))+monitorLimitForm()+
      monitorUnavailable('Faturas de Supabase, Vercel e GitHub aguardam conexão oficial. Valores com moedas diferentes ficam separados.');
     try{
      const a=await aiData();if(!current())return;
      body.insertAdjacentHTML('beforeend',monitorTable(['Moeda IA','Orçamento manual','Estimativa observada','Saldo estimado','Uso estimado','Projeção do mês'],
       ['USD','BRL'].map(currency=>{
        const budget=a.budgets.find(x=>x.resource==='ai_budget_'+currency.toLowerCase());
        const cost=a.costs.find(x=>x.currency===currency);
        const complete=cost&&cost.priced_calls===a.calls;
        const days=a.daily.filter(x=>x.currency===currency).length;
        const now=new Date(a.observed_at),daysInMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).getUTCDate();
        const monthly=complete&&days>=7?cost.estimated/now.getUTCDate()*daysInMonth:null;
        return [currency,budget?monitorNumber(budget.amount):null,cost?monitorNumber(cost.estimated):null,
         budget&&complete?monitorNumber(budget.amount-cost.estimated):null,
         budget&&complete?monitorNumber(100*cost.estimated/budget.amount)+'%':null,monthly==null?null:monitorNumber(monthly)];
       }))+monitorUnavailable('Projeção linear do mês quando há estimativa completa e sete dias de observações. Sem bloqueio automático.'));
     }catch{}
     saveRows(part,[['Amostra',result.observed_at],['Fonte dos limites','Informado pelo administrador'],['Recurso','Limite','Consumo','Percentual','Atenção','Alerta','Crítico'],
      ...result.limits.map(x=>{const amount=x.resource==='storage_bytes'&&d.storage_sized_objects<d.storage_objects?null:d[x.resource];
       return [x.resource,x.amount,amount,amount==null?null:amount/x.amount*100,x.attention,x.warning,x.critical]})]);
    }else if(part==='errors'){
     const labels={sync_failed:'Sincronização',photo_failed:'Fotografias e armazenamento',profile_failed:'Perfil e registros',import_failed:'Importação'};
     body.innerHTML=stamp+monitorMetric('Relatos em 7 dias',monitorNumber(d.errors.reduce((sum,item)=>sum+Number(item.total||0),0)),
      'Soma dos códigos seguros enviados pelo aplicativo. Um relato pode representar uma falha de rede ou do aplicativo. Sem denominador de operações.')+
      monitorTable(['Categoria','7 dias','7 dias anteriores','Último dia UTC'],d.errors.map(x=>[labels[x.code]||x.code,x.total,x.previous,x.last_day]))+
      audienceChart('Erros por dia',d.errors_daily.map(x=>({label:x.day,count:x.total})))+
      monitorUnavailable('Falhas de autenticação, acesso negado, políticas e segurança dependem de uma fonte autorizada de logs. Uma falha isolada não implica abuso.');
     saveRows(part,[['Fonte','Relatos internos do app'],['Amostra',result.observed_at],...d.errors.map(x=>[x.code,x.total,x.previous,x.last_day]),
      ...d.errors_daily.map(x=>[x.day,x.total])]);
    }else if(part==='history'){
     const scheduled=await cloud.adminSystem('scheduled_status').catch(()=>null);
     if(!current())return;
     body.innerHTML=(scheduled?monitorTable(['Amostragem agendada','Resultado'],scheduled.runs.map(x=>[signupDate(x.occurred_at,signupFullTime),x.outcome])):'')+stamp+monitorTable(['Dia UTC','Banco','Storage medido'],result.history.slice(-14).map(x=>[x.day,monitorBytes(x.database_bytes),monitorBytes(x.storage_bytes)]))+
      monitorTable(['Dia UTC','Recurso','Severidade','Consumo (%)'],result.alerts.map(x=>[x.day,x.resource,x.severity,monitorNumber(x.used_pct)]))+
      monitorUnavailable('Amostras e alertas são atualizados sob demanda. O histórico agrupa alertas por dia, recurso e severidade.');
     saveRows(part,[['Amostra',result.observed_at],['Fonte','PostgreSQL, metadados Storage e limites manuais'],...(scheduled?.runs||[]).map(x=>[x.occurred_at,x.outcome]),
      ...result.history.map(x=>[x.day,x.database_bytes,x.storage_bytes]),...result.alerts.map(x=>[x.day,x.resource,x.severity,x.used_pct])]);
    }
   }
   if(current()){loaded.add(part);status.textContent='Dados disponíveis nas seções consultadas.'}
  }catch{
   if(current())body.innerHTML=monitorUnavailable('Fonte indisponível ou integração pendente. Feche e reabra para tentar novamente.');
  }finally{jobs.delete(part)}
 }
 for(const details of root.querySelectorAll('[data-system-source]'))details.addEventListener('toggle',()=>{
  if(details.open)void load(details.dataset.systemSource,details.querySelector('[data-system-body]'));
 });
 root.querySelector('[data-system-export]').addEventListener('click',()=>{
  if(!current())return;
  if(!payloads.size){status.textContent='Abra uma fonte antes de exportar.';return}
  adminCsv('neopep-saude-sistema',[['Gerado em',new Date().toISOString()],
   ...[...payloads].flatMap(([section,rows])=>[['Seção',section],...rows,[]])]);
 });
 root.addEventListener('submit',async event=>{
  const form=event.target,action=form.dataset.monitorConfig;
  if(!action)return;
  event.preventDefault();
  const button=form.querySelector('button');button.disabled=true;
  try{
   const payload=Object.fromEntries(new FormData(form));
   for(const key of Object.keys(payload))if(payload[key]==='')payload[key]=null;
   await cloud.adminSystem(action,payload);
   if(!current())return;
   const part=action==='price'?'ai':'costs';
   if(part==='ai')ai=null;else snapshot=null;
   loaded.delete(part);
   status.textContent='Configuração registrada.';
   const body=root.querySelector('[data-system-source='+part+'] [data-system-body]');
   void load(part,body);
  }catch{if(current())status.textContent='Não foi possível salvar. Confira os valores e a vigência.'}
  finally{button.disabled=false}
 });
}
const operationsSections=[
 ['executive','Resumo executivo'],['journeys','Jornadas e retenção'],['quality','Qualidade da experiência'],
 ['routines','Rotinas agendadas'],['audit','Auditoria administrativa'],['capacity','Simulador de crescimento'],
 ['efficiency','Eficiência e custo por funcionalidade'],['insights','Oportunidades e recomendações']
];
const qualityLabels={web_lcp:'LCP (ms)',web_cls:'CLS × 1.000',web_inp:'INP (ms)',initial_load:'Carregamento inicial',sync_response:'Resposta da sincronização',
 sync_failure:'Falha de sincronização',upload_failure:'Falha de upload',javascript_error:'Erro JavaScript',pwa_update_failure:'Falha do service worker'};
const percent=value=>value==null?'—':monitorNumber(value)+'%';
function operationScenarios(h,price,limits){
 const n=x=>Number(h[x]||0);
 const fixed=h.fixed===''||h.fixed==null?null:n('fixed');
 const trafficPrice=h.transfer_price===''||h.transfer_price==null?null:n('transfer_price');
 const apiPrice=h.api_price===''||h.api_price==null?null:n('api_price');
 return [1000,5000,10000,50000,100000].map(users=>{
  const next=Math.round(users*(1+n('growth')/100)),active=next*n('active')/100;
  const sessions=active*n('sessions'),uploads=active*n('uploads'),ai=active*n('ai'),api=active*n('api');
  const uploaded=uploads*n('upload_mib')/1024;
  const stored=next*n('stored_mib')/1024+uploaded,traffic=sessions*n('traffic_mib')/1024+uploaded;
  const inputs=ai*n('input_tokens'),outputs=ai*n('output_tokens');
  const aiCost=ai===0?0:price?(inputs*Number(price.input_per_million)+outputs*Number(price.output_per_million))/1000000:null;
  const compatible=!price||price.currency===h.currency;
  const variable=compatible&&aiCost!=null&&(traffic===0||trafficPrice!==null)&&(api===0||apiPrice!==null)?
   aiCost+traffic*(trafficPrice??0)+api/1000*(apiPrice??0):null;
  const storageLimit=limits.find(x=>x.resource==='storage_bytes');
  return {users,next,active,sessions,uploads,stored,traffic,ai,api,inputs,outputs,aiCost,
   variable,total:variable===null||fixed===null?null:variable+fixed,
   storagePct:storageLimit?stored*1024**3/Number(storageLimit.amount)*100:null};
 });
}
function operationForm(prices){
 const fields=[
  ['active','Usuários ativos (%)',30,100],['sessions','Sessões / ativo',8,100000],
  ['stored_mib','Storage inicial (MiB / conta)',10,1000000],['uploads','Uploads / ativo / mês',2,100000],
  ['upload_mib','Tamanho de upload (MiB)',1,1000000],['traffic_mib','Transferência por sessão (MiB)',4,1000000],
  ['ai','Chamadas de IA / ativo',0,100000],['input_tokens','Tokens de entrada / chamada',0,10000000],
  ['output_tokens','Tokens de saída / chamada',0,10000000],['api','Chamadas de API / ativo',20,1000000],
  ['growth','Crescimento mensal (%)',0,1000]
 ];
 return `<form data-operation-sim class="admin-signup-filters space">${fields.map(([key,label,value,max])=>
  `<label>${label}<input type="number" min="0" max="${max}" step="any" name="${key}" value="${value}" required></label>`).join('')}
  <label>Preço de IA configurado<select name="price"><option value="">Nenhum</option>${prices.map((x,i)=>
   `<option value="${i}">${esc(x.model+' · '+x.currency+' · '+x.effective_from)}</option>`).join('')}</select></label>
  <label>Moeda das hipóteses<select name="currency"><option>BRL</option><option>USD</option></select></label>
  <label>Preço de transferência / GiB<input type="number" min="0" step="any" name="transfer_price"></label>
  <label>Preço de API / mil<input type="number" min="0" step="any" name="api_price"></label>
  <label>Custo fixo mensal informado<input type="number" min="0" step="any" name="fixed"></label>
  <button class="secondary">Simular</button></form><div data-scenario-result></div>`;
}
const operationRules={
 storage_growth:{title:'Revisar o crescimento do Storage',impact:'O consumo pode exigir mais capacidade.',action:'Verifique compressão de uploads e retenção de arquivos.',
  reliability:'Amostras completas de Storage, com pelo menos três medições em sete dias.'},
 app_errors_growth:{title:'Investigar o aumento de erros reportados',impact:'Falhas repetidas podem prejudicar o uso do aplicativo.',
  action:'Compare as categorias de erros e reproduza os fluxos mais afetados.',reliability:'Contagem de relatos do app, sem denominador de operações.'}
};
function mountOperations(root,summary){
 const cloud=window.NeoCloud,account=cloud.user?.id;
 root.innerHTML=`<section class="card"><h2>Inteligência operacional</h2><label>Período dos relatórios
  <select data-operations-days><option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option></select></label>
  <p data-operations-status role="status" class="sub">Abra um relatório para consultar.</p>
  <div class="admin-overview">${operationsSections.map(([key,title])=>
   `<details data-operation-section="${key}" class="monitor-section"><summary>${title}</summary><div data-operation-body></div></details>`).join('')}</div></section>`;
 const status=root.querySelector('[data-operations-status]'),range=root.querySelector('[data-operations-days]');
 const current=()=>status.isConnected&&cloud.user?.id===account&&tab==='operations';
 let revision=0;
 const loaded=new Set(),inFlight=new Map();
 let engagement=null,system=null,ai=null,journeys=null,insights=null;
 const get=(section,days)=>cloud.adminOperations(section,days);
 const getEngagement=days=>{
  if(engagement?.days===days)return engagement.promise;
  const to=new Date(),from=new Date(to);
  from.setUTCDate(to.getUTCDate()-days+1);
  engagement={days,promise:cloud.adminEngagement({p_from:from.toISOString().slice(0,10),p_to:to.toISOString().slice(0,10)})};
  return engagement.promise;
 };
 async function load(node){
  const key=node.dataset.operationSection,sequence=revision,body=node.querySelector('[data-operation-body]'),days=Number(range.value);
  if(loaded.has(key)||inFlight.get(key)===sequence)return;
  inFlight.set(key,sequence);
  body.textContent='Consultando…';
  try{
   if(!cloud.adminOperations)throw Error('Fonte indisponível');
   const valid=()=>current()&&sequence===revision;
   let stamp=null;
   if(key==='journeys'){
    const [d,funnels]=await Promise.allSettled([journeys??=get('journeys',days),getEngagement(days)]);
    if(!valid())return;
    if(d.status!=='fulfilled')throw Error('Fonte indisponível');
    const report=d.value;stamp=report.observed_at;
    const f=report.frequency;
    body.innerHTML=`<p class="sub">Atividade é uso registrado com autorização válida. A jornada inclui contas observadas no dia UTC do cadastro. Os marcos são independentes, exceto checkout após visita. Uma etapa ainda sem observação não confirma abandono.</p>
    ${monitorTable(['Marco','Contas elegíveis','Observaram o marco','Sem marco observado','Tempo médio'],report.milestones.map(x=>
     [x.label,x.started,x.reached,x.reached==null?null:percent(100*(x.started-x.reached)/x.started),engagementDuration(x.avg_seconds)]))}
    <p class="sub">D1, D7 e D30 representam retorno no dia exato. Janela semanal: dias 7 a 13. Janela mensal: dias 30 a 59. Janelas imaturas e grupos pequenos ficam sem valor.</p>
    ${monitorTable(['Coorte semanal UTC','Contas','D1','D7','D30','Janela semanal','Janela mensal'],report.cohorts.map(x=>[x.cohort,x.accounts,
      ...['d1','d7','d30','weekly','monthly'].map(k=>percent(x[k]))]))}
    ${monitorTable(['Usuários','Sessões','Sessões por conta','Intervalo médio','Novos','Recorrentes','Reativados','Sem acesso anterior observado'],
     [[f.users,f.sessions,f.sessions_per_user,engagementDuration(f.avg_gap_seconds),f.new,f.recurring,f.reactivated,f.unknown]])}
    <p class="sub">Reativação requer intervalo observado de 30 dias ou mais. Sessões anteriores ao histórico disponível não são estimadas.</p>
    ${(funnels.value?.funnels||[]).map(engagementFunnel).join('')}`;
   }else if(key==='quality'){
    const d=await get('quality',days);if(!valid())return;stamp=d.observed_at;
    body.innerHTML=`<p class="sub">Amostras consentidas e limitadas por conta. P75 das amostras. LCP e INP em milissegundos. CLS foi multiplicado por 1.000. A categoria pode aparecer quando houver pelo menos cinco contas. Navegador e sistema usam a última observação autorizada da conta.</p>
    ${monitorTable(['Métrica','Amostras','Contas','Média','P75'],d.metrics.map(x=>[qualityLabels[x.metric]||x.metric,x.samples,x.users,x.avg_ms,x.p75_ms]))}
    ${monitorTable(['Falha','Dimensão','Grupo','Amostras'],d.segments.map(x=>[qualityLabels[x.metric]||x.metric,x.kind,x.label,x.samples]))}`;
   }else if(key==='routines'){
    const d=await get('routines',days);if(!valid())return;stamp=d.observed_at;
    body.innerHTML=(d.source_available?monitorTable(['Rotina','Cron','Ativa','Última execução','Resultado','Duração (s)','Falhas no período','Último sucesso','Próxima execução estimada','Atraso observado'],d.jobs.map(j=>{
     const interval={'* * * * *':1,'*/5 * * * *':5}[j.schedule];
     const measured=Date.parse(d.observed_at);
     const late=interval&&j.active&&j.last_success&&(measured-Date.parse(j.last_success))>interval*180000;
     const next=interval&&j.active&&Number.isFinite(measured)?new Date((Math.floor(measured/(interval*60000))+1)*interval*60000):null;
     return [j.job,j.schedule,j.active?'Sim':'Não',j.last_started?signupDate(j.last_started,signupFullTime):'Execução não registrada',
      j.last_status,j.last_seconds,j.failures,j.last_success?signupDate(j.last_success,signupFullTime):null,next?signupDate(next,signupFullTime):null,late?'Atenção: três intervalos decorridos':null];
    })):monitorUnavailable('O pg_cron não está disponível neste ambiente. Nenhuma execução é inferida.'))+
    '<p class="sub">O repositório contém exemplos para neo-ai-worker e neo-staging-push-fallback. A presença no código não confirma agendamento. Nenhuma rotina é disparada pelo painel.</p>';
   }else if(key==='audit'){
    const d=await get('audit',days);if(!valid())return;stamp=d.observed_at;
    body.innerHTML=monitorTable(['Ocorrência','Responsável','Ação','Operação','Recurso','Resultado'],
     d.entries.map(x=>[signupDate(x.occurred_at,signupFullTime),x.actor,x.action,x.operation,x.resource,'Efetivada']))+
     '<p class="sub">Últimas 100 alterações confirmadas em tabelas auditadas. Operações fora dessas tabelas não entram neste relatório.</p>';
   }else if(key==='capacity'){
    const [s,a]=await Promise.allSettled([system??=cloud.adminSystem(),ai??=cloud.adminSystem('ai')]);if(!valid())return;
    const now=new Date().toISOString().slice(0,10),usedModels=new Set();
    const prices=(a.value?.prices||[]).filter(x=>{
     if(x.effective_from>now||usedModels.has(x.model))return false;
     usedModels.add(x.model);return true;
    });
    const limits=s.value?.limits||[];
    body.innerHTML='<p class="sub">Hipóteses editáveis para o próximo mês. Storage soma estoque inicial e uploads planejados. O tráfego considera sessões e uploads. Preços de transferência e API são hipóteses manuais.</p>'+operationForm(prices);
    body.querySelector('form').addEventListener('submit',event=>{
     event.preventDefault();const form=event.currentTarget;
     if(!form.reportValidity())return;
     const fields=Object.fromEntries(new FormData(form)),price=fields.price===''?null:prices[Number(fields.price)];
     const rows=operationScenarios(fields,price,limits);
     body.querySelector('[data-scenario-result]').innerHTML=monitorTable(['Cenário','Próximo mês','Ativos','Sessões','Uploads','Storage (GiB)','Tráfego (GiB)',
      'API','Chamadas IA','Tokens entrada / saída','Custo IA','Variável','Total','Limite Storage'],
      rows.map(x=>[x.users,x.next,monitorNumber(x.active),monitorNumber(x.sessions),monitorNumber(x.uploads),monitorNumber(x.stored),monitorNumber(x.traffic),
       monitorNumber(x.api),monitorNumber(x.ai),monitorNumber(x.inputs)+' / '+monitorNumber(x.outputs),
       x.aiCost==null?null:(price?.currency||fields.currency)+' '+monitorNumber(x.aiCost),x.variable==null?null:fields.currency+' '+monitorNumber(x.variable),
       x.total==null?null:fields.currency+' '+monitorNumber(x.total),percent(x.storagePct)]));
    });
   }else if(key==='insights'){
    const d=await (insights??=get('insights',days));if(!valid())return;stamp=d.observed_at;
    body.innerHTML=adminSectionHeading('Oportunidades e recomendações','operations_insights')+
     (d.recommendations.length?d.recommendations.map(x=>{
      const rule=operationRules[x.rule];if(!rule)return '';
      return `<section class="monitor-block"><h4>${rule.title}</h4><p>${esc(x.evidence_period)} · ${esc(x.unit==='bytes'?
       monitorBytes(x.baseline)+' → '+monitorBytes(x.measured):monitorNumber(x.baseline)+' → '+monitorNumber(x.measured)+' relatos')}</p>
      <p>${rule.reliability}</p><p>${rule.impact} ${rule.action}</p><label>Estado
       <select data-operation-review="${esc(x.rule)}" data-period="${esc(x.evidence_period)}">${Object.entries({new:'Nova',review:'Em análise',resolved:'Resolvida',dismissed:'Descartada'})
       .map(([k,v])=>`<option value="${k}" ${x.state===k?'selected':''}>${v}</option>`).join('')}</select></label></section>`;
     }).join(''):monitorUnavailable('Nenhuma recomendação com evidência suficiente.'));
    body.addEventListener('change',async event=>{
     const select=event.target;
     if(!select.matches('[data-operation-review]'))return;
     const found=d.recommendations.find(x=>x.rule===select.dataset.operationReview&&x.evidence_period===select.dataset.period);
     if(!found)return;
     select.disabled=true;
     try{await cloud.adminOperations('review',days,{rule:found.rule,period:found.evidence_period,state:select.value});found.state=select.value;if(valid())status.textContent='Estado atualizado.'}
     catch{if(valid()){select.value=found.state;status.textContent='Não foi possível salvar o estado.'}}
     finally{select.disabled=false}
    },{once:false});
   }else {
    const [e,s,a,j]=await Promise.allSettled([getEngagement(days),system??=cloud.adminSystem(),ai??=cloud.adminSystem('ai'),
     key==='executive'?(journeys??=get('journeys',days)):Promise.resolve(null)]);
    if(!valid())return;
    const engagementData=e.value,systemData=s.value,aiData=a.value,journeyData=j.value;
    if(key==='efficiency'){
     body.innerHTML=monitorTable(['Área','Usuários','Acessos','Tempo ativo'],(engagementData?.ranking||[]).map(x=>[
      engagementAreaLabels[x.area]||x.area,x.users,x.visits,engagementDuration(x.active)]))+
      monitorTable(['Custo direto','Moeda','Estimativa no mês UTC','Por chamada precificada'],(aiData?.costs||[]).map(x=>
       ['IA de atendimento',x.currency,monitorNumber(x.estimated),x.priced_calls?monitorNumber(x.estimated/x.priced_calls):null]))+
      '<p class="sub">As fontes usam períodos e denominadores próprios. Infraestrutura compartilhada não é rateada. Custos de IA são estimativas para chamadas com preço disponível.</p>';
    }else{
     const mature=(journeyData?.cohorts||[]).findLast(x=>x.d7!=null);
     const growth=systemData?monitorProjection(systemData.history,'database_bytes',systemData.data.database_bytes):null;
     const rows=[
      ['Contas cadastradas',summary.users_total,'Auth','Total'],['Cadastros novos',summary.signups_7d,'Auth','7 dias'],
      ['Usuários observados',engagementData?.users,'Engajamento consentido',days+' dias'],
      ['Retenção D7 da coorte madura mais recente',mature?percent(mature.d7):null,'Eventos consentidos',mature?.cohort||'Coortes na janela'],
      ['Erros reportados',systemData?.data?.errors?.reduce((n,x)=>n+Number(x.total||0),0),'Relatos do app','7 dias'],
      ['Banco (bytes)',systemData?.data?.database_bytes,'PostgreSQL','Última amostra'],
      ['Crescimento médio do banco (bytes/dia)',growth?monitorNumber(growth.daily):null,'Amostras do PostgreSQL','Histórico disponível'],
      ['Storage (bytes medidos)',systemData?.data?.storage_bytes,'Metadados de objetos','Última amostra'],
      ['Alertas armazenados',systemData?.alerts?.length,'Limites manuais','Últimos 100 alertas'],
      ...((aiData?.costs||[]).map(x=>['IA estimada '+x.currency,x.estimated,'Tabela manual','Mês UTC']))
     ];
     body.innerHTML=monitorTable(['Indicador','Valor','Fonte','Período'],rows)+
      `<p class="sub">${systemData?'Amostra de saúde: '+esc(signupDate(systemData.observed_at,signupFullTime)):'Amostra de saúde indisponível.'}</p>
       <button type="button" class="secondary" data-operations-export>Exportar CSV</button> <button type="button" class="secondary" data-executive-print>Imprimir / salvar PDF</button>`;
     body.querySelector('[data-executive-print]').addEventListener('click',()=>{if(valid())window.print?.()});
     body.querySelector('[data-operations-export]').addEventListener('click',()=>{
      if(valid())adminCsv('neopep-resumo-operacional',[['Gerado',new Date().toISOString()],['Amostra de saúde',systemData?.observed_at],
       ['Indicador','Valor','Fonte','Período'],...rows]);
     });
    }
   }
   if(stamp)body.insertAdjacentHTML('beforeend',`<p class="sub">Consultado em ${esc(signupDate(stamp,signupFullTime))} · Janela selecionada: ${days} dias UTC.</p>`);
   loaded.add(key);
  }catch{if(current()&&sequence===revision)body.textContent='Fonte indisponível. Feche e reabra para tentar novamente.'}
  finally{if(inFlight.get(key)===sequence)inFlight.delete(key)}
 }
 for(const node of root.querySelectorAll('[data-operation-section]'))node.addEventListener('toggle',()=>{if(node.open)void load(node)});
 range.addEventListener('change',()=>{
  revision++;loaded.clear();inFlight.clear();journeys=null;insights=null;
  for(const node of root.querySelectorAll('[data-operation-section]')){
   const body=node.querySelector('[data-operation-body]');
   body.replaceWith(body.cloneNode(false));
   if(node.open)void load(node);
  }
 });
}
$('#adminRefresh').onclick=refresh;
window.NeoGestures?.configure({refresh,back:()=>history.length>1?history.back():location.assign('../')});
window.NeoCloud.init((event,user)=>{if(event==='TOKEN_REFRESHED')return;window.NeoCampaignEditor?.closeForSession();if(signupVisit?.account!==user?.id){clearSignupToast();signupVisit=null}generation++;window.NeoAgent?.reset();authorized=false;$('#adminTabs').hidden=true;$('#adminContent').innerHTML='';if(user)refresh();else $('#adminStatus').textContent='Sessão ausente. Entre no aplicativo.';}).then(user=>{if(user)refresh();else if(!window.NeoCloud.configured)refresh();else $('#adminStatus').textContent='Entre na sua conta pelo aplicativo.';}).catch(()=>{$('#adminStatus').textContent='Não foi possível verificar a sessão.';});

const campaignHelp={
 title:["Título", "Escreva o título que aparece no topo do pop-up."],
 body:["Texto", "Descreva a mensagem. Prefira frases curtas e uma ação principal."],
 image_url:["Imagem publicada", "Informe o caminho de uma imagem estática já disponível no app."],
 image_file:["Enviar imagem", "Escolha JPEG, PNG ou WebP de até 5 MB."],
 remove_image:["Remover imagem", "Desvincula a imagem atual da campanha."],
 kind:["Tipo de destino", "Escolha se o botão abrirá link, material, produto ou oferta."],
 link_label:["Texto do botão", "Escreva o texto da chamada para ação."],
 content_search:["Buscar no catálogo", "Pesquise conteúdos já cadastrados na Biblioteca ou Loja."],
 content_id:["Conteúdo selecionado", "Vincule um resultado para abrir seu destino próprio."],
 link_url:["Endereço do destino", "Cole um endereço interno ou HTTPS se não selecionar conteúdo."],
 audience:["Público", "Defina quem pode receber esta campanha."],
 segments:["Segmentos", "Escolha contas recentes, antigas ou da comunidade."],
 plans:["Códigos de planos", "Informe códigos de planos separados por vírgula."],
 account:["ID da conta", "Informe o UUID da conta cujo plano será administrado."],
 plan:["Código do plano", "Associe um código de plano; deixe vazio para remover o vínculo."],
 starts_local:["Início no fuso informado", "Data e hora em que a campanha fica disponível."],
 ends_local:["Encerramento no fuso informado", "Data e hora a partir da qual ela não aparece mais."],
 opens_at:["Hora inicial", "Quando começa a janela diária de exibição."],
 closes_at:["Hora final", "Quando a janela termina; vazio significa meia-noite."],
 timezone:["Fuso das recorrências", "Use o nome IANA, como America/Sao_Paulo."],
 weekdays:["Repetir nos dias", "Marque os dias da semana permitidos."],
 frequency_hours:["Intervalo mínimo (horas)", "Horas mínimas entre duas exibições por conta."],
 max_views:["Limite por conta", "Número máximo de exibições por participante."],
 priority:["Prioridade", "Quanto maior o número, maior a preferência de entrega."],
 popup_enabled:["Exibir pop-up interno", "Mostra a campanha como janela dentro do NeoPep."],
 push_requested:["Usar o canal independente de push", "Requer consentimento e worker habilitado após teste."],
};
function addCampaignHelp(form,helps=campaignHelp,prefix="campaign-help"){
 for(const [key,[name,description]] of Object.entries(helps)){
  const control=form.querySelector(`[name="${key}"],[data-campaign-legend="${key}"]`);
  if(!control)continue;
  const legend=control.tagName==='LEGEND';
  const label=legend||control.tagName==='BUTTON'?control:control.closest('label');
  if(!label)continue;
  const row=document.createElement(legend?'span':'div'),button=document.createElement('button'),message=document.createElement(legend?'span':'p');
  row.className='campaign-field-help';
  button.type='button';button.className='campaign-info';
  const icon=document.createElement('span');icon.textContent='i';icon.setAttribute('aria-hidden','true');button.append(icon);
  button.setAttribute('aria-label','Ajuda: '+name);button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-controls',prefix+'-'+key);
  message.id=prefix+'-'+key;message.hidden=true;message.className='campaign-info-text';message.textContent=description;
  if(legend)label.append(row);
  else{label.before(row);row.append(label);}
  row.append(button,message);
 }
}
let shownCampaignHelp=null;
function closeCampaignHelp(restoreFocus=false){
 if(!shownCampaignHelp)return;
 const {button,message}=shownCampaignHelp;
 message.hidden=true;shownCampaignHelp.home.append(message);button.setAttribute('aria-expanded','false');button.removeAttribute('aria-describedby');
 shownCampaignHelp=null;
 if(restoreFocus&&button.isConnected)button.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('.campaign-info');
 if(button===shownCampaignHelp?.button){closeCampaignHelp();return;}
 if(shownCampaignHelp?.message.contains(event.target))return;
 closeCampaignHelp();
 if(!button)return;
 const message=document.getElementById(button.getAttribute('aria-controls'));
 if(!message)return;
 const home=message.parentElement;
 document.body.append(message);message.hidden=false;button.setAttribute('aria-expanded','true');button.setAttribute('aria-describedby',message.id);
 shownCampaignHelp={button,message,home};
 positionCampaignHelp();
});
function positionCampaignHelp(){
 if(!shownCampaignHelp)return;
 const {button,message}=shownCampaignHelp,r=button.getBoundingClientRect();
 if(!button.isConnected||!r.width||r.bottom<0||r.top>window.innerHeight){if(window.innerHeight)closeCampaignHelp();return;}
 const viewport=window.visualViewport, left=(viewport?.offsetLeft||0)+8,top=(viewport?.offsetTop||0)+8;
 const right=left+(viewport?.width||window.innerWidth)-16,bottom=top+(viewport?.height||window.innerHeight)-16;
 message.style.maxWidth=Math.min(328,right-left)+'px';
 message.style.maxHeight=Math.max(44,bottom-top)+'px';
 const box=message.getBoundingClientRect(),x=Math.max(left,Math.min(right-box.width,r.right-box.width));
 const y=r.top-8-box.height>=top?r.top-8-box.height:Math.max(top,Math.min(bottom-box.height,r.bottom+8));
 message.style.left=x+'px';message.style.top=y+'px';
}
window.addEventListener?.('resize',positionCampaignHelp);
window.addEventListener?.('scroll',positionCampaignHelp,true);
window.visualViewport?.addEventListener('resize',positionCampaignHelp);
window.visualViewport?.addEventListener('scroll',positionCampaignHelp);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&shownCampaignHelp){
  event.preventDefault();closeCampaignHelp(true);
 }
});
let campaignRouteGuard=null;
function campaignExitAllowed(){return !campaignRouteGuard||!campaignRouteGuard.root.isConnected||campaignRouteGuard.canLeave();}
window.addEventListener?.('beforeunload',event=>{if(campaignRouteGuard?.root.isConnected&&campaignRouteGuard.dirty()){event.preventDefault();event.returnValue='';}});
window.addEventListener?.('popstate',()=>{
 const campaign=new URLSearchParams(location.search).get('admin')==='campaigns';
 if(campaign&&tab!=='campaigns'){tab='campaigns';void refresh();}
 else if(!campaign&&tab==='campaigns'&&campaignExitAllowed()){tab='overview';campaignRouteGuard=null;void refresh();}
});
async function mountCampaigns(root){
 const cloud=window.NeoCloud;
 const statusNames={draft:'Rascunho',active:'✓ Ativa',scheduled:'Agendada',paused:'Pausada',expired:'Encerrada',archived:'Arquivada'};
 const weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
 const options=(values,value)=>Object.entries(values).map(([key,label])=>`<option value="${key}" ${value===key?'selected':''}>${label}</option>`).join('');
 const field=(row,key,label,attrs,fallback='')=>input(key,label,row[key]??fallback,attrs);
 let recipientPicker;
 let offset=0,rows=[],editing=null,busy=false,loadingPage=false,done=false,area='app',observer,whatsapp;
 root.innerHTML='<section class="card"><div class="neo-campaign-toolbar"><nav class="neo-campaign-switch" aria-label="Canal de campanha"><button type="button" class="primary" data-campaign-action="app" aria-pressed="true">App</button><button type="button" class="secondary" data-campaign-action="whatsapp" aria-pressed="false">WhatsApp</button></nav><div class="neo-campaign-toolbar-actions"><button type="button" class="secondary campaign-manual" aria-label="Ajuda para campanhas" title="Como criar uma campanha" data-campaign-action="manual"><span aria-hidden="true">?</span></button><button type="button" class="primary neo-campaign-new" data-campaign-action="new" aria-label="Criar nova campanha" title="Criar nova campanha"><span aria-hidden="true">+</span><span class="neo-campaign-new-label"> Nova</span></button></div></div><nav class="neo-campaign-crumbs" aria-label="Localização" data-campaign-breadcrumb></nav><nav class="neo-campaign-sections" aria-label="Seção" data-campaign-sections></nav><div class="neo-campaign-actionbar" data-campaign-actionbar></div><button type="button" class="secondary" data-campaign-action="back" hidden>← Voltar à lista</button><p role="status" data-campaign-status></p><details class="space" hidden><summary>Vincular plano a uma conta</summary><form data-campaign-plan class="space"><label>ID da conta<input name="account" required pattern="[a-fA-F0-9-]{36}"></label><label>Código do plano (vazio para desvincular)<input name="plan" pattern="[a-z0-9_-]{1,40}" maxlength="40"></label><button class="secondary" type="submit">Salvar vínculo</button></form></details><dialog data-campaign-edit hidden></dialog><div data-campaign-wa hidden></div><div data-campaign-filters class="neo-campaign-filters"><label>Pesquisar campanhas<input type="search"></label><label>Status<select><option value="">Todos</option><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="scheduled">Agendada</option><option value="paused">Pausada</option><option value="archived">Arquivada</option><option value="expired">Encerrada</option></select></label><label>Canal da campanha<select><option value="">Todos neste canal</option><option value="shared">App e WhatsApp</option><option value="single">Só neste canal</option></select></label></div><div data-campaign-list></div><div data-campaign-results hidden></div><div data-campaign-more aria-live="polite"></div></section>';
 window.NeoAdminConnectAI?.mount(root);
 const find=selector=>root.querySelector(selector);
 const status=find('[data-campaign-status]'),editor=find('[data-campaign-edit]'),list=find('[data-campaign-list]');
 const structured=document.createElement('details');
 structured.className='space';
 structured.innerHTML='<summary>Rascunhos estruturados para revisão</summary><div data-structured-list></div>';
 list.before(structured);
 const showStructured=()=>!((central&&area==='whatsapp'||appCentral&&area==='app')&&view==='campaigns')&&!screen&&(view==='campaigns'||area==='whatsapp'&&view==='publications');
 async function refreshStructured(){
  if(!structured.open||!showStructured()||typeof cloud.campaignEditor!=='function')return;
  const box=structured.querySelector('[data-structured-list]');
  try{
   let entries;
   try{entries=await cloud.campaignDispatch('review',{});}
   catch{entries=await cloud.campaignEditor('review');}
   if(!root.isConnected)return;
   box.innerHTML=entries.filter(row=>row.channel===area).map(row=>`<article class="monitor-block">
    <strong>${esc(row.title)}</strong><p class="sub">Versão ${esc(row.revision)} · ${row.state==='tracking'?'Acompanhar destinos':row.state==='app'?'Acompanhar App':'Em revisão, envio bloqueado'}
    ${row.planned_local?' · '+esc(row.planned_local)+' · '+esc(row.timezone):''} · ${esc(row.destinations)} destino(s)</p>
    <button type="button" class="secondary" data-campaign-action="structured_resume" data-id="${esc(row.campaign_id)}">Reabrir rascunho</button></article>`).join('')||'<p class="sub">Nenhuma versão neste canal.</p>';
  }catch{if(root.isConnected)box.textContent='Revisão no servidor indisponível. Rascunhos locais continuam acessíveis.';}
 }
 structured.addEventListener('toggle',()=>{void refreshStructured();});
 const stagingCampaigns=window.NEO_CONFIG?.campaignTestEnabled===true;
 let appCentralAvailable=false,channelCopyAvailable=false;
 if(typeof cloud.campaignCentral==='function'){
  try{appCentralAvailable=Array.isArray(await cloud.campaignCentral('app_list',{offset:0}));}catch{/* Keep legacy App if contract absent. */}
  if(appCentralAvailable)try{channelCopyAvailable=(await cloud.campaignCentral('copy_capabilities',{}))?.enabled===true;}catch{}
 }
 if(!root.isConnected)return;
 function openStructured(trigger,row,remote,channel='whatsapp',onSaved=refreshStructured){
  if(!draftOkay()||whatsapp?.canLeave?.()===false)return;
  window.NeoCampaignEditor?.open({cloud,row,remote,channel:remote?.channel||channel,trigger,
   onSaved,onConnect:()=>{showArea('whatsapp');view='connect';updateScreen();writeRoute();}});
 }

 addCampaignHelp(find('[data-campaign-plan]'));
 const views={app:[['campaigns','Campanhas'],['results','Resultados'],['plans','Públicos e planos']],whatsapp:[['campaigns','Campanhas'],['publications','Publicações'],['groups','Grupos'],['connect','NeoPep Connect']]};
 const filterValues={app:[],whatsapp:[]};
 const statusHome=status.parentElement,statusAnchor=status.nextSibling;
 const viewport=globalThis.visualViewport;
 function sizeEditor(){
  if(viewport)editor.style.setProperty('--campaign-editor-height',viewport.height+'px');
 }
 sectionNavKeyboard();
 function sectionNavKeyboard(){
  root.addEventListener('keydown',event=>{
   const tab=event.target.closest?.('.neo-campaign-tab');
   if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   const tabs=[...tab.parentElement.querySelectorAll('.neo-campaign-tab')];
   const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:
    (tabs.indexOf(tab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   event.preventDefault();
   const action=tabs[index].dataset.campaignAction;
   tabs[index].click();
   root.querySelector(`.neo-campaign-tab[data-campaign-action="${action}"]`)?.focus();
  });
 }
 editor.addEventListener('cancel',event=>{event.preventDefault();if(!busy)backToList();});
 let view='campaigns',screen='',editorTab='content',wizard=0,unsaved=false,lastScroll=0,openedBy,stopPreview,previewRefresh,appObjectUrl;
 const draftOkay=()=>!unsaved||confirm('Descartar as alterações não salvas nesta campanha?');
 const query=()=>new URL(location.href);
 const readRoute=()=>{
  const p=query().searchParams,channel=p.get('channel')==='whatsapp'?'whatsapp':'app',page=p.get('campaignView');
  return {area:channel,view:views[channel].some(([key])=>key===page)?page:'campaigns',screen:p.get('campaign')||'',editorTab:p.get('campaignTab')||'content'};
 };
 function writeRoute(replace=false){
  if(!globalThis.history)return;
  const url=query();url.searchParams.set('admin','campaigns');url.searchParams.set('channel',area);
  url.searchParams.set('campaignView',view);
  if(screen){url.searchParams.set('campaign',screen);url.searchParams.set('campaignTab',editorTab);}
  else{url.searchParams.delete('campaign');url.searchParams.delete('campaignTab');}
  history[replace?'replaceState':'pushState'](history.state,'',url);
 }
 const nav=(name,label,active)=>`<button type="button" class="${active?'primary':'secondary'}" aria-pressed="${active}" data-campaign-action="${name}">${label}</button>`;
 const bread=find('[data-campaign-breadcrumb]'),sectionNav=find('[data-campaign-sections]'),filters=find('[data-campaign-filters]');
 const plans=find('[data-campaign-plan]').parentElement,wa=find('[data-campaign-wa]'),results=find('[data-campaign-results]');
 const panelIds={campaigns:list,results,plans,publications:wa,groups:wa,connect:wa};
 const appCentralHost=document.createElement('section');appCentralHost.className='campaign-central';appCentralHost.hidden=true;list.before(appCentralHost);
 const centralHost=document.createElement('section');
 centralHost.className='campaign-central';centralHost.hidden=true;
 list.before(centralHost);
 const central=(stagingCampaigns||window.NEO_CONFIG?.campaignOfficialCentralEnabled===true)&&window.NeoCampaignCentral&&typeof cloud.campaignCentral==='function'
  ?window.NeoCampaignCentral.mount({root:centralHost,cloud,legacy:()=>rows,
   openLegacy:(id,trigger)=>{const row=rows.find(item=>item.id===id);if(row&&draftOkay()){openedBy=trigger;edit(row);}},
   recoverLegacy:(trigger,onSaved)=>openStructured(trigger,undefined,null,'whatsapp',onSaved),
   onCross:channelCopyAvailable?(channel,id)=>{showArea(channel);void (channel==='app'?appCentral:central)?.open(id);}:null,
   onConnect:()=>{showArea('whatsapp');view='connect';updateScreen();writeRoute();}}):null;
 const appCloud=Object.create(cloud);Object.defineProperty(appCloud,'campaignCentral',{value:(action,data)=>cloud.campaignCentral(action==='copy_channel'?action:'app_'+action,data)});
 const appCentral=appCentralAvailable&&window.NeoCampaignCentral?window.NeoCampaignCentral.mount({root:appCentralHost,cloud:appCloud,channel:'app',legacy:()=>rows,openLegacy:(id,trigger)=>{const row=rows.find(item=>item.id===id);if(row&&draftOkay()){openedBy=trigger;edit(row);}},onCross:central&&channelCopyAvailable?(channel,id)=>{showArea(channel);void (channel==='app'?appCentral:central)?.open(id);}:null}):null;

 let waActive=false;
 function updateScreen(){
  const from=area==='app'?'App':'WhatsApp',selected=views[area].find(([key])=>key===view)?.[1]||'Campanhas';
  bread.replaceChildren();
  const crumbs=['Administração','Campanhas',from];
  if(view!=='campaigns')crumbs.push(selected);
  if(screen)crumbs.push(editor.querySelector('[name=title]')?.value||(screen==='new'?'Nova campanha':'Campanha'));
  crumbs.forEach((name,index)=>{
   const last=index===crumbs.length-1,item=document.createElement(last?'span':'button');
   item.textContent=name;
   if(last)item.setAttribute('aria-current','page');
   else{
    item.type='button';item.className='neo-campaign-crumb-link';
    if(index===0)item.dataset.adminTab='overview';
    else item.dataset.campaignAction=index===3&&screen?'back':index===1?'view_campaigns':area;
   }
   if(index){const sep=document.createElement('span');sep.className='neo-campaign-crumb-separator';sep.textContent='›';sep.setAttribute('aria-hidden','true');bread.append(sep);}
   bread.append(item);
  });
  sectionNav.innerHTML=views[area].map(([key,label])=>`<button type="button" role="tab" class="neo-campaign-tab" id="campaign-tab-${key}" aria-controls="campaign-panel-${area==='whatsapp'&&key!=='campaigns'?'whatsapp':key}" aria-selected="${key===view}" tabindex="${key===view?0:-1}" data-campaign-action="view_${key}">${label}</button>`).join('');
  sectionNav.setAttribute('role','tablist');
  for(const [key,panel] of Object.entries({campaigns:list,results,plans,whatsapp:wa})){
   panel.id='campaign-panel-'+key;panel.setAttribute('role','tabpanel');
   if(panel===panelIds[view])panel.setAttribute('aria-labelledby','campaign-tab-'+view);
   else panel.removeAttribute('aria-labelledby');
  }
  const lists=view==='campaigns'&&!screen;
  const unifiedWA=Boolean(central&&area==='whatsapp'&&lists),unifiedApp=Boolean(appCentral&&area==='app'&&lists);
  const unified=unifiedWA||unifiedApp;
  centralHost.hidden=!unifiedWA;appCentralHost.hidden=!unifiedApp;
  if(unifiedWA)void central.load();if(unifiedApp)void appCentral.load();
  list.hidden=filters.hidden=!lists||unified;sentinel.hidden=!lists&&!(area==='app'&&view==='results'&&!screen);
  editor.hidden=!screen;plans.hidden=area!=='app'||view!=='plans'||Boolean(screen);
  results.hidden=area!=='app'||view!=='results'||Boolean(screen);
  wa.hidden=area!=='whatsapp'||view==='campaigns'||Boolean(screen);
  const newAction=find('[data-campaign-action=new]');
  newAction.hidden=unified||Boolean(screen)||view!=='campaigns';
  const actionBar=find('[data-campaign-actionbar]');
  if(newAction.parentElement!==actionBar)actionBar.append(newAction);
  const newLabel=stagingCampaigns&&area==='app'?'Nova campanha de homologação':'Nova campanha';
  newAction.setAttribute('aria-label',newLabel);
  newAction.innerHTML='<span aria-hidden="true">+</span><span class="neo-campaign-new-label"> '+newLabel+'</span>';
  find('[data-campaign-action=back]').hidden=!screen;
  if(!wa.hidden){
   if(!whatsapp&&typeof mountCampaignWhatsApp==='function')whatsapp=mountCampaignWhatsApp(wa,{cloud,embedded:true});
   whatsapp?.setCampaigns(rows);whatsapp?.setView(view);
   if(!waActive)whatsapp?.show();
  }
  waActive=!wa.hidden;
  structured.hidden=!showStructured();if(!structured.hidden)void refreshStructured();
  renderCards();
 }
 function closeEditor(){
  stopPreview?.();stopPreview=null;previewRefresh?.();previewRefresh=null;
  if(appObjectUrl){URL.revokeObjectURL(appObjectUrl);appObjectUrl=null;}
  viewport?.removeEventListener('resize',sizeEditor);
  if(editor.open)editor.close();
  if(editor.contains(status))statusHome.insertBefore(status,statusAnchor);
  recipientPicker=null;
  editor.replaceChildren();editor.removeAttribute('role');editor.removeAttribute('aria-modal');editor.removeAttribute('aria-labelledby');editing=null;screen='';unsaved=false;
 }
 function showArea(next,id){
  if(!draftOkay()||whatsapp?.canLeave?.()===false)return;
  closeEditor();
  filterValues[area]=[...filters.querySelectorAll('input,select')].map(control=>control.value);
  area=next;filters.querySelectorAll('input,select').forEach((control,i)=>{control.value=filterValues[area][i]||'';});
  view=id?'publications':'campaigns';closeCampaignHelp();
  updateChannel();updateScreen();writeRoute();
  if(id)whatsapp?.show(id);
 }
 function updateChannel(){
  for(const key of ['app','whatsapp']){
   const button=find('[data-campaign-action="'+key+'"]');
   button.setAttribute('aria-pressed',String(area===key));button.className=area===key?'primary':'secondary';
  }
 }
 function backToList(){
  if(!draftOkay())return;
  closeEditor();view='campaigns';updateScreen();writeRoute();
  globalThis.scrollTo?.(0,lastScroll);
  const previousId=openedBy?.dataset.id;
  (previousId?[...list.querySelectorAll('[data-campaign-action=edit]')].find(button=>button.dataset.id===previousId):find('[data-campaign-action=new]'))?.focus();
 }
 async function routeFromLocation(){
  if(!root.isConnected)return;
  if(!draftOkay()||whatsapp?.canLeave?.()===false){writeRoute();return;}
  const wasEditing=Boolean(screen);closeEditor();
  const route=readRoute();
  if(route.area!==area){
   filterValues[area]=[...filters.querySelectorAll('input,select')].map(control=>control.value);
   area=route.area;filters.querySelectorAll('input,select').forEach((control,i)=>{control.value=filterValues[area][i]||'';});
  }
  view=route.view;updateChannel();updateScreen();
  if(route.screen==='new'){if(!(central&&area==='whatsapp'))edit({},false);return;}
  if(!/^[a-f0-9-]{36}$/i.test(route.screen)){if(wasEditing)globalThis.scrollTo?.(0,lastScroll);return;}
  while(root.isConnected&&!rows.some(row=>row.id===route.screen)&&!done&&!loadingPage){await load();}
  const row=rows.find(item=>item.id===route.screen);
  if(row){edit(row,false);if(['content','app','whatsapp','schedule','preview','results'].includes(route.editorTab))setEditorTab(route.editorTab);}
  else status.textContent='Campanha indisponível ou sem autorização.';
 }
 function setEditorTab(next){
  editorTab=next;
  const panels=next==='app'?['app','channels']:next.split('+');
  editor.querySelectorAll('[data-campaign-panel]').forEach(panel=>{panel.hidden=!panels.includes(panel.dataset.campaignPanel);});
  const key=editing?next:['content','channels','configure','review'][wizard];

  editor.querySelectorAll('[data-campaign-editor-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.campaignEditorTab===key)));
 }
 function formRecord(){
  const form=editor.querySelector('form'),data=new FormData(form),value=key=>String(data.get(key)||'').trim();
  const kind=value('kind'),content=value('content_id');
  const destination=content&&/^[a-f0-9-]{36}$/i.test(content)?
    kind==='product'?'/?produto='+content+'#loja':kind==='document'?'/?material='+content+'#comunidade':'/#loja':value('link_url');
  return {title:value('title'),body:value('body'),whatsapp_message:value('whatsapp_message'),link_url:destination,link_label:value('link_label'),
   image_path:data.has('remove_image')?null:editor.dataset.imagePath,image_url:value('image_url'),file:data.get('image_file')};
 }
 function edit(row={},push=true){
  closeCampaignHelp();closeEditor();editing=row.id??null;screen=editing||'new';view='campaigns';wizard=0;
  if(push)lastScroll=globalThis.scrollY||0;
  editorTab='content';
  let imagePath=row.image_path||null;
  editor.dataset.imagePath=imagePath||'';
  editor.setAttribute('role','dialog');editor.setAttribute('aria-modal','true');editor.setAttribute('aria-labelledby','neo-campaign-dialog-title');
  editor.innerHTML=`<form class="space" data-campaign-form>
   <header class="neo-campaign-editor-head"><div><h3 id="neo-campaign-dialog-title">${editing?'Editar campanha':'Nova campanha'}</h3><p class="sub">${statusNames[row.display_state||row.status]||'Rascunho'}</p></div><div class="neo-campaign-editor-head-actions">${typeof neoWhatsappEye==='function'?neoWhatsappEye('data-campaign-action="preview_wa"'):''}<button type="button" class="secondary" data-campaign-action="cancel" aria-label="Fechar edição da campanha">Fechar ×</button></div></header>
   <nav class="neo-campaign-sections" aria-label="${editing?'Configuração da campanha':'Etapas de criação'}">${(editing?
    [['content','Conteúdo'],['app','App'],['whatsapp','WhatsApp'],['schedule','Programação'],['preview','Prévia'],['results','Resultados']]:
    [['content','Conteúdo'],['channels','Canais'],['configure','Configurar'],['review','Revisar']]).map(([key,label])=>
     `<button type="button" data-campaign-action="editor_tab" data-campaign-editor-tab="${key}" class="secondary">${label}</button>`).join('')}</nav>
   <section data-campaign-panel="content">
   ${field(row,'title','Título','required maxlength="120"')}
   <label>Texto<textarea name="body" maxlength="2000" rows="4">${esc(row.body||'')}</textarea></label>
   ${field(row,'image_url','Imagem publicada (caminho em /assets/)','maxlength="1000"')}
   <label>Enviar imagem (JPEG, PNG ou WebP, até 5 MB)<input type="file" name="image_file" accept="image/jpeg,image/png,image/webp"></label>
   ${imagePath?'<label class="check"><input type="checkbox" name="remove_image">Remover imagem desta campanha</label>':''}
   <div class="form-grid"><label>Tipo de destino<select name="kind">${options({link:'Link',document:'Documento',product:'Produto',offer:'Oferta',promotion:'Promoção'},row.kind)}</select></label>
   ${field(row,'link_label','Texto do botão','required maxlength="60"','Saiba mais')}</div>
   <div data-campaign-catalog><label>Buscar no catálogo<input name="content_search" maxlength="100"></label>
   <button class="secondary" type="button" data-campaign-action="search">Buscar conteúdo</button>
   <label>Conteúdo selecionado<select name="content_id"><option value="">Usar endereço manual</option>${row.content_id?`<option selected value="${esc(row.content_id)}">Vínculo atual</option>`:''}</select></label></div>
   ${field(row,'link_url','Endereço do destino','maxlength="1000" placeholder="/#loja"')}
   </section><fieldset data-campaign-panel="whatsapp"><legend>WhatsApp · divulgação manual</legend>
   <label class="check"><input type="checkbox" name="whatsapp_enabled" ${row.whatsapp_enabled||(!editing&&area==='whatsapp')?'checked':''}> Usar esta campanha no WhatsApp</label>
   <label>Mensagem WhatsApp<textarea name="whatsapp_message" maxlength="4000" placeholder="Usa o texto comum se ficar vazia.">${esc(row.whatsapp_message||'')}</textarea></label>
   <p class="sub">Anexos e lembretes da divulgação manual são configurados em Publicações depois de salvar.</p>
   <div data-campaign-sync-groups></div>
   ${editing&&row.whatsapp_enabled&&row.status!=='archived'?`<button class="secondary" type="button" data-campaign-action="prepare_wa" data-id="${esc(editing)}">Preparar divulgação manual</button>`:''}
   </fieldset>
   <fieldset data-campaign-app-settings data-campaign-panel="app"><legend>Aplicativo</legend>
   <label>Público<select name="audience">${options({all:'Todas as contas elegíveis',segment:'Segmentos selecionados',plan:'Planos selecionados'},row.audience)}</select></label>
   <fieldset data-campaign-segments><legend data-campaign-legend="segments">Segmentos</legend>${Object.entries({recent:'Cadastro nos últimos 30 dias',established:'Cadastro há mais de 30 dias',community:'Membro da comunidade'}).map(([key,label])=>`<label class="check"><input type="checkbox" name="segment" value="${key}" ${row.targets?.includes(key)?'checked':''}>${label}</label>`).join('')}</fieldset>
   ${field({...row,plans:row.audience==='plan'?(row.targets||[]).join(', '):''},'plans','Códigos de planos separados por vírgula','maxlength="500"')}
   </fieldset><fieldset data-campaign-panel="schedule"><legend>Exibição automática no App</legend><p class="sub">No WhatsApp, os horários criam lembretes de divulgação manual na aba Publicações.</p><div class="form-grid">${input('starts_local','Início no fuso informado',row.starts_local||'','type="datetime-local"')}${input('ends_local','Encerramento no fuso informado',row.ends_local||'','type="datetime-local"')}
   ${field(row,'opens_at','Hora inicial','type="time" required','00:00')}
   ${input('closes_at','Hora final (vazio até meia-noite)',row.closes_at&&row.closes_at!=='24:00:00'?row.closes_at.slice(0,5):'','type="time"')}</div>
   ${field(row,'timezone','Fuso das recorrências (IANA)','required maxlength="80"','America/Sao_Paulo')}
   <fieldset><legend data-campaign-legend="weekdays">Repetir nos dias</legend><div class="campaign-weekdays">${weekdays.map((day,i)=>`<label class="check"><input type="checkbox" name="weekday" value="${i}" ${!row.weekdays||row.weekdays.includes(i)?'checked':''}>${day}</label>`).join('')}</div></fieldset>
   <div class="form-grid">${field(row,'frequency_hours','Intervalo mínimo (horas)','type="number" required min="1" max="8760"',24)}
   ${field(row,'max_views','Limite por conta','type="number" required min="1" max="100"',1)}
   ${field(row,'priority','Prioridade','type="number" required min="0" max="100"',0)}</div>
   </fieldset><fieldset data-campaign-panel="channels"><legend>Canais do App</legend><label class="check"><input type="checkbox" name="popup_enabled" ${(editing?row.popup_enabled!==false:area==='app')?'checked':''}>Exibir pop-up interno</label>
   <label class="check"><input type="checkbox" name="push_requested" ${row.push_requested?'checked':''}>Usar o canal independente de push</label>
   <p class="sub">Quando o canal está ativo, somente contas com autorização e dispositivo inscrito podem receber o aviso.</p></fieldset>
   <section data-campaign-panel="preview"><div class="neo-campaign-actions">
   <button class="secondary" type="button" data-campaign-action="preview" data-preview-device="mobile">App celular</button>
   <button class="secondary" type="button" data-campaign-action="preview" data-preview-device="desktop">App computador</button>
   ${typeof neoWhatsappEye==='function'?neoWhatsappEye('data-campaign-action="preview_wa"'):''}
   </div><div data-campaign-preview></div></section>
   <section data-campaign-panel="results"><h4>Resultados</h4><p>${metricText(row)}</p><p class="sub">Publicações manuais têm confirmação própria na fila do WhatsApp.</p></section>
   <div class="neo-campaign-actions">${editing?'':'<button class="secondary" type="button" data-campaign-action="previous">Anterior</button><button class="secondary" type="button" data-campaign-action="next">Próximo</button>'}<button class="primary" type="submit">${editing?'Salvar alterações':'Salvar rascunho'}</button>
   <button class="secondary" type="button" data-campaign-action="preview">Prévia</button>
   <button class="secondary" type="button" data-campaign-action="cancel">Fechar edição</button></div>
   </form>`;
  const form=editor.querySelector('form');
  addCampaignHelp(form,{...campaignHelp,whatsapp_enabled:['Usar esta campanha no WhatsApp','Disponibiliza o conteúdo para divulgação manual.'],whatsapp_message:['Mensagem WhatsApp','Adapta o texto para este canal sem modificar o pop-up. Deixe em branco para usar o texto comum.']});
  const syncMessage=()=>{form.elements.whatsapp_message.closest('label').hidden=!form.elements.whatsapp_enabled.checked;};
  form.elements.whatsapp_enabled.addEventListener('change',syncMessage);syncMessage();
  function audience(){
   form.querySelector('[data-campaign-segments]').hidden=form.elements.audience.value!=='segment';
   form.elements.plans.closest('label').hidden=form.elements.audience.value!=='plan';
  }
  form.elements.kind.addEventListener('change',()=>{
   form.elements.content_id.replaceChildren(new Option('Usar endereço manual',''));
   form.querySelector('[data-campaign-catalog]').hidden=form.elements.kind.value==='link';
  });
  form.querySelector('[data-campaign-catalog]').hidden=form.elements.kind.value==='link';
  form.elements.audience.addEventListener('change',audience);audience();
  form.addEventListener('input',()=>{unsaved=true;});
  form.addEventListener('change',()=>{unsaved=true;});
  form.addEventListener('invalid',event=>{
   const section=event.target.closest('[data-campaign-panel]')?.dataset.campaignPanel;
   if(section&&event.target.closest('[hidden]'))setEditorTab(section);
  },true);
  form.querySelector('header').after(status);
  if(typeof mountSyncedCampaignGroups==='function'){
   const groups=form.querySelector('[data-campaign-sync-groups]');
   recipientPicker=mountSyncedCampaignGroups(groups,{cloud,picking:true});
   let requested=false;
   const sync=()=>{
    groups.hidden=!form.elements.whatsapp_enabled.checked;
    if(!groups.hidden&&!requested){requested=true;void recipientPicker.load(editing);}
   };
   form.elements.whatsapp_enabled.addEventListener('change',sync);sync();
  }
  setEditorTab('content');updateScreen();if(push)writeRoute();
  editor.showModal?.();
  sizeEditor();viewport?.addEventListener('resize',sizeEditor);
  form.elements.title.focus();
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const data=new FormData(form),value=k=>String(data.get(k)||'').trim();
   const audience=value('audience'),targets=audience==='segment'?data.getAll('segment'):audience==='plan'?value('plans').split(',').map(x=>x.trim()).filter(Boolean):[];
   if(busy)return;
   if(data.has('whatsapp_enabled')&&recipientPicker&&!recipientPicker.ready()){
    status.textContent='Atualize os grupos sincronizados antes de salvar a campanha WhatsApp.';return;
   }
   const file=data.get('image_file'),submit=form.querySelector('[type=submit]');
   if(file?.size){
    busy=true;submit.disabled=true;status.textContent='Preparando e enviando imagem…';
    try{imagePath=await cloud.uploadCampaignImage(file);form.elements.image_file.value='';}
    catch(error){status.textContent=error.message;return;}
    finally{busy=false;submit.disabled=false;}
    if(!root.isConnected||!form.isConnected)return;
   }else if(data.has('remove_image'))imagePath=null;
   await change('save',editing,{title:value('title'),body:value('body'),kind:value('kind'),image_url:value('image_url')||null,image_path:imagePath,
    content_id:value('content_id')||null,link_url:value('link_url')||null,link_label:value('link_label'),audience,targets,starts_local:value('starts_local')||null,ends_local:value('ends_local')||null,
    timezone:value('timezone'),weekdays:data.getAll('weekday').map(Number),opens_at:value('opens_at'),closes_at:value('closes_at')||'24:00',
    priority:Number(value('priority')),frequency_hours:Number(value('frequency_hours')),max_views:Number(value('max_views')),
    popup_enabled:data.has('popup_enabled'),push_requested:data.has('push_requested'),whatsapp_enabled:data.has('whatsapp_enabled'),whatsapp_message:value('whatsapp_message'),
    ...(recipientPicker?.ready()?{recipients:data.has('whatsapp_enabled')?recipientPicker.values():[]}:{})});
  });
 }
 function metricText(row){return Number(row.views||0)+' exibições · '+Number(row.clicks||0)+' cliques'+(row.views?' · '+(100*row.clicks/row.views).toFixed(1)+'% de cliques':'');}
 function renderCards(){
  const [search,state,channel]=filters.querySelectorAll('input,select');
  const visible=rows.filter(row=>{
   const app=row.popup_enabled!==false||row.push_requested;
   return (area==='app'?app:row.whatsapp_enabled)&&(!state.value||(row.display_state||row.status)===state.value)&&
    (!channel.value||(channel.value==='shared')===Boolean(app&&row.whatsapp_enabled))&&
    String(row.title||'').toLocaleLowerCase('pt-BR').includes(search.value.trim().toLocaleLowerCase('pt-BR'));
  });
  const appRows=rows.filter(row=>row.popup_enabled!==false||row.push_requested);
  results.innerHTML='<h3>Resultados do App</h3>'+appRows.map(row=>`<article class="monitor-block"><h4>${esc(row.title)}</h4><p>${metricText(row)}</p></article>`).join('');
  list.innerHTML=visible.map(row=>{
   const state=row.display_state||row.status,app=row.popup_enabled!==false||row.push_requested;
   const actions=row.status==='archived'?['duplicate']:['duplicate',row.status==='active'?'pause':'activate','archive','prepare_wa'];
   return `<article class="monitor-block campaign-center-card"><div class="between"><h3>${esc(row.title)}</h3>
   <span class="campaign-state state-${esc(state)}">${statusNames[state]||'—'}</span></div>
   <p class="sub">${app?'App':''}${app&&row.whatsapp_enabled?' · ':''}${row.whatsapp_enabled?'WhatsApp':''}</p>
   <p class="sub">${metricText(row)}</p>
   <p class="sub">${row.updated_at?'Alterada em '+esc(new Date(row.updated_at).toLocaleString('pt-BR')):''}</p>
   <div class="neo-campaign-actions"><button type="button" class="primary" data-campaign-action="edit" data-id="${esc(row.id)}">Abrir</button>
   ${area==='app'&&window.NeoCampaignEditor?`<button type="button" class="secondary" data-campaign-action="structured_copy" data-id="${esc(row.id)}">Criar também no WhatsApp</button>`:''}
   ${row.whatsapp_enabled&&typeof neoWhatsappEye==='function'?neoWhatsappEye('data-campaign-action="preview_wa" data-id="'+esc(row.id)+'"'):''}
   <details class="neo-campaign-menu"><summary aria-label="Mais ações">⋯</summary>${actions.map(action=>
    `<button type="button" class="secondary" data-campaign-action="${action}" data-id="${esc(row.id)}">${{edit:'Editar',duplicate:'Duplicar',pause:'Pausar',activate:'Ativar / agendar',archive:'Arquivar',prepare_wa:'WhatsApp'}[action]}</button>`).join('')}</details></div></article>`;
  }).join('')||(!done?'':'<p>Nenhuma campanha neste canal.</p>');
 }
 const sentinel=find('[data-campaign-more]');
 async function load(reset=false){
  if(loadingPage||(!reset&&done))return;
  loadingPage=true;sentinel.textContent='Carregando campanhas…';
  if(reset){offset=0;rows=[];done=false;observer?.disconnect();}
  try{
   const batch=await cloud.campaignAdmin('list',null,{offset});
   if(!root.isConnected)return;
   offset+=batch.length;done=batch.length<50;
   rows.push(...batch.filter(row=>!rows.some(existing=>existing.id===row.id)));
   renderCards();central?.syncLegacy();appCentral?.syncLegacy();whatsapp?.setCampaigns(rows);
   sentinel.innerHTML=done?'':'<button type="button" class="secondary" data-campaign-action="more">Carregar mais</button>';
   if(!done&&typeof IntersectionObserver!=='undefined'){
    observer??=new IntersectionObserver(entries=>{
     if(!root.isConnected){observer.disconnect();return;}
     if(entries.some(entry=>entry.isIntersecting))void load().catch(()=>{sentinel.textContent='Não foi possível carregar mais campanhas.';});
    },{rootMargin:'320px'});
    observer.unobserve(sentinel);observer.observe(sentinel);
   }
  }finally{loadingPage=false;}
 }
 async function change(action,id,data){
  if(busy)return;
  busy=true;status.textContent='Processando…';
  try{
   if(action==='save'&&data.recipients)await cloud.campaignWhatsAppSync('save',id,data);
   else if(action!=='list')await cloud.campaignAdmin(action,id,data);
   if(action==='assign_plan'){status.textContent='Vínculo confirmado.';return;}
   if(action==='save'){unsaved=false;closeCampaignHelp();backToList();}
   await load(true);status.textContent=action==='list'?'':'Alteração confirmada.';
  }catch(error){status.textContent=error.code==='42501'?'Ação sem autorização ou grupo sincronizado indisponível.':'Não foi possível concluir. Confira os campos, horários e a migração de campanhas.';}
  finally{busy=false;}
 }
 root.querySelector('[data-campaign-plan]').addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  void change('assign_plan',data.get('account'),{plan:data.get('plan')});
 });
 root.addEventListener('click',async event=>{
  const button=event.target.closest('[data-campaign-action]');
  if(!button||busy||!root.isConnected)return;
  const action=button.dataset.campaignAction,id=button.dataset.id;
  if(action==='structured_resume'){
   try{
    const remote=await cloud.campaignEditor('load',{campaign_id:id});
    if(remote&&root.isConnected)openStructured(button,{id,title:''},remote);
   }catch{status.textContent='Não foi possível reabrir a versão de revisão.';}
   return;
  }
  if(action==='structured_copy'){const original=rows.find(row=>row.id===id);if(original)openStructured(button,original);return;}
  if(action==='new'&&stagingCampaigns&&area==='app'&&window.NeoCampaignEditor){
   openStructured(button,undefined,null,'app');return;
  }
  if((action==='new'||action==='edit')&&area==='whatsapp'&&window.NeoCampaignEditor){
   openStructured(button,rows.find(row=>row.id===id));return;
  }
  if(action==='app'||action==='whatsapp'){showArea(action);return;}
  if(action==='prepare_wa'){
   const row=rows.find(item=>item.id===id);
   if(row?.whatsapp_enabled)showArea('whatsapp',id);
   else if(row){showArea('whatsapp');edit({...row,whatsapp_enabled:true});}
   return;
  }
  if(action==='more'){await load().catch(()=>{status.textContent='Não foi possível carregar mais campanhas.';});return;}
  if(action==='manual'){
   closeCampaignHelp();
   try{await window.NeoAdminPDF.open({path:'assets/manual-campanhas-neopep.pdf',title:'Manual de campanhas',trigger:button});}
   catch{status.textContent='Não foi possível abrir o manual de campanhas.';}
   return;
  }
  if(action.startsWith('view_')){
   if(!draftOkay()||whatsapp?.canLeave?.()===false)return;
   closeEditor();view=action.slice(5);updateScreen();writeRoute();return;
  }
  if(action==='new'||action==='edit'){if(draftOkay()){openedBy=button;edit(rows.find(row=>row.id===id));}return;}
  if(action==='cancel'||action==='back'){backToList();return;}
  if(action==='editor_tab'||action==='next'||action==='previous'){
   if(editing){setEditorTab(button.dataset.campaignEditorTab);writeRoute(true);}
   else{const steps=['content','channels','configure','review'];
    wizard=Math.max(0,Math.min(3,action==='next'?wizard+1:action==='previous'?wizard-1:steps.indexOf(button.dataset.campaignEditorTab)));
    setEditorTab(['content','whatsapp+channels','app+schedule','preview'][wizard]);}
   return;
  }
  if(action==='preview_wa'&&typeof neoWhatsappPreview==='function'){
   const row=rows.find(item=>item.id===id),form=editor.querySelector('form');
   stopPreview?.();
   let prepared=row;
   stopPreview=neoWhatsappPreview({cloud,trigger:button,form:row?null:form,read:row?()=>prepared:formRecord,
    resolve:row&&row.status!=='archived'&&typeof cloud.campaignWhatsApp==='function'?async()=>{
     const record=await cloud.campaignWhatsApp('prepare',row.id,{});
     if(record)prepared={...row,...record};
    }:null,
    onEdit:row?()=>{openedBy=button;edit(row);}:()=>{setEditorTab('content');form.elements.title.focus();}});
   return;
  }
  if(action==='search'){
   const form=editor.querySelector('form'),kind=form.elements.kind.value;
   status.textContent='Buscando conteúdo…';
   try{
    const found=await cloud.campaignAdmin('catalog',null,{kind,search:form.elements.content_search.value});
    if(!form.isConnected||form.elements.kind.value!==kind)return;
    const select=form.elements.content_id,selected=select.selectedOptions[0];
    const options=[new Option('Usar endereço manual','')];
    if(selected?.value&&!found.some(row=>row.id===selected.value))options.push(selected.cloneNode(true));
    select.replaceChildren(...options,...found.map(row=>new Option(row.label,row.id,false,row.id===selected?.value)));
    status.textContent=found.length?'Selecione um item.':'Nenhum item encontrado.';
   }catch{if(form.isConnected)status.textContent='Não foi possível buscar no catálogo.';}
   return;
  }
  if(action==='preview'){
   previewRefresh?.();
   const previewForm=editor.querySelector('form'),mode=button.dataset.previewDevice;
   let rev=0;
   const renderApp=async()=>{
   const current=++rev;
   const form=editor.querySelector('form'),data=new FormData(form),preview=form.querySelector('[data-campaign-preview]');
   const image=String(data.get('image_url')||''),file=data.get('image_file');
   if(appObjectUrl){URL.revokeObjectURL(appObjectUrl);appObjectUrl=null;}
   delete preview.dataset.objectUrl;
   const uploaded=file?.size?URL.createObjectURL(file):null;
   if(uploaded)appObjectUrl=uploaded;
   const display=uploaded||(!data.has('remove_image')&&editor.dataset.imagePath?await cloud.campaignImageURL(editor.dataset.imagePath).catch(()=>null):null);
   if(!form.isConnected||current!==rev)return;
   preview.innerHTML=`<div class="form-grid">${(mode==='mobile'?['Celular']:mode==='desktop'?['Computador']:['Celular','Computador']).map((label)=>`<div><h4>${label}</h4><div class="card campaign-preview ${label==='Celular'?'campaign-preview-mobile':''}">
    <h3>${esc(data.get('title'))}</h3>${display?`<img src="${esc(display)}" alt="">`:/^\/(assets|campaign-media)\/[a-zA-Z0-9_./-]+$/.test(image)&&!image.includes('..')?`<img src="${esc(image)}" alt="">`:''}
    <p>${esc(data.get('body'))}</p>${(data.get('link_url')||data.get('content_id'))?`<button class="primary" type="button" disabled>${esc(data.get('link_label'))}</button>`:''}</div></div>`).join('')}</div>`;
   };
   const previewInput=()=>{void renderApp().catch(()=>{});};
   previewForm.addEventListener('input',previewInput);previewForm.addEventListener('change',previewInput);
   previewRefresh=()=>{rev++;previewForm.removeEventListener('input',previewInput);previewForm.removeEventListener('change',previewInput);};
   await renderApp();return;
  }
  if((action==='activate'||action==='pause')&&!confirm(action==='activate'?'Ativar ou agendar esta campanha no App conforme a configuração?':'Pausar esta campanha?'))return;
  if(action==='archive'&&!confirm('Arquivar esta campanha? Ela deixará de ser exibida e manterá as estatísticas.'))return;
  await change(action,id);
 });
 filters.addEventListener('input',renderCards);filters.addEventListener('change',renderCards);
 campaignRouteGuard={root,canLeave:()=>draftOkay()&&whatsapp?.canLeave?.()!==false,dirty:()=>unsaved||whatsapp?.dirty?.()};
 const pop=()=>{if(!root.isConnected){window.removeEventListener?.('popstate',pop);stopPreview?.();return;}void routeFromLocation().catch(()=>{status.textContent='Não foi possível abrir a campanha.';});};
 window.addEventListener?.('popstate',pop);
 updateChannel();updateScreen();
 await change('list');
 if(globalThis.history)await routeFromLocation().catch(()=>{status.textContent='Não foi possível abrir a campanha.';});
}
