# Codex — NeoPep Connect Windows: um programa, dois ambientes independentes

## Contexto obrigatório

O proprietário confirmou em 22/11/2026 que quer **um único instalador e aplicativo Windows** NeoPep Connect, capaz de manter **Teste** e **Produção** simultaneamente, em duas sessões e janelas ou abas claramente identificadas. A versão de homologação anterior do Connect já conectou via QR ao WhatsApp real e listou os grupos de uma conta, mas **o envio automático para grupos reais não foi validado**. Não reconstruir do zero: preservar cliente, integração QR, UX, atualizador, instalador, autenticação e fluxos existentes. Desenvolvimento do código/instalador Windows será realizado **exclusivamente pelo Codex**; esta tarefa é a especificação para o Codex e não autoriza alterar binários nesta branch web.

### Projetos

| Ambiente | Supabase | Web | Dados |
|---|---|---|---|
| Teste | `qnuluspqfazdppciermw` | `teste.app.neopep.com.br` | somente homologação |
| Produção | `cpslafpzjtbpmoxxysaa` | `app.neopep.com.br` | dados oficiais |

A branch `staging/permanente` e o banco de Teste continuam como ambiente próprio. A migração incremental do backend oficial das novas funcionalidades já foi realizada; **não copiar dados, usuários, notificações, pagamentos, sessões, instâncias WhatsApp ou segredos do Teste para Produção**.

O código mencionado em conversas anteriores inclui `ConnectProfile.cs`, `Connect.cs`, `WhatsApp.cs`, `CampaignComposer.cs`, `Installer.cs`, `UpdateUi.cs`, `UpdateHelper.cs` e `build.ps1`, mas o Codex deve **localizar a estrutura real do projeto antes de editar**. Verificar PRs, commits, estado e documentação atual: `AGENTS.md`, `docs/conhecimento/CONTEXTO-MESTRE.md`, `ARQUITETURA.md`, `SEGURANCA.md`, `docs/memoria/DECISOES.md` e o histórico de Connect. Se algum caminho estiver ausente, pesquisar na branch/repositório Windows conectado; não criar outro aplicativo por suposição.

## Requisito principal: um EXE, dois perfis simultâneos

1. **Uma instalação** e **um atualizador global** assinado, sem dois EXEs divergentes. Definir versão real a partir da árvore Git/manifesto, sem assumir v0.3.0 como versão já disponível.
2. **Dois perfis obrigatoriamente separados**, identificados por enum/ID imutável `Teste` e `Produção`, cada qual fixado ao seu Supabase e URL. Não permitir trocar o endereço do perfil para outro projeto por parâmetros de tarefa/QR/manifests.
3. **Duas sessões NeoPep** com login/logout/tokens/refresh independentes, **duas sessões WhatsApp** com credenciais QR e state store independentes, conexões e grupos por perfil, filas/leases/tarefas/receipts isolados, consentimentos, logs, arquivos, campanhas, rascunhos, auditoria e preferências próprias.
4. Permitir ambos online ao mesmo tempo, sem exigir desconectar Teste para operar Produção. Janelas/abas com identificação persistente e inconfundível `TESTE` vs `PRODUÇÃO`; ao iniciar, reabrir perfis autorizados, mas **não reconectar/ativar automaticamente envios de Produção que dependam de confirmação específica**.
5. Armazenamento local segregado em diretórios próprios por ambiente e conta, com DPAPI ou equivalente por usuário do Windows para tokens e segredos. Nunca imprimir credenciais, tokens, QR em logs, telemetria ou relatórios.
6. Atualização do cliente compartilhada, mas registro de aprovações/versões, canal de distribuição, manifesto, download e auditoria **independentes nos dois bancos**. Assinatura do executável e hash SHA-256 devem conferir com o mesmo artefato; não marcar Authenticode como aprovado se não houver certificado. O perfil de Produção deve usar `profile='production'`; o de Teste usa `profile='staging'` em cada backend.
7. O instalador já existente deve **migrar uma única vez o estado legado para o perfil Teste**, sem copiar QR/tokens para Produção. Novas instalações criam perfis vazios. Falha de migração deve preservar a instalação anterior/permitir rollback.

## Campanhas e WhatsApp

- Manter o compositor de campanhas do painel e o cliente Windows conectados exclusivamente ao **ambiente selecionado**. Confirmação humana explícita para qualquer envio real de Produção, com ambiente, grupo, quantidade, título e conta de WhatsApp visíveis. Proibir envios com destinatário indefinido/seleção vazia.
- O estado comprovado inclui conexão QR real e listagem/sincronização de grupos em Teste. **Não declarar disparo real implementado/homologado** sem prova de envio para grupo permitido, idempotência de tarefas, limites e confirmação.
- O Windows deve consumir os endpoints/RPCs já implantados no ambiente correto, com token do usuário e credenciais de dispositivo específicas do perfil. Não usar `service_role` nem segredos do servidor no EXE. Verificar contrato real `neo_connect_admin`, `neo_connect_device`, `neo_connect_update`, `neo_connect_wa_*` e políticas do Storage privado.
- Se o backend exibir canal sem dispositivo ativo, mostrar estado `Aguardando conexão`, nunca simular envio concluído. Se houver erro numa sessão, a outra deve permanecer operacional.
- Preservar operação de QR, editor de campanhas, atualizador e assinatura do cliente que já funcionam; não alterar Mercado Pago, Auth, serviço de push ou IA do web app por esta tarefa Windows.

## Testes e aceitação

1. Mesma instalação, abertura simultânea Teste e Produção, acessando os projetos e logins corretos.
2. A sessão/QR/grupo/tarefa do Teste **nunca aparece nem é enviada** para a Produção; e vice-versa, inclusive após reiniciar, atualizar, desconectar e reautenticar.
3. Dois logins com credenciais diferentes, logout apenas do perfil escolhido e recuperação de sessão sem vazamento.
4. Migrar a configuração antiga para Teste sem criar estado em Produção.
5. Erro de rede/429/fila vencida/segredo incorreto/falha de QR afeta apenas aquele ambiente; recuperação sem duplicar envio ou tarefa.
6. Atualização única do aplicativo preserva duas sessões e verifica assinatura e hash; rollback documentado.
7. Interface indica permanentemente ambiente escolhido e exige confirmação explícita antes de enviar mensagens reais na Produção.
8. Teste de envio controlado e permitido, com diagnóstico no Supabase correspondente antes de habilitar automação sem confirmação.
9. Build Windows e testes automatizados .NET no GitHub/Codex; fazer revisão do PR com lista de caminhos alterados, logs sem segredos e artefatos versionados. Sem publicar atualização de Windows na Produção antes de validação da instalação e assinatura.

## Forma de execução do Codex

- Começar por auditoria de paths/branches e leitura de `AGENTS.md`; não abrir branch redundante nem tocar `main` sem necessidade. **Criar PR próprio para o Windows, separado do PR #25 da web**.
- Implementar adaptação incremental, commits pequenos, sem refatoração global, mantendo compatibilidade com modo único antigo durante migração.
- Priorizar seleção de ambiente e isolamento de tokens/WhatsApp, depois atualização/instalador, depois fila/sincronização/campanhas.
- Entregar relatório conciso do que foi implementado, o que ainda é simulado, testes executados, versão realmente compilada, hash do instalador e instruções de validação. Não assumir que distribuição pública assinada está pronta se não estiver.

**Objetivo final:** um NeoPep Connect Windows para administrar Teste e Produção simultaneamente, com separação efetiva dos dois bancos e dos dois WhatsApps, **sem reconstruir o que já foi desenvolvido**.
