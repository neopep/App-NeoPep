# NeoPep — arqueologia de Produção e Teste + plano de promoção integral

**Data da investigação:** 22/11/2026. **Fontes:** histórico Git versionado na branch de Teste, PRs #22/#23/#25/#26, comparação de commits e catálogos read-only dos dois Supabase. A captura Vercel fornecida pelo proprietário complementa o status visual; não foi obtido log específico da Vercel. **Nenhuma alteração de banco, Edge, cron, Auth, Storage, Vercel ou main foi realizada nesta investigação.**

## 1. Como os ambientes surgiram

1. O aplicativo operava primeiro na **Produção**, com o Git `main`, o Supabase `neopep` (`cpslafpzjtbpmoxxysaa`) e o site `app.neopep.com.br`.
2. Em **20/11/2026**, foi criado o Supabase separado **`neopep-staging`** (`qnuluspqfazdppciermw`), inicialmente **sem tabelas do aplicativo e sem usuários**, conforme o registro `MEM-20261120-012`. A estrutura foi preparada/reconstituída a partir de migrações de base e overrides para Teste; **não foi uma transferência integral dos usuários, pedidos e arquivos reais**.
3. O Git `staging/permanente` e o projeto Vercel `app-neopep-staging`, apontado para `teste.app.neopep.com.br`, passaram a conter as melhorias posteriores à separação, mantendo a Produção distinta.
4. O PR [#25](https://github.com/neopep/App-NeoPep/pull/25) partiu do **Testе em `fa8429a22b0639f5ab9d48614cd6458ada29ceb0`**, com base no **`main` `f1237493ecaeef4b99e5679ea31685cfdde3b792`**. O seu objetivo inicial **excluiu expressamente PRs #22 e #23**.
5. Em **22/11/2026**, [#22](https://github.com/neopep/App-NeoPep/pull/22) e [#23](https://github.com/neopep/App-NeoPep/pull/23) foram integrados ao Teste pelo [PR #26](https://github.com/neopep/App-NeoPep/pull/26), merge `8aa7ff5a887917dab6b51f3b06d60fcbdaa7df4c` às **19:29:50 UTC**. A comparação `fa8429a..staging/permanente` mostrou **9 commits posteriores e 33 arquivos alterados**. Essa integração **não está incorporada ao PR #25**.
6. A captura Vercel mostra `app-neopep-staging` **Production/Ready** do **projeto de staging**, commit `8aa7ff5`, e diversas tentativas **Preview/Error** do projeto `app-neopep`. Isso **não comprova o status Production da implantação oficial em `app-neopep`**.

## 2. Inventário real do banco: NÃO copiar dados do Teste

Consultas de leitura aos catálogos e contagens, na data indicada:

| Entidade | Produção | Teste | Interpretação |
|---|---:|---:|---|
| `auth.users` | 8 | 4 | Contas distintas; não copiar Teste |
| `neo_private.shop_orders` | 18 | 0 | Preservar pedidos de Produção |
| `storage.objects` | 34 | 25 | Não sobrescrever mídias oficiais |
| `storage.buckets` | 7 | 9 | Buckets novos privados: `neo-campaign-images` e `neo-connect-releases` |
| Tabelas `public` + `neo_private` | 52 | 90 | **38 novas no Teste** |
| Funções `public` + `neo_private` | 135 | 191 | **56 novas no Teste** |
| Colunas totais das tabelas desses schemas | 396 | 676 | **280 colunas extras no Teste**; 9 foram adicionadas em tabelas já existentes e as demais pertencem às novas tabelas |
| Supabase Migration Ledger consultado | 0 versões | 16 versões | `0` na Produção **não** significa banco vazio nem autoriza replay do baseline |
| Edge Functions ACTIVE | 9 | 6 | Implantações e `verify_jwt` diferentes |

**A estrutura das 52 tabelas já presentes**, nos campos simples consultados (nome, tipo e flag RLS), corresponde entre os ambientes; diferenças em funções, permissões, índices, policies, triggers e defaults **permanecem** e requerem revisão independente.

### Divisão das 38 novas tabelas por lotes preparados

| Lote | Área | Novas tabelas | Estado da proposta inicial |
|---|---|---:|---|
| 01 | Avisos/cadastros | 2 | SQL preparado e ensaiado sinteticamente |
| 02 | Estatísticas de público/engajamento | 2 | Idem |
| 03 | Fundação multiagentes | 3 | Agentes adicionais **inertes** na primeira proposta |
| 04 | Monitoramento/custos/qualidade/operações | 10 | Coleta externa depende de integrações e consentimento |
| 05 | Campanhas, pop-ups, push e WhatsApp | 9 | Push e disparos automáticos **inertes** |
| 06 | NeoPep Connect/atualização/WhatsApp | 12 | Canal Windows e distribuição **pausados** |
| 07 | Financeiro (opcional) | 0 | **Excluído do lançamento inicial**; proposta guardada fora de `supabase/migrations` |

As 56 funções novas do Teste não são todas instaladas pelos seis lotes aditivos: **42** cobertas, **14** excluídas intencionalmente (7 de runtime multiagentes, 2 de testes, 4 renomeadas pré-multiagentes e `rls_auto_enable()`). Há **8 rotinas compartilhadas** com mudança funcional de corpo que exigem decisão sobre filas/IA/push/atendimento, e **72 diferenças de EXECUTE efetivo de `service_role`**. Não promover ACLs nem corpos em bloco.

## 3. Funcionalidades desenvolvidas após a separação

| Módulo novo/evoluído | O que o histórico e os PRs comprovam | Dependência de publicação |
|---|---|---|
| Identidade/PWA | Marca e ícones NeoPep, variações de logo, cache, compatibilidade `/neo/`, nova PWA de Teste | Copiar **apenas UI/assets genéricos**, preservar nome/URLs/scope/auth e build de Produção |
| Evolução/Fotos | Galeria com miniaturas, comparação Antes/Depois em Início/Evolução/Fotos, datas/sliders, valor de peso e gráfico no JPEG compartilhável | Frontend e acesso autorizado a fotos privadas existentes; validar Safari/PWA |
| Administração | Avisos de novos cadastros, painéis de audiência e engajamento, qualidade, coortes, operações, monitoramento do Supabase/IA e custos/tokens | Lotes 01/02/04 e permissões de admin; algumas métricas dependem de fonte externa ainda indisponível |
| IA/atendimento | Catálogo de agentes, modos, conhecimento, seleção por conversa, medições e integração | Lote 03 e contrato de filas/claim/finish, consentimento e Edge oficiais. A candidata anterior deixa agentes extras inertes |
| Campanhas | Pop-ups e campanhas por segmento/plano/agendamento; preferências de push; imagem privada; WhatsApp por confirmação manual | Lote 05, buckets/policies; ativação e push exigem autorização e teste real |
| NeoPep Connect | Gestão administrativa de computadores, atualizações, distribuição, grupos WhatsApp e testes Windows; interfaces adicionadas | Lote 06, canal e credenciais separados, segurança de distribuição; não confundir simulação de laboratório com WhatsApp real |
| Biblioteca/Comunidade | Melhorias de navegação e integração com métricas, uso privado e consentimentos | Preservar RPCs/ACLs da Produção; não copiar defaults e triggers de Teste |
| Loja | Instrumentação de engajamento no frontend; nenhuma mudança financeira intencional do proprietário após criar o Teste | Preservar funções/Edge financeiras da Produção, testar checkout controlado; não aplicar lote 07 |
| **PR #22** (depois do baseline #25) | Central de Campanhas reorganizada: listas/filtros/edição/breadcrumbs, prévia de texto WhatsApp e modos Painel/Connect | **Falta incorporar à candidata #25** e testar com backend de campanhas |
| **PR #23** (depois do baseline #25) | Leitor PDF unificado/pinça, peso pt-BR com duas casas, avatar, tooltip com dia da semana, Biblioteca sem rótulos/downloads, checkbox de foto condicionado ao consentimento, calculadora interativa | **Falta incorporar à candidata #25** e validar build do frontend, PWA, Safari e permissão de fotos |

### Evidência direta de diferença de código

As leituras Git dos blobs de `staging/permanente` e do PR #25 mostram diferenças em **`src/app.js`, `src/cloud.js`, `dist/app.js`, `dist/cloud.js`, `dist/admin/admin.js`, `dist/admin/admin-whatsapp.js`, `dist/admin/admin-pdf.js`, `dist/community.js`, `dist/core.js`, `dist/index.html`, `dist/library-files.js`, `dist/library-shelf.js`, `dist/style.css`, `dist/sw.js`**, além dos testes. O arquivo **`dist/pdf-reader.js` existe no Teste e está ausente na candidata #25**; o guia `docs/conhecimento/CAMPANHAS-NAVEGACAO-V2.md` também está ausente. Não considerar #25 uma cópia completa do Teste atual.

## 4. O que PRESERVAR exatamente da Produção

- Supabase URL, chave **pública**, schema/base de contas, sessões, permissões de administradores, consentimentos, usuários e dados de saúde; sem migrar credenciais de staging.
- Auth, confirmação de e-mail e configurações externas do projeto oficial, que não podem ser verificados por catálogo SQL; o Teste foi configurado com cadastro público fechado.
- `mercadopago-create` v16, `mercadopago-webhook` v11, `shop-integrations` v9, `auth-settings` v12 e `delete-account` v8 implantadas oficialmente, até decisão e homologação próprias.
- `ai-reply` oficial v9, `agent-integrations` oficial v8, `platform-integrations` oficial v7 e `push-dispatch` oficial v3, enquanto os contratos de runtime, gateway/verify_jwt e CORS não forem conciliados.
- Cron oficial `neo-push-dispatch` por minuto, comportamento de emissão e preferência de notificação; **não copiar funções de Teste que estão inertes**.
- Todos os pedidos, produtos, fotos, biblioteca, arquivos e dados da Produção. O Teste tem somente 0 pedidos e 25 objetos próprios.
- `vercel.json`/build da candidata devem usar **projeto oficial, domínio oficial, Supabase oficial e configuração oficial**, nunca o build `scripts/build-staging.cjs`: este injeta `NEO_STAGING_...`, produz `NeoPep Teste` e usa `noindex`.

## 5. Plano correto para lançamento de TODAS as funcionalidades aprovadas

**Etapa A — corrigir o escopo da candidata (branch do PR #25; sem Production):**

1. Considerar a origem funcional atual de Teste como o merge `8aa7ff5`, **não apenas `fa8429a`**; integrar seletivamente o delta dos 9 commits/33 caminhos dos PRs #22/#23 ao PR #25, com testes e assets, resolvendo conflitos com configurações oficiais. Não copiar `dist/config.js` do Teste, nem `vercel.json` do Teste.
2. Congelar e testar a separação das Edge e do SQL financeiro opcional; preservar origem `main`.
3. Montar matriz de cada tela ↔ RPC ↔ Edge ↔ tabela ↔ grant ↔ bucket, sinalizando **funcional** ou **desabilitada**, nunca prometer módulo completo com runtime inerte.

**Etapa B — banco e Edge compatíveis:**

4. Comparar catálogo do banco real de Produção antes de cada lote; ensaiar os lotes 01–06 num ambiente isolado e preparar rollback. Não repetir as 47 migrações históricas sobre o banco atual. Resolver diferenças de ledger por objetos/fingerprints, não importando os 16 IDs de Teste.
5. Validar duas contas descartáveis, sessão de usuário e administrador, isolamento de registros e arquivos, consentimento, exclusão e exportação. Validar `SECURITY DEFINER` antes de abrir cadastro geral.
6. Decidir separadamente sobre ativar os 14 SQLs fora dos lotes e substituir as oito rotinas com diferença funcional. **Não incluí-las implicitamente**, porque isso poderia interromper IA e push oficiais.
7. Executar smoke tests da Loja oficial (sem cobrança real involuntária), Auth/signup e notificações com consentimento. Se a integração de multiagentes/campanhas/Connect não estiver concluída, não oferecer suas ações como operacionais.

**Etapa C — publicação oficial:**

8. Confirmar no Vercel `app-neopep` a produção real da branch `main`, conferir os logs de erro do Preview, build/HTTPS/domínio/variáveis e PWA. A linha Ready do projeto `app-neopep-staging` **não** prova deploy oficial.
9. Após obter evidências e **aprovações específicas** para DDL, Edge e frontend/merge, publicar a candidata com rollback claro. Só então habilitar cadastro público no Auth/configuração oficial, sem depender do `previewRegistration` nem marcar `cloudValidated` sem teste externo.
10. Validar em Production os módulos anunciados, usuários reais, pedidos, fotos, notificações, logs e consumo. Não anunciar conclusão antes do deploy READY comprovado.

## 6. Status e riscos

- **Produção não foi atualizada.** O PR #25 segue DRAFT / NO-GO, e os seis lotes aditivos não foram aplicados ao banco oficial.
- Os backups de banco e 34 objetos foram exportados segundo evidência anterior, mas o **ensaio da restauração real ficou adiado**, por decisão do proprietário; risco documentado, não considerado aprovado.
- GitHub CI da candidata aprovou compilação/testes focalizados na execução verificada; `release:check` bloqueia por ausência de 12 evidências e `cloudValidated=false`.
- Vercel staging Ready `8aa7ff5` conforme captura do proprietário; para `app-neopep`, ainda faltam logs de erro específicos e confirmação da implantação oficial.
- **Fato novo e determinante:** o lançamento que o proprietário agora pede é o das melhorias **realmente consolidadas no Teste mais recente**, não o pacote parcial definido no PR #25 inicialmente. Mudar essa intenção em código exige integrar PRs #22/#23 e revalidar todo o candidato antes de merge/deploy.

## Atualização oficial — migrações incrementais JÁ aplicadas em 22/11/2026

**Não executar novamente os lotes 01–06 na Produção.** O Supabase oficial agora tem 90 tabelas e 177 funções (`public` + `neo_private`), sete versões de migração próprias, dois buckets privados novos, mantendo 8 contas, 18 pedidos e 34 objetos Storage em contagem. Os agentes adicionais, campanhas automáticas e Connect estão inertes/pausados; o lote 07 financeiro não foi aplicado. A lista exata das sete versões e os guardas executados constam no [registro oficial de aplicação](APLICACAO-PRODUCAO-INCREMENTAL-20261122.md). A **publicação web e Edge** continua pendente, sem merge do PR #25. Não inferir GO da presença das novas tabelas.
