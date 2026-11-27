window.NeoAdminConnectAI=(()=>{
 const markup=`<button type="button" class="secondary neo-connect-ai-entry" data-connect-ai-open aria-haspopup="dialog">
 <span aria-hidden="true">✦</span><span><strong>NeoPep Connect AI</strong><small>Integrações, automação e gerenciamento inteligente.</small></span><span aria-hidden="true">›</span>
 </button>`;
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
  <h3>Processamento</h3>
  <dl><dt>Cloudflare</dt><dd>Aguardando homologação</dd>
  <dt>Vercel</dt><dd>Planejado</dd>
  <dt>NeoPep Connect Windows</dt><dd>Planejado como executor complementar</dd></dl>
  <form method="dialog"><button type="submit" class="secondary" autofocus>Voltar a Campanhas</button></form>`;
  toolbar.after(dialog);
  trigger.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
  dialog.addEventListener('close',()=>{if(trigger.isConnected)trigger.focus({preventScroll:true});});
 }
 return {mount};
})();
