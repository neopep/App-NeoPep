# Chegada ao aplicativo

O cadastro usa a sessão retornada pelo SDK Supabase. Com confirmação desativada, o usuário já segue autenticado para Boas-vindas → Começar → dados iniciais. Se confirmação for reativada no servidor, respeitamos a exigência e mantemos o fluxo por e-mail; não há bypass. Retorno à conta já configurada mantém o destino de links compartilhados.

Dados iniciais: Nome completo, altura, peso inicial e meta; opções de acompanhamento recolhidas, todas as preferências atuais preservadas. Autorizações de saúde e termos são explícitas e obrigatórias, sem marcação pelo aplicativo. O texto reduzido preserva a finalidade e os links legais. Salvar leva ao Início e inicia o guia.

Guia: Comunidade → registrar peso → Dose. Um único balão por vez, Entendi avança, Escape encerra. Reaparece em novo login explícito; atualização de token e polling não reiniciam. A sessão restaurada só apresenta caso ainda não concluído naquela aba. SessionStorage guarda apenas marcador por UID, nunca senha ou dados de saúde. Se armazenamento não estiver disponível, o guia permanece em memória e pode reaparecer ao recarregar. Em links diretos à biblioteca ou conversa, aguarda o usuário abrir Início.

Nova origem requer novo login; a instalação e o guia são separados por origem. Sem migração SQL ou alteração de Secrets. Testes de DOM e fluxo cobrem sessão, boas-vindas, perfil, início e sequência; conferência visual em aparelhos reais ainda necessária.

Atualização: guia inclui Registros e Loja, total de cinco passos, e pergunta final Sim/Não. A escolha é salva em settings.showArrivalGuide no perfil Supabase por saveProfile, com controle de revisão existente. Não desliga o guia antes de confirmar a gravação. False impede próximos logins inclusive em outros aparelhos após carregar o perfil; preferência padrão true para perfis antigos. O card Jornada agora fica após a saudação, antes da Biblioteca e Loja, com Peso e Dose dentro dele. Sem migração SQL nova.

## Direção da meta de peso

O cadastro identifica ganho, redução ou manutenção comparando a meta ao peso inicial. O peso inicial permanece como marco de 0%; registrar um peso maior não redefine esse marco. A jornada desenha o trecho contrário à meta em vermelho, à esquerda de zero, com percentual negativo em vermelho. Para metas de ganho, o aumento é progresso; a perda é o movimento contrário. O peso atual aparece como texto acima da barra. A escala abre espaço à esquerda apenas quando necessário, e resultados além da meta ficam visualmente limitados a 100%, mantendo o peso real visível.

## Pendências ao acessar

Após carregar a conta e concluir o guia, um aviso oferece registrar agora ou deixar para depois. Peso é verificado diariamente; medidas seguem o dia semanal e os lembretes associados; aplicações seguem lembretes de aplicação ativos na data, respeitando início e repetição. Um registro correspondente feito hoje dispensa o aviso. Adiar vale para esse acesso; recarregar, entrar novamente ou retornar do segundo plano faz uma nova verificação com dados atualizados. A preferência do guia não desativa esses avisos.

No formulário de lembretes, “Registro associado” permite selecionar Peso, Medidas, Aplicação ou Outro. A identificação fica no título legível do lembrete, preservando compatibilidade com o servidor existente. Lembretes antigos de dose/aplicação e medidas também são reconhecidos pelo título. A mensagem de aplicação convida a registrar o que já foi realizado conforme prescrição e não define quantidade nem recomenda aplicar novamente. Um registro de aplicação no dia dispensa o aviso, mesmo se houver mais de um lembrete de aplicação.

## Convite inicial para configurar lembretes

Depois do guia e dos avisos de registros pendentes, o primeiro acesso oferece “Configurar lembretes” ou “Pular por enquanto”. O convite explica o benefício de escolher dias e horários e orienta usar o sininho no topo para configurar depois. As duas escolhas salvam `settings.reminderIntroSeen` na conta; configurar abre a tela Lembretes. Contas anteriores sem essa preferência recebem o convite uma vez após a atualização. Falhas de gravação mantêm o convite com opção de tentar novamente.


## Reforço diário enquanto não há configuração

Se a rotina ainda não foi salva, o convite reaparece no primeiro acesso de um novo dia. Pular e configurar gravam a data em `settings.reminderSetupPromptDate`, evitando repetir no mesmo dia, inclusive após novo login. Abrir a configuração não equivale a salvar: o convite só deixa de ser elegível quando os horários são salvos (`reminderScheduleConfigured`) ou já existem lembretes personalizados/horários alterados. Aceitar os horários padrão com “Salvar horários” também conta como configuração. A data usa o mesmo dia local dos registros.
