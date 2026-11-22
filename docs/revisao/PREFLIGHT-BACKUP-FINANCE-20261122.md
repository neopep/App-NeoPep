# Preflight autenticado de backup e checkout — 22/11/2026

**Natureza:** consulta **somente leitura** ao Supabase da organização NeoPeptídeos e ao GitHub da candidata. Não houve backup, restauração, SQL de escrita, migração, deploy, cobrança ou merge.

## Situação efetiva do Supabase

- Organização `ooaqkvkoaqcrkgzysroi`: plano retornado pela API **`free`** (tier `tier_free`).
- Produção `cpslafpzjtbpmoxxysaa`: projeto `neopep` no `us-east-1`, `ACTIVE_HEALTHY`.
- Teste `qnuluspqfazdppciermw`: projeto `neopep-staging` no `us-west-2`, `ACTIVE_HEALTHY`.
- Branches de banco consultadas: **nenhuma** nos dois projetos. Não criar projeto ou branch cobrável sem autorização do proprietário.
- De acordo com a documentação oficial (https://supabase.com/docs/guides/platform/backups), o plano Free não inclui as cópias diárias automáticas que existem nos planos Pro/Team/Enterprise. A própria Supabase recomenda exportação periódica via CLI e backup off-site.
- **Tamanho observado em consulta em 22/11:** `pg_database_size=23.582.387` bytes (inclui índices e overhead, **não** é tamanho do dump); **8 usuários** de Auth e **18 pedidos** na Loja (contagens agregadas, podem variar após a consulta).
- Storage: **7 buckets, todos privados**; **34 objetos** registrados com metadados de tamanho somando **58.258.075 bytes**. Não foram lidos objetos, hashes remotos, chaves ou dados pessoais.
- Inventário agregado:

| Bucket | Objetos | Bytes informados nos metadados |
|---|---:|---:|
| `neo-community` | 0 | 0 |
| `neo-community-avatars` | 3 | 732218 |
| `neo-community-files` | 0 | 0 |
| `neo-library` | 6 | 50460011 |
| `neo-private` | 15 | 3595653 |
| `neo-shop-products` | 6 | 2826074 |
| `neo-support` | 4 | 644119 |

**Não é possível afirmar que há backup restaurável apenas porque o banco é pequeno ou os objetos estão no Storage.** É obrigatório produzir exportação independente e verificar os dois tipos de dados.

## Fingerprint da Loja: divergência CRLF/LF explicada e corrigida somente na candidata

Consulta READ-ONLY aos dois ambientes confirmou:

| Projeto | SHA-256 bruto `neo_shop_v36` | SHA-256 após normalizar `CRLF→LF` |
|---|---|---|
| Produção | `fc8d0d088eee0df77db4718b0a398585ee3f17fd7d36f198914c23d978723080` | `2ce19e73bcb43f0d86793b99155143ef841c9559d665129278dd6749cbb222c9` |
| Teste | `2ce19e73bcb43f0d86793b99155143ef841c9559d665129278dd6749cbb222c9` | `2ce19e73bcb43f0d86793b99155143ef841c9559d665129278dd6749cbb222c9` |

O corpo SQL **é idêntico byte a byte depois de converter `CRLF` para `LF`**; isto não é uma normalização que simplesmente remove todo espaço, e o trecho de substituição foi localizado exatamente **uma vez** nos dois bancos. Assim, a incompatibilidade de *fingerprint bruto* era exclusivamente o estilo de quebra de linha.

**Commit da correção apenas no PR:** `b2927ef9b8c2c08c43fdf5e38e7ae78246c344d9`.

- A migração `20261122190100_shop_checkout_retry.sql` verifica **apenas** os hashes canônicos originais `2ce19...` e corrigidos `cba1...`, normalizando `CRLF→LF` antes de conferir e executar o patch.
- A reversão simétrica faz a mesma normalização e mantém o fingerprint pós-operação.
- `release/production/finance-preflight.sql` mantém os hashes **bruto e canônico** disponíveis para revisão e classifica corretamente a versão oficial atual como `baseline_git`.
- O manifesto SHA-256 do lote 07 foi recalculado. O ensaio automatizado verifica também rollback, adaptação da versão CRLF e reaplicação idempotente em PGlite.
- [GitHub Actions 45063524997](https://github.com/neopep/App-NeoPep/actions/runs/45063524997): job **Candidata sem deploy APROVADO**. O gate final continua **NO-GO**, como esperado.

Os sete contratos RPC financeiros consultados estavam presentes, com os privilégios efetivos atuais preservados. As restrições `UNIQUE(user_id, request_key)`, `UNIQUE(payment_id)` e a chave primária `shop_payments(payment_id)` estavam presentes.

**Limite:** A correção passou nos testes sintéticos e é compatível lexicalmente com o corpo oficial após normalização. **Nenhuma migração foi aplicada ao Supabase oficial ou a uma cópia real restaurada.** Ainda é obrigatório validar a função dentro do clone autorizado e homologar os cenários de idempotência/pagamento externo em sandbox, antes da liberação.

## Estratégia de backup no plano Free

- Usar CLI oficial `supabase db dump` para exportar **roles, schema e data** em arquivos separados na máquina privada do proprietário. Verificar `supabase --version` e flags via `--help`, pois CLI v3 mudou comportamentos; Docker é necessário.
- Preservar Auth, RLS, políticas, funções e extensões no clone; confirmar `auth.users` no backup RESTAURADO. Não supor que exportar apenas `public` cubra contas.
- Exportar **bytes reais** do Storage separadamente: backups do banco incluem metadados, **não** os arquivos. Opções documentadas: Supabase CLI Storage `cp -r` (experimental) ou cliente S3 configurado de modo seguro, por exemplo rclone/Cyberduck. URLs/segredos são privados e **não** vão ao GitHub nem ao chat.
- Ensaio local com PostgreSQL/Supabase isolado, cron/Edge/pagamentos bloqueados, sem usar senha de produção no destino; comparar catálogos, agregados e inventário por bucket; usar `release/production/verify-storage-restore.py` com manifesto de origem e SHA-256.
- Cópia completa pode conter credenciais, informações de saúde, emails e pedidos. Manter criptografada e com controle de acesso, fora do repositório e de pastas sincronizadas publicamente. Excluir conforme política de retenção de dados.

Documentação oficial:
- Backups: https://supabase.com/docs/guides/platform/backups
- CLI, backup/restauração: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Storage: https://supabase.com/docs/guides/storage/management/download-objects

## Estado GO/NO-GO

- [x] Inventariar projeto, plano, tamanho e contagens sem dados de usuários.
- [x] Verificar os fingerprints **atuais** da Loja, ACL e restrições de idempotência.
- [x] Detectar incompatibilidade entre o lote 07 e função financeira **real**.
- [ ] Exportar dados do banco e arquivos Storage de forma privada e comprovar recuperação em clone isolado.
- [ ] Reconciliar SQL financeiro **contra o corpo oficial** e executar testes reais/sandbox.
- [ ] Homologar Auth, versões de Edge, push/cron, migrações e resposta de Vercel.
- [ ] Receber autorização humana separada para aplicação dos lotes e para merge/deploy.

**Produção intocada. PR #25 DRAFT / NO-GO.**