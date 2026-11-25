# Candidata do ciclo 25/11/2026

A candidata parte de `fc0ae22` e integra a revisão homologada `13d6346`. Usa o build oficial e mantém os arquivos Edge oficiais, o contrato de checkout e a prévia de notificações privadas. O código Windows, sua cadeia de confiança e seus testes permanecem na revisão oficial enquanto o port das mudanças de homologação é verificado.

## Banco

- Cadastros: `signup_notice_reads`, `signup_notice_rollout` e `neo_admin_signups` já existem. O lote histórico 01 é um artefato de ensaio anterior e fica fora deste ciclo. O preflight atual verifica presença, mantendo a proteção contra colisões no renderizador anterior.
- Os três arquivos versionados de personalização, prévias de atendimento e ordenação da Biblioteca são independentes da conciliação de pedidos.
- A fundação de custos vem do commit `dac605d4a2a5bf9a587cf09aea4041bdb1e01c14` da PR #50. O editor e o dashboard usam as fontes homologadas. A conciliação 010.06 cria gatilhos síncronos em produtos, pedidos e pagamentos. A homologação do catálogo e de criação de objetos, por si só, não comprova que esses gatilhos preservam as gravações financeiras oficiais. A gestão em massa depende dessa conciliação.
- A Central e o despacho rico ainda dependem da política oficial de emissão de JWT, destinos, autorização e distribuição Windows. Os arquivos SQL de Teste não são elegíveis para execução direta em Produção.
