# NeoPep Connect — canal privado de candidatos Windows (homologação)

## Situação auditada em 22/11/2026

- Repositório de código `neopep/App-NeoPep`: **público**. Artefatos do GitHub Actions deste repositório **não** devem ser tratados como privados.
- Bucket Supabase de teste `neo-connect-releases`: já existe, **privado**, MIME permitido `application/octet-stream` ou `application/vnd.microsoft.portable-executable`, limite 52.428.800 bytes por arquivo.
- Não existem objetos no bucket, releases cadastrados ou versões aprovadas.
- O sistema `connect-update` só oferece atualizações de versões aprovadas depois de autenticação e autorização do computador.
- Fluxo administrativo usa `public.neo_connect_update_admin`; uma assinatura RSA de manifesto **não substitui Authenticode**.
- A execução de ensaio do workflow `neopep-connect-trial-pair.yml` passou ao gerar e validar 0.2.2 e 0.2.3. Os instaladores temporários **não foram anexados** porque o repositório é público.
- A chave RSA temporária é descartada no runner. O par 0.2.2 → 0.2.3 assinado na mesma execução é válido para um único ensaio, mas não permite assinar versões posteriores.

## O que já está pronto: recebimento e downloads privados

O bucket `neo-connect-releases` já é o canal privado adequado. Não criar outro bucket. O objeto futuro, depois de revisado, deve ocupar somente `0.2.3/NeoPepConnectSetup.exe`. O registro correspondente deve permanecer em `draft` até o proprietário aprovar o teste.

A Edge Function `connect-update` oferece URL de download temporária somente depois da aprovação e verificação de dispositivo autenticado. O bucket não concede upload aos clientes Windows.

Nunca colocar chaves `sb_secret_` ou `service_role` em aplicativos, GitHub Actions de repositórios públicos, logs ou artefatos. Não abrir escrita geral no bucket nem permitir upload anônimo.

## Pré-requisito: uma origem PRIVADA para os binários gerados

**Ação manual do proprietário no navegador:** criar um novo repositório GitHub com visibilidade **Private** (por exemplo `neopep/NeoPep-Connect-Build-Privado`). Manter o `neopep/App-NeoPep` público. O novo repositório pode ser inicializado com uma importação/mirror do código do PR de homologação; verificar que o workflow `.github/workflows/neopep-connect-trial-pair.yml` está incluído e que a branch `desenvolvimento/connect-cloud-trial-ci` existe. Não alterar a visibilidade do repositório principal sem analisar impactos no deploy.

O workflow foi construído para:
- executar em Windows Server 2022;
- criar uma chave RSA CNG não exportável e descartável;
- compilar 0.2.2 e 0.2.3 com a mesma chave pública incorporada;
- assinar e conferir manifestos de cada versão, checando SHA-256, tamanho, perfil, commit e versão;
- **anexar os candidatos somente quando `github.event.repository.private` for verdadeiro**;
- não autorizar versões, não criar objetos no Supabase e não tocar produção.

Revisar acesso ao repositório privado (membros, permissões, ações de terceiros) antes de iniciar o workflow. Evitar permitir execução de código de PR não confiável com segredos. Retenção do artefato de ensaio: três dias. Se usar outra branch no repositório privado, ajustar o filtro de branch **somente em revisão separada**, nunca remover a trava de privacidade.

## Passos do ensaio (somente com autorização posterior)

1. No repositório privado, executar o workflow e conferir o resultado. Baixar apenas os arquivos do artefato privado, verificando o `manifest.json`, `release-manifest.json` e o fingerprint da chave pública.
2. Guardar backup do cofre DPAPI da conta Windows de teste. Instalar manualmente o candidato 0.2.2 **por cima** do cliente já autorizado; não desinstalar a versão anterior.
3. Testar login, heartbeat, autorização e ausência de atualizações com o bucket vazio.
4. Com autorização explícita, enviar somente **0.2.3** para o bucket privado de Teste e validar o hash e tamanho do objeto armazenado. O envio por navegador administrativo do Supabase é possível se autorizado pelo proprietário; para automação de upload, construir um emissor restrito de credenciais temporárias ou usar identidade federada com escopo específico, nunca expor o service role em workflow público.
5. Registrar o release no painel como `draft`; confirmar que não aparece para o cliente. Aprovar somente para uma janela curta do ensaio, sem marcar obrigatório.
6. Atualizar 0.2.2 → 0.2.3 no Windows, conferir reinício, sessão, DPAPI e desfecho. **Bloquear** o release ao final.
7. Realizar cenários negativos em máquina/perfil isolado; nunca usar a máquina de trabalho principal para testar corrupção/recovery forçado.

## Limitação crítica da chave temporária

Quando a chave efêmera da execução for descartada, **não será possível assinar a versão 0.2.4 com a mesma identidade**. Para atualizações sucessivas em nuvem, escolher antes da distribuição uma autoridade persistente de assinatura, protegida por KMS/HSM ou serviço de assinatura com acesso controlado e trilha de auditoria. Rotação de chave exige transição validada; não confundir assinatura de manifesto com Authenticode.

## Condições para avançar

- Repositório **privado** para os binários ou outro transporte comprovadamente privado.
- Manifestos e hashes exatos vinculados à **mesma execução** do workflow.
- Cliente 0.2.2 com chave pública correspondente ao manifesto 0.2.3.
- Supabase de Teste com **zero versões aprovadas** até autorização do ensaio.
- Produção, envios WhatsApp reais e branch `main` permanecem inalterados.
