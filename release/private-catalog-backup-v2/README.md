# Backup privado de catálogo v2 — candidata

Escopo: produtos não excluídos (ativos e inativos), todos os campos configurados por produto, ordem e capa da galeria, bytes originais das fotos, regras de visibilidade (inclusive listas inativas), promoções e cupons não excluídos, modo de descontos, aquisições/custos e cotações de referência. IDs de membros são necessários para identificar as regras; não inclui seus nomes, e-mails ou avatares. Não exporta pedidos, endereços, carrinhos, credenciais, chaves de pagamento ou históricos de pedidos/movimentos. Não restaura dados nem ativa publicação. É um backup de catálogo, não um backup integral do banco.

Pré-requisitos para ativação: validar a SQL em banco isolado, confirmar o contrato e as permissões do projeto de destino, aplicar exclusivamente a função de leitura, testar usuário comum/admin e ausência de arquivos no Storage. A UI exige resposta íntegra do banco e download dos bytes, compara duas leituras do manifesto, inclui SHA-256 de cada foto e aborta se faltar imagem, a sessão mudar ou a leitura não estiver consistente. O arquivo contém dados comerciais confidenciais e deve ser protegido. Limite de 150 MiB do JSON no navegador; acima disso, falha explícita, sem backup parcial. O v1 é aceito apenas para conferência como incompleto. A importação é somente validação, sem escrita. Não executar SQL em produção antes de homologar.

## Conferência de recuperação

A comparação de leitura utiliza o manifesto do catálogo atual, valida os hashes das imagens no arquivo e apresenta somente contagens por seção: ausentes, diferentes, iguais e presentes apenas no destino. Não considera o manifesto atual uma verificação de bytes dos objetos atuais. Não grava, publica, recria ou substitui produtos, promoções, estoque, regras de visibilidade ou arquivos no servidor. Arquivos v1 são rejeitados nesta conferência completa. O catálogo atual e o arquivo permanecem inalterados.

## Triagem de elegibilidade (somente leitura)

A seleção local valida integridade e identifica categorias fora do escopo (cursos, treinamentos, acompanhamento e protocolos digitais), descrições ausentes e itens que aguardam revisão de conteúdo. Nenhum nome de categoria, campo de aprovação do arquivo ou declaração do usuário libera restauração. A revisão não envia conteúdo ao servidor, não cria uma lista autorizada e não efetua escrita. A identificação e aprovação substantiva de itens elegíveis ainda é necessária para um fluxo real de restauração.
