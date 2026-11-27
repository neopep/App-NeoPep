// Teste: consentimento OAuth somente leitura e base de conhecimento preservada.
window.NeoAdminConnectAI=(()=>{
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
  if(!proof||!expires||Number(expires)<=Date.now()||params.get('scope')!=='campaigns:read'){approve.disabled=true;status.textContent='Solicitação inválida, expirada ou fora do escopo de leitura. Reinicie pelo Codex.';dialog.showModal();return;}
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
  toolbar.insertAdjacentHTML('beforebegin','<button type="button" class="secondary neo-connect-ai-entry" data-connect-ai-open aria-haspopup="dialog"><span aria-hidden="true">✦</span><span><strong>NeoPep Connect AI</strong><small>Base de conhecimento · Teste</small></span><span aria-hidden="true">›</span></button>');
  const trigger=root.querySelector('[data-connect-ai-open]');
  const dialog=document.createElement('dialog');dialog.className='card neo-connect-ai-dialog';dialog.setAttribute('aria-labelledby','neoConnectAITitle');
  dialog.innerHTML='<h2 id="neoConnectAITitle">NeoPep Connect AI</h2><p role="status">Teste: base de conhecimento disponível. Conexão MCP somente leitura mediante autorização; escrita desativada.</p><section data-connect-ai-consent hidden aria-label="Autorizar integração"><h3>Autorizar integração</h3><p data-consent-client></p><p data-consent-description>Permitir que este cliente consulte campanhas no NeoPep Teste com a sua conta? Somente leitura. Não autoriza criação, edição, envio ou agendamento.</p><button type="button" class="primary">Autorizar leitura</button><p role="status"></p></section><details data-connect-ai-knowledge open><summary>Base de conhecimento da IA</summary><div data-knowledge-content></div></details><form method="dialog"><button type="submit" class="secondary" autofocus>Voltar a Campanhas</button></form>';
  toolbar.after(dialog);mountKnowledge(dialog);mountConsent(dialog,window.NeoCloud);trigger.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});dialog.addEventListener('close',()=>{if(trigger.isConnected)trigger.focus({preventScroll:true});});
 }
 return {mount};
})();
