# NeoPep Connect 0.2.21 — diagnóstico de grupo independente

Base: candidata 0.2.20 a7f927997ed7a1271a2f30e06b3522627fe027d0.
Em 27/11, o Mundo Pep recebeu nova rejeição 421 às 18:36:44. A tela não mostrou o diagnóstico esperado. Não se comprovou a causa do 421.

## Escopo
- Aba Grupos: selecione uma linha e clique em Diagnosticar grupo, ou escolha o grupo diretamente na aba Diagnóstico.
- Executar diagnóstico completo consulta lista geral e metadados individuais, sem enviar texto, imagem ou arquivo.
- Compara modo, contagens e conjunto dos participantes em memória, informa PN/LID/outros, função, permissões e fase de eventual falha.
- Histórico por grupo, limitado aos últimos 12 registros e à sessão local da janela; não sobrescreve com outros grupos. Uma nova sessão/limpeza de grupos não recupera o histórico anterior.
- Registra início da tentativa, identificador gerado (não é confirmação), retorno do servidor, entrega ou rejeição. Sem reenvios automáticos.
- Nenhum identificador individual, chave ou conteúdo é registrado no diagnóstico. Não valida a criptografia de entrega sem envio; mostra explicitamente não verificada.
- Não altera permissões, não apaga chaves ou sessão, não troca Baileys, não altera pagamentos, banco ou PWA nesta candidata.

## Homologação
A esteira privada executa npm test, auditoria, compilação e teste do instalador. Distribuição por agente e aprovação são etapas separadas.
Antes de instalar 0.2.21, ampliar exclusivamente as allowlists existentes de versão de campanha para incluir 0.2.21, preservando 0.2.20 e demais controles, nos dois ambientes. Ver script deste diretório; aplicar somente no momento de liberar a atualização, após validar candidato.
Depois da instalação, diagnosticar Mundo Pep e Teste sem enviar mensagens. Não realizar nova publicação ao Mundo Pep até analisar ambos os resultados.
