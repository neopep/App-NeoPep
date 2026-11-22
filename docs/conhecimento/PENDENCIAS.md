# Pendências

| ID | Classificação | Evidência necessária |
| --- | --- | --- |
| P-001 | Parcialmente validado | Reproduzir e corrigir em entregas próprias as 67 falhas já classificadas. [Triagem](../memoria/TRIAGEM-TESTES-BASE-MA03.md) [Testes](TESTES.md) |
| P-002 | Não verificado | Confirmar esquema remoto, RLS entre contas, Storage, exclusão, backup e recuperação no ambiente autorizado. [Banco](BANCO-DE-DADOS.md) |
| P-003 | Não verificado | Conferir domínio, audiência, redirects, widget CAPTCHA, SMTP externo, recuperação e limites. [Integrações](INTEGRACOES.md) |
| P-004 | Não verificado | Executar QA Safari/iPhone e Chrome/Android, incluindo instalação, teclado, anexos, áudio e atualização. [Lançamento](../LANCAMENTO-WEB-E-LOJAS.md) |
| P-005 | Não verificado | Validar push real, privacidade e custos do agente, ciclo de pagamento em teste, catálogo e critérios operacionais. [IA](INTELIGENCIA-ARTIFICIAL.md) · [Monetização](MONETIZACAO.md) |
| P-006 | Planejado | Receber a fonte integral das 140 etapas e verificar o acervo autorizado. [Estudo original](../estudo-original/README.md) |
| P-007 | Planejado | Implementar verificações documentais após aprovação. [Estratégia](../processos/PROTOCOLO-DE-VALIDACAO.md) |
| P-008 | Planejado | Revisar prontidão e privacidade, decidir lançamento e implementar a preparação nativa em entregas posteriores. [Roadmap](ROADMAP.md) |
| P-009 | Concluído | Publicação funcional confirmada em Preview no PR #3. A limpeza das branches é uma operação separada, sujeita a autorização. A conectividade real do Supabase continua coberta por P-002. [Registro](../memoria/HISTORICO-DE-ALTERACOES.md#mem-20261120-006) |
| P-010 | Parcialmente validado | Push direto e deployment Production Ready confirmados. A entrega do marcador pelo domínio permanece sem evidência. Limpeza autorizada em commits separados. Falta confirmar o deployment da remoção. [MEM-20261120-008](../memoria/HISTORICO-DE-ALTERACOES.md#mem-20261120-008) |

| P-011 | Parcialmente validado | Staging Supabase separado criado e backup manual operacional legível, conforme confirmação do responsável. Pacote sem dados ensaiado localmente. Restam aplicar e auditar o pacote no staging, homologar Auth/Edge/frontend e testar recuperação do backup real em alvo autorizado separado. [MEM-20261120-012](../memoria/HISTORICO-DE-ALTERACOES.md#mem-20261120-012) |

As evidências para lançamento continuam registradas no [checklist de release](../../release/web-readiness.json).
