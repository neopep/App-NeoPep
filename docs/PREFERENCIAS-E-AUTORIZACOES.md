# Acompanhamento e autorizações

Contas novas começam com peso, medidas, diário, fotos e aplicações selecionados. Escolhas já salvas, incluindo opções desmarcadas, são preservadas. Esses controles personalizam atalhos na tela inicial; peso e medidas também participam dos lembretes configurados. Fotos agora acrescenta uma tarefa para adicionar uma imagem privada.

O Perfil apresenta “Personalizar meu acompanhamento”, com descrição do efeito de cada escolha, e “Privacidade e autorizações”, com o estado real das permissões da conta. Não há mais a caixa de consentimento de saúde bloqueada com instruções técnicas. Retirar a autorização de fotos atualiza esse estado na tela.

As preferências não autorizam tratamento de dados nem divulgação na comunidade. Consentimentos de saúde, termos e fotografias não são concedidos automaticamente ou marcados em nome do usuário. O cadastro inicial mantém confirmação expressa; fotografias têm autorização específica no envio. A implementação não considera um padrão de interface como consentimento válido e não modifica registros existentes de consentimento no Supabase.

As escolhas de acompanhamento não alteram a configuração de notificações do dispositivo. Desmarcar acompanhamento não exclui dados, não remove módulos de Registros e não altera lembretes personalizados independentes.

## Privacidade e permissões opcionais

O Perfil oferece uma tela única para estatísticas, medição de uso, notificações de campanhas e localização aproximada. Após concluir um cadastro novo, a mesma interface permite salvar as escolhas ou continuar sem autorizar. O Supabase registra a conclusão por conta, inclusive quando o usuário pula a etapa. Contas já cadastradas mantêm as preferências e seguem o fluxo habitual.

Estatísticas e medição de uso conservam os prazos individuais de até 90 dias. Revogar uma opção não remove o consentimento nem os dados válidos da outra. A gravação usa uma transação e registra finalidade, versão, escolha e horário no histórico de consentimento. O backup em **Meus dados** inclui exportações de estatísticas e localização quando disponíveis. Autorizações de saúde e fotos continuam acessíveis no Perfil.

O controle de campanhas pode solicitar a permissão nativa quando o usuário o ativa e salva. A inscrição de dispositivo permanece em **Lembretes**, separada da preferência promocional. Se o aparelho já bloqueou as notificações, o aplicativo orienta a mudança pelos ajustes. No iPhone, a permissão depende da instalação na tela inicial. A localização usa cidade, estado e país fornecidos pela hospedagem se o recurso estiver configurado. O aplicativo não solicita GPS.

### Integração futura de homologação

Com autorização para a entrega conjunta, confira a versão atual dos RPCs e o backup recuperável do Supabase de Teste. Aplique primeiro a migração `20261123190000_privacy_preferences.sql`. Só então publique o frontend que chama `neo_privacy_preferences`. A migração mantém as assinaturas anteriores e preenche a validade da medição de uso a partir dos registros existentes. Para reverter o frontend, mantenha a migração aplicada e republique a versão anterior. Remover a estrutura ou restaurar o banco a um ponto anterior exigiria preservar os consentimentos registrados desde a publicação. Homologue o primeiro acesso com contas fictícias, a recusa e a reativação nativa no Safari/PWA de iPhone físico e a distinção entre avisos essenciais e promocionais.
