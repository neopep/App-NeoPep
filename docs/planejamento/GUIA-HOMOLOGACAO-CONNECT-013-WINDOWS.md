# NeoPep #013 — Roteiro de homologação segura do Connect no Windows físico

**Situação: preparado, NÃO executado em computador real.** Fonte técnica `desenvolvimento/ajuste-013-windows-qa`, baseada na PR #57, com PR #58 de CI. Banco Supabase **Teste** `qnuluspqfazdppciermw` já tem a migração `campaign_dispatch`, mas os controles permanecem `whatsapp_enabled=false`, `app_enabled=false` e `neo_private.connect_config.paused=true` (consulta read-only em 24/11). **Não desativar esses bloqueios neste roteiro**.

## Candidato e canal de distribuição

- Build público isolado verificou o código, mas gerou instalador **sem assinatura Authenticode**, somente no runner. Não divulgar instalador ou link de download público.
- Repositório **privado** disponível: `neopep/NeoPep-Connect-Build-Privado`, workflow `Connect Windows Release Candidate`, que recompila a partir de SHA pinado em runner Windows e envia arquivo a artefato privado. A assinatura de manifesto para o updater acontece em uma etapa externa, a partir do assinador autorizado. **Não executar esse workflow nem publicar no storage sem autorização específica.**
- Histórico do workflow privado confirma candidato de **Teste 0.2.8** em 23/11. Como o novo código é posterior, **não reutilizar a identidade de release 0.2.8**. Sugestão de versão futura: **0.2.9**, sujeita a checagem do registro privado de versões e aprovação do proprietário. `0.2.8` usado em CI pública é apenas o rótulo de ensaio.
- Instalar somente artefato preparado pelo canal privado revisado, com versão, SHA do código, hash do instalador, manifesto e assinatura RSA de atualização verificados. Assinatura RSA do manifesto **não equivale** à assinatura Windows Authenticode; registrar esta distinção.
- Não alterar automaticamente os clientes instalados. O usuário deverá consentir em qualquer instalação/atualização real.

## Pré-condições

1. Confirmar Windows alvo, versão instalada, ambiente **TESTE** e conta Windows que detém os dados DPAPI. Nunca copiar, excluir, redefinir ou sobrescrever cofre da sessão WhatsApp para forçar homologação.
2. Confirmar o candidato assinado/verificado do canal privado e eventual janela de recuperação. Manter backup/proteção de dados e versão anterior para retorno sem desparear usuários.
3. Checar flags remotas **ambas false**, pausa Connect ativa e ausência de `NEO_CONNECT_CAMPAIGN_WORKER=1` no ambiente local. Não usar sessão WhatsApp de clientes ou grupos sem autorização.
4. Não inserir chaves de administrador, service_role, assinatura, JWT ou credenciais em logs/repositório. Capturas devem ocultar número, QR, grupos, titulares e tokens.

## Matriz de ensaio físico — sem enviar mensagens

| Teste | Comportamento a comprovar | Evidência mínima |
|---|---|---|
| I. Identidade | Versão, perfil TESTE, SHA/manifesto e origem correspondem ao candidato | Versionado + hash, sem dados secretos |
| II. Atualização | Instalação consentida preserva `session.dat`, `whatsapp-session.dat` e perfis; sem reset | Comparação protegida dos cofres antes/depois |
| III. Login | Connect abre, autentica na conta autorizada, computador aprovado e diagnosis visível | Captura mascarada, horário e estado |
| IV. Conexão | WhatsApp apresenta estado real conectado/desconectado, não apenas último estado salvo | Indicador + atualização após reconectar |
| V. Grupos | Seleção e sincronização apenas de grupos autorizados; grupo obsoleto não é elegível | Contagem mascarada, hora do sync |
| VI. Bloqueio | Worker não realiza claim/start/finish enquanto flags e opt-in estão desativados | Banco: zero lotes/execuções de ensaio e status de flags |
| VII. Offline | Sem rede ou ponte desconectada, UI sinaliza indisponibilidade sem confirmar envio fictício | Estado e horário, sem dados de grupos |
| VIII. Reinício | Encerrar/reabrir preserva conta, seleção e rascunho protegido | Integridade DPAPI e recuperação |
| IX. Segurança | Dispositivo revogado ou sessão expirada não pode publicar; sem vazamento de conteúdo | Erro sanitizado e evidência read-only |
| X. Reversão | Versão privada anterior restaura o funcionamento com cofres preservados, se necessária | SHA de restauração e estado da conta |

## Bloqueios explícitos

- **Não enviar** mensagem de teste, imagem, documento, campanha real ou push neste roteiro. Envio controlado para um grupo autorizado é **outro gate de autorização** após a homologação de leitura/conexão.
- **Não habilitar** worker, rotina automática, `whatsapp_enabled`, `app_enabled`, nem retirar a pausa do Connect.
- Não disponibilizar binário de repositório público ou instalar pacote não verificado. Não mudar Produção ou Vercel.
- Se houver divergência de hash, perda da sessão, falha de permissão ou claim inesperado, suspender a homologação e registrar a falha antes de qualquer tentativa adicional.

## Critério de saída

Relatório de Windows físico anexando somente versão/commit, resultado por caso, ambiente, horários e evidências sanitizadas. Só depois avaliar ativação de **um grupo próprio e autorizado** com aceite específico, mantendo limites anti-duplicidade, consentimento e observação dos resultados incertos. A homologação do painel web também exige deploy **Teste** autorizado à parte.
