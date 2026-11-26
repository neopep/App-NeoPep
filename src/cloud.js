import { createClient } from '@supabase/supabase-js';
const C=window.NeoCore, config=window.NEO_CONFIG||{};
let client=null,user=null,profileRevision=null,listener=null,consents=[],isAdmin=false,onboarded=false,identityVersion=0;
// Mantém o callback já usado no Supabase ao abrir o aplicativo também na raiz.
function authRedirect(){const current=new URL(location.href),target=new URL(config.authRedirectPath||'./',current);if(target.origin!==current.origin)throw Error('O retorno de autenticação deve permanecer neste site.');target.hash='';target.search='';return target;}
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||'')&&C.isPublicSupabaseKey(config.supabasePublishableKey);
const ok=r=>{if(r.error){const source=r.error,emailLimit=source.code==='over_email_send_rate_limit'||/email rate limit exceeded/i.test(source.message||'');const error=new Error(emailLimit?'O limite de envio de e-mails foi atingido. Aguarde antes de tentar novamente. Se o problema continuar, entre em contato com o responsável pelo aplicativo.':source.message||'Não foi possível acessar a nuvem.');error.code=source.code||null;error.status=source.status||null;throw error}return r.data};
const needsHealth=()=>{need();if(!api.hasConsent('health')||!api.hasConsent('terms'))throw Error('Conclua o cadastro inicial e os consentimentos antes de gravar na conta.');};
const need=()=>{if(!client||!user)throw Error('Entre na sua conta para continuar.');return client};
async function getRows(query){let all=[],from=0;for(;;){const rows=ok(await query().range(from,from+999));all.push(...rows);if(rows.length<1000)return all;from+=1000;if(from>100000)throw Error('Muitos registros. Exporte os dados e contate o suporte.')}}
// SDK session tokens only: passwords and health records never enter this adapter.
const AUTH_KEY='neo-auth',REMEMBER_KEY='neo-auth-remember',AUTH_KEYS=[AUTH_KEY,AUTH_KEY+'-code-verifier',AUTH_KEY+'-user'];
const authMemory=new Map();
const browserStore=name=>{try{const value=window[name];return value&&typeof value.getItem==='function'&&typeof value.setItem==='function'&&typeof value.removeItem==='function'?value:null}catch{return null}};
const readStore=(store,key)=>{try{return store?.getItem(key)??null}catch{return null}};
const writeStore=(store,key,value)=>{try{if(!store)return false;store.setItem(key,value);return true}catch{return false}};
const removeStore=(store,key)=>{try{store?.removeItem(key)}catch{}};
let rememberSession=readStore(browserStore('localStorage'),REMEMBER_KEY)!=='false',persistenceLimited=false;
const authStorage={
 getItem(key){if(authMemory.has(key))return authMemory.get(key);const preferred=browserStore(rememberSession?'localStorage':'sessionStorage');let value=readStore(preferred,key);if(value!==null)return value;if(rememberSession){value=readStore(browserStore('sessionStorage'),key);if(value!==null){if(writeStore(preferred,key,value))removeStore(browserStore('sessionStorage'),key);else persistenceLimited=true;return value}}return authMemory.get(key)??null},
 setItem(key,value){authMemory.set(key,value);if(!writeStore(browserStore(rememberSession?'localStorage':'sessionStorage'),key,value)){if(rememberSession){persistenceLimited=true;removeStore(browserStore('localStorage'),key);writeStore(browserStore('sessionStorage'),key,value)}}else{authMemory.delete(key);removeStore(browserStore(rememberSession?'sessionStorage':'localStorage'),key)}},
 removeItem(key){authMemory.delete(key);removeStore(browserStore('localStorage'),key);removeStore(browserStore('sessionStorage'),key)}
};
function chooseRemember(value){if(typeof value!=='boolean')return;const saved=rememberSession===value?null:AUTH_KEYS.map(key=>[key,authStorage.getItem(key)]);rememberSession=value;writeStore(browserStore('localStorage'),REMEMBER_KEY,String(value));if(saved){for(const [key] of saved)authStorage.removeItem(key);for(const [key,item] of saved)if(item!==null)authStorage.setItem(key,item)}}
const clearAuthStorage=()=>AUTH_KEYS.forEach(key=>authStorage.removeItem(key));
const api={configured,
 async campaignImageURL(path){
  const result=ok(await need().storage.from('neo-campaign-images').createSignedUrl(path,120));
  return result.signedUrl;
 },
 async uploadCampaignImage(file){
  const sdk=need(),owner=user.id;
  if(!file||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Escolha JPEG, PNG ou WebP de até 5 MB.');
  const image=await createImageBitmap(file);
  let blob;
  try{
   const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(image.width,image.height));
   canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
   const context=canvas.getContext('2d');
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));
  }finally{image.close();}
  if(!blob||blob.size>5*1024*1024||owner!==user?.id)throw Error('Não foi possível preparar a imagem.');
  const path=owner+'/'+crypto.randomUUID()+'.jpg';
  ok(await sdk.storage.from('neo-campaign-images').upload(path,blob,{contentType:'image/jpeg',cacheControl:'0',upsert:false}));
  if(owner!==user?.id)throw Error('A sessão mudou.');
  return path;
 },
 ...(config.supabaseUrl==='https://qnuluspqfazdppciermw.supabase.co' ? {
  async importConnectRelease(manifest){
   const response=await need().functions.invoke('connect-release-draft',{body:manifest});
   if(response.error){
    let message='Não foi possível verificar o manifesto no servidor de Teste.';
    try{const detail=await response.error.context.json();if(typeof detail.error==='string')message=detail.error;}catch{}
    throw Error(message);
   }
   return response.data;
  },
  async connectUpdateAdmin(action,data={}){return ok(await need().rpc('neo_connect_update_admin',{p_action:action,p_data:data}));}
 } : {}),
 async connectWaConnections(){return ok(await need().rpc('neo_connect_wa_list_connections'));},
 async connectWaGroups(connection,after=null){return ok(await need().rpc('neo_connect_wa_list_groups',{p_connection:connection,p_after:after,p_limit:50}));},
 async connectAdmin(action,data={}){return ok(await need().rpc('neo_connect_admin',{p_action:action,p_data:data}));},
 async connectReleaseURL(path){return ok(await need().storage.from('neo-connect-releases').createSignedUrl(path,120,{download:'NeoPepConnectSetup.exe'})).signedUrl;},
 async campaignWeekly(action,data={}){
  const version=identityVersion;
  const result=ok(await need().rpc('neo_campaign_weekly_v1',{p_action:action,p_data:data}));
  if(version!==identityVersion)throw Error('A conta mudou.');
  return result;
 },
 async campaignCentral(action,data={}){
  const version=identityVersion;
  const result=ok(await need().rpc('neo_campaign_central_v1',{p_action:action,p_data:data}));
  if(version!==identityVersion)throw Error('A conta mudou.');
  return result;
 },
 async campaignEditor(action,data){const version=identityVersion;const result=ok(await need().rpc('neo_campaign_editor_v1',{p_action:action,p_data:data}));if(version!==identityVersion)throw Error('A conta mudou.');return result;},
 async campaignRich(action,data={}){
  const version=identityVersion;
  const result=ok(await need().rpc('neo_campaign_rich_admin_v1',{p_action:action,p_data:data}));
  if(version!==identityVersion)throw Error('A conta mudou.');
  return result;
 },
 async campaignOriginalUpload(path,file){
  const sdk=need(),version=identityVersion,owner=user?.id;
  const mime=file?.type;
  if(!owner||typeof path!=='string'||!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(pdf|mp4)$/.test(path)||path.split('/')[0]!==owner||
   !['application/pdf','video/mp4'].includes(mime)||!file.size||file.size>5242880||(mime==='application/pdf')!==path.endsWith('.pdf'))throw Error('Arquivo original inválido. PDF ou MP4 de até 5 MB.');
  const result=ok(await sdk.storage.from('neo-campaign-originals').upload(path,file,{contentType:mime,upsert:false,cacheControl:'0'}));
  if(version!==identityVersion||user?.id!==owner)throw Error('A conta mudou durante o envio.');
  return result.path;
 },
 async campaignOriginalURL(path){
  const sdk=need(),version=identityVersion,owner=user?.id;
  if(!owner||typeof path!=='string'||!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(pdf|mp4)$/.test(path))throw Error('Arquivo indisponível.');
  const result=ok(await sdk.storage.from('neo-campaign-originals').createSignedUrl(path,120));
  if(version!==identityVersion||user?.id!==owner)throw Error('A conta mudou.');
  return result.signedUrl;
 },
 async campaignOriginalDownload(path){
  const sdk=need(),version=identityVersion,owner=user?.id;
  if(!owner||typeof path!=='string'||!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(pdf|mp4)$/.test(path)||path.split('/')[0]!==owner)throw Error('Arquivo indisponível.');
  const file=ok(await sdk.storage.from('neo-campaign-originals').download(path));
  if(version!==identityVersion||user?.id!==owner)throw Error('A conta mudou.');
  if(!file||file.size>5242880)throw Error('Arquivo inválido.');
  return file;
 },
 async campaignMediaUpload(path,jpeg){
  const sdk=need(),version=identityVersion,owner=user?.id;
  if(typeof path!=='string'||!new RegExp('^[a-f0-9-]{36}/[a-f0-9-]{36}\\.jpg$').test(path)||
    path.split('/')[0]!==owner||!jpeg||jpeg.type!=='image/jpeg'||!jpeg.size||jpeg.size>1048576)
    throw Error('Imagem JPEG ou destino privado inválido. Máximo de 1 MB.');
  const uploaded=ok(await sdk.storage.from('neo-campaign-images').upload(path,jpeg,{
   contentType:'image/jpeg',upsert:false,cacheControl:'3600'
  }));
  if(version!==identityVersion||user?.id!==owner)throw Error('A conta mudou durante o envio.');
  return uploaded.path;
 },
 async campaignDispatch(action,data){const version=identityVersion;const result=ok(await need().rpc('neo_campaign_dispatch_admin_v1',{p_action:action,p_data:data}));if(version!==identityVersion)throw Error('A conta mudou.');return result;},
 async campaignTest(action,data={}){
  const version=identityVersion;
  const result=ok(await need().rpc('neo_campaign_test_admin_v1',{p_action:action,p_data:data}));
  if(version!==identityVersion)throw Error('A conta mudou.');
  return result;
 },
 async campaignTestVisit(action,batch=null){
  const version=identityVersion;
  const response=await need().rpc('neo_campaign_test_visit_v1',{p_action:action,p_batch:batch});
  if(version!==identityVersion)throw Error('A conta mudou.');
  if(['PGRST202','42883'].includes(response.error?.code))return null;
  return ok(response);
 },
 async campaignWhatsAppSync(action,id=null,data={}){return ok(await need().rpc('neo_campaign_wa_sync',{p_action:action,p_id:id,p_data:data}));},
 async campaignWhatsApp(action,id=null,data={}){return ok(await need().rpc('neo_campaign_wa',{p_action:action,p_id:id,p_data:data}));},
 async campaignAdmin(action,id=null,data={}){return ok(await need().rpc('neo_campaign_admin',{p_action:action,p_id:id,p_data:data}));},
 async privacyPreferences(choices=null,complete=false){
  const sdk=need(),version=identityVersion;
  const result=ok(await sdk.rpc('neo_privacy_preferences',{p_choices:choices,p_complete:complete}));
  if(version!==identityVersion)throw Error('A conta mudou. Reabra suas preferências.');
  return result;
 },
 async personalizationConsent(granted=null){
  const sdk=need(),version=identityVersion,controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const result=ok(await sdk.rpc('neo_personalization_consent',{p_granted:granted}).abortSignal(controller.signal));
   if(version!==identityVersion)throw Error('A conta mudou. Reabra suas preferências.');
   return result;
  }finally{clearTimeout(timeout);}
 },
 async campaignPushPreference(enabled=null){return ok(await need().rpc('neo_campaign_push_preference',{p_enabled:enabled}));},
 async campaignVisit(action,impression=null){return ok(await need().rpc('neo_campaign_visit',{p_action:action,p_impression:impression}));},get remember(){return rememberSession},get persistenceLimited(){return persistenceLimited},
 async pushDevice(action,subscription,timezone){need();return ok(await client.rpc("neo_push_device",{p_action:action,p_subscription:subscription,p_timezone:timezone||"UTC"}))},
 async shop(action,payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_shop',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou. Reabra a loja.');return data},
 async shopCosts(action,payload){need();const version=identityVersion;const result=await client.rpc('neo_shop_costs_v1',{p_action:action,p_payload:payload});if(version!==identityVersion)throw Error('A conta mudou. Reabra a loja.');return ok(result)},
 async shopFinancial(filters){need();const version=identityVersion;const result=await client.rpc('neo_shop_financial_dashboard_v1',{p_filters:filters});if(version!==identityVersion)throw Error('A conta mudou. Reabra a loja.');return ok(result)},
 async shopReconciliation(action,input){need();const version=identityVersion;const result=await client.rpc('neo_shop_reconciliation_v1',{p_action:action,p_input:input});if(version!==identityVersion)throw Error('A conta mudou. Reabra a loja.');return ok(result)},
 async shopBulk(action,input){need();const version=identityVersion;const result=await client.rpc('neo_shop_bulk_v1',{p_action:action,p_input:input});if(version!==identityVersion)throw Error('A conta mudou. Reabra a loja.');return ok(result)},
 async shopAddress(action,payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_shop_address',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou. Reabra o checkout.');return data},
 async shopPhotoURL(path){need();return ok(await client.storage.from('neo-shop-products').createSignedUrl(path,600)).signedUrl},
 async uploadShopPhoto(blob){need();if(blob.type!=='image/jpeg'||blob.size>5242880)throw Error('Foto inválida.');const version=identityVersion;const reserved=await api.shop('reserve_photo');ok(await client.storage.from('neo-shop-products').upload(reserved.path,blob,{contentType:'image/jpeg',upsert:false}));if(version!==identityVersion)throw Error('A conta mudou.');return reserved.path},
 async shopPayment(orderId){need();const version=identityVersion;const response=await client.functions.invoke('mercadopago-create',{body:{order_id:orderId}});if(response.error){let message='Pagamento ainda indisponível. Confira a configuração do Mercado Pago.';try{const detail=await response.error.context.json();if(typeof detail.error==='string')message=detail.error}catch{}throw Error(message)}const result=response.data;if(version!==identityVersion)throw Error('A conta mudou.');return result},
 async shopPaymentIntegration(action='status',payload={}){need();const version=identityVersion,result=await client.functions.invoke('shop-integrations',{body:{...payload,action}});if(version!==identityVersion)throw Error('A conta mudou.');if(result.error){let code='failed';try{code=(await result.error.context?.json())?.error||code}catch{}const messages={access_token:'Informe um Access Token válido.',webhook_secret:'Informe a assinatura secreta do webhook.',provider_key_invalid:'O Mercado Pago recusou o Access Token.',environment_mismatch:'O Access Token não corresponde ao ambiente escolhido.',configuration_pending:'Salve o Access Token e a assinatura do webhook antes de testar.',forbidden:'Apenas o administrador pode configurar pagamentos.'};throw Error(messages[code]||'Não foi possível configurar o Mercado Pago.')}return result.data},
 async shopVisibilityRevision(){
  need();const version=identityVersion;
  const current=ok(await client.from('neo_shop_visibility_events').select('revision').eq('singleton',true).single());
  if(version!==identityVersion)throw Error('A conta mudou. Reabra a loja.');
  return current.revision;
 },
 watchShopVisibility(onChange,onStatus){
  need();const version=identityVersion,account=user.id;
  const current=()=>version===identityVersion&&user?.id===account;
  const channel=client.channel('neo-shop-visibility-'+account)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'neo_shop_visibility_events'},()=>{if(current())onChange();})
   .subscribe(status=>{if(current())onStatus(status);});
  return ()=>{client.removeChannel(channel);};
 },
 watchMessages(onChange,onState=()=>{}){need();const account=user.id,version=identityVersion;const channel=client.channel('neo-messages-'+account).on('postgres_changes',{event:'*',schema:'public',table:'neo_message_events',filter:'user_id=eq.'+account},event=>{if(version===identityVersion&&user?.id===account)onChange(event.new)}).subscribe(state=>{if(version===identityVersion)onState(state)});return ()=>{client.removeChannel(channel)}},
 async communityMembers(action='list',payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_community_members',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async communityAvatarURL(path){need();return ok(await client.storage.from('neo-community-avatars').createSignedUrl(path,3600)).signedUrl},
 async supportMediaURL(file){need();return ok(await client.storage.from('neo-support').createSignedUrl(file.path,60)).signedUrl},
 async uploadSupportMedia(file,thread_id){need();const account=user.id,version=identityVersion;const mime=file.type.split(';')[0];if(!['image/jpeg','application/pdf','text/plain','audio/webm','audio/mp4','audio/ogg'].includes(mime)||!file.size||file.size>10485760)throw Error('Anexo inválido. O limite é 10 MB.');if(mime==='application/pdf'&&await file.slice(0,5).text()!=='%PDF-')throw Error('PDF inválido.');if(mime==='text/plain'&&(await file.text()).includes('\0'))throw Error('Arquivo de texto inválido.');const name=String(file.name||('audio-'+Date.now())).replace(/[\\/\x00-\x1f]/g,'').slice(0,120);const reserved=await api.support('reserve',{thread_id,name,mime,size:file.size});if(version!==identityVersion)throw Error('A conta mudou.');ok(await client.storage.from('neo-support').upload(reserved.path,file,{contentType:mime,upsert:false}));if(version!==identityVersion||account!==user?.id)throw Error('A conta mudou.');return reserved},
 async supportInbox(){
  need();const version=identityVersion;
  const result=await client.rpc('neo_support_inbox_v1');
  if(version!==identityVersion)throw Error('A conta mudou durante a consulta.');
  if(['PGRST202','42883'].includes(result.error?.code))return this.support('list');
  return ok(result);
 },
 async support(action,payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_support',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou. Reabra a conversa.');return data},
 async communitySettings(action='read',payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_community_settings',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async communityActivity(action='status',payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_community_activity',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async enterCommunity(){need();const version=identityVersion;const data=ok(await client.rpc('neo_community_enter'));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async communityFile(action,payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_community_file',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async communityInboxV2(){need();const version=identityVersion;const data=ok(await client.rpc('neo_community_inbox_v2'));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async uploadCommunityFile(file){need();const version=identityVersion;const name=String(file.name||'').replace(/[\\/\x00-\x1f]/g,'').slice(0,120),mime=/\.pdf$/i.test(name)?'application/pdf':/\.txt$/i.test(name)?'text/plain':'';if(!mime||!file.size||file.size>5242880)throw Error('Escolha PDF ou TXT de até 5 MB.');if(mime==='application/pdf'&&await file.slice(0,5).text()!=='%PDF-')throw Error('O arquivo não é um PDF válido.');if(mime==='text/plain'&&(await file.text()).includes('\0'))throw Error('Escolha um arquivo de texto válido.');if(version!==identityVersion)throw Error('A conta mudou.');const reserved=await api.communityFile('reserve',{name,mime,size:file.size,share:'on'});if(version!==identityVersion)throw Error('A conta mudou.');ok(await client.storage.from('neo-community-files').upload(reserved.path,file,{contentType:mime,upsert:false}));if(version!==identityVersion)throw Error('A conta mudou.');return reserved.path},
 async cleanupCommunityFiles(){need();const version=identityVersion,account=user.id;const paths=await api.communityFile('live_paths');if(!Array.isArray(paths))return;const keep=new Set(paths);const files=ok(await client.storage.from('neo-community-files').list(account,{limit:1000}));if(version!==identityVersion)throw Error('A conta mudou.');const unused=files.filter(f=>Date.parse(f.created_at)<Date.now()-3600000).map(f=>account+'/'+f.name).filter(p=>!keep.has(p));if(unused.length)ok(await client.storage.from('neo-community-files').remove(unused));},
 async communityFileURL(file,download=true){need();return ok(await client.storage.from('neo-community-files').createSignedUrl(file.path,60,download?{download:file.name}:{})).signedUrl},
 async communityInbox(){need();const version=identityVersion;const data=ok(await client.rpc('neo_community_inbox'));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async communityChat(action,payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_community_chat',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou. Reabra a comunidade.');return data},
 async communityPhotoURL(path){need();const d=ok(await client.storage.from('neo-community').createSignedUrl(path,60));return d.signedUrl},
 async uploadCommunityPhoto(blob){need();if(blob.type!=='image/jpeg'||blob.size>5*1024*1024)throw Error('Foto inválida.');const account=user.id,version=identityVersion;const reserved=await api.communityChat('reserve_photo',{photo_share:'on'});if(version!==identityVersion)throw Error('A conta mudou.');ok(await client.storage.from('neo-community').upload(reserved.path,blob,{contentType:'image/jpeg',upsert:false}));if(version!==identityVersion||account!==user?.id)throw Error('A conta mudou. Reabra a comunidade.');return reserved.path},
 async cleanupCommunityPhotos(){need();const version=identityVersion,account=user.id;const keep=new Set(await api.communityChat('attachments'));for(let count=0;count<10;count++){const files=ok(await client.storage.from('neo-community').list(account,{limit:1000}));if(version!==identityVersion)throw Error('A conta mudou.');const unused=files.filter(f=>Date.parse(f.created_at)<Date.now()-3600000).map(f=>account+'/'+f.name).filter(p=>!keep.has(p));if(!unused.length)return;ok(await client.storage.from('neo-community').remove(unused));if(files.length<1000)return;}},
 async agent(action='read',payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_agent',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async multiagent(action='list',payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_multiagent',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async agentIntegration(action,payload={}){need();const version=identityVersion;const result=await client.functions.invoke('agent-integrations',{body:{...payload,action}});if(version!==identityVersion)throw Error('A conta mudou.');if(result.error){let detail=null;try{detail=await result.error.context?.json();}catch{}const messages={encryption_configuration_pending:'Configure a chave de proteção no servidor antes de salvar credenciais.',key_pending:'Cadastre a chave desta integração.',key_required:'Cole a chave da API para carregar os modelos disponíveis.',provider_key_invalid:'A chave da API foi recusada. Confira a chave e o projeto da conta.',provider_model_not_found:'Esse modelo não existe ou não está liberado para esta chave. Atualize a lista e escolha outro.',provider_quota_exhausted:'A API está sem créditos ou atingiu o limite. Confira o faturamento do serviço.',model_list_unavailable:'O serviço não conseguiu fornecer a lista de modelos agora. Tente novamente.',configuration_changed:'A configuração mudou ou o limite de testes foi atingido. Atualize o painel e confira o limite diário.'};throw Error(messages[detail?.error]||'Não foi possível concluir. Confira a função agent-integrations, a chave, o modelo e a cota da API.');}return result.data},
 async platform(action='read',payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_platform',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async authSettings(action='status',payload={}){need();const version=identityVersion;const data=ok(await client.functions.invoke('auth-settings',{body:{...payload,action}}));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async integrations(action='status'){need();const version=identityVersion;const data=ok(await client.functions.invoke('platform-integrations',{body:{action}}));if(version!==identityVersion)throw Error('A conta mudou.');return data},
 async supportAI(messageID){need();return ok(await client.functions.invoke('ai-reply',{body:{message_id:messageID}}))},
 async uploadLibraryFile(file,allowDownload=true){need();if(!['image/jpeg','application/pdf','text/plain','video/mp4','video/webm','video/quicktime'].includes(file.type)||!file.size||file.size>(file.type.startsWith('video/')?52428800:10485760))throw Error('Use foto, PDF ou TXT de até 10 MB; vídeo até 50 MB.');const version=identityVersion;const reserved=await api.library('reserve',{name:file.name.slice(0,120),mime:file.type,size:file.size,allow_download:allowDownload});if(version!==identityVersion)throw Error('A conta mudou.');ok(await client.storage.from('neo-library').upload(reserved.path,file,{contentType:file.type,upsert:false}));if(version!==identityVersion)throw Error('A conta mudou.');return reserved.path},
 async libraryMediaURL(file,download=false){need();const version=identityVersion;if(download&&file.allow_download===false)throw Error('O download deste arquivo não foi disponibilizado.');if(typeof file.allow_download==='boolean')await api.library('media_access',{path:file.path,download});if(version!==identityVersion)throw Error('A conta mudou.');const data=ok(await client.storage.from('neo-library').createSignedUrl(file.path,file.mime?.startsWith('video/')||file.mime==='application/pdf'?1800:60,download?{download:file.name}:{}));if(version!==identityVersion)throw Error('A conta mudou.');return data.signedUrl},
 async library(action='read',payload={}){need();const version=identityVersion;const data=ok(await client.rpc('neo_library',{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error('A conta mudou. Reabra a biblioteca.');return data},
 async community(action,payload={}){need();const version=identityVersion;const data=ok(await client.rpc("neo_community",{p_action:action,p_payload:payload}));if(version!==identityVersion)throw Error("A conta mudou. Reabra a comunidade.");return data},get user(){return user},get validated(){return config.cloudValidated===true},get admin(){return isAdmin},get onboardingComplete(){return onboarded},get consents(){return consents.map(c=>({...c}))},hasConsent(purpose){return consents.some(c=>c.purpose===purpose&&c.version==='2026-11-v1'&&c.granted)},
 async init(onChange){listener=onChange;if(!configured)return null;client=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{flowType:'pkce',persistSession:true,storage:authStorage,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'neo-auth'}});client.auth.onAuthStateChange((event,session)=>{const nextUser=session?.user||null;if(nextUser?.id!==user?.id){identityVersion++;profileRevision=null;consents=[];isAdmin=false;onboarded=false}user=nextUser;setTimeout(()=>listener?.(event,user),0)});if(typeof client.auth.initialize==='function'){const initialized=await client.auth.initialize();if(initialized.error)throw initialized.error}const sessionResult=await client.auth.getSession();if(sessionResult.error)throw sessionResult.error;if(!sessionResult.data.session)return null;const data=ok(await client.auth.getUser());user=data.user;return user},
 async oauth(provider,options={}){if(!configured||!config.providers?.[provider])throw Error('Este provedor ainda não foi configurado.');chooseRemember(options.remember);const redirectTo=authRedirect();ok(await client.auth.signInWithOAuth({provider,options:{redirectTo:redirectTo.href,scopes:provider==='apple'?'name email':'email profile'}}))},
 async email(mode,email,password,name,options={}){
  if(!configured||!config.providers?.email)throw Error('Login por e-mail ainda não configurado.');
  if(mode==='signup'&&config.publicRegistration!==true&&config.previewRegistration!==true)throw Error('Cadastro ainda não liberado nesta versão.');
  if(!['signup','login','reset','verifycode','newpassword'].includes(mode))throw Error('Fluxo de autenticação inválido.');
  if(mode!=='newpassword'&&(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)))throw Error('Informe um e-mail válido.');
  if(['signup','newpassword'].includes(mode)&&(typeof password!=='string'||password.length<8||password.length>128))throw Error('Use uma senha de 8 a 128 caracteres.');
  if(config.captchaRequired===true&&!['newpassword','verifycode'].includes(mode)&&!options.captchaToken)throw Error('Conclua a verificação de segurança.');
  if(mode!=='newpassword')chooseRemember(options.remember);const redirect=authRedirect();const captchaToken=options.captchaToken;
  if(mode==='signup')return ok(await client.auth.signUp({email,password,options:{emailRedirectTo:redirect.href,data:{full_name:String(name||'').slice(0,100)},captchaToken}}));
  if(mode==='reset')return ok(await client.auth.resetPasswordForEmail(email,{redirectTo:redirect.href,captchaToken}));
  if(mode==='verifycode'){
   const token=String(options.code||'').replace(/\s/g,'');if(!/^\d{6,10}$/.test(token))throw Error('Digite o código numérico recebido por e-mail.');
   const data=ok(await client.auth.verifyOtp({email,token,type:'recovery'}));if(!data?.session||!data.user)throw Error('Não foi possível validar o código. Solicite um novo.');return data;
  }
  if(mode==='newpassword')return ok(await client.auth.updateUser({password}));
  return ok(await client.auth.signInWithPassword({email,password,options:{captchaToken}}));
 },
 async logout(scope='local'){await window.NeoPush?.detach();if(!['local','global'].includes(scope))throw Error('Escopo de sessão inválido.');if(client)ok(await client.auth.signOut({scope}));clearAuthStorage();identityVersion++;user=null;profileRevision=null;consents=[];isAdmin=false;onboarded=false},
 async load(){need();const account=user.id,version=identityVersion;
  const [rows,pr,cr,ar,vr]=await Promise.all([
   getRows(()=>client.from('neo_records').select('kind,id,data,revision').eq('user_id',account).order('updated_at').order('id')),
   client.from('neo_profiles').select('data,revision').eq('user_id',account).maybeSingle(),
   client.from('neo_consents').select('purpose,version,granted,changed_at').eq('user_id',account),
   client.rpc('neo_admin_access'),
   Promise.resolve().then(()=>client.rpc('neo_vial_diary',{p_action:'read',p_data:{}})).catch(()=>({error:{code:'network'}}))
  ]);
  if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou durante a leitura. Recarregue os dados.');
  const s=C.blank();for(const row of rows)if(C.TYPES.includes(row.kind))s[row.kind].push({...C.validRecord(row.kind,{...row.data,id:row.id}),_revision:row.revision});
  const diary=vr?.data;
  s.vialDiaryStatus=diary&&Array.isArray(diary.items)&&diary.links&&typeof diary.links==='object'&&!Array.isArray(diary.links)?'ready':(!vr?.error||['PGRST202','42883'].includes(vr.error.code)?'unavailable':'error');
  if(s.vialDiaryStatus==='ready')s.vialDiary=diary;
  const p=ok(pr);consents=ok(cr)||[];isAdmin=ok(ar)===true;profileRevision=p?.revision??null;
  if(p?.data){s.profile=C.profile(p.data.profile);s.settings=C.validateBackup({settings:p.data.settings}).settings}else s.profile.name=String(user.user_metadata?.full_name||user.user_metadata?.name||'').slice(0,100);
  onboarded=!!p&&!!s.profile.height&&!!s.profile.initialWeight&&!!s.profile.goal&&api.hasConsent('health')&&api.hasConsent('terms');return s;
 },
 async onboard(profile,settings,health,terms){need();if(health!==true||terms!==true)throw Error('Confirme os consentimentos específicos.');const p=C.profile(profile);if(!p.height||!p.initialWeight||!p.goal)throw Error('Informe altura, peso inicial e meta.');ok(await client.rpc('neo_complete_onboarding',{p_profile:{...p,initialRecordDate:C.today()},p_settings:C.validateBackup({settings}).settings,p_health:health,p_terms:terms}))},
 async setConsent(purpose,granted){need();if(!['health','terms','photos'].includes(purpose)||typeof granted!=='boolean')throw Error('Consentimento inválido.');const sessionVersion=identityVersion;ok(await client.rpc('neo_set_consent',{p_purpose:purpose,p_granted:granted}));if(sessionVersion!==identityVersion)throw Error('A conta mudou. Confirme a autorização novamente.');consents=consents.filter(c=>c.purpose!==purpose);consents.push({purpose,version:'2026-11-v1',granted});if(!granted&&['health','terms'].includes(purpose))onboarded=false},
 async heartbeat(){need();ok(await client.rpc('neo_heartbeat'))},
 async reportError(code){if(!user||!['sync_failed','photo_failed','profile_failed','import_failed'].includes(code))return;try{await client.rpc('neo_report_error',{p_code:code})}catch{}},
 observeWebVitals(callback){
  return import('web-vitals').then(({onCLS,onINP,onLCP})=>{onCLS(callback);onINP(callback);onLCP(callback)}).catch(()=>{});
 },
 async geoControl(action){need();return ok(await client.rpc('neo_geo_control',{p_action:action}))},
 async adminGeo(users){need();return ok(await client.rpc('neo_admin_geo',{p_users:users}))},
 async captureGeo(){
  need();const version=identityVersion,account=user.id;
  const {session}=ok(await client.auth.getSession());
  if(version!==identityVersion||session?.user?.id!==account||!session.access_token)return;
  const result=await fetch('/api/staging-observe?mode=geo',{method:'POST',headers:{Authorization:'Bearer '+session.access_token}});
  if(version===identityVersion&&result.ok)return result.json();
 },
 async captureDeviceCity(position){
  // The live GPS coordinates are sent only to BigDataCloud by the device, never to Supabase.
  const latitude=Number(position?.latitude),longitude=Number(position?.longitude);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
  need();const version=identityVersion,account=user.id;
  const url='https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+encodeURIComponent(String(latitude))+
   '&longitude='+encodeURIComponent(String(longitude))+'&localityLanguage=pt';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  let place;
  try{
   const response=await fetch(url,{method:'GET',mode:'cors',cache:'no-store',referrerPolicy:'no-referrer',
    headers:{Accept:'application/json'},signal:controller.signal});
   if(!response.ok)return null;
   place=await response.json();
  }finally{clearTimeout(timeout)}
  if(version!==identityVersion||user?.id!==account)return null;
  // Do not mistake the provider's IP fallback for a device-derived locality.
  if(/ip/i.test(String(place?.lookupSource||'')))return null;
  const city=typeof place?.city==='string'?place.city.trim():'',
   region=typeof place?.principalSubdivision==='string'?place.principalSubdivision.trim():'',
   country=typeof place?.countryCode==='string'?place.countryCode.trim().toUpperCase():'';
  if(!city||!region||city.length>120||region.length>100||!/^[A-Z]{2}$/.test(country))return null;
  return ok(await client.rpc('neo_geo_device_city',{p_country:country,p_region:region,p_city:city}));
 },
 async adminOperations(section,days=30,review=null){need();return ok(await client.rpc('neo_admin_operations',{p_section:section,p_days:days,p_review:review}))},
 async qualityObserve(metric,duration=null,revision=''){need();return ok(await client.rpc('neo_quality_observe',{p_metric:metric,p_duration:duration,p_revision:revision}))},
 async adminSystem(action='snapshot',payload={}){need();return ok(await client.rpc('neo_admin_system',{p_action:action,p_payload:payload}))},
 async adminMonitor(provider){
  need();
  const version=identityVersion,account=user.id;
  const {session}=ok(await client.auth.getSession());
  if(version!==identityVersion||session?.user?.id!==account||!session.access_token)throw Error('Sessão indisponível.');
  const response=await fetch('/api/admin-monitor?provider='+encodeURIComponent(provider),{
   headers:{Authorization:'Bearer '+session.access_token}
  });
  if(version!==identityVersion||!response.ok)throw Error('Fonte indisponível.');
  return response.json();
 },
 async adminSummary(){need();return ok(await client.rpc('neo_admin_summary'))},
 async audience(action,device=null,campaign=null){need();return ok(await client.rpc('neo_audience_self',{p_action:action,p_device:device,p_campaign:campaign}))},
 async engagement(action,events=[]){need();return ok(await client.rpc('neo_engagement',{p_action:action,p_events:events}))},
 async adminEngagement(filters){need();return ok(await client.rpc('neo_admin_engagement',filters))},
 async adminAudience(filters={}){need();return ok(await client.rpc('neo_admin_audience',filters))},
 async adminSignupExport(filters={}){need();return ok(await client.rpc('neo_admin_signup_export',filters))},
 async adminSignups(action,filters={}){need();return ok(await client.rpc('neo_admin_signups',{...filters,p_action:action}))},
 async exportMetadata(){need();const account=user.id,version=identityVersion,data=ok(await client.rpc('neo_export_account_metadata'));const support=await client.rpc('neo_support_export');if(support.error&&!['PGRST202','42883'].includes(support.error.code))ok(support);const purchases=await client.rpc('neo_shop_export');if(purchases.error&&!['PGRST202','42883'].includes(purchases.error.code))ok(purchases);if(version!==identityVersion||account!==user?.id)throw Error('A conta mudou durante a exportação.');return {user:{id:user.id,email:user.email,created_at:user.created_at},...data,...(!support.error?{private_conversations:support.data}:{} ),...(!purchases.error?{purchases:purchases.data}:{})}},
 async vialDiary(action,data={}){
  need();if(!['read','add','put_dose','import_local'].includes(action))throw Error('Operação de frasco inválida.');
  if(action!=='read')needsHealth();
  const owner=user.id,version=identityVersion;
  const response=await client.rpc('neo_vial_diary',{p_action:action,p_data:data});
  if(owner!==user?.id||version!==identityVersion)throw Error('A conta mudou. Atualize o histórico.');
  if(response.error?.code==='40001')throw Error('O frasco ou a aplicação mudou em outro aparelho. Atualize antes de tentar novamente.');
  if(response.error?.message?.includes('vial_balance_insufficient'))throw Error('O saldo registrado mudou. Confira o histórico e o frasco.');
  const result=ok(response),diary=action==='put_dose'?result?.diary:result;
  if(!Array.isArray(diary?.items)||!diary.links||typeof diary.links!=='object'||Array.isArray(diary.links)||(action==='put_dose'&&!Number.isInteger(result.revision)))throw Error('A confirmação do servidor não retornou o diário. Atualize antes de tentar novamente.');
  return result;
 },
 async put(kind,record){needsHealth();const account=user.id,version=identityVersion,clean=C.validRecord(kind,record),base={user_id:account,kind,id:clean.id,data:clean};let r;
  if(record._revision!=null){r=await client.from('neo_records').update({data:clean}).eq('user_id',account).eq('kind',kind).eq('id',clean.id).eq('revision',record._revision).select('revision');if(!r.error&&!r.data.length)throw Error('Este registro mudou em outro aparelho. Atualize antes de editar.')}
  else {r=await client.from('neo_records').insert(base).select('revision');if(r.error?.code==='23505'){const existing=ok(await client.from('neo_records').select('data,revision').eq('user_id',account).eq('kind',kind).eq('id',clean.id).maybeSingle());if(!existing||C.fingerprint(kind,existing.data)!==C.fingerprint(kind,clean))throw Error('Já existe um registro com este identificador e outro conteúdo. Atualize o histórico antes de continuar.');r={data:[existing],error:null}}}
  const rows=ok(r);if(version!==identityVersion||account!==user?.id)throw Error('A conta mudou durante a gravação. Confira o histórico ao entrar novamente.');if(!rows?.length||rows[0].revision==null)throw Error('A confirmação da gravação não retornou a revisão. Atualize o histórico antes de tentar novamente.');return {...clean,_revision:rows[0].revision};
 },
 async remove(kind,record){need();const q=client.from('neo_records').delete().eq('user_id',user.id).eq('kind',kind).eq('id',record.id).eq('revision',record._revision).select('id');const rows=ok(await q);if(!rows.length)throw Error('Registro alterado em outro aparelho. Atualize antes de excluir.')},
 async saveProfile(p,settings){needsHealth();const data={profile:C.profile(p),settings:C.validateBackup({settings}).settings};let r;if(profileRevision==null)throw Error('Conclua o cadastro inicial antes de editar o perfil.');else{r=await client.from('neo_profiles').update({data}).eq('user_id',user.id).eq('revision',profileRevision).select('revision');if(!r.error&&!r.data.length)throw Error('O perfil mudou em outro aparelho. Atualize antes de salvar.')}ok(r)},
 async importRecords(incoming){needsHealth();const account=user.id,version=identityVersion,current=await api.load(),merged=C.merge(current,incoming),rows=[];
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  for(const kind of C.TYPES){const existing=new Set(current[kind].map(r=>C.fingerprint(kind,r)));for(const row of merged.data[kind]){const fp=C.fingerprint(kind,row);if(!existing.has(fp)){const id='import-'+await hash(kind+':'+fp);rows.push({kind,id,data:{...row,id}})}}}
  rows.sort((a,b)=>(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id));
  if(version!==identityVersion||account!==user?.id)throw Error('A conta mudou antes da migração.');
  if(!rows.length)return {added:0,skipped:merged.skipped,verified:true};
  const migrationId=await hash(JSON.stringify(rows)),result=ok(await client.rpc('neo_migrate_records',{p_rows:rows,p_migration_id:migrationId}));
  const receipt=ok(await client.from('neo_migration_receipts').select('migration_id,records_requested,manifest').eq('user_id',account).eq('migration_id',migrationId).single());
  const manifest=rows.map(r=>r.kind+':'+r.id).sort(),verified=receipt?.manifest?.map(r=>r.kind+':'+r.id).sort();
  if(version!==identityVersion||account!==user?.id||result?.verified!==rows.length||receipt?.records_requested!==rows.length||JSON.stringify(manifest)!==JSON.stringify(verified))throw Error('A confirmação da migração não pôde ser verificada. Mantenha o backup e a origem local; repita a conferência.');
  return {added:result.added,skipped:merged.skipped,verified:true,migrationId};
 },
 async beforeAfterAvailable(){
  need();
  const version=identityVersion;
  const result=await client.from('neo_saved_comparisons').select('id').limit(1);
  if(version!==identityVersion)throw Error('A conta mudou.');
  return !result.error;
 },
 async savedBeforeAfter(){
  // Listing must remain possible after photo/health consent is withdrawn.
  need();
  const account=user.id,version=identityVersion;
  const rows=ok(await client.from('neo_saved_comparisons')
   .select('id,user_id,path,before_photo_id,after_photo_id,before_date,after_date,created_at')
   .eq('user_id',account).order('created_at',{ascending:false}).limit(100));
  if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou.');
  return rows;
 },
 async saveBeforeAfter(blob,photos){
  needsHealth();
  if(!api.hasConsent('photos'))throw Error('Autorize o armazenamento de fotografias antes de salvar.');
  if(blob?.type!=='image/jpeg'||!blob.size||blob.size>5242880||!Array.isArray(photos)||photos.length!==2)
   throw Error('Comparação inválida.');
  const account=user.id,version=identityVersion;
  const check=()=>{if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou. Abra novamente a comparação.')};
  const [before,after]=photos;
  if(!before||!after||before.id===after.id||!C.validDate(before.date)||!C.validDate(after.date)||
   before.date>=after.date||!/^[-a-f0-9]{36}$/i.test(before.id)||!/^[-a-f0-9]{36}$/i.test(after.id))
   throw Error('Escolha fotografias próprias de duas datas em ordem cronológica.');
  const rows=ok(await client.from('neo_photos').select('id,path,date,role')
   .eq('user_id',account).in('id',[before.id,after.id]));
  check();
  if(rows.length!==2||[before,after].some(p=>!rows.some(row=>
   row.id===p.id&&row.date===p.date&&row.role==='progress'&&row.path?.startsWith(account+'/'))))
   throw Error('As fotografias selecionadas não estão disponíveis nesta conta.');
  const id=crypto.randomUUID(),path=account+'/'+id+'.jpg',bucket=client.storage.from('neo-comparisons');
  check();
  ok(await bucket.upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'0'}));
  try{
   check();
   const saved=ok(await client.from('neo_saved_comparisons').insert({
    id,user_id:account,path,before_photo_id:before.id,after_photo_id:after.id,
    before_date:before.date,after_date:after.date
   }).select('id,path,created_at').single());
   check();
   return saved;
  }catch(error){
   try{await bucket.remove([path])}catch{}
   throw error;
  }
 },
 async beforeAfterURL(item){
  need();
  const account=user.id,version=identityVersion;
  if(item?.user_id!==account||!item.path?.startsWith(account+'/'))
   throw Error('Comparação privada indisponível.');
  const data=ok(await client.storage.from('neo-comparisons').createSignedUrl(item.path,60));
  if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou.');
  return data.signedUrl;
 },
 async beforeAfterThumbnails(item){
  const sdk=need(),account=user.id,version=identityVersion;
  if(item?.user_id!==account||!item.path?.startsWith(account+'/'))
   throw Error('Comparação privada indisponível.');
  const ids=[item.before_photo_id,item.after_photo_id];
  if(ids.some(id=>typeof id!=='string'||!/^[-a-f0-9]{36}$/i.test(id)))return [null,null];
  const photos=ok(await sdk.from('neo_photos').select('id,path,date,role')
   .eq('user_id',account).in('id',ids));
  if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou.');
  const results=await Promise.allSettled(ids.map((id,index)=>{
   const photo=photos.find(row=>row.id===id&&row.role==='progress'&&row.date===[item.before_date,item.after_date][index]);
   return photo?api.photoURL(photo,'thumbnail'):null;
  }));
  if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou.');
  return results.map(result=>result.status==='fulfilled'?result.value:null);
 },
 async verifyBeforeAfter(item){
  needsHealth();
  const account=user.id,version=identityVersion;
  if(item?.user_id!==account||!item.path?.startsWith(account+'/')||
   !/^[-a-f0-9]{36}\/[-a-f0-9]{36}\.jpg$/i.test(item.path))
   throw Error('Comparação privada indisponível.');
  const record=ok(await client.from('neo_saved_comparisons').select('id,path')
   .eq('id',item.id).eq('user_id',account).eq('path',item.path).single());
  if(version!==identityVersion||user?.id!==account||record?.path!==item.path)
   throw Error('A conta mudou ou a comparação não existe mais.');
 },
 async beforeAfterBlob(item){
  needsHealth();
  const account=user.id,version=identityVersion;
  await api.verifyBeforeAfter(item);
  if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou.');
  const blob=ok(await client.storage.from('neo-comparisons').download(item.path));
  if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou.');
  if(blob?.type!=='image/jpeg'||!blob.size||blob.size>5242880)
   throw Error('Imagem da comparação indisponível.');
  return blob;
 },
 async deleteBeforeAfter(item){
  // A user must be able to erase data even after revoking prior consent.
  need();
  const account=user.id,version=identityVersion;
  if(item?.user_id!==account||!item.path?.startsWith(account+'/'))throw Error('Comparação privada indisponível.');
  // Delete Storage first: its SELECT policy verifies that this metadata still exists.
  const record=ok(await client.from('neo_saved_comparisons').select('id,path')
   .eq('id',item.id).eq('path',item.path).eq('user_id',account).single());
  if(version!==identityVersion||user?.id!==account||record?.path!==item.path)
   throw Error('A conta mudou ou a comparação não existe mais.');
  ok(await client.storage.from('neo-comparisons').remove([item.path]));
  if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou.');
  ok(await client.from('neo_saved_comparisons').delete().eq('id',item.id).eq('user_id',account));
 },
 async photos(){
  need();
  const account=user.id,version=identityVersion;
  const rows=await getRows(()=>client.from('neo_photos').select('id,user_id,path,date,role,created_at').eq('user_id',account).order('date').order('id'));
  if(version!==identityVersion)throw Error('A conta mudou.');
  return rows;
 },
 async photoURL(photo,variant='original'){
  need();
  const account=user.id,version=identityVersion;
  if(!photo.path?.startsWith(account+'/'))throw Error('Foto indisponível nesta conta.');
  const suffix=variant==='thumbnail'?'.thumb.jpg':variant==='preview'?'.preview.jpg':'';
  const result=await client.storage.from('neo-private').createSignedUrl(photo.path+suffix,300);
  if(version!==identityVersion)throw Error('A conta mudou.');
  if(suffix&&result.error&&(/not found|does not exist/i.test(result.error.message||'')||String(result.error.statusCode)==='404'))return null;
  return ok(result).signedUrl;
 },
 async uploadProgressPhoto(blob,thumbnail,date,id,preview){
  needsHealth();
  if(!api.hasConsent('photos'))throw Error('Autorize o armazenamento de fotografias antes do envio.');
  if(!C.validDate(date)||date>C.today()||!/^[-a-f0-9]{36}$/i.test(id)||blob.type!=='image/jpeg'||!blob.size||blob.size>5242880||thumbnail.type!=='image/jpeg'||!thumbnail.size||thumbnail.size>262144)throw Error('Foto inválida.');
  const account=user.id,version=identityVersion,path=account+'/'+id+'.jpg',bucket=client.storage.from('neo-private');
  const current=()=>{if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou. Abra novamente o formulário.');};
  const read=()=>client.from('neo_photos').select('id,path,date').eq('user_id',account).eq('id',id).maybeSingle();
  const existing=ok(await read());current();
  if(existing){
   if(existing.path!==path||existing.date!==date)throw Error('Esta seleção já foi salva com outra data.');
   return existing;
  }
  if(preview&&(preview.type!=='image/jpeg'||!preview.size||preview.size>524288))throw Error('Prévia inválida.');
  const images=[[path+'.thumb.jpg',thumbnail],[path,blob]];
  if(preview)images.splice(1,0,[path+'.preview.jpg',preview]);
  for(const [key,data] of images){
   current();
   const result=await bucket.upload(key,data,{contentType:'image/jpeg',upsert:false});current();
   if(result.error&&!(['409','Duplicate','ResourceAlreadyExists','KeyAlreadyExists'].includes(String(result.error.statusCode||result.error.code||result.error.error))||/already exists|duplicate/i.test(result.error.message||'')))ok(result);
  }
  const result=await client.from('neo_photos').insert({id,user_id:account,path,date,role:'progress'});current();
  if(result.error){
   // A response can be lost after the insert commits. Reconcile before retrying.
   const row=ok(await read());current();
   if(!row||row.path!==path||row.date!==date)ok(result);
  }
  return {id,path,date};
 },
 async uploadPhoto(blob,date,role='progress',thumbnail){needsHealth();const account=user.id,version=identityVersion;const current=()=>{if(version!==identityVersion||user?.id!==account)throw Error('A conta mudou durante o envio.');};if(!api.hasConsent('photos'))throw Error('Autorize o armazenamento de fotografias antes do envio.');if(!C.validDate(date)||date>C.today()||blob.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(blob.type))throw Error('Foto inválida. Use JPEG, PNG ou WebP com até 5 MB.');const previous=role==='avatar'?ok(await client.from('neo_photos').select('id,path').eq('user_id',account).eq('role','avatar')):[],id=crypto.randomUUID(),path=`${account}/${id}.${blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg'}`;current();ok(await client.storage.from('neo-private').upload(path,blob,{contentType:blob.type,upsert:false}));try{current();ok(await client.from('neo_photos').insert({id,user_id:account,path,date,role}))}catch(e){await client.storage.from('neo-private').remove([path]);throw e}current();if(thumbnail?.type==='image/jpeg'&&thumbnail.size<=262144)await client.storage.from('neo-private').upload(path+'.thumb.jpg',thumbnail,{contentType:'image/jpeg',upsert:false});const signed=ok(await client.storage.from('neo-private').createSignedUrl(path,600)).signedUrl,photo={id,user_id:account,path,date,role,created_at:new Date().toISOString(),url:signed};current();if(role==='avatar'){if(previous.length){await client.storage.from('neo-private').remove(previous.flatMap(p=>[p.path,p.path+'.thumb.jpg']));await client.from('neo_photos').delete().eq('user_id',account).eq('role','avatar').neq('id',id)}try{current();const avatarPath=`${account}/avatar.jpg`;await client.storage.from('neo-community-avatars').remove([avatarPath]);ok(await client.storage.from('neo-community-avatars').upload(avatarPath,blob,{contentType:'image/jpeg',upsert:false}));current();ok(await client.rpc('neo_community_avatar',{p_path:avatarPath}));photo.url=ok(await client.storage.from('neo-community-avatars').createSignedUrl(avatarPath,3600)).signedUrl;photo.communitySynced=true}catch{photo.communitySynced=false}}current();return photo},
 async deletePhoto(p){need();ok(await client.storage.from('neo-private').remove([p.path,p.path+'.thumb.jpg',p.path+'.preview.jpg']));ok(await client.from('neo_photos').delete().eq('user_id',user.id).eq('id',p.id))},
 async photoBlob(p){need();return ok(await client.storage.from('neo-private').download(p.path))},
 async deleteAccount(password,captchaToken,expectedAccount){
  need();const account=user.id,version=identityVersion;if(expectedAccount&&expectedAccount!==account)throw Error('Sua conta mudou. Abra novamente a opção de exclusão.');
  if(typeof password!=='string'||!password.length||password.length>128)throw Error('Informe sua senha de acesso.');
  if(config.captchaRequired===true&&!captchaToken)throw Error('Conclua a verificação de segurança.');
  const session=ok(await client.auth.getSession()).session;if(version!==identityVersion||user?.id!==account||session?.user?.id!==account||!session?.access_token)throw Error('Entre novamente na sua conta para continuar.');
  const response=await client.functions.invoke('delete-account',{headers:{Authorization:'Bearer '+session.access_token},body:{password,captchaToken}});
  if(response.error){let message='Não foi possível excluir a conta. Tente novamente.';try{const detail=await response.error.context.json();if(typeof detail.error==='string')message=detail.error==='Confirmação obrigatória.'?'A exclusão está temporariamente indisponível. Tente novamente mais tarde.':detail.error.slice(0,400);}catch{}throw Error(message);}
  if(response.data?.deleted!==true)throw Error('A exclusão não foi confirmada. Tente novamente.');
  if(version===identityVersion&&user?.id===account){try{await api.logout();}catch{if(version===identityVersion&&user?.id===account){client.auth.stopAutoRefresh?.();clearAuthStorage();identityVersion++;user=null;profileRevision=null;consents=[];isAdmin=false;onboarded=false;}}}
 }

};window.NeoCloud=api;
