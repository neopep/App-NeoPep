# #013 — Validação Windows isolada do Connect

Base: `desenvolvimento/ajuste-013-continuacao@088ee45`, PR #57. Esta branch `desenvolvimento/ajuste-013-windows-qa` contém apenas a preparação da validação Windows, sem alterar o código de despacho aprovado localmente.

## Objetivo

Reutilizar a rotina preexistente `.github/workflows/neopep-connect.yml` para rodar **em um runner efêmero Windows 2022**, perfil **Teste**, versão candidata **0.2.8**, sem autenticação Supabase/WhatsApp e sem ativar o worker. Este pacote de CI testa:

- Node 24.22.1 verificado, dependências com `npm ci --ignore-scripts`, testes e auditoria;
- compilação WinForms .NET Framework e geração de instalador x64;
- contrato de atualização, autenticidade e testes de interface de campanha;
- regressão de instalação/atualização/reversibilidade dos cofres com fixtures, sem dispositivos reais;
- manifesto e SHA-256 do instalador, execução breve em processo efêmero e desinstalação de fixture.

A execução da rotina pela plataforma GitHub Actions NÃO implica instalação no computador do proprietário, deploy Vercel, atualização automática de clientes, homologação de sessão WhatsApp, envio real ou publicação em Produção. O upload da candidata continua desabilitado para esta branch, e a opção `git.deploymentEnabled` do Vercel é explicitamente false.

## Gates posteriores

1. Confirmar resultado do workflow Windows para esta branch e comparar SHA de checkout; se houver falhas, corrigi-las nesta branch.
2. Validar executável e sessão num Windows real e autorizado, primeiro offline e com as duas flags servidor false e `NEO_CONNECT_CAMPAIGN_WORKER` ausente.
3. Nenhuma tentativa real de envio sem autorização explícita e testes controlados.

A migração `campaign_dispatch` está instalada SOMENTE no Supabase Teste, com `whatsapp_enabled=false` e `app_enabled=false`; sem necessidade de novo SQL para esta rotina de compilação.

## Resultado da execução inicial — GitHub Actions

- Workflow `NeoPep Connect Windows`, run **45471485884**, URL https://github.com/neopep/App-NeoPep/actions/runs/45471485884, checkout **`ff8a4eb4ed9c4dec295735c34862a22f7904ae91`**.
- Resultado da job `windows`: **success**. Passaram checkout, Node fixado, broker, dependências/auditoria/testes Bridge, autenticidade do pacote, compilação Windows x64, contrato Turnstile, prévia e rascunho protegido, SHA-256, instalação e atualização de versões anteriores, preservação do cofre, inicialização curta e desinstalação de fixture.
- Instalador gerado no runner teve SHA-256 **`6a39c0af321a1231940cadb16455810d65a835f9447ab9ca747d2307fa3abe34`**, e **`Authenticode NotSigned`**. Esse hash identifica o artefato efêmero do teste, **não** uma distribuição assinada ou homologada.
- Versões 0.1.1, 0.1.2, 0.2.6 e 0.2.7: cofre preservado nas atualizações, conforme logs.
- Houve quatro avisos `CS4014` no `WhatsApp.cs` atual (chamadas assíncronas sem `await`) e avisos preexistentes em baselines; build foi aprovado, mas os avisos merecem revisão antes de publicação.
- Nenhum artefato de instalador foi enviado ao GitHub: passo `upload-artifact` intencionalmente **skipped** (repositório público, candidato não assinado). Sem emissão de instalador distribuível, atualização automática, instalação em PC do proprietário, sessão WhatsApp real ou envio real.
- **Ainda pendente**: decidir versão e assinatura do instalador para release, compilar/instalar/validar no Windows real, verificar compatibilidade com sessão WhatsApp autorizada, homologação e autorização de ativação. Server gates permanecem desativados.
