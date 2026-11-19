# Validação da prévia NeoPeptídeos

Status: **prévia local pronta; produção Elo preservada**. Atualização não publicada e nenhuma base externa foi criada/migrada.

## Resultados executados
- `npm run build`: SDK Supabase oficial empacotado em dist/cloud.js.
- `npm run check`: JavaScript e service worker com sintaxe válida.
- `npm test`: 8 arquivos, 30 casos individuais, todos aprovados.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas nas dependências de produção na consulta executada.
- HTML portátil: todos os quatro scripts reais executados em DOM de teste; navegação, demonstração e calculadora renderizam.
- Snapshot Elo e dist/elo comparados por SHA-256 ao conteúdo do commit ecce8791b78b531f175e6f7cc34cae14b65f1acf.

## Cobertura dos 30 casos
12 casos do núcleo: fórmulas e mcg, limites de cálculo, datas reais, backup legado, importação idempotente, conflitos de id, rejeição de backups, IMC/metas, isolamento da demonstração, CSV, agenda, escape HTML.
8 casos de UI/DOM: todas as rotas, Elo intocado, CRUD/persistência, quota, demonstração, corrupção local, login indisponível sem configuração, conteúdo malicioso.
4 casos do adaptador de nuvem: PKCE/redirects, chamadas de cadastro/login/recuperação/logout, erro de credenciais, conflito de revisão. **Transporte simulado; não são validação de OAuth real.**
1 caso SQL abrangente em PostgreSQL WASM: migração, RLS com duas contas, proteção de Storage, validação de dados, revisão concorrente, importação transacional com rollback e exclusão por cascata.
1 caso IndexedDB: persistência do Blob e exclusão individual.
2 casos PWA: manifesto/ícones/safe areas/redução de movimento; service worker sem cache de APIs, sessões ou fotos.
1 caso de preservação da versão anterior.
1 caso da prévia portátil com os scripts reais.

## Não validado / depende de configuração
- Cadastro, recuperação e logins Apple/Google reais; cancelamento OAuth e e-mails de confirmação/recuperação.
- Duas contas reais no Supabase hospedado; sincronização entre iPhone/computador.
- Upload/download/exclusão de fotos na nuvem e expiração de URLs reais.
- Edge Function de exclusão real de conta, ainda não implantada.
- Inspeção visual, Safari/iPhone, teclado, standalone, comportamento de instalação e offline em dispositivo.
- Acessibilidade por leitor de tela e contraste medido no dispositivo.
- Revisão final da política LGPD com controlador, contato e retenção.

O ambiente Sites está em managed-linux, porém não disponibiliza cua_repl.js, exigido por seu fluxo de prévia. Por essa limitação, não foi iniciado servidor de prévia nem usado controle alternativo de navegador. Os testes DOM não substituem QA visual. A publicação anterior está confirmada no Sites; esta nova versão ainda não tem URL publicada.

## Próximo passo de publicação
Com autorização explícita do usuário, enviar a atualização ao mesmo repositório privado e publicar no mesmo Site. Manter `dist/elo/` para acesso à versão anterior em `/elo/`. Alternativa de revisão: publicar somente a prévia em uma subpasta, preservando o Elo na raiz, após aprovação do usuário. Não criar outro aplicativo/Site.
