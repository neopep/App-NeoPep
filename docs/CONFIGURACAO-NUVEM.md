# NeoPeptídeos — ativação real da nuvem

## Situação da prévia
Não há projeto Supabase nem provedores configurados neste ambiente. Os botões de login não fingem sucesso. Integração, SQL e políticas foram implementados; autenticação, upload remoto, sincronização real e exclusão remota permanecem **não validados** até configuração. O gate de acesso privado do Sites permanece e não é substituído por esta integração.

## 1. Projeto e domínio — intervenção do responsável
1. Criar ou escolher um projeto Supabase sob sua titularidade. Selecionar região e plano após revisar preços, contrato e tratamento de dados sensíveis. Nenhum serviço foi contratado automaticamente.
2. Informar **somente** a URL `https://<project-ref>.supabase.co` e a chave pública publishable (ou anon). Não enviar senha, service_role, chave privada Apple ou Google client secret no chat.
3. Confirmar o endereço de prévia/produção aprovado. Endereço atual do Elo: `https://elo-minha-evolucao.supplemast3.chatgpt.site/`. Ainda não substituir a publicação. Se a prévia for hospedada em subpasta, usar a URL completa dessa subpasta nos redirects.
4. O Sites suporta autenticação própria ChatGPT e mantém o controle de acesso externo. Para permitir outros usuários no futuro, revisar explicitamente a política de acesso do Sites; não a tornar pública automaticamente. Validar OAuth Apple/Google junto desse gate antes de anunciar suporte.

## 2. Banco e autorização
Após aprovação, aplicar `supabase/migrations/202611120001_neopeptideos.sql` em um projeto de teste e revisar o diff. A migração é aditiva, cria `neo_profiles`, `neo_records`, `neo_photos`, validações, revisões para concorrência, RPC de importação atômica e bucket `neo-private`.
- RLS: `auth.uid() = user_id` para registros de cada pessoa. Inserts exigem perfil com consentimento. Sem permissões anônimas.
- Storage: prefixo `<user_id>/`, bucket privado, máximo 5 MB, JPEG/PNG/WebP. Sem permissão pública ou alteração de objeto existente.
- URLs assinadas duram 300 s. O app recarrega URLs ao entrar nas telas.
- Testes locais executam a migração em PostgreSQL WASM, com dois usuários, roles e RLS. Isso não substitui testes com o Supabase hospedado.

## 3. Login por e-mail
Em Authentication → URL Configuration:
- Site URL: URL aprovada da aplicação.
- Redirect URLs: **exatas** de produção e prévia, sem wildcards amplos. Não usar o endpoint Git.
Em Authentication → Providers → Email:
- Habilitar confirmação por e-mail.
- Política mínima de senha de 12 caracteres, limites de tentativas e proteção contra abuso.
- Configurar SMTP de sua titularidade e validar entrega de confirmação e recuperação.
- Não habilitar envio público antes de publicar identificação do controlador e contato LGPD.

## 4. Google oficial
Google Cloud Console → APIs & Services → OAuth consent screen / Credentials:
- Criar OAuth client do tipo Web application.
- Authorized JavaScript origins: origem HTTPS aprovada do app.
- Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
- Configurar consentimento, usuários de teste e verificação quando exigida.
- Informar Client ID e Client Secret **diretamente** em Supabase Authentication → Providers → Google. Nunca colocá-los em config.js ou enviar secrets no chat.
- Após configurar, marcar `providers.google: true` na configuração pública.

## 5. Apple oficial
Exige conta Apple Developer compatível e configuração sob sua titularidade:
- App ID com Sign in with Apple.
- Services ID para login web; Team ID, Key ID e chave `.p8`.
- Domínio e return URL exata: `https://<project-ref>.supabase.co/auth/v1/callback`.
- Cadastrar/verificar domínio exigido pela Apple. Se não houver controle DNS sobre o domínio gerado pelo Supabase, seguir a configuração recomendada pelo Supabase ou definir domínio de autenticação próprio, após sua aprovação.
- Criar o client secret Apple no ambiente seguro adequado e inseri-lo somente no provedor Supabase. Para OAuth web, acompanhar a validade e programar rotação; o secret Apple expira em no máximo seis meses.
- Apple pode fornecer nome somente no primeiro consentimento. O app solicita nome no Perfil quando ele não vier do provedor. Não inventa o nome a partir do e-mail.
- Após configurar, marcar `providers.apple: true`.

