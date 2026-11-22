# Atualizações do NeoPep Connect

O candidato 0.2.2 implementa um canal de atualização estável exclusivo de Teste. O perfil Produção mantém comunicação e instalação interna bloqueadas. Em Atualizações, a preferência de notificações e o intervalo de 15 a 1.440 minutos ficam no perfil local. A verificação acontece após o primeiro heartbeat e periodicamente. O usuário pode consultar, adiar ou confirmar. Uma versão obrigatória recebe destaque e continua exigindo confirmação.

## Distribuição e confiança

A migração `20261122015846` reaproveita `neo_private.connect_releases` e o bucket privado `neo-connect-releases`. Releases anteriores ficam com estado legado e continuam disponíveis apenas para o fluxo administrativo manual anterior. A consulta do computador aceita uma sessão do proprietário e a prova do dispositivo aprovado, sem privilégio administrativo no novo RPC. A função Edge `connect-update` autentica o usuário, chama o RPC e só assina a URL privada após autorização. Ela recusa execução fora do projeto `qnuluspqfazdppciermw`. O cliente limita HTTPS ao host do projeto, sem seguir redirecionamentos.

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
