# NeoPep Connect 0.2.20 — investigação do erro 421
Base: d78fa107797ec884ca0576bcb45b096bbb39744c (0.2.19).

## Evidência
- Mundo Pep, grupo independente, teve rejeições 421 com texto e mídia; dois grupos menores da mesma sessão funcionaram.
- O código da Baileys rc14 consulta separadamente a lista de grupos e os metadados individuais no relay. O parser usa PN quando o atributo addressing_mode não é lid. Isso não prova a causa do erro.
- A biblioteca já fazia a consulta individual por padrão; esta candidata explicita a validação e expõe suas diferenças, sem forçar modos nem alterar permissões.
- Os identificadores de membros são comparados apenas em memória. Se o conjunto mudou, mas o grupo atual e a permissão são válidos, usa-se o snapshot individual fresco. Divergências de modo, grupo inválido, permissões não confirmadas ou mudança durante consulta interrompem o envio, sem repetição automática.
- A tela Diagnóstico apresenta apenas modo, contagens agregadas e resultado da comparação. Não exporta lista de membros, identificadores individuais, conteúdo nem chaves.
- Nenhuma alteração na versão Baileys, sessão, armazenamento de chaves, Supabase, Vercel, histórico ou permissões dos grupos.

## Validação
11 casos novos exercitados com o código obtido do GitHub em V8 e APIs Node simuladas, todos passaram. A esteira Windows privada deve executar npm test, auditoria, compilação e teste do instalador reais antes de qualquer distribuição.
Homologação: instalar no perfil Teste após aprovação, validar os dois grupos pequenos, inclusive entrada/saída de membro consentido. Só depois, com autorização, testar uma única publicação no Mundo Pep e comparar metadados e confirmação real de entrega. Se persistir 421, não repetir automaticamente e usar publicação manual oficial até esclarecer a causa.
A versão 0.2.19 permanece ativa; não ampliar allowlists de produção nem publicar sem homologação.
