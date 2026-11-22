# Preparação da publicação oficial

**NO-GO para produção.** A aplicação depende de catálogo remoto autenticado, histórico reconciliado, evidência de restauração e aprovação específica. O diretório supabase/migrations contém históricos de instalação e de Teste. Preserve-os como referência e evite replay.

## Auditoria somente leitura

1. Usar conexões autenticadas separadas, em perfis PostgreSQL locais fora do Git. Confirmar no painel o destino de cada perfil, produção cpslafpzjtbpmoxxysaa e Teste qnuluspqfazdppciermw. Conferir TLS e o projeto no host ou usuário do pooler, sem credenciais em argumentos ou logs.
2. Em diretório privado e com umask 077, executar `PGSERVICE=neopep_prod_read psql -XqAt -f release/production/catalog.sql > prod-antes.jsonl` e repetir com o perfil de Teste para gerar teste.jsonl. Qualquer erro invalida a captura. O SQL usa transação somente leitura, inclui ACL, RLS, cron e ledger e compara definições por hash.
3. Executar `python3 release/production/compare-catalog.py prod-antes.jsonl teste.jsonl > delta.json`. Distinguir mudanças semânticas de formatação em sessão administrativa. Confirmar visibilidade do cron e do ledger antes de interpretar ausências.
4. Pelo painel administrativo, inventariar Edge, verify_jwt, Auth, callbacks, CORS, SMTP, CAPTCHA, DNS, Vercel e recuperação. Registrar configurações públicas, presença e nomes das variáveis. O catálogo PostgreSQL não verifica esses serviços.

## Ordem e cobertura dos lotes de homologação

| Lote | Entrega SQL | Dependências e limites |
|---|---|---|
| 01 Cadastros | 2 tabelas de rollout e leitura, mais RPC administrativa | Auth e administração da base oficial. |
| 02 Audiência e engajamento | 2 tabelas e RPCs de audiência e engajamento | Perfis, atividade e administração. |
| 03 Multiagentes | 3 tabelas e 9 colunas tipadas em `ai_attempts`, `ai_jobs` e `support_threads` | Catálogo administrativo. Ativação vedada via CHECK. Claim, finish, suporte e fila oficiais preservados. |
| 04 Monitoramento e operações | 10 tabelas, RPCs, gatilhos de auditoria e atribuição de ambiente oficial | Requer o catálogo de agentes. Preserva `neo_message_events_own`. Configuração de observabilidade externa depende da liberação de Edge e da validação de permissões. |
| 05 Campanhas, push e WhatsApp | 9 tabelas, bucket privado de imagens e 2 políticas Storage | Campanhas ativas, solicitação de push e lembretes WhatsApp bloqueados. Worker de campanhas sem EXECUTE. O agendamento e a preferência padrão de push oficial são preservados. Permanece em escopo apenas a base de campanhas já integrada ao staging. |
| 06 Connect | 12 tabelas, bucket privado de releases e política de download | Canal pausado, distribuição limitada a rascunho e RPCs Connect sem EXECUTE para os roles do aplicativo e dos workers. Nenhum instalador ou registro do Teste é copiado. |
| 07 Financeiro | Correção incremental de `neo_shop_v36` para retentativa do checkout | Exige fingerprint do corpo oficial aceito pelo SQL. A revisão de reembolsos parciais e a chave no provedor estão no código de Edge da candidata. A homologação funcional em sandbox e a publicação de Edge têm decisões próprias. |

Os lotes cobrem as 38 tabelas e as 9 colunas em tabelas existentes. O ensaio sintético mediu 70 índices, 13 gatilhos, 182 restrições, 42 rotinas e 3 políticas de Storage adicionadas. O número de restrições inclui gates de inatividade. Contagens isoladas de índices e gatilhos coincidem com as do relatório autenticado, mas identidade e definição ainda exigem comparação objeto a objeto. As 42 rotinas adicionadas não encerram as 56 encontradas no Teste. As diferenças de contrato compartilhadas também permanecem abertas.

