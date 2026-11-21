# Funcionalidades

O inventário descreve o código versionado. Dependências de ativação e verificação estão em [Estado atual](ESTADO-ATUAL.md) e [Pendências](PENDENCIAS.md).

| Área | Implementado no snapshot | Guias de origem |
| --- | --- | --- |
| Acompanhamento | Perfil, registros de peso, medidas, diário, aplicações, fotos, relatórios, backup e calendário. Calculadora de conversão matemática, com limites de uso. | [Início e calculadora](../INICIO-E-CALCULADORA.md) · [Chegada](../CHEGADA-E-GUIA.md) · [Preferências](../PREFERENCIAS-E-AUTORIZACOES.md) |
| Conta | E-mail, confirmação, recuperação, sessão persistente opcional, demonstração separada, exportação e solicitação de exclusão. | [Sessão](../LOGIN-E-SESSAO.md) · [Recuperação](../email/RECUPERACAO-POR-CODIGO.md) · [Confirmação administrativa](../CONFIRMACAO-EMAIL-ADMIN.md) |
| Comunidade | Grupo, mensagens, regras de entrada/publicação, avisos e documentos com acesso controlado. | [Conversa](../COMUNIDADE-CONVERSA.md) · [Lembretes](../COMUNIDADE-E-LEMBRETES.md) · [Avisos](../AVISOS-COMUNIDADE.md) |
| Atendimento | Conversas privadas, fila da equipe, aceite, áudio e anexos. Há modos de assistência por IA com ativação própria. | [Conversas privadas](../CONVERSAS-PRIVADAS.md) · [Conversas ao vivo](../CONVERSAS-AO-VIVO.md) · [Agente](INTELIGENCIA-ARTIFICIAL.md) |
| Biblioteca | Conteúdo editorial, destaques, descoberta, prévias, edição administrativa, vídeos e compartilhamento por link sem credenciais. Anexos privados com visualização e download distintos. | [Organização](../BIBLIOTECA-ORGANIZACAO-E-COMPARTILHAMENTO.md) · [Destaques](../BIBLIOTECA-DESTAQUES.md) · [Edição](../BIBLIOTECA-EDICAO.md) · [Anexos](../ANEXOS-E-DOWNLOAD-BIBLIOTECA.md) · [Vídeos](../VIDEOS-E-NAVEGACAO.md) |
| Administração | Função única de administrador, diretório de membros, indicadores e controles para loja, conteúdo e integrações. | [Administradores](../ADMINISTRADORES.md) · [Membros e destaques](../MEMBROS-DESTAQUES-E-NAVEGACAO.md) · [Configurações](../ADMINISTRACAO-INTEGRACOES-E-IA.md) |
| Loja | Catálogo, galeria, carrinho, pedidos, endereços, entrega, promoções e pagamento preparado. | [Monetização](MONETIZACAO.md) |

## Composição Antes e Depois no NeoPep Teste

O botão **Comparar e compartilhar** em Início, Evolução e Fotos abre a composição com as seleções atuais. O modal prepara o JPEG no aparelho em formato 9:16 e exibe o arquivo que será salvo ou compartilhado. O compartilhamento usa arquivos nativos quando o navegador oferece esse recurso. O botão **Salvar imagem** usa o download local.

A composição com fotos reais usa os originais das duas seleções da conta autenticada no bucket privado. A exportação exige dois dias distintos. Exemplos e seleções do mesmo dia podem ser visualizados, com exportação indisponível. O arquivo leva a marca NeoPep incorporada e a composição é descartada ao fechar o modal ou mudar de conta. A opção Premium permanece indisponível até existir autorização verificável no backend.

A composição usa a tipografia do aplicativo, com a marca translúcida sobre a base das fotografias. O painel **Evolução do Peso** usa os registros da conta no intervalo, inclusive nos dias das duas fotos, e respeita a unidade configurada. Com menos de dois dias com registros válidos, o painel informa que os dados são insuficientes.

A comparação mostra a variação de peso nas três telas. Duas pesagens nas datas exatas determinam a diferença entre Depois e Antes. Quando faltar uma delas, o indicador usa a variação total da jornada e o gráfico usa o histórico correspondente. Se o total partir de um peso inicial do perfil diferente da primeira pesagem, o gráfico o identifica como referência. Exemplos e registros insuficientes exibem um estado informativo. O modal congela a seleção, a variação e o gráfico ao abrir. A marca-d'água é obrigatória e a composição não apresenta controles de assinatura.
