# Atualizações do NeoPep Connect

O candidato 0.2.2 implementa um canal de atualização estável exclusivo de Teste. O perfil Produção mantém comunicação e instalação interna bloqueadas. Em Atualizações, a preferência de notificações e o intervalo de 15 a 1.440 minutos ficam no perfil local. A verificação acontece após o primeiro heartbeat e periodicamente. O usuário pode consultar, adiar ou confirmar. Uma versão obrigatória recebe destaque e continua exigindo confirmação.

## Distribuição e confiança

A migração `20261122022149` reaproveita `neo_private.connect_releases` e o bucket privado `neo-connect-releases`. Releases anteriores ficam com estado legado e continuam disponíveis apenas para o fluxo administrativo manual anterior. A consulta do computador aceita uma sessão do proprietário e a prova do dispositivo aprovado, sem privilégio administrativo no novo RPC. A função Edge `connect-update` autentica o usuário, chama o RPC e só assina a URL privada após autorização. Ela recusa execução fora do projeto `qnuluspqfazdppciermw`. O cliente limita HTTPS ao host do projeto, sem seguir redirecionamentos.

O manifesto assinado usa UTF-8 sem BOM, LF entre as linhas e nenhuma quebra depois da última linha:

```text
neopep-connect/v1
<versão>
staging
stable
<bytes base 10>
<sha256 em minúsculas>
<identificador do artefato>
```

Assine fora do repositório com RSA PKCS#1 v1.5 e SHA-256, mínimo de 2.048 bits. Entregue apenas a assinatura Base64 e a chave pública pela via de aprovação. Em um empacotamento autorizado, use `build.ps1 -Perfil Teste -PublisherPublicKey <RSA-public.xml>` com um arquivo contendo somente `Modulus` e `Exponent`. O candidato padrão da CI não recebe chave confiável e recusa instalações automáticas. O teste criptográfico gera sua própria chave descartável em memória. O canal rejeita instalação igual ou anterior, de outro perfil ou com arquivo ou assinatura incompatível.

## Aprovação e primeiro ensaio

Valide primeiro o candidato manual no Windows, sem desinstalar a versão anterior. Para um ensaio de atualização controlada, obtenha autorização para instalar a migração e implantar a função Edge no projeto Teste, depois instale um cliente inicial com a chave pública validada. Prepare uma segunda versão superior, confira arquivo, manifesto e assinatura e faça upload do EXE no bucket privado em `<versão>/NeoPepConnectSetup.exe`. No painel Connect, cadastre o rascunho, confira os dados e aprove somente o pacote revisado. Bloquear retira a versão das próximas consultas e da autorização final do auxiliar. Artefatos GitHub Actions são apenas insumos do ensaio.

O cliente baixa, mostra o progresso e verifica os bytes antes de entregar o controle ao auxiliar. Uma tarefa em andamento ou janela WhatsApp aberta bloqueia a passagem. O auxiliar aguarda a saída do cliente e confere novamente a aprovação remota, assinatura e hash antes de chamar o instalador. O ticket transitório é protegido por DPAPI e removido após o uso. O cofre de Supabase, a sessão do WhatsApp e as preferências permanecem no perfil. O auxiliar guarda cópias dos executáveis anteriores, tenta restaurá-los em caso de falha e registra o desfecho para a próxima sessão reportar. Os runtimes têm diretórios versionados para permitir recuperação. A verificação de reinício observa também se o novo processo continua aberto.

O painel registra status de distribuição, versões instaladas via heartbeat e desfechos reportados. Para o primeiro teste, confira também o arquivo de sessão DPAPI, a autorização do computador, a identidade fictícia, a sessão WhatsApp, a retomada e o desfecho após perda de rede ou falha do instalador. A migração, o Edge e as aprovações ficam pendentes até revisão da homologação.

## Plano de implantação em homologação

