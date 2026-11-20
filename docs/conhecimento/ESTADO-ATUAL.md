# Estado atual

Referência de código: `8cf6bc7aac6711ea3b952d62ddaab0b59b577bd1`, consultado em 20/11/2026. [Exportação segura](../EXPORT.md)

| Evidência | Classificação |
| --- | --- |
| Uma aplicação estática em `dist/`. O pacote de prévia copia o mesmo conteúdo para `/neo/`. | Implementado |
| Configuração do navegador exige CAPTCHA, mantém cadastro de prévia, bloqueia cadastro público e declara `cloudValidated: false`. | Implementado como configuração do snapshot. O ambiente remoto segue não verificado nesta revisão. |
| Verificação pública limitada do Supabase registrou Auth acessível, objetos no catálogo e recusa anônima após instalação, além de rejeição de login sem token CAPTCHA. | Confirmado na infraestrutura à época, com alcance parcial. A persistência de uma conta foi relatada pelo responsável, e a segunda encontrou limite de e-mail. [Registro da conexão](../CONEXAO-SUPABASE.md) |
| App iOS/Android | Planejado. Existem guia e configuração de exemplo do Capacitor. [Preparação mobile](../../mobile/README.md) |
| Hospedagem, domínio, funções instaladas e prontidão de lançamento | Não verificados remotamente nesta revisão. [Evidências de release](../../release/web-readiness.json) |

## Divergências entre fases

- A auditoria e a primeira validação descrevem o Elo preservado na raiz e uma prévia separada. A consolidação e o snapshot atual mostram NeoPeptídeos como única aplicação e `/neo/` como compatibilidade. A cópia estática do Elo em `/elo/` está descontinuada. [Auditoria](../AUDITORIA.md) · [Validação histórica](../VALIDACAO.md) · [Consolidação](../CONSOLIDACAO.md)
- O manifesto de hospedagem aponta para `dist/`. A referência técnica antiga e o domínio citado como publicação no guia Vercel correspondem a relatos de fases distintas. As rotas e os cabeçalhos de Vercel estão versionados, e o guia trata a migração como futura. A audiência e os domínios ativos requerem evidência independente. [Troca de endereço](../TROCA-ENDERECO.md) · [Vercel](../VERCEL.md) · [Manifesto](../../.openai/hosting.json)
- Os relatos de testes antigos registram suítes menores. A suíte atual tem cobertura e falhas diferentes. [Testes](TESTES.md)
