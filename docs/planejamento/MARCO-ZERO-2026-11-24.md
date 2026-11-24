# MARCO ZERO — ponto de partida da evolução NeoPep
**Snapshot capturado em 24/11/2026** · Dados obtidos de GitHub e Vercel somente leitura. **Imutável como referência histórica**: mudanças futuras geram novos marcos em REGISTRO-DE-PUBLICACOES.md.

## 1. Ponto de partida do frontend
| Campo | Produção | Teste |
|---|---|---|
| Repositório | neopep/App-NeoPep | neopep/App-NeoPep |
| Branch de origem | main | staging/permanente |
| SHA branch confirmado no GitHub | `fc0ae22faf75b108aad137b1399fc8b367af1292` | `0970ae6b7c7d846915f98f4582780382c71a80e9` |
| Vercel projeto | app-neopep | app-neopep-staging |
| Vercel project ID | `prj_Qd8luBAEbXtJgk5dIwwoSbnrBIki` | `prj_ksWxwsJyKhdR2nW2OiZkwx8hlkdq` |
| Último deployment `target=production` READY consultado nesse projeto | `dpl_5tRTZU2WsH7Zn5naexANfaZuAESd` | `dpl_F7crpVWtyrBkc7ZpddMNb7XjpMRg` |
| SHA declarado no deployment | `fc0ae22faf75b108aad137b1399fc8b367af1292` | `0970ae6b7c7d846915f98f4582780382c71a80e9` |
| Horário criação (UTC) | 2026-11-24 09:37:18 | 2026-11-24 01:15:20 |
| Estado no inventário | READY | READY |
| URL de deployment retornada | `app-neopep-k2h24fz4f-neo-pep.vercel.app` | `app-neopep-staging-nxm8nxv1m-neo-pep.vercel.app` |
**ATENÇÃO:** target production de app-neopep-staging significa o ambiente principal **do projeto de Teste**, não produção comercial. READY indica build e deploy, não que o domínio personalizado esteja servindo esse SHA, nem homologação de Auth, pagamentos, Connect ou PWA instalada. Confirmar aliases e sessões ao liberar qualquer lote.

## 2. Ponto de partida do banco (metadados)
| Campo | Produção | Teste |
|---|---|---|
| Supabase projeto | `cpslafpzjtbpmoxxysaa` (neopep) | `qnuluspqfazdppciermw` (neopep-staging) |
| Estado consultado | ACTIVE_HEALTHY | ACTIVE_HEALTHY |
| Migrações registradas na consulta de 24/11 | 15 | 22 |
| Observação | IDs próprios de migrations oficiais | IDs próprios de migrations de Teste |
Os ledgers **não são intercambiáveis**: a contagem não define paridade estrutural. A consulta information_schema somente leitura confirmou em ambos `neo_private.shop_products.stock` integer, `neo_private.shop_products.price_cents` integer, tabelas de campanhas e publicações WhatsApp, e tabelas de conexão e grupos do NeoPep Connect.
Não foram consultados pedidos, usuários, segredos ou conteúdo de mensagens. RLS/grants, RPCs, políticas, Edge implantadas e backup/restauração devem ser conferidos **se forem diretamente afetados pelo novo ajuste**.

## 3. Trabalho já existente a preservar
- Loja: gerenciador, produto com estoque/preço, pedidos, duplicação, visibilidade por membro e Mercado Pago; webhook deve ser preservado.
- Calculadora: resultado com seringa e três cards de capacidade (rever SHA do ambiente no ajuste #009).
- Biblioteca: leitor de PDF, vídeos, favoritos/destaques conforme módulo já feito; prévia PDF já possui canvas/fallback que pode requerer correção.
- App: peso, fotos/comparações, perfil, privacidade e consentimentos existentes.
- Campanhas: abas App/WhatsApp, publicações, grupos, Connect, push/segmentação e seus contratos existentes; não substituir por módulo duplicado.
- NeoPep Connect Windows: cofre DPAPI, pareamento, assinatura/atualização, grupos sincronizados e envio com confirmação manual descrito em documentação de 0.2.6. **A instalação real Windows e sessão WhatsApp não foram lidas**.
- Tema: `src/app.js` já suporta `light`, `dark`, `system`; o visual escuro aprovado não deve ser alterado por #003.

Estes itens não são atestados como 100% homologados; a lista delimita contratos que **não podem ser removidos por uma nova tarefa**.

## 4. Registro de abertura para cada ajuste
Ao começar cada ID/sub-ID:
1. Comparar branch/deployment realmente corrente com este Marco Zero e com o **último release publicado**; determinar ponto de entrada efetivo.
2. Registrar a lista exata de arquivos e contratos atingidos; não inspecionar todos os recursos antigos por reflexo.
3. Para cada arquivo antigo alterado, comprovar que o comportamento preexistente essencial permaneceu: testes direcionados, comparação de API e revisão de diff.
4. Verificar compatibilidade do delta com o estado efetivo do ambiente de destino, não assumir que Teste e Produção têm o mesmo código/SQL.
5. Nunca fazer `git reset --hard`, restaurar arquivos legados ou copiar o Teste inteiro por conveniência. Não sobrescrever commits anteriores nem configurações exclusivas.
6. No fechamento, registrar novos SHAs e evidência em CONTROLE-DE-EXECUCAO.md e, se publicado, no REGISTRO-DE-PUBLICACOES.md. **Marco Zero não será reescrito**.

## 5. O que não foi verificado e por quê
O inventário registra referências técnicas, não verifica toda a experiência do app no dispositivo, DNS/aliases, sessão Windows, capacidade de envio automático, captura de pagamentos recorrentes, operação de estoque real ou restauração de backup. Esses testes só entram no escopo se forem necessários ao ajuste selecionado ou ao release correspondente. Uma publicação que dependa de migração crítica exige gates de segurança apropriados, mesmo se o restante do legado já estiver aprovado.

## 6. Proteção da linha de base por ambiente
**Base Teste ≠ Base Produção.** PR #37 de reconciliação está aberta/draft no momento do snapshot. Para publicar um ajuste isolado, criar delta compatível com Produção e promover somente o necessário; quando isso exigir dependências, identificá-las e pedir a decisão do proprietário. Não fazer merge integral de staging em main como consequência oculta de «publique esse ajuste».
