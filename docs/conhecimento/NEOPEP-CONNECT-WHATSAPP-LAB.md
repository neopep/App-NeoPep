# NeoPep Connect — fase 2.1: laboratório QR (sem envios)

**Estado:** protótipo em branch de desenvolvimento. **Não faz parte do executável NeoPep Connect Windows 0.1.1** já instalado, não foi distribuído e não está liberado para contas reais de produção.

## Objetivo e limites

A fase 2.1 cria um adaptador de leitura por QR Code na modalidade de dispositivo vinculado, verifica estado da conexão e consulta exclusivamente os grupos dos quais a conta participa.

- NÃO envia texto, arquivos, mensagens nem campanhas.
- NÃO processa conversas, fotos, contatos ou mensagens recebidas.
- NÃO transmite os identificadores de grupos, nomes, chaves do WhatsApp ou credenciais para o Supabase.
- NÃO altera a fila de simulação e não modifica o aplicativo Windows instalado.
- Usa Node.js 22+ somente no computador de laboratório e biblioteca não oficial Baileys 7.0.0-rc14.

## Proteções locais

- Serviço HTTP vinculado somente a 127.0.0.1 e uma porta aleatória.
- URL do navegador com segredo aleatório no fragmento (não enviado ao servidor). As rotas privadas exigem header Bearer e as operações exigem Origin local.
- QR Code fica somente na interface local e na memória; jamais é escrito no log ou exportado.
- Consulta de grupos devolve somente ID, nome e contagem agregada. Não existe rota para enviar mensagens.
- Sessão armazenada no perfil local, em LOCALAPPDATA/NeoPep Connect/whatsapp-lab-auth.
- IMPORTANTE: nesta prova de conceito a sessão utiliza o formato de arquivos do Baileys, que ainda NÃO possui proteção adicional DPAPI. Distribuição e utilização com contas reais exigem revisão de proteção de credenciais.
- A função de desconectar apaga explicitamente os arquivos de sessão do laboratório.

## Opções técnicas examinadas

A API oficial de Grupos da Meta exige uma Official Business Account (OBA), limita grupos a oito participantes e exclui números comuns do WhatsApp Business App. Documentação: https://developers.facebook.com/documentation/business-messaging/whatsapp/groups.

O QR Code via Baileys é uma integração não oficial, sujeita a alterações técnicas e às restrições dos termos do WhatsApp. Documentação: https://github.com/WhiskeySockets/docs/blob/main/quickstart.mdx e https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App.

## Pendências obrigatórias antes de um teste REAL no Windows

1. Gerar, auditar e versionar o package-lock.json reprodutível para as dependências pinadas; bloquear distribuições sem lock.
2. Revisar a compatibilidade e testes de pareamento com versão específica de Baileys e Node.js em um Windows limpo.
3. Definir armazenamento cifrado com DPAPI ou proteção equivalente, revisar ACLs, rotação, logout e revogação.
4. Preparar empacotamento e instalador assinado/verificado que inclua o runtime e o bridge, com atualização segura.
5. Adicionar uma tela no NeoPep Connect Windows com Conectar, QR, Conectado, Desconectar e Grupos; não deixar um terminal como interface final.
6. Confirmar que a conta de teste é membro dos grupos consultados e que não há captura ou sincronização de membros/conversas.
7. Implementar um cadastro de permissões por grupo, com confirmação explícita do administrador.
8. Fazer homologação com número e grupo próprios de TESTE, não com números comerciais críticos.
9. Manter qualquer envio futuro em um módulo SEPARADO, desligado por padrão, com confirmação humana, deduplicação e auditoria de estado incerto.
10. Preservar a produção e o programa Windows 0.1.1 validados.

## Validação técnica local por um desenvolvedor

Depois de gerar o lockfile revisado e instalar dependências com npm ci, ativar explicitamente NEOPEP_WHATSAPP_LAB_ENABLE=1 e iniciar node server.mjs dentro da pasta connect/whatsapp-lab.

No Windows PowerShell: definir NEOPEP_WHATSAPP_LAB_ENABLE como 1, e executar node server.mjs.

O aplicativo abre um navegador local. NÃO executar com credenciais de um número importante. O teste automatizado sem WhatsApp real está em tests/whatsapp-lab.test.cjs na raiz do repositório.

## Critério de aceite

Conseguir exibir e renovar QR de uma conta dedicada; reconhecer autenticação, desconexão e revogação; mostrar apenas IDs locais, nomes e contagem dos grupos da própria conta; nunca divulgar a sessão, conteúdos privados ou enviar mensagens; passar por avaliação de segurança e possuir um instalador Windows próprio.
