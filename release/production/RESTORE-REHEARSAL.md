# Ensaio de backup e restauração

**Estado atual.** Ensaio sintético de migração em PGlite e de backup lógico em PostgreSQL 17. A comprovação de restauração de banco e Storage de produção está pendente.

## Preparar a origem e um destino isolado

1. Em sessão autorizada de leitura, confirmar o projeto oficial, a proteção disponível no plano e a hora UTC do ponto de recuperação. Registrar o intervalo de perda de dados tolerado e o tempo máximo de retorno antes da janela.
2. Preparar um destino dedicado, sem domínio de produção e sem credenciais oficiais. Restringir o acesso aos operadores autorizados. Impedir egress para Mercado Pago, WhatsApp, SMTP, Web Push e provedores de IA, desativar cron/dispatchers no destino e controlar integrações de Auth antes de iniciar a restauração. Nunca conectar o frontend oficial ao destino.
3. Obter a imagem de backup pelo mecanismo aprovado do provedor. Para arquivo lógico, verificar SHA-256 e o inventário via pg_restore --list; essa leitura não comprova restauração. Proteger o backup e os catálogos fora do Git. Planejar o backup de objetos separadamente, com metadados, inventário e checksums de uma amostra; banco e objetos devem corresponder ao mesmo ponto lógico.
4. Se a política não autorizar copiar dados reais para o ambiente isolado, usar clone sanitizado ou dados sintéticos para o ensaio funcional e registrar a limitação. Restauração de backup real só conta como comprovada com execução e evidência autorizadas.

## Restaurar e validar

1. Restaurar no destino confirmado e registrar ferramenta, versões, ponto UTC, duração, erros e ajustes esperados. Transmitir logs desidentificados e guardar material protegido na área aprovada. A restauração de um projeto não deve alterar nem religar o cron oficial.
2. Consultar o catálogo de origem e de destino com catalog.sql. Distinguir diferenças intencionais de infraestrutura, como cron e segredos ausentes na cópia, de perda de objetos. Conferir agregados de Auth, pedidos por estado, eventos de pagamento, conversas e filas na mesma referência temporal. Reconciliar divergências justificadas antes do ensaio.
3. Restaurar objetos da amostra nos buckets privados do destino. Conferir tamanho, checksum e negativa de acesso anônimo e entre duas contas sintéticas, sem publicar links assinados ou usar dados reais em smoke tests.
4. Renderizar e aplicar os lotes incrementais somente no banco de ensaio neopep_release_rehearsal. Comparar catálogo, RLS, grants e contagens antes/depois. Testar falha e rollback e, em sequência separada, aplicar o lote com commit e medir o efeito. Qualquer objeto existente ou diferença de contrato suspende o lote.
5. Validar Auth, navegação, checkout, webhook e reembolsos com fixtures ou conta sandbox, protegendo o cron e as filas. Registrar resultado de cada caso e decisão de operador.

## Evidência mínima para um Go

- Identificadores do backup e destino, período de consistência e ferramenta de recuperação.
- Data, duração, RPO/RTO observados e diferença frente ao alvo.
- Resultado dos catálogos e agregados, amostra de Storage, políticas de acesso e cenários financeiros e de Auth.
- Passos de recuperação testados, responsáveis e evidência de bloqueio de saídas. Uma leitura do manifesto ou um teste PGlite não substitui esse registro.

Se um lote falhar antes do commit, usar rollback da transação. Depois do commit, preparar alteração compensatória revisada, preservando registros/auditoria. Para alterações financeiras, reconciliar pedidos e eventos do provedor antes de restaurar qualquer estado. A restauração sobre a origem oficial precisa de avaliação das gravações posteriores e aprovação separada.

## Evidência sintética de PostgreSQL 17

`bash tests/production-postgres.sh` cria um contêiner PostgreSQL 17 sem rede, usa exclusivamente migrações da referência local `origin/main` e dados sintéticos, produz um dump lógico e o restaura em outro banco do contêiner. Verifica um registro Auth sintético e compara o catálogo, aceitando apenas ACL padrão do proprietário e três CHECKs conhecidos cuja expressão o PostgreSQL reserializa com a mesma conjunção. Ensaios por lote comparam o catálogo integral antes e depois do rollback e verificam as invariantes após os sete commits. O script registra o SHA da base, o dump, catálogos e SHA-256 em diretório privado.

O ensaio local cobre o procedimento lógico e os deltas em PostgreSQL real. O backup oficial, a consistência entre banco e arquivos, o tempo de recuperação de produção e a restauração de arquivos de Storage seguem pendentes.

## Verificação reproduzível de objetos Storage restaurados

A restauração de Postgres **não traz automaticamente os bytes dos buckets Storage**. Para demonstrar a integridade dos arquivos, use o inventário de objetos obtido de uma exportação autorizada **no mesmo ponto lógico de recuperação**, com nomes, tamanhos e SHA-256 calculados a partir dos **bytes da origem**. O inventário e os objetos devem permanecer em diretório privado fora do Git e dos logs do CI.

Formato de uma linha de `origem.jsonl` (valores ilustrativos, não dados reais):

```json
{"bucket":"neo-library","key":"exemplo.pdf","size":12345,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
```

Formato de `contagens.json` (contagens ilustrativas de objetos da origem, por bucket no mesmo corte temporal):

```json
{"neo-library":1,"neo-private":0}
```

Com os objetos restaurados em subpastas por bucket, por exemplo `/volume/restore/neo-library/exemplo.pdf`, executar **localmente no destino isolado**:

```bash
python3 release/production/verify-storage-restore.py --self-test
python3 release/production/verify-storage-restore.py \
  --manifest /area-privada/origem.jsonl \
  --expected-counts /area-privada/contagens.json \
  --root /volume/restore
```

O verificador rejeita objetos faltantes, tamanhos ou SHA-256 divergentes, nomes duplicados, cobertura incompleta de buckets, referências fora da raiz e links simbólicos. **Não baixa nem envia arquivos**, não recebe credenciais nem mostra nomes dos objetos no resultado. O autoteste executa casos positivos e negativos com objetos sintéticos e não comprova restauração de produção.

**Evidência indispensável:** identidade e consistência do snapshot original, autenticidade do inventário, SHA-256 do backup, relógio/cutoff, bloqueio de egress e cron no clone, contagens e hashes do inventário de origem e destino, relatório do teste de integridade e teste isolado de acesso por conta/Storage RLS. Um arquivo JSONL autodeclarado não substitui prova da origem. Caso a exportação seja por amostragem, não rotular como restauração integral verificada. A integração com Auth/Storage e os direitos efetivos devem ser testados em clone isolado, sem login de usuários reais.

**Limitação atual:** não temos backup oficial restaurado no destino isolado nem manifesto de objetos autorizado. A verificação foi adicionada, mas a evidência real continua pendente; o gate oficial segue NO-GO.