Referências oficiais consultadas:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-apple
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 6. Exclusão de conta
Implantar a Edge Function `supabase/functions/delete-account/index.ts` no projeto, com:
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: secrets do servidor, nunca no app.
- `ALLOWED_ORIGIN`: origem HTTPS exata aprovada (sem path).
- Manter verificação JWT habilitada e configurar compatibilidade do gateway para os tokens utilizados pelo projeto Supabase. A função também valida o token usando `auth.getUser`.
A função exige sessão válida, nova verificação da senha no Supabase Auth e origem permitida; remove fotos antes de excluir auth.users (registros e perfil por cascade). Se houver falha parcial, não confirma sucesso e permite tentar novamente. Não há logs de dados pessoais no código.

## 7. Configuração pública do app
Editar `dist/config.js` apenas com URL, chave pública, flags de provedores, contato do controlador. `cloudValidated` permanece false até testes reais. Nada foi ativado automaticamente.
O SDK oficial usa PKCE, verifica usuário no provedor, renova tokens e guarda os tokens em localStorage quando Manter conectado está ativo, ou em sessionStorage quando desativado, sob CSP restritiva. Não persiste dados de conta no localStorage de registros, nem transfere registros locais ao entrar. Com Manter conectado ativo, novas visitas podem restaurar a sessão; Sair remove os tokens do dispositivo. Senhas não são armazenadas pelo aplicativo. Não utiliza cookies administrativos ou segredos no navegador.

## 8. Validação obrigatória antes de liberar
- Cadastro com confirmação, login inválido/válido, recuperação completa e logout.
- OAuth Google e Apple reais no Safari/iPhone, retorno PKCE e erros/cancelamento.
- Dois usuários: nenhuma leitura/escrita/foto cruzada.
- Registro no iPhone visível no computador após atualizar, e vice-versa.
- Desconexão: sem falso “salvo”; alterações de conta exigem conexão.
- Conflito: editar em dois aparelhos com a mesma revisão, rejeitando atualização desatualizada.
- Importação: backup, consentimento, repetição sem duplicar e rollback em erro.
- Fotos: URLs privadas, expiração, exclusão e exportação.
- Exclusão real de conta de teste com sessão recente; banco/Storage sem resíduos.
- PWA em HTTPS: instalar na tela inicial, standalone, safe areas, teclado e offline da interface. Login e dados remotos não ficam disponíveis offline nesta fase.
- Aprovação explícita do responsável antes de substituir o Elo publicado.

### Exportação opcional antes de excluir

Em Perfil → Meus dados → Excluir minha conta, a pessoa escolhe exportar os dados, continuar sem exportar ou cancelar. A exportação não é pré-requisito para a exclusão na nuvem nem para a limpeza dos dados locais. As fotos são exportadas separadamente. A confirmação com senha de acesso no servidor, as verificações de pedidos/arquivos e a validação da identidade continuam obrigatórias. Exportar não dispara a exclusão automaticamente. A exigência de backup antes da importação é independente e continua ativa.


### Atualização da função de exclusão para confirmação por senha

Publicar novamente `delete-account` com o arquivo gerado por `scripts/package-edge-functions.cjs`. O corpo novo contém `password` e `captchaToken`, sem `confirmation: EXCLUIR`. A função confere o JWT original, fixa o e-mail pela identidade autenticada e verifica a senha com um cliente de Auth separado usando SUPABASE_ANON_KEY. CAPTCHA e limites de tentativas são conferidos pelo Supabase Auth. Só uma senha validada para o mesmo UID autoriza as verificações de pedidos, remoção de arquivos e exclusão da conta. A sessão temporária dessa verificação é encerrada com escopo local; senhas não são registradas em logs ou banco. A interface limpa o campo após enviar e permite mostrar/ocultar a senha.

A função antiga recusa o corpo novo por faltar a palavra de confirmação; a função nova recusa o corpo antigo por faltar senha. A atualização em duas etapas não permite exclusões sem senha. Enquanto o painel do Supabase não receber o código novo, a interface informa indisponibilidade ao tentar concluir. A limpeza de dados apenas locais, que não têm senha de conta, usa confirmação de exclusão permanente sem palavra digitada. Exportação segue opcional em ambos os modos.
