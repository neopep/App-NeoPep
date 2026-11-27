window.NeoAdminConnectAI=(()=>{
 const markup=`<button type="button" class="secondary neo-connect-ai-entry" data-connect-ai-open aria-haspopup="dialog">
 <span aria-hidden="true">✦</span><span><strong>NeoPep Connect AI</strong><small>Integrações, automação e gerenciamento inteligente.</small></span><span aria-hidden="true">›</span>
 </button>`;
 const clients={
  chatgpt:{label:'ChatGPT',help:'No Desktop, use o catálogo local se disponível. Plus Web e iPhone precisam de teste em cada cliente.',url:'https://developers.openai.com/plugins/build/plugins'},
  claude:{label:'Claude',help:'Em uma conta elegível, use um conector MCP remoto personalizado e autorize a conta NeoPep.',url:'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp'},
  gemini:{label:'Gemini',help:'Verifique plano, idioma e região antes de usar um aplicativo conectado personalizado.',url:'https://support.google.com/gemini/answer/17209137'},
  codex:{label:'Codex',help:'Use o marketplace local ou a configuração MCP do cliente. A conexão precisa de autorização própria.',url:'https://developers.openai.com/codex/mcp'}
 };
 function mountInstaller(dialog){
  const select=dialog.querySelector('[data-connect-ai-client]');
  const environment=dialog.querySelector('[data-connect-ai-environment]');
  const surface=dialog.querySelector('[data-connect-ai-surface]');
  const address=dialog.querySelector('[data-connect-ai-address]');
  const copy=dialog.querySelector('[data-connect-ai-copy]');
  const copyStatus=dialog.querySelector('[data-connect-ai-copy-status]');
  const instructions=dialog.querySelector('[data-connect-ai-instructions]');
  const official=dialog.querySelector('[data-connect-ai-guide]');
  const state=dialog.querySelector('[data-connect-ai-install-state]');
  function render(){
   const client=clients[select.value]||clients.chatgpt;
   const isMobileOrWeb=surface.value==='web'||surface.value==='iphone';
   instructions.textContent=select.value==='chatgpt'&&isMobileOrWeb
    ?'ChatGPT Sites pode ser avaliado como alternativa privada. Verifique a disponibilidade nesta conta e dispositivo.'
    :client.help;
   address.value=environment.value==='production'?'https://connect.neopep.com.br/mcp':'https://connect-teste.neopep.com.br/mcp';
   copyStatus.textContent='';
   official.href=client.url;
   state.textContent=(environment.value==='production'?'Produção':'Teste')+
    ' · instalação e verificação pendentes de homologação.';
  }
  select.addEventListener('change',render);
  environment.addEventListener('change',render);
  surface.addEventListener('change',render);
  copy.addEventListener('click',async()=>{
   try{
    await navigator.clipboard.writeText(address.value);
    copyStatus.textContent='Endereço candidato copiado.';
   }catch{
    address.focus();
    address.select();
    copyStatus.textContent='Copie o endereço selecionado manualmente.';
   }
  });
  render();
 }
 function mountConnections(dialog,cloud){
  if(!cloud?.connectAIAvailable)return;
  const details=dialog.querySelector('[data-connect-ai-connections]');
  const list=details.querySelector('ul'),status=details.querySelector('p');
  let busy=false;
  async function refresh(id){
   if(busy)return;
   busy=true;
   list.replaceChildren();
   status.textContent='Consultando conexões…';
   try{
    if(id&&!await cloud.connectAIConnections('revoke',id))throw Error();
    const rows=await cloud.connectAIConnections('list');
    for(const row of rows){
     const item=document.createElement('li');
     const state=row.revoked_at?'Revogada':Date.parse(row.expires_at)<=Date.now()?'Expirada':'Ativa';
     item.textContent=row.client_id+' · '+state+' ';
     if(state==='Ativa'){
      const button=document.createElement('button');
      button.type='button';
      button.className='secondary';
      button.textContent='Revogar';
      button.addEventListener('click',()=>{if(window.confirm('Revogar esta conexão?'))void refresh(row.id);});
      item.append(button);
     }
     list.append(item);
    }
    status.textContent=id?'Conexão revogada.':rows.length?'Suas conexões':'Nenhuma conexão registrada.';
   }catch{status.textContent='Não foi possível consultar ou atualizar suas conexões.';}
   finally{busy=false;}
  }
  details.addEventListener('toggle',()=>{if(details.open)void refresh();});
 }
 function mountConsent(dialog,cloud){
  if(!cloud?.connectAIAvailable)return;
  const current=new URL(window.location.href);
  const query=current.searchParams.get('connectAiRequest');
  if(!query)return;
  const proof=current.searchParams.get('connectAiCsrf'),expires=current.searchParams.get('connectAiExpires');
  const params=new URLSearchParams(query);
  const panel=dialog.querySelector('[data-connect-ai-consent]');
  const status=panel.querySelector('[role=status]'),approve=panel.querySelector('button');
  panel.hidden=false;
  panel.querySelector('[data-consent-client]').textContent=params.get('client_id')||'Cliente externo';
  approve.addEventListener('click',async()=>{
   approve.disabled=true;
   try{window.location.assign(await cloud.approveConnectAI(query,proof,expires));}
   catch{status.textContent='A autorização falhou ou expirou. Reinicie pelo cliente.';}
  });
  dialog.addEventListener('close',()=>{
   for(const key of ['connectAiRequest','connectAiCsrf','connectAiExpires'])current.searchParams.delete(key);
   window.history.replaceState(window.history.state,'',current.href);
   panel.hidden=true;
  },{once:true});
  dialog.showModal();
 }
 function mount(root){
  const toolbar=root.querySelector('.neo-campaign-toolbar');
  if(!toolbar||root.querySelector('[data-connect-ai-open]'))return;
  toolbar.insertAdjacentHTML('beforebegin',markup);
  const trigger=root.querySelector('[data-connect-ai-open]');
  const dialog=document.createElement('dialog');
  dialog.className='card neo-connect-ai-dialog';
  dialog.setAttribute('aria-labelledby','neoConnectAITitle');
  dialog.innerHTML=`<h2 id="neoConnectAITitle">NeoPep Connect AI</h2>
  <p>Integração externa com as campanhas do NeoPep.</p>
  <p role="status">Servidor e conexões aguardam homologação.</p>
  <section data-connect-ai-consent hidden aria-label="Autorizar integração">
   <h3>Autorizar integração</h3><p data-consent-client></p>
   <p>Permitir que este cliente consulte campanhas no NeoPep Teste com a sua conta?</p>
   <button type="button" class="primary">Autorizar leitura</button><p role="status"></p>
  </section>
  <details data-connect-ai-connections><summary>Conexões</summary><p role="status">A gestão depende da autorização individual do NeoPep.</p><ul></ul></details>
  <details><summary>Ferramentas</summary><p>A disponibilidade será informada pelo catálogo do servidor conectado.</p></details>
  <details><summary>Base de conhecimento</summary><p>Consulte o guia de campanhas do NeoPep antes de preparar publicações.</p></details>
  <details><summary>Histórico</summary><p>Histórico de operações disponível após a conexão ao servidor.</p></details>
  <details><summary>Instalar integração</summary>
   <label>Cliente<select data-connect-ai-client>${Object.entries(clients).map(([id,client])=>`<option value="${id}">${client.label}</option>`).join('')}</select></label>
   <label>Dispositivo ou superfície<select data-connect-ai-surface><option value="desktop">Desktop</option><option value="web">Web</option><option value="iphone">iPhone</option></select></label>
   <label>Ambiente<select data-connect-ai-environment><option value="test">Teste</option><option value="production">Produção</option></select></label>
   <p data-connect-ai-instructions></p><p role="status" data-connect-ai-install-state></p>
   <a class="text-btn" data-connect-ai-guide target="_blank" rel="noopener noreferrer">Abrir instruções oficiais</a>
   <label>Endereço MCP candidato<input data-connect-ai-address readonly></label>
   <button type="button" class="secondary" data-connect-ai-copy>Copiar endereço MCP</button>
   <p role="status" data-connect-ai-copy-status></p>
   <p>Versão instalada indisponível. Para atualizar o catálogo local, confira a revisão autorizada, regenere o pacote e reinicie o cliente.</p>
   <button type="button" class="secondary" disabled>Baixar pacote homologado</button>
   <button type="button" class="secondary" disabled>Verificar conexão</button>
  </details>
  <h3>Processamento</h3>
  <dl><dt>Cloudflare</dt><dd>Aguardando homologação</dd>
  <dt>Vercel</dt><dd>Planejado</dd>
  <dt>NeoPep Connect Windows</dt><dd>Planejado como executor complementar</dd></dl>
  <form method="dialog"><button type="submit" class="secondary" autofocus>Voltar a Campanhas</button></form>`;
  toolbar.after(dialog);
  mountInstaller(dialog);
  mountConnections(dialog,window.NeoCloud);
  mountConsent(dialog,window.NeoCloud);
  trigger.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
  dialog.addEventListener('close',()=>{if(trigger.isConnected)trigger.focus({preventScroll:true});});
 }
 return {mount};
})();
