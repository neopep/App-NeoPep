# #013 — Diagnóstico não destrutivo da sessão WhatsApp (Produção)

## Problema observado em 24/11/2026
Depois de instalar o Connect 0.2.9, a sessão WhatsApp de **Teste** conectou e mostrou grupos. Na janela de **Produção**, ao selecionar Conexão WhatsApp → Conectar WhatsApp surgiu «Não foi possível processar a sessão local protegida». O telefone ainda exibia um dispositivo Windows vinculado, mas isso não comprova que o cofre DPAPI local possa ser lido.

A mensagem genérica vinha do `catch` em `connect/windows/WhatsApp.cs::Receive`, que agregava indiscriminadamente erros na desserialização do envelope, atualização de credenciais, proteção do cofre, interface, grupos, QR e status. Sem registro local por fase, **não há evidência da causa específica**. O erro não prova perda/corrupção da sessão.

## Correção de diagnóstico
- Introduz códigos seguros (sem dados privados) `WA-LEITURA-*` para leitura do cofre, `WA-INICIALIZACAO-*` para lançamento do Bridge, `WA-CREDENCIAL-*` para salvamento do cofre DPAPI, `WA-ESTADO-*` para estados, `WA-GRUPOS-*` para grupos, `WA-QR-*` para QR e `WA-ENVELOPE-*` para payload inesperado.
- Classes controladas: `DPAPI`, `PERMISSAO`, `ARQUIVO`, `FORMATO`, `PROCESSAMENTO`. **Nunca registrar** mensagem/stack de exceção, número do telefone, JID, chave, credenciais, QR Code, conteúdo da conversa ou caminho da pasta Windows.
- A janela exibe o código e a aba Diagnóstico explica que a sessão está preservada. O arquivo local `whatsapp-diagnostico.log` contém somente data UTC e código, com limite aproximado de 32 KiB. Nenhum envio de diagnóstico ao servidor.
- Ao encontrar erro, o Bridge é interrompido sem remover `whatsapp-session.dat` ou limpar o perfil; o novo código **não altera** `OpenVault`, `WriteVault`, `SaveVault`, entropia, paths DPAPI, autenticação, revogação, envio, ligação com produção, fila ou Mercado Pago. O botão `Desconectar` já existente permanece destrutivo e não deve ser usado para investigar.
- Esta mudança **não afirma reparar sozinha** a causa original, pois o código exato só poderá ser observado após instalar uma versão de diagnóstico voluntariamente aprovada. Teste de recuperação sem dados reais exige preservar e usar o cofre da mesma conta Windows.
- Compilar como candidato **0.2.10** após 0.2.9 homologado, com testes isolados. Nenhum release privado é disparado, nenhuma atualização aprovada/distribuída, nenhum deploy Vercel, nenhuma escrita Supabase nem envio real sem decisão posterior.

## Verificação após instalação futura
1. Confirmar que a sessão Teste permanece conectada e com grupos.
2. Abrir Produção → WhatsApp → Conexão WhatsApp e tentar conectar uma vez.
3. Se falhar, copiar **somente** o código `WA-...` apresentado na aba Diagnóstico, sem compartilhar arquivos `.dat` ou credenciais.
4. Corrigir precisamente a fase reportada, sem apagar a sessão. Manter Prod sem enviar.

**Precisão de status:** uma falha da sessão não garante que o cofre estivesse intacto antes do diagnóstico. A interface informa apenas que a rotina de diagnóstico não o apaga; nenhum reset ou reparação são prometidos sem evidência de causa.

## Resultado da validação e preparação 0.2.10
- CI Windows final: run [45480809973](https://github.com/neopep/App-NeoPep/actions/runs/45480809973) com `conclusion=success`, 12 etapas aprovadas, fonte **`148f68f927b9b128dcd5518b97dc6ab69f8980cb`** (o código efetivamente compilado).
- Pedido ao repositório privado `neopep/NeoPep-Connect-Build-Privado`: `release-requests/0.2.10.json`, commit `ce6507e8b70cc82471fbc0a4d10b2c4895b169d4`, perfil `staging`; ponte `45481259800`.
- Build privado [45481286448](https://github.com/neopep/NeoPep-Connect-Build-Privado/actions/runs/45481286448) **success**; artefato privado `connect-teste-0.2.10-45481286448-1` (ID 14960019492); ZIP digest `sha256:326fe14dc82441067713f024463f7692955b75350333282bbb746ababd7e5702` (o digest do ZIP não equivale ao SHA do EXE).
- No primeiro preflight após build: `connect_release_evidence` e `connect_releases` para 0.2.10 ainda ausentes no Supabase Teste. Fase pendente: agente Windows RSA CNG conferir, assinar manifesto, registrar arquivo privado e **somente draft**. Não aprovar, não baixar nem instalar antes de verificar origem/hash/estado.
- Flags Supabase Teste: `whatsapp_enabled=false`, `app_enabled=false`, `connect_config.paused=true`. Sem alterações de bancos, sem deploys Vercel, produção intocada.
