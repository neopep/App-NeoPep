# Histórico de alterações

## Cronologia recuperada

| Evidência temporal | Acontecimento | Classificação e fonte |
| --- | --- | --- |
| Até a auditoria de 12/11/2026 | Elo era um app estático privado de registros locais na chave `elo-v1`. A auditoria descreve pesos, medidas, aplicações e configurações, sem conta própria ou banco. | Histórico. O commit `ecce8791b78b531f175e6f7cc34cae14b65f1acf` é citado, com objeto ausente neste checkout. [Auditoria](../AUDITORIA.md) |
| 12/11/2026 | A transição acrescentou PWA, temas, perfil, fotos, relatórios e preparação Supabase. A primeira prévia validou regras e preservação. A consolidação documentou a retirada do pacote antigo e o mesmo NeoPeptídeos na raiz e em `/neo/`. | Histórico. [Validação](../VALIDACAO.md) · [Consolidação](../CONSOLIDACAO.md) |
| Prefixos de 12 a 16/11/2026 | A sequência SQL passa por multiusuário, comunidade, push, atendimento, biblioteca, administração, loja, agente, pagamentos, frete e ajustes de identidade e mídia. | Implementado no acervo versionado. As datas dos prefixos não comprovam implantação. [Banco de dados](../conhecimento/BANCO-DE-DADOS.md) |
| Sem data explícita no relato | SQL aplicado pelo responsável corrigiu a ausência das tabelas no schema cache. Houve recusa de acesso anônimo e CAPTCHA exigido, além de relato de persistência em uma conta e limite de e-mail na segunda. | Histórico com verificação remota limitada. [Conexão](../CONEXAO-SUPABASE.md) |
| 19/11/2026, data Git registrada | Inicialização segura (`1ba8375`) e exportação completa (`8cf6bc7`). O relatório cita a fonte `cefd8e81bbaab2b246942be79c40edc00cd3f890`, cujo objeto não está no histórico acessível, e registra correção de avatar. | Histórico. [Exportação](../EXPORT.md) |
| Após a exportação, conforme os pais Git | `4e7e2da` em `teste-integracao-colaborador` acrescenta um arquivo de teste. `8166fe4` em `teste-codex-cloud` registra leitura, checagem e escrita controlada em branch separada. | Histórico. Commits observados no Git. |

A ordem entre fatos de fontes diferentes só foi estabelecida quando os registros a sustentam. O [índice de origem](../estudo-original/INDICE.md) preserva os relatos de módulos.

## MEM-20261120-001

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo e solicitação | Solicitação original, trecho do objetivo: “Implementar uma base de conhecimento permanente, centralizada, versionada e evolutiva dentro do repositório neopep/App-NeoPep.” A entrega é exclusivamente documental. |
| Contexto anterior | Guias distribuídos por módulo e etapas. O histórico Git acessível começa na exportação segura. |
| Decisão e justificativa | Centralizar orientação atual, evidências, decisões e protocolos em Markdown e preservar os documentos legados, para manter contexto auditável entre ferramentas. |
| Arquivos modificados | Quatro entradas de agente na raiz e em `.github/`, além dos arquivos novos em `docs/conhecimento/`, `docs/memoria/`, `docs/processos/` e `docs/estudo-original/`. |
| Funcionalidades e banco | Entrega de documentação. Escopo funcional e de esquema vazio. |
| Dependências | Repositório existente, guias legados e histórico acessível. Nenhuma dependência de execução adicionada. |
| Testes e resultados | Checagem de links relativos e cobertura do índice, revisão do diff, `npm run check` aprovado e `npm test` com 229/296 aprovados. |
| Erros e soluções | A suíte repetiu os mesmos 67 casos com falha da base do onboarding, com falhas que incluem objetos e papéis ausentes no banco emulado. As falhas foram registradas para investigação separada. |
| Limitações e pendências | Estudo integral indisponível, objetos Git históricos ausentes e infraestrutura do aplicativo sem inspeção nesta entrega. [Pendências](../conhecimento/PENDENCIAS.md) |
| Reversão | Reverter apenas o commit documental com `git revert` em branch de trabalho e revisar referências de entregas posteriores. |
| Identificação Git | Branch `docs/memoria-permanente`, base `8cf6bc7aac6711ea3b952d62ddaab0b59b577bd1`. Localize o commit deste registro com `git log --all --oneline --grep=MEM-20261120-001`. |
