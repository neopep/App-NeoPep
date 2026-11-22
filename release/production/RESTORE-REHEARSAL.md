# Ensaio de backup e restauração

**Estado atual — pendente.** Os testes usam dados sintéticos em PGlite. Ainda não há evidência de restauração de banco ou Storage de produção.

## Preparar a origem e um destino isolado

1. Em sessão autorizada de leitura, confirmar o projeto oficial, a proteção disponível no plano e a hora UTC do ponto de recuperação. Registrar o intervalo de perda de dados tolerado e o tempo máximo de retorno antes da janela.
2. Preparar um destino dedicado, sem domínio de produção e sem credenciais oficiais. Restringir o acesso aos operadores autorizados. Impedir egress para Mercado Pago, WhatsApp, SMTP, Web Push e provedores de IA, desativar cron/dispatchers no destino e controlar integrações de Auth antes de iniciar a restauração. Nunca conectar o frontend oficial ao destino.
3. Obter a imagem de backup pelo mecanismo aprovado do provedor. Para arquivo lógico, verificar SHA-256 e o inventário via pg_restore --list; essa leitura não comprova restauração. Proteger o backup e os catálogos fora do Git. Planejar o backup de objetos separadamente, com metadados, inventário e checksums de uma amostra; banco e objetos devem corresponder ao mesmo ponto lógico.
4. Se a política não autorizar copiar dados reais para o ambiente isolado, usar clone sanitizado ou dados sintéticos para o ensaio funcional e registrar a limitação. Restauração de backup real só conta como comprovada com execução e evidência autorizadas.

## Restaurar e validar

1. Restaurar no destino confirmado e registrar ferramenta, versões, ponto UTC, duração, erros e ajustes esperados. Transmitir logs desidentificados e guardar material protegido na área aprovada. A restauração de um projeto não deve alterar nem religar o cron oficial.
2. Consultar o catálogo de origem e de destino com catalog.sql. Distinguir diferenças intencionais de infraestrutura, como cron e segredos ausentes na cópia, de perda de objetos. Conferir agregados de Auth, pedidos por estado, eventos de pagamento, conversas e filas na mesma referência temporal. Reconciliar divergências justificadas antes do ensaio.
3. Restaurar objetos da amostra nos buckets privados do destino. Conferir tamanho, checksum e negativa de acesso anônimo e entre duas contas sintéticas, sem publicar links assinados ou usar dados reais em smoke tests.
4. Renderizar e aplicar os lotes incrementais somente no banco de ensaio neopep_release_rehearsal. Comparar catálogo, RLS, grants e contagens antes/depois. Testar falha e rollback e, em sequência separada, aplicar o lote com commit e medir o efeito. Qualquer objeto existente ou diferença de contrato suspende o lote.
5. Validar Auth, navegação, checkout, webhook e reembolsos com fixtures ou conta sandbox, protegendo o cron e as filas. Registrar resultado de cada caso e decisão de operador.

## Evidência mínima para um Go

- Identificadores do backup e destino, período de consistência e ferramenta de recuperação.
- Data, duração, RPO/RTO observados e diferença frente ao alvo.
- Resultado dos catálogos e agregados, amostra de Storage, políticas de acesso e cenários financeiros e de Auth.
- Passos de recuperação testados, responsáveis e evidência de bloqueio de saídas. Uma leitura do manifesto ou um teste PGlite não substitui esse registro.

Se um lote falhar antes do commit, usar rollback da transação. Depois do commit, preparar alteração compensatória revisada, preservando registros/auditoria. Para alterações financeiras, reconciliar pedidos e eventos do provedor antes de restaurar qualquer estado. A restauração sobre a origem oficial precisa de avaliação das gravações posteriores e aprovação separada.