1. Após autorização explícita, confirmar a referência `qnuluspqfazdppciermw`, guardar as definições das funções e ACL existentes e verificar a disponibilidade de um ponto de recuperação. Confirmar o bucket privado de 50 MiB e registrar o estado dos dispositivos, versões e fila simulada por contagens.
2. Aplicar `20261122022149_neopep_connect_updates.sql` em transação. O fluxo manual mantém os releases legados. Validar RLS, permissões, negativa para sessão anônima, dispositivo errado ou revogado e acesso administrativo. Preservar as filas e as aprovações dos computadores existentes.
3. Implantar `connect-update` apenas no projeto Teste. Verificar JWT e RPC com uma conta fictícia; testar a URL Storage assinada de 90 segundos em um objeto de ensaio. Antes do ensaio, manter todas as versões novas em rascunho. O bloqueio impede novas autorizações e a instalação mesmo após o download. URLs emitidas podem durar até expirar.
4. O responsável pela assinatura valida a impressão digital da chave pública em canal separado. Incorporar essa chave ao primeiro instalador Teste, instalado manualmente. Assinar o manifesto de uma versão posterior com a mesma autoridade, conferir bytes e SHA-256, publicar o objeto privado e aprovar apenas durante a janela do ensaio. Nenhum artefato da CI é aprovado automaticamente.
5. Em Windows 10 e 11 x64, testar instalação e reinício do aplicativo após confirmação, reboot, perda de rede e retomada por nova tentativa, adulteração, bloqueio após o download, perfil incorreto e falha do instalador. Comparar antes e depois a autorização, login, preferências, cofre DPAPI, sessão experimental e fila simulada. Confirmar estado local e registros no painel. Bloquear o release ao terminar. Em falha, conservar o cache de recuperação e desativar o broker se necessário. Restaurar as ACL e funções documentadas mediante autorização separada, preservando a auditoria.

## Histórico, diagnóstico e rotação

O painel registra solicitação de download e os resultados reportados, incluindo instalação, falha e restauração. Uma solicitação não comprova a conclusão do download. O cliente mantém os últimos cinco resultados no cofre local. Se a restauração falhar, os executáveis de recuperação permanecem em `updates` dentro do perfil Teste. Conservar o cofre DPAPI e validar o instalador de recuperação com a versão e o hash conhecidos antes de reinstalar.

Para rodar uma chave, preparar um cliente com a nova chave pública e assinar o manifesto desse instalador com a chave antiga ainda confiável. Migrar e confirmar os computadores primeiro, mantendo o release ponte disponível aos clientes antigos durante a transição. Só então aprovar versões assinadas pela nova chave. Como o cliente seleciona a última versão aprovada, concluir a transição antes de aprovar a primeira versão com a nova assinatura. Em suspeita de comprometimento, bloquear o canal e reinstalar manualmente um cliente com a nova chave verificada em canal independente. Manter a chave privada fora do repositório, da CI e dos instaladores. A chave de assinatura e a chave publicável do Supabase têm funções distintas.

## Estado implantado no Supabase Teste

O SQL do arquivo `20261122015846_neopep_connect_updates.sql` foi aplicado em `qnuluspqfazdppciermw`. A ferramenta Supabase registrou a versão remota `20261122022149` com o nome `neopep_connect_updates`. O conteúdo registrado foi conferido byte a byte, desconsiderando a quebra de linha final. O arquivo no Git foi renomeado para `20261122022149_neopep_connect_updates.sql`, sem executar SQL no banco. A Edge `connect-update` está ativa na versão 1, com verificação de JWT no gateway.

A distribuição segue vazia, com zero releases, zero objetos no bucket privado e zero eventos persistidos. Os testes de RPC usaram dispositivos e release bloqueado fictícios em transação revertida. O acesso HTTP à Edge sem JWT ou com JWT inválido retornou 401. A tentativa anônima pelo endpoint público do Storage retornou 400 e não entregou conteúdo. O formato de URL assinada foi validado por teste automatizado. A emissão real pelo broker depende do ensaio autorizado com release assinado e aprovado especificamente para aquele teste.

O dispositivo já autorizado continuou enviando heartbeat com o cliente 0.1.1 e a sessão vinculada a `fixture-principal`. A simulação permaneceu pausada, com a tarefa anterior em estado `simulated`. O ensaio em Windows 10/11, a autenticação positiva da Edge com o cliente atualizador e a emissão de URL real continuam pendentes.
