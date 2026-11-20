# Lições aprendidas

- Relatórios datados preservam contexto, inclusive quando descrevem uma publicação que depois mudou. Compare o relato com o snapshot e mantenha o estado atual no índice. [Estado atual](../conhecimento/ESTADO-ATUAL.md)
- Uma gravação confirmada pode ser seguida de falha na releitura. Mantenha o identificador de reenvio e comunique os resultados separadamente para evitar duplicação. [Acabamento funcional](../ACABAMENTO-FUNCIONAL.md)
- A troca de origem altera escopo de sessão e armazenamento do navegador. Planeje backup local, redirects, CAPTCHA e CORS antes de mover a aplicação. [Troca de endereço](../TROCA-ENDERECO.md)
- Verificação anônima, duas contas reais, testes de DOM e QA em dispositivo cobrem riscos diferentes. Um ambiente SQL emulado pode exigir seus próprios objetos de teste. Registre cada resultado com seu alcance. [Conexão](../CONEXAO-SUPABASE.md) · [Testes](../conhecimento/TESTES.md)
- Publicação da interface e atualização de banco ou funções são operações independentes. Confira pré-requisitos e mantenha as flags de prontidão vinculadas a evidências. [Lançamento](../LANCAMENTO-WEB-E-LOJAS.md)
