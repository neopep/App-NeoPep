# Etapa 2 — ativação da plataforma multiusuário

## Atualização da conexão
URL e chave pública foram fornecidas e o endpoint Auth respondeu com sucesso. O banco ainda não estava disponível na API. Consulte o estado atual em [CONEXAO-SUPABASE.md](CONEXAO-SUPABASE.md).

## Situação na preparação da etapa 2
A implementação foi evoluída no projeto existente; o Elo na raiz é preservado e a prévia permanece em `/neo/`. **Supabase ainda não está configurado.** Os recursos remotos não estão ativados, não existe login simulado e a publicação continua privada. Código, migrações e testes locais estão preparados; não afirmar prontidão para público antes dos testes abaixo.

A auditoria inicial encontrou SDK oficial, PKCE, SQL 001 com RLS/Storage, diário, fotos locais, exportação, consentimento básico e importação. A etapa 2 acrescentou onboarding, consentimentos separados/histórico, painel administrativo autorizado no banco, limites por conta, migração com recibo, CAPTCHA, sincronização periódica e testes específicos.

## 1. O que preciso de você agora
- Criar ou escolher um projeto Supabase sob sua titularidade. Revise região, preço, contrato e adequação para dados sensíveis antes de contratar.
- Fornecer somente a URL `https://<project-ref>.supabase.co` e a chave pública `sb_publishable_…` (ou anon legado).
- Informar nome/razão social do controlador, canal de contato LGPD e região/critério de retenção escolhidos.
- Não enviar no chat senha do banco, service_role, secret key `sb_secret_…`, client secret Google ou chave Apple `.p8`.

## 2. Banco — executar em projeto de teste primeiro
No Supabase, abrir **SQL Editor**. Verificar:

```sql
select to_regclass('public.neo_profiles') as perfis,
       to_regclass('public.neo_consents') as consentimentos;
```

Se não existem tabelas Neo, aplicar na ordem:
1. `supabase/migrations/202611120001_neopeptideos.sql`.
2. `supabase/migrations/202611120002_multiuser.sql`.

Se 001 já foi aplicada, conferir compatibilidade com seu conteúdo e aplicar somente 002. **Não reaplicar nem editar a migração 001.** A 002 não exclui registros existentes; acrescenta tabelas/regras e restringe novos writes aos consentimentos registrados no servidor. Perfis existentes poderão precisar concluir o novo onboarding antes de novas gravações.

Confirmar RLS habilitada nas tabelas públicas `neo_profiles`, `neo_records`, `neo_photos`, `neo_consents`, `neo_consent_events`, `neo_migration_receipts`. Tabelas `neo_private` também têm RLS e nenhum acesso de contas comuns. O schema `neo_private` não deve ser incluído em Exposed schemas da API. RPCs públicos têm autorização explícita e não recebem user_id para escolher outra conta.

Storage → bucket `neo-private`: privado, limite 5 MB, somente JPEG/PNG/WebP, políticas por prefixo do UUID autenticado. Não torná-lo público. Os links assinados expiram em 300 segundos.

## 3. E-mail, confirmação e recuperação
Authentication → Providers/Sign-in → Email: habilitar e-mail/senha e **Confirm email**. Configurar senha mínima de 12 caracteres, proteção de senhas vazadas quando disponível, limites de tentativas e timeout de sessões compatíveis com o projeto.

Configurar **SMTP próprio** e testar recebimento; o transporte de teste do Supabase tem limites e não é base para lançamento público. Conferir os templates de confirmação/recuperação com o fluxo PKCE do SDK, sem substituir por links incompatíveis.

Authentication → URL Configuration:
- Site URL/redirect da prévia: `https://elo-minha-evolucao.supplemast3.chatgpt.site/neo/`.
- Adicionar esta URL **exata** à lista de Redirect URLs. Se houver domínio definitivo, cadastrar sua URL exata também. Não usar wildcards amplos.
- Não cadastrar o endpoint Git como URL de login.

A opção do Supabase de permitir novos cadastros deve ficar sob controle do responsável. Flags do JavaScript só controlam a interface; a proteção real é do Supabase.

