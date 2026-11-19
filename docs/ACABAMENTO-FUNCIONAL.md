# NeoPeptídeos — acabamento das funcionalidades internas

Escopo autorizado: priorizar o uso do aplicativo e pausar Google, Apple, SMTP, domínio e lançamento público. Nenhum desses serviços foi configurado, contratado ou liberado nesta atualização. A prévia permanece no mesmo Site, com Elo original na raiz.

## Entregue neste ciclo
- Históricos de peso, medidas, diário, aplicações, protocolos e lembretes: busca com acentos, intervalo inclusivo de datas, paginação de 12 registros e apresentação em cards no celular. Pesquisas ficam somente na memória e são limpas ao trocar de conta/modo. Dados não são apagados pelos filtros.
- Medidas: seletor de gráfico para cintura, quadril, peito, braço e coxa; comparação entre primeira e última medida realmente informada; ausência de valores não vira zero.
- Diário: novos registros completamente vazios são recusados; registros legados continuam legíveis e restauráveis. Médias seguem apenas os valores informados, sem inferências médicas.
- Protocolos: resumo com quantidade de aplicações e último registro; acesso às aplicações vinculadas. Nenhuma dose/frequência/recomendação é gerada.
- Lembretes: ativar/pausar no histórico; recorrência respeita data inicial futura. Eventos já exportados precisam ser alterados na agenda pelo usuário. Sem promessa de notificações push em segundo plano.
- Calendário: próxima/anterior semana ou mês mantém os detalhes em uma data do período navegado.
- Relatórios: histórico de pesos e diário junto de medidas/aplicações; CSV da tela respeita o período escolhido. CSV/JSON completos continuam no Perfil. Impressão/PDF pelo sistema mantém todas as linhas filtradas, inclusive além da página visível, e informa os filtros. CSV usa kg/cm canônicos, mantendo a unidade informada das aplicações.
- Fotos: galeria de evolução separada das fotos de perfil; versões antigas de avatar têm exportação/exclusão individual. Falha ao atualizar a galeria preserva a lista já carregada. Gravação confirmada da foto não é tratada como perdida se a leitura posterior falhar.
- Salvamento: ID estável durante tentativas do mesmo formulário; reenvio idêntico não duplica um insert já confirmado no servidor. Colisão com conteúdo diferente é recusada. Revisão retornada pelo banco é preservada. Falha na atualização do histórico após gravação bem-sucedida aparece como alteração salva com leitura pendente, sem induzir novo cadastro.
- Sessão: evento repetido da mesma conta não recria o perfil em edição nem limpa filtros. Login/cadastro/recuperação continuam sem navegação pessoal.
- Atualização PWA: botão de nova versão permanece disponível ao mudar de tela.

## Preservação e limites
Sem mudanças nas migrações 001/002, sem migração automática de dados ou exclusão de registros existentes. Cálculos da calculadora mantidos. Regras RLS, consentimento e revisão concorrente continuam ativos. Não houve leitura de dados pessoais pelo assistente ou envio de mensagens/e-mails.

## Validação
Build do SDK oficial, checagem de JavaScript/configuração e suíte completa de testes locais. Casos adicionais cobrem filtros, gráficos, paginação/linhas de impressão, vínculos de protocolos, pausa de lembrete, agenda futura, exportação de período, reenvio sem duplicação, falha após gravação, datas do calendário, fotos de perfil, eventos repetidos de sessão e preservação da galeria após erro.

A inspeção visual automatizada permanece indisponível: managed-linux sem cua_repl.js, exigido pelo fluxo Sites. Testes DOM e transporte simulado não comprovam comportamento completo de Safari, câmera, impressão real ou rede móvel. A validação remota de funcionalidades deve ser feita pelo titular na prévia, sem compartilhar senha ou dados de saúde no chat.

## Roteiro de revisão no iPhone
1. Evolução: registrar/editar peso e medidas; trocar a medida do gráfico; aplicar filtros; conferir que dados reaparecem ao limpar filtros.
2. Diário: registrar sono/energia/observações; editar e comparar os períodos.
3. Aplicações e protocolos: criar protocolo pessoal de teste, vincular aplicação informada, usar “Ver aplicações”, editar e conferir o vínculo. Não usar dados de demonstração como orientação clínica.
4. Lembretes e calendário: configurar início futuro, pausar/ativar, navegar meses/semanas e exportar .ics, revisando o alerta na agenda do dispositivo.
5. Relatórios: selecionar 7/30/90 dias ou todo o histórico; exportar CSV do período e relatório pelo diálogo PDF/Imprimir; comparar com histórico completo do Perfil.
6. Fotos: enviar imagem própria de teste, comparar duas fotos, exportar/excluir individualmente. Fotografias ficam fora do backup JSON.

Integrações externas, entrega de e-mails, exclusão real de conta via Edge Function e teste de isolamento entre duas contas reais continuam com o estado documentado na etapa 2; esta atualização não os declara concluídos.
