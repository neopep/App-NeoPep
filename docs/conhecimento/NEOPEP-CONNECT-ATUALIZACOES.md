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

## Primeiro ensaio com 0.2.2 e 0.2.3

### Preparar os candidatos em uma conta Windows de assinatura

Use Windows x64, Windows PowerShell 5.1, Git, .NET Framework 4.8 e Node.js oficial 24.22.1 x64. Examine o commit revisado e mantenha o checkout limpo. Em `connect\whatsapp-lab`, execute `npm ci --omit=dev --ignore-scripts` e `npm test`. Se o responsável ainda não tiver uma chave dedicada, execute uma vez na conta Windows de assinatura:

```powershell
$cert = New-SelfSignedCertificate -Subject 'CN=NeoPep Connect Teste Update Signing' `
  -CertStoreLocation 'Cert:\CurrentUser\My' -Provider 'Microsoft Software Key Storage Provider' `
  -KeyAlgorithm RSA -KeyLength 3072 -KeyExportPolicy NonExportable `
  -KeyUsage DigitalSignature -Type Custom -NotAfter (Get-Date).AddYears(1)
.\connect\windows\prepare-update-trial.ps1 `
  -SigningThumbprint $cert.Thumbprint -Output "$env:LOCALAPPDATA\NeoPep-Connect-Ensaio-01"
```

Se a chave já existir, use a impressão digital do certificado conferida no repositório pessoal de certificados do Windows. A chave privada permanece no provedor CNG e o script escreve apenas a parte pública. A impressão SHA-256 de `publisher-public.xml` identifica a chave incorporada. O script gera dois diretórios, cada um com o EXE, `manifest.json` do empacotamento e `release-manifest.json` assinado. Registre a versão, commit, tamanho, SHA-256 e assinatura de cada candidato. Antes de instalar, compare os hashes com `Get-FileHash -Algorithm SHA256`. O manifesto assina a identidade do pacote; o EXE pode continuar sujeito ao aviso de reputação do Windows.

### Executar depois da aprovação do proprietário

1. Confira que há apenas um computador autorizado no projeto Teste e que a simulação segue pausada. Registre versão instalada, autorização, sessão de login, preferências, vínculo `fixture-principal` e estado da tarefa. Proteja a cópia de recuperação do perfil local na mesma conta Windows. Feche o Connect e instale 0.2.2 por cima da versão atual, sem usar a desinstalação, que remove o cofre. Abra o programa e confirme a sessão e o heartbeat. Em **Atualizações**, clique **Verificar atualizações**. O canal vazio deve responder sem versão disponível.
2. Após aprovação explícita do candidato 0.2.3, envie somente seu EXE ao bucket privado `neo-connect-releases` no caminho `0.2.3/NeoPepConnectSetup.exe`, com MIME `application/octet-stream`. Confira tamanho e SHA-256 do objeto por uma leitura administrativa segura. Em **NeoPep Connect → Atualizações**, cadastre 0.2.3 como rascunho com os campos do `release-manifest.json`. Confirme que o cliente ainda não recebe oferta. Aprove apenas durante o ensaio e deixe a opção de obrigatoriedade desmarcada.
3. No 0.2.2, clique **Verificar atualizações**, **Atualizar agora** e confirme. Verifique o download, a instalação, a abertura do 0.2.3 e o resultado administrativo. O evento `download_requested` indica uma solicitação, e download concluído no Windows é a evidência de que o bucket entregou o objeto por URL assinada. Registre apenas status e resultado, sem copiar a URL assinada. Compare login, autorização, cofre DPAPI, preferências e sessão experimental antes e depois. Bloqueie a versão ao encerrar a janela.
4. Faça os cenários negativos em uma máquina isolada, restaurando o snapshot 0.2.2 entre eles. Para revogação, pause o cliente com o depurador na revalidação imediatamente após verificar o SHA-256. Bloqueie 0.2.3 no painel e retome o cliente. A instalação deve ser recusada. Para perda de conexão, desconecte a rede durante o download, confirme que 0.2.2 permanece funcional e faça uma nova tentativa ao reconectar. Para testar a recuperação, somente no perfil de ensaio crie um arquivo vazio com o nome do futuro diretório `whatsapp-runtime-0.2.3` antes da instalação. Isso força falha na preparação do runtime. Verifique reinício no 0.2.2 e o resultado de restauração. Remova só o arquivo de teste. Em falha da própria recuperação, preserve o cache `updates` e os cofres para análise.

A aprovação descrita acima é a única etapa que abre o canal do release. No ensaio local ou na CI com chave descartável, mantenha os arquivos fora do bucket e evite anexar o instalador a um release do GitHub.

A CI Windows do commit `295e484` gerou e conferiu os dois manifestos com uma chave descartável, depois removeu a chave e os arquivos temporários. Os EXEs tinham 50.072.576 bytes cada. Os SHA-256 foram `ac04d99f800b3d21e4ada26df2bfbc5db974753bd0023ef66bf981e5f2ec5b30` para 0.2.2 e `bc303573bc598a6358457a0615259e853c8b419df8e53f643ba65d34250f56ab` para 0.2.3. Esses valores identificam a rodada automatizada. Os manifestos e checksums para aprovação correspondem aos binários preparados com a chave do responsável. [CI Windows](https://github.com/neopep/App-NeoPep/actions/runs/44976204731)
