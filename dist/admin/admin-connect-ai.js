window.NeoAdminConnectAI=(()=>{
 const markup=`<button type="button" class="secondary neo-connect-ai-entry" data-connect-ai-open aria-haspopup="dialog">
 <span aria-hidden="true">✦</span><span><strong>NeoPep Connect AI</strong><small>Integrações, automação e gerenciamento inteligente.</small></span><span aria-hidden="true">›</span>
 </button>`;
 const clients={
  chatgpt:{label:'ChatGPT',help:'No ChatGPT Windows, adicione um servidor MCP personalizado por URL HTTPS e selecione OAuth. Use o ícone PNG abaixo. Valide Web e iPhone separadamente.',url:'https://developers.openai.com/plugins/build/plugins'},
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
  const pack=dialog.querySelector('[data-connect-ai-package]');
  function render(){
   const client=clients[select.value]||clients.chatgpt;
   const cloudWeb=environment.value==='production'&&select.value==='chatgpt'&&surface.value==='web';
   const mobile=surface.value==='iphone';
   const cloudPanel=dialog.querySelector('[data-connect-ai-cloud]');
   cloudPanel.hidden=!cloudWeb;
   const supported=environment.value==='production'&&surface.value==='desktop'&&['codex','chatgpt'].includes(select.value);
   pack.hidden=!supported;
   instructions.textContent=supported?'Baixe o ZIP 1.0.5, importe como novo plugin na página Plugins do ChatGPT, abra no aplicativo desktop e autorize a leitura no NeoPep. Se estiver substituindo uma instalação antiga que não reconhece o MCP, desinstale o plugin anterior antes de importar.':cloudWeb?'A integração Nuvem requer registro privado do servidor MCP pelo ChatGPT Web em uma conta elegível. Não importe o ZIP Desktop para esta modalidade.':mobile&&['chatgpt','codex'].includes(select.value)?'O ZIP Desktop não executa MCP no iPhone. O registro de MCP personalizado é feito pela Web em uma conta elegível; o uso móvel ainda não foi homologado.':client.help;
   address.value=environment.value==='production'?'https://connect.neopep.com.br/mcp':'https://connect-teste.neopep.com.br/mcp';
   copyStatus.textContent='';
   official.href=cloudWeb||mobile&&['chatgpt','codex'].includes(select.value)?'https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt':client.url;
   state.textContent=(environment.value==='production'?'Produção':'Teste')+
    (supported?' · Desktop: ZIP 1.0.5 homologado no Codex Windows.':cloudWeb?' · Nuvem: registro privado pendente.':mobile?' · execução móvel não homologada.':' · esta combinação ainda não foi homologada.');
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
 function mountKnowledge(dialog,source=window.NeoConnectAIKnowledge){
  const panel=dialog.querySelector('[data-connect-ai-knowledge]');
  const body=panel.querySelector('[data-knowledge-content]');
  if(!source||source.kind!=='candidate_reference_only'){body.textContent='Manual não carregado nesta versão.';return;}
  const add=(parent,tag,value)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node;};
  const list=(parent,values)=>{const ul=document.createElement('ul');for(const value of values)add(ul,'li',value);parent.append(ul);};
  const section=(name,fill)=>{const d=document.createElement('details');add(d,'summary',name);fill(d);body.append(d);return d;};
  body.replaceChildren();
  add(body,'p','Versão '+source.version+' · referência candidata, somente leitura. Não representa permissões ou ferramentas ativas do servidor.');
  section('Manual operacional',d=>list(d,source.workflow));
  section('Modelos de publicações e legendas',d=>{
   list(d,source.native_editor.caption_modes);
   list(d,source.native_editor.formatting);
   for(const model of source.examples){add(d,'h4',model.name);for(const block of model.blocks)add(d,'p',block.type+' · '+(block.text||'Sem legenda'));}
   add(d,'p','Imagem: 1 MiB como limite conservador; 5 MiB é o alvo, condicionado ao executor. Não alterar limites a partir deste manual.');
  });
  section('Especialistas criativos ('+source.creative_context.methods.length+')',d=>{
   for(const method of source.creative_context.methods){add(d,'h4',method.title);add(d,'p',method.instructions);add(d,'small','Resultado: '+method.deliverable);}
   list(d,source.creative_context.policy);
  });
  section('Referências externas ('+source.references.length+')',d=>{
   add(d,'p',source.provenance);
   const input=document.createElement('input');input.type='search';input.placeholder='Buscar especialista';input.setAttribute('aria-label','Buscar referências criativas');d.append(input);
   const ul=document.createElement('ul');d.append(ul);
   const refresh=()=>{ul.replaceChildren();const query=String(input.value||'').trim().toLocaleLowerCase('pt-BR');
    for(const item of source.references){if(!(item.name+' '+item.category).toLocaleLowerCase('pt-BR').includes(query))continue;
     if(typeof item.url!=='string'||!/^https:\/\/chatgpt\.com\/g\/g-[a-zA-Z0-9-]+$/.test(item.url))continue;
     const li=document.createElement('li');const link=add(li,'a',item.name);link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';add(li,'small',' · referência manual');ul.append(li);
    }if(!ul.children.length)add(ul,'li','Nenhuma referência encontrada.');
   };input.addEventListener('input',refresh);refresh();
  });
  section('Segurança e regras de uso',d=>list(d,source.guardrails));
  section('Identidade visual, exemplos aprovados e histórico',d=>add(d,'p','Edição administrativa, aprovação de exemplos e histórico persistente ainda não habilitados. Nenhuma informação de membros é carregada.'));
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
  <p role="status">Produção: Desktop homologado no Codex Windows; Nuvem aguarda registro privado. Somente leitura.</p>
  <section aria-label="Modalidades de integração"><h3>NeoPep Connect AI – Desktop</h3><p>Codex Windows · ZIP 1.0.5 homologado em duas contas.</p><h3>NeoPep Connect AI – Nuvem</h3><p>ChatGPT Web · conexão privada em conta elegível, ainda não registrada. iPhone: compatibilidade não homologada.</p></section>
  <section data-connect-ai-consent hidden aria-label="Autorizar integração">
   <h3>Autorizar integração</h3><p data-consent-client></p>
   <p>Permitir que este cliente consulte campanhas no NeoPep ${window.location?.origin==='https://app.neopep.com.br'?'Produção':'Teste'} com a sua conta?</p>
   <button type="button" class="primary">Autorizar leitura</button><p role="status"></p>
  </section>
  <details data-connect-ai-connections><summary>Conexões</summary><p role="status">A gestão depende da autorização individual do NeoPep.</p><ul></ul></details>
  <details><summary>Ferramentas</summary><p>A disponibilidade será informada pelo catálogo do servidor conectado.</p></details>
  <details data-connect-ai-knowledge><summary>Base de conhecimento da IA</summary><div data-knowledge-content></div></details>
  <details><summary>Histórico</summary><p>Histórico de operações disponível após a conexão ao servidor.</p></details>
  <details><summary>Instalar integração</summary>
   <label>Cliente<select data-connect-ai-client>${Object.entries(clients).map(([id,client])=>`<option value="${id}">${client.label}</option>`).join('')}</select></label>
   <label>Dispositivo ou superfície<select data-connect-ai-surface><option value="desktop">Desktop</option><option value="web">Web</option><option value="iphone">iPhone</option></select></label>
   <label>Ambiente<select data-connect-ai-environment><option value="test">Teste</option><option value="production"${window.location?.origin==='https://app.neopep.com.br'?' selected':''}>Produção</option></select></label>
   <p data-connect-ai-instructions></p><p role="status" data-connect-ai-install-state></p>
   <a class="text-btn" data-connect-ai-guide target="_blank" rel="noopener noreferrer">Abrir instruções oficiais</a>
   <a class="text-btn" href="../assets/connect-ai-mcp-icon.png" download="neopep-connect-ai.png">Baixar ícone PNG do servidor</a>
   <label>Endereço MCP candidato<input data-connect-ai-address readonly></label>
   <button type="button" class="secondary" data-connect-ai-copy>Copiar endereço MCP</button>
   <p role="status" data-connect-ai-copy-status></p>
   <section data-connect-ai-package hidden><h3>Plugin homologado · 1.0.5</h3><p>Produção · somente leitura · sem chaves ou senhas no ZIP.</p><a class="secondary" href="../assets/NeoPep_Connect_AI_Producao_1.0.5.zip" download="NeoPep_Connect_AI_Producao_1.0.5.zip">Baixar plugin ZIP 1.0.5</a><p><small>SHA-256: 30eb394710a4c13fcc8add7d719e1e8957cbfb13af3f5b768126e122ef9216fb</small></p></section>
   <section data-connect-ai-cloud hidden><h3>Configurar Nuvem (registro privado)</h3><p>Nome sugerido: NeoPep Connect AI – Nuvem. Autenticação: OAuth, CIMD quando disponível. Escopo: campaigns:read.</p><p>Abra Plugins pelo navegador, escolha Adicionar servidor MCP personalizado, informe o endereço acima e autorize sua conta administrativa NeoPep. A opção depende do plano e das permissões do workspace.</p><a class="secondary" href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer">Abrir Plugins do ChatGPT</a><p>Não compartilhe tokens ou senhas. Após o registro, teste em uma nova conversa. Não confunda registro com homologação móvel.</p></section>
   <button type="button" class="secondary" disabled>Verificar conexão</button>
  </details>
  <h3>Processamento</h3>
  <dl><dt>Cloudflare</dt><dd>Servidor MCP de produção conectado</dd>
  <dt>Vercel</dt><dd>Interface administrativa</dd>
  <dt>NeoPep Connect Windows</dt><dd>Planejado como executor complementar</dd></dl>
  <form method="dialog"><button type="submit" class="secondary" autofocus>Voltar a Campanhas</button></form>`;
  toolbar.after(dialog);
  mountKnowledge(dialog);
  mountInstaller(dialog);
  mountConnections(dialog,window.NeoCloud);
  mountConsent(dialog,window.NeoCloud);
  trigger.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
  dialog.addEventListener('close',()=>{if(trigger.isConnected)trigger.focus({preventScroll:true});});
 }
 return {mount};
})();
