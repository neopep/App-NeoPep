# Instalação exclusivamente em staging

Alvo autorizado: `neopep-staging`, ID `qnuluspqfazdppciermw`. A base é `c770682`. Confira o ID no painel antes de executar cada etapa.

1. Siga [ORDEM.txt](ORDEM.txt), começando pelo [preflight](00-preflight.sql). Rode cada SQL individualmente no editor e pare no primeiro erro. Para psql já conectado ao staging, use [aplicar-psql.sql](aplicar-psql.sql), com os arquivos mantidos nas posições indicadas.
2. O diretório [migrations](migrations/) contém as 47 migrações em ordem. As cópias `202611160038` e `202611160039` apontam somente ao staging. Execute o [pós-teste](99-postflight.sql) e a [auditoria em leitura](auditoria-somente-leitura.sql) antes de criar os usuários da fixture.
3. Crie as duas contas descartáveis no Auth do staging com senhas exclusivas e use a [fixture](fixture-opcional.sql). Os agentes adicionais são inativos. Pagamentos, cron e push permanecem fora do primeiro ensaio.
4. Para a etapa Edge isolada, os bundles estão em [ai-reply](edge/ai-reply.ts) e [agent-integrations](edge/agent-integrations.ts), nessa ordem. Configure as origens e credenciais de staging somente no ambiente separado.
5. A configuração versionada nesta branch deixa o frontend sem conexão Supabase. Gere a cópia de homologação com o [gerador](../../../scripts/prepare-multiagent-staging.cjs) e a variável privada `NEO_STAGING_SUPABASE_PUBLISHABLE_KEY`. Ele valida a chave via HTTPS no staging. O [configurador](../configure-frontend.cjs) pode ativar a nuvem em um frontend de homologação gerado. Consulte o [manual](../../../docs/processos/HOMOLOGACAO-MULTIAGENTE.md).

[Evidências do ensaio](EVIDENCIAS.md)
