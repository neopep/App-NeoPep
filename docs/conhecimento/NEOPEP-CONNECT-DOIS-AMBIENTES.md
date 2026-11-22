# NeoPep Connect Windows em dois ambientes

O candidato 0.2.7 usa uma instalação e abre duas janelas, **TESTE** e **PRODUÇÃO**. Ao iniciar em segundo plano, abra o ambiente desejado pela bandeja. Cada janela tem login, aprovação de dispositivo, perfis de WhatsApp, campanhas, histórico e consulta de atualização próprios. O comando Sair desta conta encerra a sessão NeoPep daquela janela. Para desvincular WhatsApp, use Desconectar WhatsApp na mesma janela.

## Armazenamento e recuperação

- Teste mantém a instalação e o cofre DPAPI existentes in situ. A primeira autenticação vincula o estado legado à conta Teste. Outras contas usam uma pasta própria.
- Produção usa `profiles/production` e os dados WhatsApp ficam em `accounts/<id>` sob esse perfil. DPAPI usa contexto distinto em Produção e nos novos cofres WhatsApp por conta. O runtime é comum, e cada janela WhatsApp inicia seu próprio processo.
- O instalador preserva os cofres ao atualizar ou remover o programa. O caminho legado mantém a compatibilidade com o atualizador anterior. Quando a reinstalação for necessária, use um artefato confiável. O auxiliar cria backup do EXE e do setup antes da troca e restaura ambos em falha. Separe e preserve os diretórios dos dois ambientes durante qualquer recuperação.
- O auxiliar baixa e reautoriza usando o perfil que iniciou a atualização. Exige manifesto do ambiente correspondente, assinatura RSA confiável, origem exata e SHA-256. Reinicia as duas janelas ao instalar. O manifesto de build de homologação identifica `staging` como canal de entrega do candidato, com os dois perfis compilados. Aprovação, registro e auditoria são do projeto que distribui a versão.

## Homologação controlada

1. Verificar o SHA-256, o status Authenticode do setup e a chave pública incorporada. O workflow público produz um candidato interno de CI e informa o hash. A assinatura e a entrega privada oficiais dependem do assinador do Windows.
2. Atualizar uma instalação 0.2.6 Teste. Conferir login, registro aprovado, rascunhos locais, QR, reconexão e grupos. Abrir Produção e confirmar que começa vazia.
3. Entrar em cada ambiente com contas explicitamente autorizadas. Usar dois vínculos WhatsApp e comparar as listas e os grupos sincronizados no painel de cada projeto. Desconectar ou sair de um lado e confirmar que o outro mantém a sessão.
4. Ensaiar checagem de atualização, assinatura, revogação após o download e recuperação com manifestos de fixture. Conferir isolamento do histórico e recusa de manifesto ou URL do outro ambiente.
5. Conferir falhas de rede e reconexão com os dois perfis abertos. Produção exige ação explícita para conectar o WhatsApp. O envio e o consumo automático de filas oficiais permanecem bloqueados até ensaio controlado e aprovação específica. A simulação e o envio manual já existentes continuam restritos à janela Teste.

Nenhum ajuste de banco ou de aplicação web acompanha o PR. [Issue #27](https://github.com/neopep/App-NeoPep/issues/27)
