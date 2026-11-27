# NeoPep Connect AI — protocolo permanente de continuidade Codex / ChatGPT

Objetivo: permitir que qualquer sessão autorizada do Codex ou ChatGPT retome o projeto diretamente pelo GitHub, sem depender de histórico de chat, arquivos locais ou créditos restantes.

## Regras de trabalho
- Manter a branch desenvolvimento/campanhas-plugin-ia-20261126 como referência do ciclo, salvo decisão explícita posterior. Antes de iniciar, consultar HEAD remoto e reconciliar alterações concorrentes. Não sobrescrever trabalho de outra sessão, não usar force push.
- Fazer commits pequenos, coerentes e verificáveis e push ao GitHub ao concluir cada incremento. Em interrupções, preservar trabalho parcial em commit identificado como WIP, com limitações e próximo passo; não tratar WIP como pronto para release.
- Atualizar docs/NEOPEP-CONNECT-AI-PROGRESSO.md a cada incremento relevante, de preferência no mesmo commit que o código. Incluir as 14 etapas, estado de implementação/teste/homologação/publicação, timestamp, arquivos, commits de referência (sem autorreferência circular), testes/comandos/resultados, bloqueios, decisões, dependências e instrução de retomada concreta.
- Manter código, contratos, migrações candidatas, testes, documentação gerada, manifestos e configurações reproduzíveis no repositório. Não depender de arquivos temporários de uma sessão. Registrar versões das dependências e comandos de build/teste. Nunca commitar segredos, tokens, cookies, chaves privadas ou dados pessoais; registrar somente nomes de variáveis, local autorizado de configuração e passos de verificação.
- Registrar operações externas separadamente: ambiente, serviço, recurso ou identificador não secreto, commit associado, resultado real, migração aplicada ou candidata, rollback e autorização. Nenhuma operação externa deve ser presumida por existir código no GitHub.
- Antes de encerrar uma etapa, verificar o push e confirmar que o conteúdo está acessível no remoto. Não aguardar o fim de toda a implementação para publicar commits. Se faltar acesso de escrita, informar e deixar patch/arquivos exportáveis e instruções de aplicação, sem afirmar que o push ocorreu.
- Evitar deploys automáticos desnecessários da branch de desenvolvimento: revisar política existente da Vercel/Cloudflare, sem mudar configuração de produção sem autorização. Push de código não equivale a publicar o aplicativo. Preservar os gates de release.

## Retomada
1. Ler este documento, o relatório de progresso e a ordem oficial docs/NEOPEP-CONNECT-AI-ORDEM-CODEX-V1.md.
2. Confirmar HEAD remoto, commits posteriores e estado real dos ambientes; não reexecutar migrações ou envios já realizados.
3. Executar os testes pertinentes à última etapa e iniciar o próximo incremento registrado.
4. Se uma sessão estiver trabalhando na mesma branch, coordenar a transferência antes de editar. Não executar simultaneamente alterações conflitantes.

## Limites preservados
Cloudflare-first, Supabase como fonte de verdade, Vercel e Windows executores futuros opcionais. Card independente acima de App/WhatsApp. Ponto de corte anterior: Teste não publicado. Sem provisionamento, migração real, alteração DNS, gastos, envio ou publicação sem autorização específica. Mercado Pago, agentes de atendimento e Connect Windows atual preservados.

Este protocolo não garante acesso a alterações não enviadas, terminal de outra sessão ou recursos cuja autorização tenha expirado. O GitHub remoto é a fonte de continuidade; conexões e permissões devem ser reconfirmadas quando necessário.
