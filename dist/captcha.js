/* Widget oficial Turnstile; cada resposta é consumida uma única vez pelo formulário. */
(function(){
 let widget=null,token='',issued=0,pending=null,generation=0;
 const cfg=window.NEO_CONFIG||{},api={
  get token(){return token&&Date.now()-issued<240000?token:''},
  take(){const value=api.token;token='';issued=0;return value},
  reset(){return api.mount()},
  remove(){generation++;token='';issued=0;if(widget!==null&&window.turnstile)window.turnstile.remove(widget);widget=null},
  async mount(){
   api.remove();const version=generation,container=document.querySelector('#captcha');
   if(!container||!cfg.captchaSiteKey||!cfg.supabaseUrl)return;
   try{
    if(!window.turnstile){if(!pending)pending=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=()=>{pending=null;reject(Error('Verificação de segurança indisponível.'))};document.head.append(script)});await pending}
    if(version!==generation||!document.contains(container))return;
    widget=window.turnstile.render(container,{sitekey:cfg.captchaSiteKey,theme:'auto',size:'flexible',callback:value=>{if(version===generation){token=value;issued=Date.now()}},'expired-callback':()=>{if(version===generation){token='';issued=0}},'error-callback':()=>{if(version===generation){token='';issued=0;container.setAttribute('aria-label','Verificação falhou. Tente novamente.')}}});
   }catch{if(version===generation&&document.contains(container))container.textContent='Não foi possível carregar a verificação. Confira sua conexão e tente novamente.'}
  }
 };window.NeoCaptcha=api;
})();
