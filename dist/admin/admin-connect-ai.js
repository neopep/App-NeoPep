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
  <details><summary>Conexões</summary><p>A gestão depende da autorização individual do NeoPep.</p></details>
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
  trigger.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
  dialog.addEventListener('close',()=>{if(trigger.isConnected)trigger.focus({preventScroll:true});});
 }
 return {mount};
})();
