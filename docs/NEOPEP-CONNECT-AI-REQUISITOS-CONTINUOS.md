# NeoPep Connect AI — requisitos permanentes

## Escopo funcional
- Gerenciamento completo das campanhas existentes e novas, tanto App quanto WhatsApp, inclusive campanhas manuais anteriores ao plugin quando suportadas pela Central. Campanhas legadas: consultar primeiro; editar apenas por operação nativa autorizada, sem migração automática nem perda de histórico.
- Consultar campanhas, publicações, calendário, estados e recibos; editar conteúdo, criativos, datas, horários, recorrências e destinos; acrescentar publicações, duplicar, copiar entre canais, pausar/reativar, cancelar agendamentos e arquivar. Exclusões e operações de envio exigem confirmação explícita. Não reescrever mensagens já enviadas; preservar histórico e criar nova revisão/publicação quando necessário. Agendamentos existentes exigem verificação de estado, cancelamento/reprogramação segura e confirmação; não duplicar envios.
- App: público/planos/segmentos, pop-up, push, prioridade, frequência, janela, limite de exibição. WhatsApp: grupos vigentes autorizados na conexão, diagnóstico e regras de envio. Usar funções nativas e validar permissões por ação e ambiente. Cópia entre canais cria rascunhos e exige revisar destinos.

## Autenticação flexível (requisito anterior)
- Múltiplas conexões por conta NeoPep, inclusive várias contas da mesma IA, identificadas por conexão e cliente; escopos independentes, expiração, revogação individual, auditoria, ambientes separados. OAuth 2.1/PKCE para clientes compatíveis; código de pareamento temporário e de uso único somente se o cliente suportar o fluxo, sem credenciais em prompts. Não compartilhar sessão ou service_role.

## Atualização contínua de documentação (requisito anterior)
- Catálogo de ferramentas e contratos como fonte versionada, geração automática de documentação e validação em CI. Mudança em Campanhas exige revisão dos contratos/guia, cobertura e testes de compatibilidade; bloquear publicação integrada quando documentação estiver desatualizada. Expor capabilities por versão e ambiente, respeitar diferenças de deploy. Atualização automática da documentação não substitui revisão humana de semântica nem validação do backend. Implementação pendente.

## Estado
Requisitos de planejamento registrados; não representam funcionalidades do plugin implementadas. Sem alteração de produção, teste, migrações ou publicação. Ponto de corte anterior permanece válido: Produção a315404, Teste fe8ecb2 preparado e não publicado.
