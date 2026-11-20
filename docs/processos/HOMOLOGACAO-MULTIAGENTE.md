# Homologação do NeoPeptídeos multiagente

**Alvo único:** `neopep-staging`, projeto `qnuluspqfazdppciermw`, PostgreSQL 17.12. Antes de executar qualquer script, selecione e confira esse ID no painel. O preflight verifica o banco vazio e os pré-requisitos, mas o nome interno do banco PostgreSQL não identifica o projeto Supabase. Preserve o projeto operacional.

Os arquivos individuais ficam no [diretório de instalação](../../release/multiagent-staging/install/README.md).

Em 20/11/2026 a validação da configuração publicada do App-NeoPep confirmou conectividade HTTPS aos três domínios autorizados e acesso OAuth de leitura e escrita ao staging pela integração oficial do Supabase. Consulte o [registro de rede e preflight](../memoria/HISTORICO-DE-ALTERACOES.md#mem-20261120-013) e as [evidências do ensaio](../../release/multiagent-staging/install/EVIDENCIAS.md).

## SQL e dependências

1. No projeto separado, confira Auth, Storage, os papéis padrão, Supabase Vault e a assinatura de `net.http_post` do `pg_net`. Habilite extensões ausentes somente se autorizado no staging. Mantenha todos os cron jobs e segredos de push/IA por cron ausentes durante a homologação inicial. Não use instaladores históricos de `supabase/setup/` em paralelo.
2. Rode `00-preflight.sql`. Após sucesso, siga `ORDEM.txt` com as 45 migrações históricas em ordem lexicográfica, seguidas por MA-01/02 e MA-03, e finalize com `99-postflight.sql`. Execute uma por vez no SQL Editor, interrompendo no primeiro erro. Em psql conectado comprovadamente ao staging, `aplicar-psql.sql` aplica a mesma ordem com `ON_ERROR_STOP`. Mantenha cada transação original. Se houver falha parcial, registre o último arquivo concluído, confira os objetos em leitura e revise a retomada antes de executar novos arquivos.
3. As cópias das migrações 202611160038 e 202611160039 redirecionam os dois triggers HTTP para o projeto de homologação. As outras 45 cópias preservam o SQL da referência. A instalação verifica grants de usuário e worker, RLS e destinos dos triggers. O catálogo inicial contém somente o padrão desabilitado, pois o staging começa vazio. Não copie dados, configurações de pagamentos, credenciais, tokens nem segredos da produção.
4. Rode `auditoria-somente-leitura.sql`. Se a instalação foi feita no SQL Editor, registre os arquivos aplicados. Essa via pode não alimentar o histórico do CLI automaticamente. Valide as duas funções de disparo, as RPCs e os grants antes de criar usuários.

Na retomada de 20/11/2026, as cópias em [staging-overrides](../../release/multiagent-staging/install/staging-overrides/) mantêm push desativado nas posições 10 e 22, com uma restrição de banco instalada na posição 10. A execução remota chegou à posição 16. A posição 17 requer revisão do escopo de moderadores. [Evidências e ponto de retomada](../../release/multiagent-staging/install/EVIDENCIAS.md#segunda-retomada-em-20112026)

## Dados fictícios e Edge Functions

Depois do pós-teste, crie no Auth do staging apenas duas contas descartáveis confirmadas, `admin-ma@example.invalid` e `participante-ma@example.invalid`. Use senhas novas no painel. A fixture opcional requer exatamente essas contas e os triggers com destino staging. Ela adiciona perfis e consentimentos sintéticos, concede administração à conta fictícia designada, cria dois agentes inativos e cadastra conhecimento independente e compartilhado. Execute a fixture só após conferir os UUIDs das duas contas no painel. Ela não cadastra integração, não armazena senhas e pode ser repetida sem repetir agentes ou itens padrão.

Quando for autorizado aplicar as Edge Functions **no staging**, publique primeiro `edge/ai-reply.ts`, depois `edge/agent-integrations.ts`. São bundles do código revisado para o editor. Preserve a validação de sessão nas funções e configure somente as origens do frontend de homologação. Se testar provedores reais, gere uma chave de criptografia exclusiva do staging e cadastre pelo painel uma conexão e um modelo de teste com credenciais isoladas. Mantenha Google/Apple, push, pagamentos e cron fora do primeiro ensaio. Use processamento disparado pelo cliente e mensagens fictícias.

## Frontend e critérios de homologação

Na conta que consegue consultar o staging, disponibilize a chave **publishable** desse projeto na variável `NEO_STAGING_SUPABASE_PUBLISHABLE_KEY` por mecanismo local seguro. Execute o gerador a partir do repositório com suas dependências instaladas:

```sh
node scripts/prepare-multiagent-staging.cjs artifacts/neopep-ma-staging
```

Use um diretório novo. O gerador monta SQL, bundles Edge e `frontend/dist` pela referência `c770682`. A configuração operacional é excluída antes da extração. Sem a variável, o pacote deixa os recursos de nuvem desabilitados. A conta conectada pode extrair o pacote pronto e executar `node configurar-frontend.cjs` na raiz dele, com a mesma variável. Antes de escrever a configuração, ambos os caminhos exigem confirmação HTTPS da chave no staging. O frontend gerado serve a raiz e `/neo/` com o mesmo destino staging. Sirva esse diretório localmente ou em um projeto separado autorizado, com acesso restrito. O pacote não é destinado à branch ou ao projeto de produção. Cadastre a origem e o redirect exato `/neo/` no Auth desse staging. Use contas precriadas. O cadastro fica fechado no frontend. Confirme também no painel do Auth que o cadastro público do staging está desabilitado. O CAPTCHA só deve ser configurado se esse fluxo fizer parte de um ensaio separado com chaves de staging.

Antes de autenticar, confira no navegador o host das requisições. Teste login e permissões com as duas contas, administração sem acesso a chaves, agente padrão e atendimento manual, isolamento do conhecimento, consentimento ligado ao provedor, modelo e cota própria, troca de agente, sugestão privada, transferência humana e ausência de duplicação. Mantenha os agentes adicionais inativos no início e ative um de cada vez em Sugestões apenas durante o ensaio autorizado. Preserve logs sem conteúdo privado e identifique o ambiente em cada evidência.

A coleta do backup manual operacional foi confirmada pelo responsável. A leitura do índice e do conteúdo é evidência de legibilidade do dump. O teste de restauração desse backup real ainda está pendente e não deve usar o staging de homologação com dados pessoais. [Plano de recuperação](PUBLICACAO-MULTIAGENTE.md)
