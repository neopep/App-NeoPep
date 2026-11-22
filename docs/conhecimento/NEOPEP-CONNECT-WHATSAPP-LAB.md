# NeoPep Connect — fase 2.1: laboratório QR (sem envios)

**Estado:** protótipo em branch de desenvolvimento. **Não faz parte do executável NeoPep Connect Windows 0.1.1** já instalado, não foi distribuído e não está liberado para contas reais de produção.

## Objetivo e limites

A fase 2.1 cria um adaptador de leitura por QR Code na modalidade de dispositivo vinculado, verifica estado da conexão e consulta exclusivamente os grupos dos quais a conta participa.

- NÃO envia texto, arquivos, mensagens nem campanhas.
- NÃO processa conversas, fotos, contatos ou mensagens recebidas.
- NÃO transmite os identificadores de grupos, nomes, chaves do WhatsApp ou credenciais para o Supabase.
- NÃO altera a fila de simulação e não modifica o aplicativo Windows instalado.
- Usa Node.js 22+ somente no computador de laboratório e biblioteca não oficial Baileys 7.0.0-rc14.

## Proteções locais

- Serviço HTTP vinculado somente a 127.0.0.1 e uma porta aleatória.
- URL do navegador com segredo aleatório no fragmento (não enviado ao servidor). As rotas privadas exigem header Bearer e as operações exigem Origin local.
- QR Code fica somente na interface local e na memória; jamais é escrito no log ou exportado.
- Consulta de grupos devolve somente ID, nome e contagem agregada. Não existe rota para enviar mensagens.
- O modo HTTP de laboratório mantém o estado em memória. O candidato WinForms usa seu próprio cofre DPAPI, descrito abaixo.
- Ao desconectar, o adaptador solicita revogação do vínculo. O cliente Windows apaga o cofre local mesmo se a revogação remota falhar.

## Opções técnicas examinadas

A API oficial de Grupos da Meta exige uma Official Business Account (OBA), limita grupos a oito participantes e exclui números comuns do WhatsApp Business App. Documentação: https://developers.facebook.com/documentation/business-messaging/whatsapp/groups.

O QR Code via Baileys é uma integração não oficial, sujeita a alterações técnicas e às restrições dos termos do WhatsApp. Documentação: https://github.com/WhiskeySockets/docs/blob/main/quickstart.mdx e https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App.

## Critérios originais de implementação e homologação Windows

1. Gerar, auditar e versionar o package-lock.json reprodutível para as dependências pinadas; bloquear distribuições sem lock.
2. Revisar a compatibilidade e testes de pareamento com versão específica de Baileys e Node.js em um Windows limpo.
3. Definir armazenamento cifrado com DPAPI ou proteção equivalente, revisar ACLs, rotação, logout e revogação.
4. Preparar empacotamento e instalador assinado/verificado que inclua o runtime e o bridge, com atualização segura.
5. Adicionar uma tela no NeoPep Connect Windows com Conectar, QR, Conectado, Desconectar e Grupos; não deixar um terminal como interface final.
6. Confirmar que a conta de teste é membro dos grupos consultados e que não há captura ou sincronização de membros/conversas.
7. Implementar um cadastro de permissões por grupo, com confirmação explícita do administrador.
8. Fazer homologação com número e grupo próprios de TESTE, não com números comerciais críticos.
9. Manter qualquer envio futuro em um módulo SEPARADO, desligado por padrão, com confirmação humana, deduplicação e auditoria de estado incerto.
10. Preservar a produção e o programa Windows 0.1.1 validados.

## Validação técnica local por um desenvolvedor

Depois de gerar o lockfile revisado e instalar dependências com npm ci, ativar explicitamente NEOPEP_WHATSAPP_LAB_ENABLE=1 e iniciar node server.mjs dentro da pasta connect/whatsapp-lab.

No Windows PowerShell: definir NEOPEP_WHATSAPP_LAB_ENABLE como 1, e executar node server.mjs.

O aplicativo abre um navegador local. NÃO executar com credenciais de um número importante. O teste automatizado sem WhatsApp real está em tests/whatsapp-lab.test.cjs na raiz do repositório.

## Critério de aceite

Conseguir exibir e renovar QR de uma conta dedicada; reconhecer autenticação, desconexão e revogação; mostrar apenas IDs locais, nomes e contagem dos grupos da própria conta; nunca divulgar a sessão, conteúdos privados ou enviar mensagens; passar por avaliação de segurança e possuir um instalador Windows próprio.

## Candidato Windows 0.2.0

O instalador Windows incorpora o runtime Node.js x64 e as dependências fixadas no lockfile. A interface WinForms usa pipes herdados para falar com o bridge local, sem porta HTTP. O cofre do WhatsApp é separado de `session.dat` e protegido com DPAPI vinculada ao usuário Windows. Nenhum QR, token de sessão ou dado dos grupos segue para o Supabase. A interface só recebe identificador, nome e contagem dos grupos participantes. O adaptador não assina eventos de mensagens ou contatos.

