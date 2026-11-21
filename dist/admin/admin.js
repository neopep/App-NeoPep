'use strict';
const $=s=>document.querySelector(s),esc=window.NeoCore.escape;let generation=0,loading=false,authorized=false,tab='overview',platform=null,dirty=false,authConfirmation=null;
function overview(d){const metrics=[['Usuários cadastrados',d.users_total],['Cadastros em 7 dias',d.signups_7d],['Ativos em 24 horas',d.active_24h],['Ativos em 7 dias',d.active_7d],['Ativos em 30 dias',d.active_30d],['Perfis configurados',d.profiles_total],['Registros totais',d.records_total],['Fotos armazenadas',d.photos_total]];return `<div class="stats">${metrics.map(([title,value])=>`<article class="card stat"><div class="stat-label">${title}</div><div class="stat-value">${Number.isFinite(value)?value.toLocaleString('pt-BR'):'—'}</div></article>`).join('')}</div><div class="two-cols"><section class="card"><h2>Funcionamento</h2><p class="sub space">Banco: ${d.database_status==='reachable'?'respondeu à consulta':'não confirmado'}<br>Storage privado: ${d.private_storage===true?'confirmado':'não confirmado'}<br>Schema: ${esc(d.schema_version)}<br>Horário do servidor: ${esc(d.server_time)}</p><div class="notice">“Ativo” significa acesso autenticado informado pelo aplicativo. Esta consulta não mede disponibilidade externa, latência de todas as funções ou entrega de e-mails.</div></section><section class="card"><h2>Erros informados pelo app · 7 dias</h2>${d.app_errors_7d.length?d.app_errors_7d.map(r=>`<div class="task"><b>${esc(r.code)}</b><span>${Number(r.count)}</span></div>`).join(''):'<p class="sub space">Nenhum erro de categoria permitida foi informado.</p>'}<p class="sub space">Contadores limitados por conta. Não contêm mensagens livres, notas, identificadores ou valores de saúde.</p></section></div><section class="card space"><h2>Cadastros por dia</h2>${d.signups_daily.map(r=>`<div class="task"><b>${esc(r.day)}</b><span>${r.count===null?'Menos de 5 · célula suprimida':Number(r.count)}</span></div>`).join('')||'<p class="sub">Sem cadastros no período.</p>'}</section>`;}
function input(name,label,value='',extra=''){return `<label>${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;}
function settingsView(p){const c=p.config,s=p.shop||{},publicCfg=window.NEO_CONFIG||{};return `<section class="card space"><h2>Cadastro e confirmação de e-mail</h2><p class="sub">Controle exclusivo do administrador principal. Desativar permite criar conta e entrar sem confirmar a propriedade do e-mail. Recuperação de senha ainda depende de envio de e-mail. Reativar vale para novos cadastros.</p><p id="authSettingsStatus" role="status">Estado ainda não consultado no Supabase.</p><button class="secondary" type="button" id="authSettingsRead">Consultar estado atual</button><form id="authSettingsForm" class="space"><label class="check"><input type="checkbox" id="requireEmailConfirmation" disabled> Exigir confirmação de e-mail nos novos cadastros</label><button class="primary" type="submit" disabled>Aplicar no Supabase</button></form></section><form id="platformForm"><section class="card space"><h2>Configurações gerais</h2><p class="sub">Referências operacionais do suporte. Alterar a URL aqui não conecta um domínio nem muda as permissões do CAPTCHA.</p>${input('support_email','E-mail operacional de atendimento',c.support_email||publicCfg.privacyContact||'','type="email" maxlength="254"')}${input('site_url','Endereço público de referência',c.site_url||'','type="url" maxlength="2000" placeholder="https://…"')}<label class="check"><input type="checkbox" name="require_approval" ${p.require_approval?'checked':''}> Exigir aprovação das novas mensagens do Grupo</label></section><button class="primary full space" type="submit">Salvar configurações</button></form><div data-agent-admin></div><section class="card space"><h2>Pagamentos e entrega</h2><p class="sub">Mercado Pago: ${s.payments_ready?'habilitado no ambiente '+esc(s.payment_environment):'configuração e homologação pendentes'}. Retorno do navegador não confirma pagamento.</p><details class="admin-secret-help"><summary>Integração com Mercado Pago</summary><p class="sub">As credenciais MP_ACCESS_TOKEN, MP_COLLECTOR_ID, MP_WEBHOOK_SECRET, MP_MODE e SHOP_APP_URL ficam nos Secrets do Supabase. Teste completo e webhook são necessários antes de ativar pagamentos. Não coloque essas chaves no formulário.</p><p class="sub">Webhook: <code>${esc(publicCfg.supabaseUrl||'')}/functions/v1/mercadopago-webhook</code></p></details><form id="adminShopForm" class="space">${input('seller_name','Responsável pela loja',s.seller_name||'','required maxlength="120"')}${input('seller_document','CPF ou CNPJ',s.seller_document||'','required maxlength="14" inputmode="numeric"')}${input('business_address','Endereço comercial',s.business_address||'','required maxlength="250"')}${input('support_email','E-mail de atendimento da loja',s.support_email||'','required type="email" maxlength="254"')}<label>Condições de troca<textarea name="returns_policy" rows="4" required maxlength="4000">${esc(s.returns_policy||'')}</textarea></label><div class="form-grid">${input('shipping','Frete fixo (R$)',String((s.shipping_cents??0)/100).replace('.',','),'required inputmode="decimal"')}${input('delivery_min','Prazo mínimo em dias úteis',s.delivery_min??3,'required type="number" min="1" max="90"')}${input('delivery_max','Prazo máximo em dias úteis',s.delivery_max??10,'required type="number" min="1" max="120"')}</div><label class="check"><input type="checkbox" name="shipping_ready" ${s.shipping_ready?'checked':''}> Entrega e prazo conferidos</label><button class="secondary full" type="submit">Salvar entrega e condições</button></form></section>`;}
async function refresh(){if(loading)return;window.NeoAgent?.reset();authConfirmation=null;const gen=++generation;loading=true;$('#adminContent').innerHTML='';$('#adminStatus').textContent='Verificando autorização no servidor…';$('#adminRefresh').disabled=true;try{if(!window.NeoCloud.configured)throw Error('Supabase não configurado. O painel não apresenta métricas fictícias.');if(!window.NeoCloud.user)throw Error('Entre na sua conta pelo aplicativo e abra novamente o painel.');const d=await window.NeoCloud.adminSummary();if(gen!==generation)return;authorized=true;$('#adminTabs').hidden=false;$('#adminTitle').textContent=tab==='settings'?'Configurações da plataforma':'Visão da plataforma';$('#adminSubtitle').textContent=tab==='settings'?'Geral, atendimento com IA e integrações da loja.':'Indicadores e cadastros. Autorização verificada no servidor.';for(const button of document.querySelectorAll('[data-admin-tab]')){const active=button.dataset.adminTab===tab;button.className=active?'primary':'secondary';button.setAttribute('aria-pressed',String(active));}if(tab==='settings'){try{platform=await window.NeoCloud.platform();if(gen!==generation)return;$('#adminContent').innerHTML=settingsView(platform);window.NeoAgent?.mount($('#adminContent [data-agent-admin]'));}catch(err){$('#adminContent').innerHTML='<section class="card"><h2>Ativação das configurações</h2><p class="sub">Execute a atualização de Biblioteca e integrações no Supabase. As configurações são autorizadas pelo servidor e não são simuladas neste painel.</p></section>';throw err;}}else {$('#adminContent').innerHTML=overview(d)+'<div data-admin-signups></div>';void mountAdminSignups($('[data-admin-signups]'));}$('#adminStatus').textContent='Consulta autorizada. Atualizado agora.';dirty=false;}catch(err){if(gen!==generation)return;$('#adminStatus').textContent='Acesso não disponível: '+err.message;if(!authorized){$('#adminTabs').hidden=true;$('#adminContent').innerHTML='<div class="notice">Somente uma permissão concedida pelo responsável no banco habilita este painel. Editar perfil ou dados do navegador não concede acesso.</div>';}}finally{loading=false;$('#adminRefresh').disabled=false;}}
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
const signupFullTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium'});
const signupShortTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});
const signupHour=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'});
function signupDate(value,formatter){
 const time=value?new Date(value):null;
 return time&&Number.isFinite(+time)?formatter.format(time):'Ainda não registrado';
}
function signupRow(row){
 const name=esc(row.full_name||'Nome não informado'),email=esc(row.email||'E-mail não informado');
 const method={email:'E-mail',google:'Google',apple:'Apple'}[row.provider]||'Não informado';
 return `<details class="admin-signup"><summary>
  <span class="admin-signup-person"><strong>${name}</strong><small>${email}</small></span>
  <time title="${esc(signupDate(row.created_at,signupFullTime))}">${signupDate(row.created_at,signupShortTime)}</time>
  ${row.is_new?'<span class="admin-signup-new">Novo</span>':''}<span aria-hidden="true" class="admin-signup-chevron">⌄</span>
 </summary><dl>
  <div><dt>Nome completo</dt><dd>${name}</dd></div><div><dt>E-mail</dt><dd>${email}</dd></div>
  <div><dt>Origem</dt><dd>Localização não disponível</dd></div><div><dt>Método</dt><dd>${method}</dd></div>
  <div><dt>Cadastro</dt><dd>${signupDate(row.created_at,signupFullTime)}</dd></div>
  <div><dt>Último acesso</dt><dd>${signupDate(row.last_access,signupFullTime)}</dd></div>
  <div><dt>Identificador</dt><dd>${esc(row.id)}</dd></div>
 </dl></details>`;
}
async function mountAdminSignups(root){
 const cloud=window.NeoCloud,account=cloud.user?.id;
 if(!root||!account||!cloud.adminSignups)return;
 if(signupVisit?.account!==account)signupVisit={account,batch:null,notice:null,opening:null};
 const visit=signupVisit,current=()=>root.isConnected&&cloud.user?.id===account&&signupVisit===visit;
 root.innerHTML=`<section class="card space"><h2>Cadastros</h2>
  <div data-signup-notice aria-live="polite" hidden class="admin-signup-notice"></div>
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
 const more=find('[data-signup-more]'),notice=find('[data-signup-notice]');
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
   cursor=rows.at(-1);
   if(!next)list.replaceChildren();
   list.insertAdjacentHTML('beforeend',rows.map(signupRow).join(''));
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
    visit.notice={count:opened.read_count,rows:opened.rows,until:Date.now()+9000};
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
 const pending=visit.notice;
 if(pending&&pending.until>Date.now()){
  const amount=Number(pending.count);
  root.closest('#adminContent').prepend(notice);
  notice.hidden=false;
  notice.innerHTML=`<strong>${amount.toLocaleString('pt-BR')} ${amount===1?'novo cadastro':'novos cadastros'}</strong>`+
   `<ul>${pending.rows.map(row=>`<li>${esc(row.full_name||row.email||'Nome não informado')} · ${signupDate(row.created_at,signupHour)}</li>`).join('')}</ul>`+
   (amount>pending.rows.length?'<small>Consulte a lista abaixo para ver os demais cadastros.</small>':'');
  setTimeout(()=>{notice.hidden=true;notice.replaceChildren();if(visit.notice===pending)visit.notice=null},pending.until-Date.now());
 }
 void load();
}
$('#adminRefresh').onclick=refresh;
window.NeoGestures?.configure({refresh,back:()=>history.length>1?history.back():location.assign('../')});
window.NeoCloud.init((event,user)=>{if(event==='TOKEN_REFRESHED')return;if(signupVisit?.account!==user?.id)signupVisit=null;generation++;window.NeoAgent?.reset();authorized=false;$('#adminTabs').hidden=true;$('#adminContent').innerHTML='';if(user)refresh();else $('#adminStatus').textContent='Sessão ausente. Entre no aplicativo.';}).then(user=>{if(user)refresh();else if(!window.NeoCloud.configured)refresh();else $('#adminStatus').textContent='Entre na sua conta pelo aplicativo.';}).catch(()=>{$('#adminStatus').textContent='Não foi possível verificar a sessão.';});
