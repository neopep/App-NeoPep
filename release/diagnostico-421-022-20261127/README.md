# NeoPep Connect 0.2.22 — inventário criptográfico local
Base: 0.2.21, 3a535e31a6cebbb9cb1d86bd47c7ea9f3e237c0b.

Evidência da homologação 27/11 às 18:50: Mundo Pep 231→231, LID→LID, todos os identificadores LID, administrador e envio/configuração restritos a administradores. Teste NeoPep 3→3, LID→LID, metadados consistentes. O erro 421 anterior permanece sem causa confirmada.

Código upstream rc14: src/Socket/messages-send.ts linhas 709–814 lê sender-key-memory e persiste mapa antes de sendNode (1097); src/Signal/libsignal.ts expõe hasSenderKey e jidToSignalProtocolAddress. Issue upstream #2901 é hipótese correlata, não causa demonstrada. Não aplicar patches de criptografia especulativos nem reenvios.

A candidata mantém o diagnóstico manual sem envio e acrescenta inventário de presença de registros próprios PN/LID, memória de distribuição por tipo e entradas sem correspondência nas identidades atuais, cache persistido device-list e presença de registros de sessão por endereço exato. Cache device-list é indexado por user e pode estar incompleto/desatualizado; aliases atuais podem não estar disponíveis; contagens não comprovam ex-membros, validade criptográfica nem estado remoto. O mapa é indicador local, não confirmação de entrega. Somente campos agregados são exibidos localmente. Não alterar credenciais, chaves, permissões, participantes, biblioteca ou transporte. Corrige quebras de linha no histórico Windows.

22 casos de teste simulados em V8 passaram, incluindo os anteriores. Executar esteira privada real antes da distribuição. Aplicar SQL de compatibilidade após validar build, mantendo versões anteriores, sem mudar outros controles. Diagnosticar Mundo Pep e Teste NeoPep, sem enviar mensagens. Se necessário, usar o WhatsApp oficial para publicação manual, respeitando permissões e políticas. Não repetir tentativa 421 automaticamente.
