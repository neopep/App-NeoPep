'use strict';
const $=s=>document.querySelector(s),esc=window.NeoCore.escape;let generation=0,loading=false,authorized=false,tab='overview',platform=null,dirty=false,authConfirmation=null;
function overview(d){const metrics=[['Usuários cadastrados',d.users_total],['Cadastros em 7 dias',d.signups_7d],['Ativos em 24 horas',d.active_24h],['Ativos em 7 dias',d.active_7d],['Ativos em 30 dias',d.active_30d],['Perfis configurados',d.profiles_total],['Registros totais',d.records_total],['Fotos armazenadas',d.photos_total]];return `<div class="stats">${metrics.map(([title,value])=>`<article class="card stat"><div class="stat-label">${title}</div><div class="stat-value">${Number.isFinite(value)?value.toLocaleString('pt-BR'):'—'}</div></article>`).join('')}</div><div data-admin-signups></div><div data-admin-audience></div><div class="two-cols"><section class="card"><h2>Funcionamento</h2><p class="sub space">Banco: ${d.database_status==='reachable'?'respondeu à consulta':'não confirmado'}<br>Storage privado: ${d.private_storage===true?'confirmado':'não confirmado'}<br>Schema: ${esc(d.schema_version)}<br>Horário do servidor: ${esc(d.server_time)}</p><div class="notice">“Ativo” significa acesso autenticado informado pelo aplicativo. Esta consulta não mede disponibilidade externa, latência de todas as funções ou entrega de e-mails.</div></section><section class="card"><h2>Erros informados pelo app · 7 dias</h2>${d.app_errors_7d.length?d.app_errors_7d.map(r=>`<div class="task"><b>${esc(r.code)}</b><span>${Number(r.count)}</span></div>`).join(''):'<p class="sub space">Nenhum erro de categoria permitida foi informado.</p>'}<p class="sub space">Contadores limitados por conta. Não contêm mensagens livres, notas, identificadores ou valores de saúde.</p></section></div><section class="card space"><h2>Cadastros por dia</h2>${d.signups_daily.map(r=>`<div class="task"><b>${esc(r.day)}</b><span>${r.count===null?'Menos de 5 · célula suprimida':Number(r.count)}</span></div>`).join('')||'<p class="sub">Sem cadastros no período.</p>'}</section>`;}
function input(name,label,value='',extra=''){return `<label>${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;}
function settingsView(p){const c=p.config,s=p.shop||{},publicCfg=window.NEO_CONFIG||{};return `<section class="card space"><h2>Cadastro e confirmação de e-mail</h2><p class="sub">Controle exclusivo do administrador principal. Desativar permite criar conta e entrar sem confirmar a propriedade do e-mail. Recuperação de senha ainda depende de envio de e-mail. Reativar vale para novos cadastros.</p><p id="authSettingsStatus" role="status">Estado ainda não consultado no Supabase.</p><button class="secondary" type="button" id="authSettingsRead">Consultar estado atual</button><form id="authSettingsForm" class="space"><label class="check"><input type="checkbox" id="requireEmailConfirmation" disabled> Exigir confirmação de e-mail nos novos cadastros</label><button class="primary" type="submit" disabled>Aplicar no Supabase</button></form></section><form id="platformForm"><section class="card space"><h2>Configurações gerais</h2><p class="sub">Referências operacionais do suporte. Alterar a URL aqui não conecta um domínio nem muda as permissões do CAPTCHA.</p>${input('support_email','E-mail operacional de atendimento',c.support_email||publicCfg.privacyContact||'','type="email" maxlength="254"')}${input('site_url','Endereço público de referência',c.site_url||'','type="url" maxlength="2000" placeholder="https://…"')}<label class="check"><input type="checkbox" name="require_approval" ${p.require_approval?'checked':''}> Exigir aprovação das novas mensagens do Grupo</label></section><button class="primary full space" type="submit">Salvar configurações</button></form><div data-agent-admin></div><section class="card space"><h2>Pagamentos e entrega</h2><p class="sub">Mercado Pago: ${s.payments_ready?'habilitado no ambiente '+esc(s.payment_environment):'configuração e homologação pendentes'}. Retorno do navegador não confirma pagamento.</p><details class="admin-secret-help"><summary>Integração com Mercado Pago</summary><p class="sub">As credenciais MP_ACCESS_TOKEN, MP_COLLECTOR_ID, MP_WEBHOOK_SECRET, MP_MODE e SHOP_APP_URL ficam nos Secrets do Supabase. Teste completo e webhook são necessários antes de ativar pagamentos. Não coloque essas chaves no formulário.</p><p class="sub">Webhook: <code>${esc(publicCfg.supabaseUrl||'')}/functions/v1/mercadopago-webhook</code></p></details><form id="adminShopForm" class="space">${input('seller_name','Responsável pela loja',s.seller_name||'','required maxlength="120"')}${input('seller_document','CPF ou CNPJ',s.seller_document||'','required maxlength="14" inputmode="numeric"')}${input('business_address','Endereço comercial',s.business_address||'','required maxlength="250"')}${input('support_email','E-mail de atendimento da loja',s.support_email||'','required type="email" maxlength="254"')}<label>Condições de troca<textarea name="returns_policy" rows="4" required maxlength="4000">${esc(s.returns_policy||'')}</textarea></label><div class="form-grid">${input('shipping','Frete fixo (R$)',String((s.shipping_cents??0)/100).replace('.',','),'required inputmode="decimal"')}${input('delivery_min','Prazo mínimo em dias úteis',s.delivery_min??3,'required type="number" min="1" max="90"')}${input('delivery_max','Prazo máximo em dias úteis',s.delivery_max??10,'required type="number" min="1" max="120"')}</div><label class="check"><input type="checkbox" name="shipping_ready" ${s.shipping_ready?'checked':''}> Entrega e prazo conferidos</label><button class="secondary full" type="submit">Salvar entrega e condições</button></form></section>`;}
async function refresh(){if(loading)return;if(tab!=='overview')clearSignupToast();window.NeoAgent?.reset();authConfirmation=null;const gen=++generation;loading=true;$('#adminContent').innerHTML='';$('#adminStatus').textContent='Verificando autorização no servidor…';$('#adminRefresh').disabled=true;try{if(!window.NeoCloud.configured)throw Error('Supabase não configurado. O painel não apresenta métricas fictícias.');if(!window.NeoCloud.user)throw Error('Entre na sua conta pelo aplicativo e abra novamente o painel.');const d=await window.NeoCloud.adminSummary();if(gen!==generation)return;authorized=true;$('#adminTabs').hidden=false;$('#adminTitle').textContent=tab==='settings'?'Configurações da plataforma':'Visão da plataforma';$('#adminSubtitle').textContent=tab==='settings'?'Geral, atendimento com IA e integrações da loja.':'Indicadores e cadastros. Autorização verificada no servidor.';for(const button of document.querySelectorAll('[data-admin-tab]')){const active=button.dataset.adminTab===tab;button.className=active?'primary':'secondary';button.setAttribute('aria-pressed',String(active));}if(tab==='settings'){try{platform=await window.NeoCloud.platform();if(gen!==generation)return;$('#adminContent').innerHTML=settingsView(platform);window.NeoAgent?.mount($('#adminContent [data-agent-admin]'));}catch(err){$('#adminContent').innerHTML='<section class="card"><h2>Ativação das configurações</h2><p class="sub">Execute a atualização de Biblioteca e integrações no Supabase. As configurações são autorizadas pelo servidor e não são simuladas neste painel.</p></section>';throw err;}}else {$('#adminContent').innerHTML=overview(d);void mountAdminSignups($('[data-admin-signups]'));mountAdminAudience($('[data-admin-audience]'));}$('#adminStatus').textContent='Consulta autorizada. Atualizado agora.';dirty=false;}catch(err){if(gen!==generation)return;$('#adminStatus').textContent='Acesso não disponível: '+err.message;if(!authorized){$('#adminTabs').hidden=true;$('#adminContent').innerHTML='<div class="notice">Somente uma permissão concedida pelo responsável no banco habilita este painel. Editar perfil ou dados do navegador não concede acesso.</div>';}}finally{loading=false;$('#adminRefresh').disabled=false;}}
async function integration(action){if(loading||!authorized)return;if(action==='test_ai'&&dirty){$('#adminStatus').textContent='Salve as configurações antes de testar a conexão.';return;}const gen=generation;loading=true;try{const r=await window.NeoCloud.integrations(action);if(gen!==generation)return;if(action==='test_ai'){loading=false;await refresh();$('#adminStatus').textContent='Conexão com IA validada. Você já pode ativar as respostas automáticas.';}else $('#integrationStatus').textContent=`Chave OpenAI: ${r.openai_key_present?'presente':'pendente'} · Mercado Pago: ${r.mercadopago_keys_present?'chaves presentes, homologação deve ser conferida':'chaves pendentes'} · Rotina da IA: ${r.ai_worker_secret_present?'segredo presente; agendamento deve ser conferido':'pendente'}`;}catch{if(gen===generation)$('#adminStatus').textContent='Não foi possível conferir a integração. Verifique a função publicada, as chaves e o modelo no Supabase.';}finally{loading=false;}}
async function authSettings(save=false){if(loading||!authorized)return;const status=$('#authSettingsStatus'),box=$('#requireEmailConfirmation'),button=$('#authSettingsForm [type=submit]'),gen=generation;if(!status||!box||!button)return;const desired=box.checked;if(save&&authConfirmation===null)return;if(save&&!confirm(desired?'Exigir confirmação de e-mail nos novos cadastros? Confira o SMTP antes de ativar.':'Permitir novos cadastros sem confirmar a propriedade do e-mail?'))return;loading=true;box.disabled=true;button.disabled=true;$('#authSettingsRead').disabled=true;status.textContent=save?'Aplicando e conferindo no Supabase…':'Consultando o Supabase…';try{const r=await window.NeoCloud.authSettings(save?'set':'status',save?{require_email_confirmation:desired,expected_confirmation:authConfirmation}:{});if(gen!==generation)return;if(typeof r.require_email_confirmation!=='boolean')throw Error('invalid_state');authConfirmation=r.require_email_confirmation;box.checked=authConfirmation;box.disabled=false;button.disabled=false;status.textContent=(save?'Alteração confirmada no Supabase. ':'Estado conferido no Supabase. ')+(authConfirmation?'Confirmação de e-mail ativada.':'Confirmação de e-mail desativada.');}catch{if(gen===generation){authConfirmation=null;box.checked=false;status.textContent='Não foi possível confirmar o estado. Consulte novamente. A função auth-settings e os Secrets precisam estar configurados, e sua conta deve ser administrador principal.';}}finally{loading=false;if(gen===generation)$('#authSettingsRead').disabled=false;}}
document.addEventListener('submit',event=>{if(event.target.id==='authSettingsForm'){event.preventDefault();authSettings(true);}});
document.addEventListener('click',event=>{if(event.target.closest('#authSettingsRead'))authSettings();const tabButton=event.target.closest('[data-admin-tab]');if(tabButton&&!loading){tab=tabButton.dataset.adminTab;refresh();}if(event.target.closest('#testAI'))integration('test_ai');if(event.target.closest('#integrationRefresh'))integration('status');});
document.addEventListener('input',event=>{if(event.target.closest('#platformForm'))dirty=true;});
document.addEventListener('change',event=>{if(event.target.matches('[name=ai_provider],[name=ai_model]')){const form=document.querySelector('#platformForm'),box=form?.querySelector('[name=ai_enabled]');if(box){box.checked=false;box.disabled=true;}}});
document.addEventListener('submit',async event=>{const form=event.target;if(!form.matches('#platformForm,#adminShopForm'))return;event.preventDefault();if(loading||!authorized||!form.reportValidity())return;const values=Object.fromEntries(new FormData(form)),gen=generation;loading=true;const button=form.querySelector('[type=submit]');button.disabled=true;try{if(form.id==='platformForm')await window.NeoCloud.platform('save',{support_email:values.support_email,site_url:values.site_url,require_approval:values.require_approval==='on'});else await window.NeoCloud.shop('settings',{...values,shipping_cents:window.NeoShopCore.cents(values.shipping,true),delivery_min:Number(values.delivery_min),delivery_max:Number(values.delivery_max),shipping_ready:values.shipping_ready==='on'});if(gen!==generation)return;dirty=false;loading=false;await refresh();$('#adminStatus').textContent='Configurações salvas no servidor.';}catch(err){if(gen===generation)$('#adminStatus').textContent=err.message;}finally{loading=false;button.disabled=false;}});
let paymentConfig=null,paymentBusy=false,paymentMessage='',paymentSelected='test';
function paymentPanel(){const root=paymentConfig||{},active=root.active_environment||root.environment||'test',c=root.environments?.[paymentSelected]||(root.environment===paymentSelected?root:{}),url=root.webhook_url||new URL('/functions/v1/mercadopago-webhook',window.NEO_CONFIG.supabaseUrl).href,saved=c.configured?' <span class="tag">✓ Salvo</span>':'',label=paymentSelected==='production'?'Produção':'Teste',message=paymentMessage||(c.validated_at?'Conexão validada · conta '+c.collector_id:c.configured?'Credenciais salvas. Teste esta conexão antes de ativar.':'Cadastre as credenciais de '+label+'.');return `<section class="card space"><div class="between"><div><h2>Pagamento · Mercado Pago</h2><p class="sub">Teste e Produção ficam salvos separadamente. Somente o ambiente ativo recebe novas compras.</p></div><span class="tag">Ativo: ${active==='production'?'Produção':'Teste'}</span></div><div class="segmented shop-payment-environments" role="tablist"><button type="button" data-admin-payment-environment="test" class="${paymentSelected==='test'?'active':''}" aria-selected="${paymentSelected==='test'}">Teste</button><button type="button" data-admin-payment-environment="production" class="${paymentSelected==='production'?'active':''}" aria-selected="${paymentSelected==='production'}">Produção</button></div><form id="adminPaymentForm" class="space"><input type="hidden" name="environment" value="${paymentSelected}"><label>Access Token${saved}<input name="access_token" type="password" autocomplete="new-password" placeholder="${c.configured?'Salvo · deixe vazio para manter':'Cole o Access Token deste ambiente'}"></label><label>Assinatura secreta do webhook${saved}<input name="webhook_secret" type="password" autocomplete="new-password" placeholder="${c.configured?'Salva · deixe vazio para manter':'Cole a assinatura secreta deste ambiente'}"></label><label>URL de notificação<input data-admin-webhook readonly value="${esc(url)}"></label><button class="secondary" type="button" data-admin-copy-webhook>Copiar URL do webhook</button><p class="notice" data-payment-status>${esc(message)}</p><div class="shop-admin-actions"><button class="secondary" ${paymentBusy?'disabled':''}>Salvar credenciais</button><button class="secondary" type="button" data-admin-payment-test ${!c.configured||paymentBusy?'disabled':''}>Testar conexão</button><button class="primary" type="button" data-admin-payment-activate ${!c.validated_at||active===paymentSelected||paymentBusy?'disabled':''}>${active===paymentSelected?'Ambiente ativo':'Ativar '+label}</button></div></form></section>`}
const originalSettingsView=settingsView;settingsView=p=>{const html=originalSettingsView(p).replace('<div data-agent-admin></div>','<div data-agent-admin></div><div data-admin-payment>'+paymentPanel()+'</div>').replace(/<p class="sub">Mercado Pago:[\s\S]*?<\/details>/,'').replace('<h2>Pagamentos e entrega</h2>','<h2>Entrega e condições da loja</h2>');if(!paymentConfig&&!paymentBusy)setTimeout(loadPaymentConfig);return html};
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
function signupRow(row,observed={}){
 const name=esc(row.full_name||'Nome não informado'),email=esc(row.email||'E-mail não informado');
 const method={email:'E-mail',google:'Google',apple:'Apple'}[row.provider]||'Não informado';
 return `<details class="admin-signup"><summary>
  <span class="admin-signup-person"><strong>${name}</strong><small>${email}</small></span>
  <time title="${esc(signupDate(row.created_at,signupFullTime))}">${signupDate(row.created_at,signupShortTime)}</time>
  ${row.is_new?'<span class="admin-signup-new">Novo</span>':''}<span aria-hidden="true" class="admin-signup-chevron">⌄</span>
 </summary><dl>
  <div><dt>Nome completo</dt><dd>${name}</dd></div><div><dt>E-mail</dt><dd>${email}</dd></div>
  <div><dt>Local de origem</dt><dd>Localização não disponível</dd></div>
  <div><dt>Local do último acesso</dt><dd>Localização não disponível</dd></div><div><dt>Método</dt><dd>${method}</dd></div>
  <div><dt>Cadastro</dt><dd>${signupDate(row.created_at,signupFullTime)}</dd></div>
  <div><dt>Último acesso</dt><dd>${signupDate(row.last_access,signupFullTime)}</dd></div>
  <div><dt>Identificador</dt><dd>${esc(row.id)}</dd></div>
  <div><dt>Primeiro dispositivo observado</dt><dd>${audienceDeviceSummary(observed.first_device)}</dd></div>
  <div><dt>Último dispositivo observado</dt><dd>${audienceDeviceSummary(observed.last_device)}</dd></div>
  <div><dt>Primeira origem / campanha observada</dt><dd>${audienceCampaignSummary(observed.first_campaign)}</dd></div>
  <div><dt>Última origem / campanha observada</dt><dd>${audienceCampaignSummary(observed.last_campaign)}</dd></div>
 </dl></details>`;
}
async function mountAdminSignups(root){
 const cloud=window.NeoCloud,account=cloud.user?.id;
 if(!root||!account||!cloud.adminSignups)return;
 if(signupVisit?.account!==account)signupVisit={account,batch:null,notice:null,opening:null};
 const visit=signupVisit,current=()=>root.isConnected&&cloud.user?.id===account&&signupVisit===visit;
 root.innerHTML=`<section class="card space"><h2>Cadastros</h2>
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
 let sequence=0,cursor=null,filters={};
 async function load(next=false){
  const request=++sequence;
  more.disabled=true;
  status.textContent='Carregando cadastros…';
  try{
   const page=await cloud.adminSignups('page',{...filters,p_batch:visit.batch,
    p_before:next?cursor?.created_at:null,p_before_id:next?cursor?.id:null});
   if(!current()||request!==sequence)return;
   const rows=page.rows.slice(0,20);
   let observations={};
   if(rows.length&&cloud.adminAudience){
    try{observations=await cloud.adminAudience({p_users:rows.map(row=>row.id)})}catch{}
   }
   if(!current()||request!==sequence)return;
   cursor=rows.at(-1);
   if(!next)list.replaceChildren();
   list.insertAdjacentHTML('beforeend',rows.map(row=>signupRow(row,observations?.[row.id])).join(''));
   more.hidden=page.rows.length<=20;
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
  more.hidden=true;
  void load();
 });
 more.addEventListener('click',()=>void load(true));
 try{
  visit.opening??=cloud.adminSignups('open').then(opened=>{
   if(opened.read_count>0){
    visit.batch=opened.batch;
    visit.notice={count:opened.read_count,rows:opened.rows};
   }
  }).finally(()=>{visit.opening=null});
  await visit.opening;
 }catch(error){
  if(!current())return;
  if(error.code==='42501')root.innerHTML='';
  else status.textContent='Não foi possível conferir novos cadastros. Use Atualizar para tentar novamente.';
  return;
 }
 if(!current())return;
 if(visit.notice&&!activeSignupToast){
  showSignupToast(visit.notice);
  visit.notice=null;
 }
 void load();
}
const audienceLabels={mobile:'Celular',tablet:'Tablet',desktop:'Desktop',pwa:'PWA',browser:'Navegador'};
function audienceDeviceSummary(d){
 if(!d)return 'Não disponível';
 return esc([audienceLabels[d.category],d.os,d.browser&&[d.browser,d.major].filter(Boolean).join(' '),audienceLabels[d.context],
  signupDate(d.at,signupFullTime)].filter(Boolean).join(' · '));
}
function audienceCampaignSummary(c){
 if(!c)return 'Não disponível';
 return esc([c.referrer,c.utm_source,c.utm_medium,c.utm_campaign,c.utm_content,c.utm_term,
  signupDate(c.at,signupFullTime)].filter(Boolean).join(' · '));
}
function audienceChart(title,rows){
 const shown=rows.filter(row=>Number.isFinite(row.count));
 const max=Math.max(1,...shown.map(row=>row.count));
 return `<details class="audience-chart"><summary>${title}</summary>${
  shown.length?shown.map(row=>`<div class="audience-bar"><span>${esc(row.label)}</span>
   <meter value="${row.count}" max="${max}" aria-label="${esc(row.label)}"></meter><b>${row.count}${row.total?' · '+Math.round(row.count/row.total*100)+'%':''}</b></div>`).join('')
  :'<p class="sub">Dados insuficientes no período.</p>'}</details>`;
}
function mountAdminAudience(root){
 const cloud=window.NeoCloud,account=cloud.user?.id;
 if(!root||!account||!cloud.adminAudience)return;
 root.innerHTML=`<section class="card space"><h2>Estatísticas de público</h2>
  <form class="admin-signup-filters space"><label>Período<select name="window"><option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option><option value="custom">Personalizado</option></select></label>
  <label>De<input type="date" name="from"></label><label>Até<input type="date" name="to"></label><button type="submit" class="secondary">Aplicar</button></form>
  <p data-audience-message role="status" class="sub"></p><div data-audience-results></div><div data-engagement-report></div></section>`;
 const form=root.querySelector('form'),message=root.querySelector('[data-audience-message]'),results=root.querySelector('[data-audience-results]');
 let sequence=0;
 async function load(windowDays=30,customFrom=null,customTo=null){
  const request=++sequence,today=new Date(),end=today.toISOString().slice(0,10);
  today.setUTCDate(today.getUTCDate()-windowDays+1);
  const from=customFrom||today.toISOString().slice(0,10),to=customTo||end;
  message.textContent='Carregando estatísticas…';
  try{
   const d=await cloud.adminAudience({p_from:from,p_to:to});
   if(request!==sequence||!root.isConnected||cloud.user?.id!==account)return;
   const kpis=[['Cadastros hoje (UTC)',d.today],['Cadastros em 7 dias',d.signups_7],['Cadastros em 30 dias',d.signups_30],
    ['Cadastros no período',d.period_signups],['Ativos em 24 h',d.active_1],['Ativos em 7 dias',d.active_7],['Ativos em 30 dias',d.active_30]];
   const group=(kind,title)=>audienceChart(title,d.groups.filter(row=>row.kind===kind).map(row=>({label:audienceLabels[row.label]||row.label,count:row.n,total:row.visible_total})));
   results.innerHTML=`<div class="audience-kpis">${kpis.map(([label,count])=>`<div><small>${label}</small><strong>${Number(count).toLocaleString('pt-BR')}</strong></div>`).join('')}</div>
   <p class="sub">Último acesso registrado: ${signupDate(d.last_access,signupFullTime)}.</p>
   <div class="audience-charts">${audienceChart('Cadastros por dia',d.daily)}${audienceChart('Cadastros por mês',d.monthly)}
   ${audienceChart('Último acesso no período', [{label:'Contas criadas no período',count:d.new_active},{label:'Contas anteriores',count:d.returning_active}])}
   ${group('device','Tipos de dispositivo')}${group('os','Sistemas operacionais')}${group('browser','Navegadores')}${group('context','PWA e navegador')}
   ${group('referral','Referências identificadas')}${group('campaign','Campanhas identificadas')}</div>
   <p class="sub">Dispositivos e campanhas usam observações autorizadas das contas cadastradas no período. Grupos pequenos são omitidos, e os percentuais representam os grupos exibidos.</p>
   <p class="sub">Geografia: localização indisponível para os cadastros. Conversão, frequência e retenção dependem de dados adicionais.</p>`;
   message.textContent='Período: '+d.from+' a '+d.to+' (UTC).';
   void mountEngagementReport(root.querySelector('[data-engagement-report]'),from,to);
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
$('#adminRefresh').onclick=refresh;
window.NeoGestures?.configure({refresh,back:()=>history.length>1?history.back():location.assign('../')});
window.NeoCloud.init((event,user)=>{if(event==='TOKEN_REFRESHED')return;if(signupVisit?.account!==user?.id){clearSignupToast();signupVisit=null}generation++;window.NeoAgent?.reset();authorized=false;$('#adminTabs').hidden=true;$('#adminContent').innerHTML='';if(user)refresh();else $('#adminStatus').textContent='Sessão ausente. Entre no aplicativo.';}).then(user=>{if(user)refresh();else if(!window.NeoCloud.configured)refresh();else $('#adminStatus').textContent='Entre na sua conta pelo aplicativo.';}).catch(()=>{$('#adminStatus').textContent='Não foi possível verificar a sessão.';});