Para atualizar, encerre o Connect 0.1.1 pela bandeja, confira o tamanho e o SHA-256 do EXE com o manifesto do mesmo workflow e execute o candidato com a mesma conta Windows. Preserve o diretório de dados local e não desinstale a versão anterior antes da atualização. Ao reabrir, confira o computador aprovado e `fixture-principal`. Em **WhatsApp experimental**, conecte apenas um número próprio de teste. Para fechar a sessão, use **Desconectar WhatsApp**. Se a revogação remota falhar, confirme a remoção em **Dispositivos conectados** no telefone.

O candidato segue fora do canal aprovado. A integração com o cliente não oficial é experimental e pode sofrer restrições pelo WhatsApp. São necessários ensaios interativos em Windows 10 e 11 com número e grupo próprios para validar QR, desconexão, reconexão real, coexistência do simulador e revogação remota. A distribuição aprovada exige revisão de assinatura do instalador. [PR de homologação](https://github.com/neopep/App-NeoPep/pull/10)

## Cliente Windows de desenvolvimento

O executável Windows já continha o provedor Baileys real, separado da simulação. A branch `desenvolvimento/connect-whatsapp-grupos` mantém a dependência fixada em 7.0.0-rc14 e Node.js oficial x64 24.22.1. Baileys é um cliente comunitário de WhatsApp Web, com acesso ao pareamento e aos grupos participantes. A versão fixada é candidata a release. O protocolo pode mudar, o pareamento pode deixar de funcionar e o WhatsApp pode restringir ou bloquear a conta. Use uma conta própria de Teste. Nenhuma rota de mensagens foi acrescentada.

O cliente restaura o cofre DPAPI quando a janela WhatsApp é aberta novamente. Após conectar, solicita os grupos e mostra nome, número quando o WhatsApp fornece um identificador telefônico, nome do grupo, identificador e contagem disponível. A aba Grupos oferece busca, atualização e caixas de seleção locais. Números, identificadores e credenciais permanecem no computador. As caixas representam uma seleção em memória. A foto de grupo e a confirmação de compatibilidade ponta a ponta dependem de validação com conta real.

### Compilar e testar manualmente

1. Use uma máquina Windows x64 de Teste, separada do computador usado para o ensaio do atualizador 0.2.2 → 0.2.3. Instale o Node.js oficial 24.22.1 x64. No checkout da branch, rode `npm ci --omit=dev --ignore-scripts` e `npm test` em `connect\whatsapp-lab`.
2. Na raiz, execute `.\connect\windows\build.ps1 -Perfil Teste -Version 0.2.4 -Output "$env:LOCALAPPDATA\NeoPep-WhatsApp-Candidato"`. Se esse perfil já tiver confiança de atualizações configurada, incorpore a mesma chave pública revisada com `-PublisherPublicKey`. Confira o SHA-256 com o manifesto local. O ensaio de QR usa instalação manual isolada, sem publicação no canal de atualização.
3. No cliente Windows, entre com a conta NeoPep de Teste. Abra **WhatsApp → Abrir conexão WhatsApp → Conectar WhatsApp**. No telefone próprio, abra **Dispositivos conectados → Conectar dispositivo** e aponte para o QR. Confirme a exibição de grupos conhecidos, o filtro, as caixas de seleção e a atualização manual.
4. Feche e reabra o cliente e entre na aba WhatsApp. Confira a restauração sem novo QR. Teste a reconexão após queda de rede, a atualização do QR e a revogação pelo telefone. Teste a desconexão no cliente e confirme no telefone que o vínculo desapareceu. Se a revogação remota falhar, o cliente remove o cofre local e orienta a remoção pelo telefone.

### Proposta para o vínculo web e o Supabase, sujeita à revisão

- Criar armazenamento separado dos grupos de campanhas e de simulação em `neo_private`, com RLS, associação por usuário e computador e chave única por computador e identificador de grupo. Persistir apenas grupos optados, nome, contagem agregada quando conhecida, estado e horário definido no servidor. Usar o vínculo existente do computador para obter o proprietário no servidor. O estado de conexão deve expirar quando o heartbeat estiver antigo.
- A operação de sincronização valida `auth.uid()`, titularidade, computador aprovado e prova existente do dispositivo. A chamada deve receber um conjunto completo de seleções, limitar tamanho e quantidade e aplicar inclusão, atualização e retirada da seleção anterior numa transação. O RPC de leitura web deve devolver somente os vínculos do usuário autorizado. Rejeitar computadores revogados também no caminho de leitura. O uso em painel administrativo de terceiros exigiria um requisito de autorização separado.
- No Windows, conectar uma ação explícita **Sincronizar selecionados** ao RPC. No painel web configurado para homologação, exibir quantidade, grupos vinculados e último horário confirmado pelo servidor. Os acessos ao banco e a UI web só devem ser habilitados após revisar o contrato, os testes de isolamento e a revogação. O fluxo não recebe número do WhatsApp, imagens, arquivos de sessão, contatos, listas de membros nem mensagens.