## 4. CAPTCHA e limites reais de autenticação
Criar um widget **Cloudflare Turnstile**, adicionar o hostname `elo-minha-evolucao.supplemast3.chatgpt.site` e o eventual domínio definitivo. Colocar a **site key pública** em `dist/config.js` → `captchaSiteKey`.

No Supabase, Authentication → proteção contra abuso/Attack Protection → habilitar CAPTCHA com Turnstile e inserir a **secret key apenas no dashboard do Supabase**. O SDK envia `captchaToken` para signup, login por senha e recuperação; o Supabase o valida no servidor. Sem CAPTCHA configurado, a interface não permite esses fluxos nesta prévia. Não remover essa exigência para liberar o público.

Em Authentication → Rate Limits, revisar e testar os limites do projeto para token, cadastro, recuperação e envio de e-mail. Os defaults/plano variam; não marcar como validado só por ver a interface. A proteção para Google/Apple também depende do provedor e do Supabase. A aplicação não implementa um contador local como substituto de rate limiting de autenticação.

SQL 002 também aplica limites persistidos: 300 statements de escrita por conta/minuto, 12 onboardings/hora, 20 alterações de consentimento/hora, 6 migrações/hora, 12 exportações de metadados/hora e 30 consultas administrativas/minuto. Erros operacionais aceitam apenas quatro códigos fixos e até 20 envios/hora. Esses controles são do servidor, porém não substituem proteção de tráfego do provedor.

## 5. Google oficial
No Google Cloud, criar OAuth Client do tipo Web application, configurar tela de consentimento e usuários de teste:
- Authorized JavaScript origin: `https://elo-minha-evolucao.supplemast3.chatgpt.site`.
- Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
Inserir Client ID e Client Secret diretamente em Supabase → Authentication → Google. Depois habilitar `providers.google` na configuração pública. Verificar a publicação/validação da tela de consentimento exigida pelo Google antes do público.

## 6. Apple oficial
No Apple Developer: App ID com Sign in with Apple, Services ID web, Team ID, Key ID e chave `.p8`; configurar domínio e retorno `https://<project-ref>.supabase.co/auth/v1/callback`. Resolver as exigências de verificação de domínio com o procedimento oficial Supabase/Apple ou domínio próprio aprovado.

Inserir o client secret no provedor Apple do Supabase, nunca no navegador. Acompanhar sua expiração e rotação (OAuth web Apple: validade máxima de seis meses). Nome pode vir só no primeiro consentimento; o onboarding solicita edição quando necessário. Habilitar `providers.apple` somente depois de configurar.

## 7. Exclusão da conta
Implantar `supabase/functions/delete-account/index.ts` usando o Supabase CLI ou o mecanismo oficial de Edge Functions do seu projeto. Configurar no servidor:
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, em Secrets; nunca no config.js.
- `ALLOWED_ORIGIN=https://elo-minha-evolucao.supplemast3.chatgpt.site` (origem, sem `/neo/`).
Validar compatibilidade da verificação JWT do gateway com o tipo de chave/token do projeto. O handler também valida o token via Auth, exige login de menos de 10 minutos, confirmação EXCLUIR e origem permitida. Remove arquivos antes da conta. FK cascade remove perfil, registros, recibos, consentimentos e contadores operacionais vinculados. Falha parcial não é anunciada como sucesso.

## 8. Administrador — somente pelo responsável no banco
1. Criar uma conta real e localizar seu UUID em Authentication → Users.
2. No SQL Editor, conectado como responsável, conceder:

```sql
insert into neo_private.admin_members(user_id)
values ('<uuid-da-conta-administradora>'::uuid);
```

Revogar, se necessário:

```sql
delete from neo_private.admin_members
where user_id = '<uuid-da-conta-administradora>'::uuid;
```

Não existe endpoint de autopromoção. `user_metadata.role`, perfil, localStorage e parâmetros da URL são ignorados para autorização. Nem um administrador ganha acesso direto a registros de saúde de outras pessoas: o painel só chama RPC de agregados, protegida no servidor.

Painel da prévia: `/neo/admin/`. Entrar primeiro pelo app na mesma aba e abrir o painel pelo Perfil. Com Manter conectado ativo, o painel reutiliza a sessão persistente no mesmo navegador; com a opção desativada, a sessão fica restrita à aba. A sessão não é uma credencial administrativa do banco.

