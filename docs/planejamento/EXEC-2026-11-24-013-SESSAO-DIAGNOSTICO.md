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
