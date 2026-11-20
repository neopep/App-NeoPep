window.NeoPush=(()=>{
 const style=document.createElement('style');
 style.textContent='.notification-settings-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.notification-settings-actions [hidden]{display:none!important}.notification-settings [data-push-status]{min-height:22px;margin:10px 0;color:var(--muted);font-size:12px}.notification-settings .push-active{color:var(--good);border-color:var(--good)}.notification-disable{color:var(--danger)}.push-invite{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:20px;background:#080907b8;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}.push-invite-card{width:min(420px,100%);padding:28px;text-align:center}.push-invite-icon{display:grid;place-items:center;width:62px;height:62px;margin:0 auto 18px;border-radius:50%;border:1px solid var(--accent);color:var(--accent);font-size:27px}.push-invite h2{font-size:24px;margin-bottom:10px}.push-invite p{line-height:1.7}.push-invite-actions{display:grid;gap:10px;margin-top:22px}.push-invite-status{min-height:22px;margin:14px 0 0;color:var(--muted);font-size:12px}';
 document.head.append(style);
 const supports=()=>('serviceWorker'in navigator)&&('PushManager'in window)&&('Notification'in window);
 const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const configured=()=>/^[A-Za-z0-9_-]{87}$/.test(window.NEO_CONFIG?.pushVapidPublicKey||'');
 const inviteKey='neo-push-invite-confirmed-v1';
 const timeout=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error(label)),ms))]);
 let active=false,busy=false,activationTask=null,prompted=false,lastStatus='';
 const baseState=cloud=>!cloud?'Entre na conta para ativar.':!configured()?'Ativação pendente: a configuração segura de envio ainda precisa ser concluída.':!supports()?'Este navegador não oferece notificações compatíveis.':ios()&&!installed()?'No iPhone, instale o NeoPep na tela inicial e abra pelo ícone.':Notification.permission==='denied'?'Notificações bloqueadas nos ajustes do dispositivo.':'Verificando este dispositivo…';
 const panel=({cloud})=>{queueMicrotask(()=>sync(cloud));return `<section class="card notification-settings"><h2>Notificações e lembretes</h2><p class="sub">Receba lembretes e avisos de mensagens, grupos, compras e novos materiais mesmo com o aplicativo fechado. O conteúdo da tela bloqueada é discreto.</p><p class="notice compact" data-push-state>${baseState(cloud)}</p><div class="notification-settings-actions"><button class="primary" data-push="enable" ${!cloud||!configured()||!supports()?'disabled':''}>Ativar neste dispositivo</button><button class="secondary notification-disable" data-push="disable" hidden>Desativar neste dispositivo</button></div><p data-push-status role="status">${lastStatus}</p><details class="notification-calendar"><summary>Usar também a agenda do telefone</summary><p class="sub">A agenda é uma alternativa para os horários de peso, medidas e lembretes pessoais.</p><button class="secondary full" id="calendarExport">Exportar para a agenda (.ics)</button></details></section>`};
 const roots=()=>({state:document.querySelector('[data-push-state]'),status:document.querySelector('[data-push-status]'),enable:document.querySelector('[data-push="enable"]'),disable:document.querySelector('[data-push="disable"]')});
 function message(text){lastStatus=text;const ui=roots();if(ui.status)ui.status.textContent=text;const invite=document.querySelector('[data-push-invite-status]');if(invite)invite.textContent=text}
 function paint(text=''){
  const ui=roots();
  if(ui.state){ui.state.textContent=text||(active?'Notificações ativadas neste dispositivo.':Notification.permission==='denied'?'Notificações bloqueadas nos ajustes do dispositivo.':'Notificações desativadas neste dispositivo.');ui.state.classList.toggle('push-active',active)}
  if(ui.enable){ui.enable.hidden=active;ui.enable.disabled=busy||!window.NeoCloud?.user||!configured()||!supports()||Notification.permission==='denied'}
  if(ui.disable){ui.disable.hidden=!active;ui.disable.disabled=busy}
 }
 async function registration(){
  let reg=await timeout(navigator.serviceWorker.getRegistration('./'),8000,'O aplicativo demorou para localizar o serviço de notificações.');
  if(!reg)reg=await timeout(navigator.serviceWorker.register('./sw.js',{scope:'./'}),15000,'Não foi possível instalar o serviço de notificações.');
  reg.update().catch(()=>{});
  if(reg.active)return reg;
  if(reg.waiting){reg.waiting.postMessage({type:'SKIP_WAITING'});}
  await timeout(new Promise((resolve,reject)=>{
   const worker=reg.installing||reg.waiting;
   if(!worker){reject(Error('O serviço de notificações não iniciou.'));return}
   const check=()=>{if(reg.active||worker.state==='activated')resolve();else if(worker.state==='redundant')reject(Error('A instalação do serviço de notificações falhou.'))};
   worker.addEventListener('statechange',check);check();
  }),25000,'O serviço de notificações não ficou pronto. Verifique a conexão e tente novamente.');
  return reg;
 }
 async function subscription(){if(!supports())return null;return timeout((async()=>{const reg=await registration();return reg?.pushManager.getSubscription()||null})(),15000,'Não foi possível consultar as notificações deste aparelho.')}
 async function register(sub){
  if(!window.NeoCloud.user?.id)throw Error('A sessão ainda está sendo carregada. Aguarde um instante.');
  await timeout(window.NeoCloud.pushDevice('register',sub.toJSON(),Intl.DateTimeFormat().resolvedOptions().timeZone),15000,'O cadastro no servidor demorou demais. Verifique a conexão e tente novamente.');
  timeout(window.NeoCloud.communityActivity?.('preferences',{enabled:true})||Promise.resolve(),10000,'').catch(()=>{});
 }
 async function sync(cloud=window.NeoCloud?.user){
  if(!cloud||!configured()||!supports()||(ios()&&!installed())||Notification.permission==='denied'){active=false;paint(baseState(cloud));return false}
  if(busy)return activationTask;
  try{const sub=await subscription();if(!sub){active=false;paint('Notificações desativadas neste dispositivo.');return false}await register(sub);active=true;message('');paint('Notificações ativadas e registradas neste dispositivo.');document.querySelector('[data-push-invite]')?.remove();return true}
  catch(err){active=false;paint('A permissão existe, mas falta concluir o cadastro deste dispositivo.');message(err.code==='PGRST202'?'Falta atualizar a estrutura de notificações no Supabase.':err.message||'Toque em Ativar para tentar novamente.');return false}
 }
 async function enable(){
  if(activationTask)return activationTask;
  const account=window.NeoCloud.user?.id;
  activationTask=(async()=>{
   if(!account||!configured()||!supports())throw Error('A configuração de envio ainda não foi concluída.');
   if(ios()&&!installed())throw Error('Abra o aplicativo pelo ícone da tela inicial do iPhone.');
   message('Solicitando autorização do aparelho…');
   const permission=Notification.permission==='granted'?'granted':await timeout(Notification.requestPermission(),30000,'A autorização do aparelho não foi concluída.');
   if(permission!=='granted')throw Error('Permissão não concedida. Você pode alterá-la nos ajustes do dispositivo.');
   message('Preparando o serviço de notificações…');
   const reg=await registration(),key=window.NEO_CONFIG.pushVapidPublicKey,padded=key+'='.repeat((4-key.length%4)%4),bytes=Uint8Array.from(atob(padded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   const existing=await timeout(reg.pushManager.getSubscription(),10000,'Não foi possível consultar a assinatura deste aparelho.');
   message(existing?'Confirmando este dispositivo…':'Criando a assinatura segura…');
   const sub=existing||await timeout(reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes}),20000,'O aparelho não concluiu a assinatura. Feche e abra o aplicativo pelo ícone e tente novamente.');
   if(window.NeoCloud.user?.id!==account)throw Error('A sessão foi atualizada durante a ativação. Tente novamente.');
   try{await register(sub)}catch(err){if(!existing)await sub.unsubscribe().catch(()=>{});throw err}
   active=true;lastStatus='Tudo certo. Este dispositivo receberá os avisos habilitados.';paint('Notificações ativadas e registradas neste dispositivo.');message(lastStatus);document.querySelector('[data-push-invite]')?.remove();document.dispatchEvent(new CustomEvent('neo:push-state',{detail:{active:true}}));return true;
  })().finally(()=>{busy=false;activationTask=null;paint()});
  busy=true;paint();return activationTask;
 }
 async function detach(){
  if(!supports())return;const sub=await subscription();
  if(!sub){active=false;paint();message('Não havia uma assinatura ativa neste dispositivo.');return}
  let removed=false;try{if(window.NeoCloud.user)await timeout(window.NeoCloud.pushDevice('remove',sub.toJSON()),12000,'Falha ao remover o dispositivo.'),removed=true}catch{}
  const unsubscribed=await timeout(sub.unsubscribe(),12000,'O aparelho demorou para desativar as notificações.');if(!removed&&!unsubscribed)throw Error('Não foi possível desativar. Tente novamente antes de sair.');active=false;
 }
 function invite(){
  if(document.querySelector('[data-push-invite]')||active||busy||prompted||localStorage.getItem(inviteKey)==='1'||!window.NeoCloud?.user||!configured()||!supports()||(ios()&&!installed())||Notification.permission==='denied'||document.querySelector('[data-arrival]'))return false;
  prompted=true;const root=document.createElement('div');root.className='push-invite';root.dataset.pushInvite='';root.innerHTML='<section class="card push-invite-card" role="dialog" aria-modal="true" aria-labelledby="pushInviteTitle"><span class="push-invite-icon" aria-hidden="true">♢</span><p class="eyebrow">NÃO PERCA NENHUMA ATUALIZAÇÃO</p><h2 id="pushInviteTitle">Ative as notificações</h2><p class="sub">Receba lembretes e avisos importantes mesmo quando o NeoPep estiver fechado. Você pode desativar depois em Lembretes.</p><div class="push-invite-actions"><button class="primary full" type="button" data-push="enable">Ativar notificações</button><button class="text-btn full" type="button" data-push-invite-later>Agora não</button></div><p class="push-invite-status" data-push-invite-status role="status"></p></section>';document.body.append(root);root.querySelector('[data-push="enable"]').focus();return true;
 }
 async function maybePrompt(){
  if(prompted||document.querySelector('[data-arrival]')||!window.NeoCloud?.user)return false;
  if(Notification.permission==='granted'){await sync();localStorage.setItem(inviteKey,'1');return false}
  return invite();
 }
 document.addEventListener('click',async event=>{
  if(event.target.closest('[data-push-invite-later]')){localStorage.setItem(inviteKey,'1');document.querySelector('[data-push-invite]')?.remove();return}
  const button=event.target.closest('[data-push]');if(!button||busy)return;
  if(button.dataset.push==='disable'){busy=true;paint();message('Desativando…');try{await detach();message('Notificações desativadas neste dispositivo.')}catch(err){message(err.message||'Não foi possível desativar.')}finally{busy=false;paint()}return}
  message('Iniciando a ativação…');
  try{await enable()}catch(err){active=false;paint();message(err.code==='PGRST202'?'Falta atualizar a estrutura de notificações no Supabase.':err.message||'Não foi possível alterar as notificações.')}
 });
 document.addEventListener('neo-arrival-finished',()=>setTimeout(maybePrompt,500));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){sync();setTimeout(maybePrompt,1800)}});
 let checks=0;const startup=setInterval(()=>{checks++;if(window.NeoCloud?.user&&!document.querySelector('[data-arrival]')){clearInterval(startup);setTimeout(maybePrompt,1800)}else if(checks>40)clearInterval(startup)},500);
 return {panel,detach,supports,configured,sync,enable,maybePrompt};
})();
