# NeoPep Connect AI — matriz de continuidade

Base remota conferida em `4276b86`. “Candidato” indica código de desenvolvimento e testes isolados. As referências dos frontends são as últimas registradas, Produção `7943d3c` e Teste `d4d9e35`. Essa referência não constitui nova verificação Vercel.

| Etapa | Funcionalidade | Implementação e teste | Homologação e publicação | Evidência, dependência e próxima ação |
|---|---|---|---|---|
| 01 | Windows 0.2.16 | Instalação compilada na execução Actions informada e testes locais de contrato | Assinatura, artefato e instalação física pendentes nos dois perfis | [Execução Windows](https://github.com/neopep/App-NeoPep/actions/runs/45993241414). Usar esteira privada e assinador autorizado. Validar atualização, reversão, DPAPI e troca de conta. |
| 02 | JPEG 5 MiB | Editor e bridge candidatos. Preflight real por metadados nos dois bancos | Flag de 5 MiB pendente nos dois ambientes | `16a1cbb`, 009 e preflight. Conferir patch completo contra os RPCs instalados. Homologar executor e limites do App separadamente. |
| 03 | Infraestrutura de Teste | SQL 001–003, 007–008 e gate 014 instalados no Supabase Teste; 8 tabelas RLS; ensaio de 60 itens com rollback | Banco instalado; Worker/Hyperdrive/login dedicados ainda pendentes; escrita desativada | Migrações connect_ai_test_readonly_foundation e connect_ai_test_draft_jobs_disabled; drafts_enabled=false. Conferir plano/cotas e provisionar exclusivamente Teste. |
| 04 | Sincronização de frontends | Bases independentes registradas | Sem promoção neste ciclo | Reconstruir deltas sobre deployments confirmados, validar CSP e publicar Produção primeiro. |
| 05 | Consulta App e WhatsApp | Leitores e projeções candidatas testados com fixtures | WhatsApp Produção homologado anteriormente. App e Teste pendentes | Verificar catálogo real por canal, paginação, arquivos excluídos e recibos sem expor destinatários. |
| 06 | Criar e editar rascunhos | Escopo, recibo, revisão e idempotência em candidato. Testes MCP | Escrita real pendente | `007`; validar OAuth Teste, revogação, concorrência e recuperação antes da habilitação. |
| 07 | Legendas e formatação | Editor já publicado conforme histórico; MCP candidato com legenda, vazio e texto separado | Verificar paridade em dispositivo | `16a1cbb`; conferir a prévia com originais fictícios e testar formatação no host. |
| 08 | Base de conhecimento | Manual gerado, consulta e comprovante já implementados | Administração persistente pendente | `a87bd12`; preparar ACL, histórico, aprovação e leitura somente de versão publicada. |
| 09 | Especialistas e referências | Nove métodos e vinte referências catalogados | Catálogo candidato. Gestão dinâmica pendente | `f44c1e1`; pesquisar, classificar e versionar sem copiar instruções de terceiros. |
| 10 | Fluxo criativo | Manual e skill de criação candidatos | Fluxo completo em host pendente | `313c0e3`; testar do objetivo à revisão de rascunhos com material fictício. |
| 11 | Criativos | Validação estrutural e vínculo candidatos | Transferência real pendente | `media-plan.mjs`; implementar ticket persistente, validação segura, recibo, revisão e limpeza. |
| 12 | Lotes | SQL 008 instalado em Teste, gate de escrita desligado. Ensaio de 60 itens, idempotência, lease, pausa, retomada e cancelamento aprovado com rollback | Executor e painel ainda pendentes; sem tarefas reais | 008 e 014. Integrar runner e conciliação; não ativar escrita antes de OAuth e ACL. |
| 13 | Destinos e materiais | Consulta candidata com projeção limitada | Vínculo real pendente | Revalidar listas da conexão e refs da Biblioteca, Loja e Comunidade pela Central nativa. |
| 14 | Agenda e recorrência | Leitura candidata | Escrita e confirmação pendentes | Testar ocorrências no fuso de São Paulo e preservar histórico antes de criar agenda. |
| 15 | Aprovação e publicação | Requisitos documentados | Ações MCP pendentes | Proposta com revisão, hash e nonce. Confirmar por usuário autorizado antes da ação nativa. |
| 16 | Administração avançada | Operações nativas existentes em escopo parcial | Integração MCP pendente | Cópia em rascunho; exclusão exige confirmação verificável. |
| 17 | Claude e Gemini | Documentação e contratos comuns | Instalação real pendente | Validar elegibilidade e callback oficial de cada host. Preservar Desktop 1.0.5 e adiamento Web/iOS/Nuvem. |
| 18 | Auditoria e monitoramento | Audit mínimo em 008 | Painel e métricas reais pendentes | Definir retenção, agregação por ambiente, permissões e fonte de custo. |
| 19 | Documentação automática | Geradores de manual e conhecimento integrados ao CI | Evidência local e CI anterior | Atualizar catálogo e versões junto dos contratos. |
| 20 | Regressão e releases | Suítes locais e CI Windows anterior | Sem deploy neste ciclo | Validar binário assinado, navegadores e rollback antes da promoção. |
| 21 | Álbum WhatsApp | 011 de rascunhos, executor candidato inativo e 012 de recibos locais. Falha parcial e não repetição testadas com fixture | Fila, migrações, build Windows e apresentação real pendentes | Adaptar planejamento da fila, negociar capability no servidor, validar lease e homologar |
| 22 | Biblioteca de criativos | Referências privadas existentes; seleção e deduplicação de criativos reutilizáveis pendentes | Pendente | Definir vínculo e retenção antes de permitir exclusão de arquivos |
| 23 | Calendário editorial | Fluxos nativos de agenda; visualização consolidada pendente | Pendente | Reutilizar fontes nativas e distinguir horário proposto de agendamento |
| 24 | Revisão consolidada | Prévia individual existente | Aprovação editorial em lote pendente | Vincular aprovações a revisões e manter confirmação de envio independente |
| 25 | Identificação da conta WhatsApp | Implementação 06b3eb8; CI MCP e Windows aprovados; 013 ensaiada nas definições reais dos dois bancos com rollback e ACL | Migração 013, distribuição assinada, instalação e publicação pendentes | Validar atualização real, reconexão, troca de conta e painel; telefone somente admin autorizado. |

### Próxima rodada — prioridade Connect AI
Concluir infraestrutura isolada Teste e homologação real de leitura/escrita de rascunhos, upload e vínculo de criativos, executor/painel de lotes e integração da fila nativa de álbuns (011/012). Acrescentar identificação da conta WhatsApp ativa ao editor e Central, sem redesenhar UI ou alterar seleção de grupos. Nome e telefone completos apenas no painel administrativo autorizado; catálogo MCP não precisa receber telefone. Preservar fluxo de imagem única, compatibilidade com versões antigas e ordem Produção → verificação funcional → Teste. Não ativar envio de álbuns nem 5 MiB antes de homologar o executor. Nuvem/ChatGPT Web/iOS continuam adiados.

## Publicação incremental da base de conhecimento — 27/11/2026
- CI 46004554506 do commit 7ed41f1: success (intertravamento de escrita Worker/banco). Sem deploy do Worker.
- Produção: commit 3164ccc09cca6385867f44fb7d616dc1faac097d na branch desenvolvimento/campanhas-legendas-producao-20261127; deployment dpl_3LbnYh2id5QL1MmpqkncS9GJBUqp READY com alias app.neopep.com.br. Alterados apenas painel, snapshot e index; OAuth e ZIP 1.0.5 preservados. Rollback anterior dpl_4ZT5G36BgoNrWK6GvV4uDcfekcvN.
- Teste: commit 9f236f0910eb54ce82485f8c26ea2cc84ac39b6f na branch desenvolvimento/loja-ofertas-etiquetas-teste-20261126; deployment dpl_BmEi6SBW7imZXCo3XCMnEf95sFB8 READY com alias teste.app.neopep.com.br. Painel somente consulta sobre base própria; sem OAuth, gestão de conexões ou escrita. Rollback anterior dpl_6Ny6vhGy16RXKXW2rjFxkEpXGByv.
- Ambos servem HTTP 200 no /admin/, snapshot 2026-11-27.8 e script do painel; snapshot contém 9 métodos e 20 referências, sem recibos ou capacidades de runtime. Ordem Produção → verificação de assets → Teste cumprida; homologação interativa com sessão admin ainda pendente. O manual publicado é referência candidata, não catálogo MCP ativo. Nenhuma publicação de campanha, alteração de banco ou contratação nova nesta rodada.
- Hyperdrive/Worker Teste ainda pendentes de backup verificável e provisionamento seguro de credenciais isoladas. Não substituir por segredo de Produção. Base de conhecimento editável, upload e executor de lotes permanecem pendentes.

### Lotes — atualização 015
Persistência de conteúdo instalada somente no Supabase Teste, flag de escrita false; teste transacional 60 itens aprovado. Runner e adaptador privado candidatos, CI do runner aprovado. Falta integrar submissão por partes, catálogo MCP, runner/runtime e painel; sem serviço externo ativo.