Os IDs de Teste 20261122022149, 20261122040259, 20261122044929 e 20261122151856 requerem reconciliação com as definições remotas. O lote 06 usa fixtures com hashes fixos para construir dependências do ensaio. Antes de aprovar o delta oficial, confirmar seus equivalentes instalados, a predecessora de 20261122152200 e a matriz de ACLs. A linha de base de Produção precisa ser registrada a partir do catálogo confirmado, sem importar ledger de Teste ou repetir migrações iniciais.

O manifesto seleciona apenas as fontes expressamente listadas. Fora da exceção financeira validada pelo próprio SQL, o pós-voo transacional impede alteração das rotinas instaladas e seus grants. Também verifica ACL/RLS de relações instaladas, políticas preexistentes e o default de push. Os catálogos antes e depois são necessários para confirmar mudanças fora desses guards. Os PRs #22 e #23 ficam fora.

## Execução e recuperação futura

- Obter ponto de recuperação do banco e comprovar restauração em ambiente isolado. Fazer cópia separada dos objetos de Storage e ensaiar recuperação com autorização. Registrar o SHA Vercel anterior e versões de Edge.
- Capturar catálogo e contagens agregadas antes de cada lote. Interromper em caso de drift, locks ou filas inesperadas. Preservar o cron oficial.
- Executar somente o lote aprovado. Repetir a captura e rodar `python3 release/production/verify-invariants.py prod-antes.jsonl prod-depois.jsonl`. Comparar o delta com o manifesto aprovado e verificar isolamento, filas, pedidos, pagamentos e objetos privados.
- Em falha antes do commit, reverter a transação. Após commit, desligar ativações novas no servidor, restaurar código ou Edge anterior quando compatível e preparar migração compensatória. Preservar dados e auditoria. Reconciliar IDs de transação e webhooks antes de reversão financeira. Restauração na origem oficial exige avaliação de perda de gravações posteriores e autorização.
- Publicar o frontend por último, após decisão Go. Confirmar no painel a supressão de deploy da branch de preparação. Após publicação autorizada, observar Vercel READY e testar a origem oficial.

## Executar em homologação isolada

O manifesto fixa o SHA-256 de cada fonte e descreve as adaptações intencionais. O renderer valida os hashes, rejeita colisões, exige o banco `neopep_release_rehearsal`, limita lock e duração de statements e faz pré e pós-verificações na mesma transação. Um lote já aplicado falha antes do DDL. Nenhum lote grava no ledger.

1. Confirmar no painel e no perfil local que o host e o banco são do ensaio isolado. Assegurar que o destino não tem dispatchers nem acesso aos provedores reais. Usar diretório de evidências privado, fora do Git.
2. Seguir a ordem do manifesto. Para cada lote, começar com `PGSERVICE=neopep_isolado bash release/production/batches/rehearse.sh 01-cadastros /caminho/privado/01-rollback`. O script gera o SQL com rollback, guarda os catálogos e SHA-256 e exige que o catálogo inteiro seja igual no fim. O lote financeiro grava também o pré e o pós-voo de fingerprints e unicidade.
3. Após revisar a evidência, repetir o mesmo lote com novo diretório e a opção `--apply-isolated`. Comparar `delta.json` com os objetos esperados antes de avançar. Se a captura posterior falhar depois do commit, interromper a sequência e confirmar o estado pelo catálogo antes de tentar novamente.
4. Para inspecionar SQL sem conectar, usar `python3 release/production/batches/render.py 01-cadastros --rollback`. A transação pode ser descartada antes do commit. Para estado financeiro já persistido, há patch compensatório com fingerprint em `rollback/20261122190100_shop_checkout_retry.sql`, condicionado à reconciliação de pedidos e pagamentos. Após lotes aditivos já persistidos, manter os gates de inatividade e preparar compensação específica que preserve registros. Retestar a sequência completa em nova cópia restaurada.

[Procedimento de restauração](RESTORE-REHEARSAL.md)
