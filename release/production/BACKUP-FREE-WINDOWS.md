# Backup NeoPep Produção no plano Free — procedimento local, sem alteração remota

**Status:** preparado e conferido com documentação da Supabase em 22/11/2026; **NÃO EXECUTADO**. Arquivos reais e segredos devem ficar **fora do Git**, ChatGPT e pastas compartilhadas. O projeto PROD é `cpslafpzjtbpmoxxysaa`, na região `us-east-1`; Staging é `qnuluspqfazdppciermw` e não deve ser confundido.

A organização NeoPeptídeos está no plano **Free**. A documentação oficial informa backups diários automáticos para Pro/Team/Enterprise, não para Free. **A exportação do banco NÃO inclui os bytes dos arquivos Storage**. Portanto, backup completo = banco + Auth + Storage + configuração fora do banco, seguido de restauração e validação em clone isolado.

## 0. Confirmar requisitos no Windows (sem tocar no banco)

No Windows PowerShell do proprietário, executar:

```powershell
Get-Command supabase,docker,psql,pg_dump -ErrorAction SilentlyContinue | Select-Object Name,Source
if (Get-Command supabase -ErrorAction SilentlyContinue) {
  supabase --version
  supabase db dump --help
  supabase storage cp --help
}
if (Get-Command docker -ErrorAction SilentlyContinue) { docker info --format '{{.ServerVersion}}' }
```

**Não colar senha ou string de conexão aqui.** Em Supabase CLI v3, `supabase db dump` mira o banco **LOCAL por padrão**; é obrigatório `--remote` para o projeto vinculado. Não usar `db reset`, `db push`, `migration repair` ou `storage mv/rm` na origem oficial.

## 1. Preparar diretório privado e vincular a produção

```powershell
$projeto = 'cpslafpzjtbpmoxxysaa'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$saida = Join-Path $env:LOCALAPPDATA "NeoPep-Backups-Privados\producao-$timestamp"
New-Item -ItemType Directory -Path $saida | Out-Null
Push-Location $saida
# Supabase CLI e Docker Desktop devem estar instalados.
supabase init
supabase login
supabase link --project-ref $projeto
```

A CLI poderá solicitar autenticação/senha interativamente; **não a escreva em arquivos de texto, comandos de chat, prints ou logs**. Antes de cada `dump`, confirme o destino `Target:` e o ref exato **`cpslafpzjtbpmoxxysaa`**. Não execute comandos contra staging.

## 2. Exportar funções, permissões e dados

Conforme a CLI atual, dentro da mesma pasta privada vinculada:

```powershell
supabase db dump --remote -f roles.sql --role-only
if ($LASTEXITCODE -ne 0) { throw "Falha ao exportar roles" }
supabase db dump --remote -f schema.sql
if ($LASTEXITCODE -ne 0) { throw "Falha ao exportar schema" }
supabase db dump --remote --data-only --use-copy -f data.sql -x storage.buckets_vectors -x storage.vector_indexes
if ($LASTEXITCODE -ne 0) { throw "Falha ao exportar data" }
Get-Item roles.sql,schema.sql,data.sql | Select-Object Name,Length
Get-FileHash roles.sql,schema.sql,data.sql -Algorithm SHA256 | Select-Object Path,Hash
```

**Atenção:** a CLI filtra alguns schemas internos do Supabase, incluindo `auth` e `storage` no dump padrão. O procedimento **não deve ser considerado backup integral** antes de comprovar se a exportação contempla `auth.users`, seus dados e dependências; caso contrário, planejar extração controlada desses dados (por exemplo, `pg_dump` com acesso de leitura autorizado e schema explícito) e restauração no clone. Nunca fazer isso publicando dados sensíveis no Git.

Recomenda-se verificar que os arquivos são não vazios e que **o restore em ambiente isolado** recupera as contagens esperadas e os contratos. `Get-FileHash` dos arquivos prova integridade local, não que a exportação esteja completa.

## 3. Exportar os objetos privados do Storage separadamente

A fonte contém **7 buckets privados**. Inventário somente de metadados em 22/11/2026: `neo-community` (0), `neo-community-avatars` (3), `neo-community-files` (0), `neo-library` (6), `neo-private` (15), `neo-shop-products` (6), `neo-support` (4), total **34 objetos** / ~58,3 MB segundo metadados. Como números podem mudar, capturar um inventário de origem no **mesmo intervalo de exportação**.

No CLI v3, `storage cp` suporta `--recursive`, `--remote` e `--experimental`. Exemplo, executado **somente após conferir os comandos `--help` na versão instalada e autenticação**:

```powershell
$bucket = 'neo-library'
$destino = Join-Path $saida "storage\$bucket"
New-Item -ItemType Directory -Force -Path $destino | Out-Null
supabase storage cp --recursive --remote --experimental "ss:///$bucket" "$destino"
if ($LASTEXITCODE -ne 0) { throw "Erro ao baixar $bucket" }
```

Repetir para os **sete buckets com objetos** (inclusive os antes vazios se receberem itens) e comparar contagens e somas de tamanho com um inventário remoto contemporâneo. Armazenar hashes SHA-256 em manifestos **privados**, jamais no repositório ou em publicações. Se a CLI experimental não estiver habilitada ou falhar, usar cliente S3 autenticado (rclone/Cyberduck) como documentado oficialmente, sem compartilhar as credenciais.

A base PostgreSQL armazena os metadados `storage.objects`, mas o `dump` não faz backup do corpo dos arquivos. Uma cópia contendo apenas registros do banco NÃO recupera PDF, fotos, documentos e imagens.

## 4. Provar recuperação e impedir efeitos colaterais

O clone de restauração deve **não ter acesso** a Mercado Pago, WhatsApp, SMTP, push, IA nem aos segredos de produção. Não restaurar sobre os projetos atuais. Preparar uma instalação Supabase local separada e isolada, com versão compatível das extensões, ou outro destino expressamente autorizado. Não criar projeto pago sem autorização.

1. Restaurar roles/schema/data e dados internos/Storage que tenham sido excluídos pelos filtros de dump.
2. Conferir a existência e permissões dos schemas `auth`, `public`, `neo_private` e `storage`; verificar dados e contagens agregadas, sem extrair conteúdo individual.
3. Conferir todos os arquivos (nomes, tamanhos, SHA-256) contra **manifesto oriundo dos arquivos efetivamente recebidos da origem**, sem inventar hashes.
4. Executar `python3 release/production/verify-storage-restore.py --manifest ... --expected-counts ... --root ...` no clone e verificar todos os buckets.
5. Aplicar o ensaio dos sete lotes com a identidade `neopep_release_rehearsal` e comprovar RLS, grants, SQL financeiro e rollback. **O lote financeiro atualmente NÃO aceita o fingerprint real da função `neo_shop_v36` e exige revisão antes de aprovação.**
6. Capturar tempo de restauração, SHA de dumps, contagens por tabela, diferença de ACLs/Edge e relatório de sucesso antes de considerar o backup efetivamente validado.

## Limites do trabalho automatizado pelo assistente

Os conectores desta sessão permitem consultar catálogos e projetos Supabase mas **não oferecem download de backups e bytes privados do Storage**. Por isso **nenhum backup de dados reais ou restauração real foi efetuado aqui**. A conclusão depende do operador executar a exportação local com suas credenciais privadas. Não há recomendação de liberar produção até esse teste.

**Fontes oficiais consultadas:** https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore ; https://supabase.com/docs/reference/cli/supabase-db-dump ; https://supabase.com/docs/reference/cli/supabase-storage-cp

Status geral: **NO-GO**.
