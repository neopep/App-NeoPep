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

## Bloqueio financeiro adicional: fingerprint REAL não aceito pelo lote 07

A consulta de `encode(sha256(convert_to(prosrc,'UTF8')),'hex')` na rotina **instalada em produção**, `public.neo_shop_v36(text,jsonb)`, retornou:

```
fc8d0d088eee0df77db4718b0a398585ee3f17fd7d36f198914c23d978723080
```

A migração `supabase/migrations/20261122190100_shop_checkout_retry.sql` aceita somente o fingerprint **anterior esperado**:

```
2ce19e73bcb43f0d86793b99155143ef841c9559d665129278dd6749cbb222c9
```

ou o fingerprint já corrigido:

```
cba1a27d4d54e0cb050877b3434003440a3ba9493cd27dad43b4a4ebd1038521
```

**Resultado:** o lote 07 **deve falhar fechado** se tentarmos aplicá-lo diretamente ao corpo oficial atual, ainda que a candidata tenha passado no ensaio **sintético**. Não acrescentar `fc8d...` à allowlist sem provar que o corpo e os contratos oficiais equivalem à referência usada para gerar o patch, incluindo endereço, frete, totais, cancelamento e concorrência.

Os sete contratos de RPC financeiros consultados estavam presentes, com os privilégios efetivos atuais preservados. As restrições `UNIQUE(user_id, request_key)`, `UNIQUE(payment_id)` e a chave primária `shop_payments(payment_id)` estavam presentes. Essas condições **não eliminam** o risco de recotação e idempotência.

### Resolução segura do fingerprint

1. Capturar a definição DDL oficial e o fingerprint num **clone isolado/restaurado**. Não editar função da produção durante análise.
2. Comparar corpo lexical e comportamento com o SQL histórico exato `neo_shop_v36` que gerou o fingerprint previsto, sem presumir equivalência por remoção de espaços.
3. Ensaiar SQL idempotente específico no clone com todos os estados de pedido: mesma chave/carrinho vazio, endereço e faturamento diferentes, estoque, preço/frete, concorrência, dois usuários e retomada de pagamento.
4. Só após equivalência comprovada, gerar patch/guard adaptado e hashes para a versão oficial, além de rollback compensatório testado. Não copiar wrapper de Teste por cima do oficial sem essa comparação.
5. Revisar `mercadopago-webhook` v11 ativa: não trata explicitamente `partially_refunded`. A correção na candidata ainda exige testes em sandbox e decisão independente de deploy.

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