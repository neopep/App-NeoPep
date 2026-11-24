# NeoPep — Início obrigatório para qualquer agente ou Codex
**Projeto:** `neopep/App-NeoPep`  
**Documento principal:** [Plano Mestre](PLANO-MESTRE-NEOPEP-2026-11-24.md)  
**Levantamento técnico:** [Levantamento](LEVANTAMENTO-TECNICO-2026-11-24.md)  
**Tracker:** [Controle de execução](CONTROLE-DE-EXECUCAO.md)  
**Planejamento:** PR #40 (draft). **Não confundir branch de documentação com código pronto para produção.**

## Missão
Evoluir o NeoPep cumulativamente, **sem desfazer alterações aprovadas anteriormente**, iniciando por melhorias simples e avançando para módulos complexos. Há 13 ajustes funcionais (#001–#013) e uma etapa transversal de preservação e governança (#014). Respeitar prioridades, dependências e requisitos detalhados no Plano Mestre.

## Checklist de entrada
1. Ler `AGENTS.md`, `docs/conhecimento/CONTEXTO-MESTRE.md`, `docs/memoria/DECISOES.md`, docs e testes do módulo.
2. Conferir HEAD/branch, PRs abertos/merged, especialmente #35, #37 e #40, e o último estado do tracker.
3. Auditar Teste e Produção separadamente: SHA do deploy, migrations/ledger, RPCs, RLS, Edge, Storage, Auth, Vercel e configuração de runtime. Nunca confundir versão no Git com versão implantada.
4. Conferir se há implementação parcial do requisito em outra branch ou PR. Reaproveitar o delta aprovado, não reimplementar do zero.
5. Antes de codificar, registrar subetapa e contratos afetados no tracker, com baseline e teste de regressão.
6. Desenvolver em branch isolada e PR pequeno. **Não misturar a documentação PR #40 com merge da PR #37**; a PR #37 tem gates próprios.
7. Rodar check, build, testes dirigidos e testes de preservação. Registrar evidências. Não marcar como aprovado sem evidência.
8. Atualizar os documentos deste diretório e a documentação específica do módulo no mesmo PR/commit. Registrar próximos passos e bloqueios.
9. Produção/merge main/migrações/serviços pagos/envios WhatsApp reais exigem autorização explícita. **Não mexer no webhook da Loja Mercado Pago** salvo necessidade comprovada e aprovação.
10. Ao retomar de outro chat, consultar o tracker, identificar o último item efetivamente validado e continuar dali, sem supor que o Codex concluiu o que apenas iniciou.

## Regra de status
«Planejado» não é «implementado». «Implementado em branch» não é «integrado». «Integrado no Git» não é «implantado». «READY no Vercel» não é «homologado no usuário». «Enfileirado» não é «enviado». «Enviado» não é «entregue/lido». «Webhook funcionando na Loja» não é «assinaturas funcionando».

## Critérios de preservação
- PWA: tema escuro aprovado, login, sessão, identidade, callbacks, service worker e instalações existentes.
- Loja: catálogo, preços, estoque atual, checkout, pedidos, duplicação, visibilidade por membro, webhook e histórico.
- Calculadora: componente da seringa e três cards de capacidade.
- Biblioteca: leitor PDF, player de vídeo, permissões e mídias.
- Comunidade: dados e permissões, consentimento de compartilhamento.
- Campanhas: duas abas App/WhatsApp, esteira, grupos, Connect, push e consentimentos.
- Connect Windows: cofre DPAPI, sessão, atualizador assinado, versões e perfil do dispositivo.
- Infraestrutura: isolamento Teste/Produção, RLS, jobs, segredos, migrações e backups.

## Primeira ação autorizada neste ciclo
Somente levantamento e documentação foram solicitados até aqui. A execução funcional deve começar pela Fase 0 e depois #007, quando expressamente autorizada. Não fazer deploy por inferência.
