# Etapa 2 — relatório de implementação e testes

Estado: **prévia técnica; ativação remota e lançamento público pendentes de configuração**.

## Implementado sobre o projeto existente
- Migração SQL 002 aditiva, preservando a 001 e os registros locais.
- Onboarding com nome, altura, peso inicial, meta e preferências editáveis.
- Consentimentos específicos com histórico no servidor e retirada; write/read/export/delete têm regras distintas.
- Administração por membership privada no banco, sem autopromoção e sem acesso clínico individual.
- Rate limits de operações no banco, CAPTCHA oficial integrado ao SDK (configuração externa pendente).
- Sincronização por polling visível a cada 30 s, sem substituir formulários em edição.
- Importação transacional com hashes, recibo verificado, confirmação/backup e origem local preservada.
- Exportação de metadados do próprio titular, logout local/global, proteção contra chaves administrativas no frontend.
- Política de Privacidade e Termos; definição do controlador/contato/retenção pendente.

## Executado
`npm run build`, `npm run check` e `npm test`.
46 casos individuais em 12 arquivos, abrangendo os casos existentes e a etapa 2.

SQL executado de fato em PostgreSQL WASM (PGlite): migrações 001+002, dois usuários, RLS de registros/consentimentos/recibos/fotos, recusa administrativa para usuário comum/anônimo, tentativa de autopromoção por metadata/perfil, agregados sem conteúdo de saúde, retirada de consentimento, limites persistentes, migração/rollback/idempotência/recibo, exclusão por cascata.

Handlers/código de cliente com transporte de teste: cadastro/login/recuperação/logout e envio de CAPTCHA via SDK, onboarding, falha na verificação de recibo, limpeza ao trocar conta, servidor de exclusão verificando identidade/recência/origem e removendo Storage antes da conta, recusa em caso de falha parcial. Isso **não comprova OAuth, SMTP ou exclusão em projeto remoto real**.

Interface testada em DOM: navegação, novos módulos, administração sem métricas falsas e sem renderizar campos individuais recebidos por engano, preservação do Elo, demonstração separada, quotas, backups, fotos IndexedDB, shell PWA sem cache de APIs/fotos/sessões. O snapshot Elo é conferido por hash.

## Não executado / bloqueadores externos
Não há URL/chave pública Supabase configuradas nem credenciais/provedores oficiais disponíveis. Não foram aplicados SQL/Edge Function em banco remoto. Logins reais, e-mails, CAPTCHA remoto, sincronização entre aparelhos e permissões no Supabase hospedado precisam ser validados após configuração.

Não há `cua_repl.js` no ambiente managed-linux, exigido pelo fluxo Sites para prévia visual. Não foi usado navegador alternativo. DOM/SQL não substituem inspeção visual e teste de instalação/uso no Safari/iPhone.

O Site permanece privado para validar a prévia; não foi liberado cadastro público ou contratado serviço. A publicação da prévia mantém o Elo na raiz e NeoPeptídeos em `/neo/`, com administração em `/neo/admin/`.
