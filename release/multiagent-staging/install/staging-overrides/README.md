# Substituições exclusivas do neopep-staging

Use este pacote somente em `qnuluspqfazdppciermw`. Siga a ordem do instalador e use as quatro cópias deste diretório nos pontos correspondentes. Os originais permanecem em `../migrations/`. O script psql original usa os arquivos originais, portanto não é o script de aplicação deste perfil.

| Arquivo | Alteração |
| --- | --- |
| 202611120010 e 202611120022 | Preferência de push desativada por padrão e nas inserções. A posição 10 instala uma restrição que impede gravar opt-in ativo. |
| 202611160038 e 202611160039 | Funções de despertar preservam assinaturas e não leem o Vault nem fazem HTTP. Os três gatilhos de push são instalados e desabilitados na mesma transação. |
| 99-postflight.sql | Verifica gatilhos desabilitados e funções de despertar sem egress ou Vault, além dos demais controles do pós-teste. |

As adaptações não modificam o contrato histórico de autorização. Antes de qualquer ensaio futuro de push, revise as diferenças e o plano de reversão como parte da autorização específica.