O painel mostra usuários/cadastros/atividade, contagens globais de registros e fotos, status da consulta ao banco, configuração privada do bucket e contadores de erro. Não mostra valores corporais, nomes, e-mails, notas ou fotos. Células diárias com menos de cinco cadastros são suprimidas. “Ativo” significa heartbeat autenticado recente do app, não uma auditoria de cada requisição. Erros são contadores limitados informados pelo cliente, não um serviço de observabilidade completo.

## 9. Configuração pública e verificação de chaves
Preencher `dist/config.js` com URL/chave pública, flags dos provedores, site key Turnstile, nome e contato do controlador. `publicRegistration` começa false; habilitar para testes controlados na prévia privada só após a configuração de segurança. `cloudValidated` só deve ser true após os testes reais documentados.

`npm run build` / `npm run check` recusam chaves secretas e legacy JWT com role diferente de anon. Sessões do usuário são geridas pelo SDK oficial com PKCE, refresh e armazenamento escolhido em Manter conectado; nenhum service_role é empacotado. A integração não substitui o controle de acesso do Sites enquanto ele permanecer privado.

## 10. Sincronização e migração assistida
Após login, o onboarding grava perfil, preferências e consentimentos numa transação. Dados locais não são copiados automaticamente. A conta usa apenas seu UUID autenticado; os dados remotos ficam na memória da interface, sem cache offline de saúde.

A sincronização consulta a nuvem a cada 30 segundos com a página visível/online e ao voltar ao app. Pausa durante edição ou diálogo aberto; atualizações não substituem formulário em edição. Escritas exigem rede e revisão concorrente. Não é promessa de sync instantâneo ou funcionamento remoto offline.

Perfil → importar registros locais ou restaurar backup → revisar destino → exportar backup → confirmar. Conteúdo recebe IDs por hash; o servidor valida numa transação e retorna recibo conferido pelo cliente. Se a resposta se perder, repetir não duplica os registros. Não há comando que apague a origem local depois da importação. Fotos continuam com exportação separada; a migração numérica não envia fotos locais automaticamente.

Exportação JSON da conta inclui estado do app, identidade básica, consentimentos/histórico, recibos, metadados de fotos e seus indicadores operacionais. Não inclui tokens nem binários de fotos.

## 11. Retenção operacional e documentação
Antes do lançamento, definir política de retenção/backups do provedor, região, controlador e canal LGPD. Revisar os Termos e a Política de Privacidade implementados no app. Eles são uma base técnica, não certificação jurídica.

Configurar uma rotina administrativa no banco para remover `neo_private.rate_limits` com mais de dois dias e `neo_private.app_errors` com mais de 30 dias. Use `supabase/maintenance.sql` sob revisão do responsável e, se disponível, agendamento oficial pg_cron. Não foi agendada tarefa sem acesso ao projeto. Dados corporais e fotos não são removidos por essa manutenção.

## 12. Critérios para o lançamento público (ainda pendentes)
- Cadastro, confirmação, login inválido/válido, CAPTCHA inválido/expirado, bloqueio por limite e recuperação completa via e-mail reais.
- Google e Apple reais no Safari/iPhone, cancelamento e retorno PKCE.
- Registro no iPhone visto no computador e vice-versa; conflito de edição e desconexão sem falso sucesso.
- Duas contas reais, sem acesso cruzado em REST, RPC e Storage.
- Usuário comum recebe recusa do RPC administrativo mesmo alterando metadata ou a URL; administrador vê somente agregados.
- Fotos privadas, revogação de consentimento, exportação e exclusão real de conta de teste; confirmar remoção do Storage e cascatas.
- PWA no iPhone, safe areas, teclado, instalação e verificação visual. Essa validação de dispositivo não foi executada neste ambiente.
- Documentos/retencão completos; teste de backup e recuperação.
- Somente após aprovação dos resultados, alterar a audiência do mesmo Site para pública. Não foi feita essa alteração nesta etapa; o Elo original permanece na raiz.

Referências: https://supabase.com/docs/guides/auth/rate-limits · https://supabase.com/docs/guides/auth/auth-captcha · https://supabase.com/docs/guides/auth/sessions · docs/CONFIGURACAO-NUVEM.md.
