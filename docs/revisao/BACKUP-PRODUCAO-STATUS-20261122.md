# Registro operacional de backup privado — 22/11/2026

**Origem:** evidências fornecidas pelo operador da Produção em capturas do PowerShell, Cyberduck e painel Supabase nesta data; conferência independente posterior de **somente leitura** de agregados no catálogo remoto. **Não anexar o backup, o manifesto com caminhos internos, chaves ou dados de usuários ao GitHub.**

## Confirmado por execução local do proprietário

- Exportação lógica `pg_dump 17.12 --format=custom` do banco Produção `cpslafpzjtbpmoxxysaa`, salva como `neopep-producao.backup` em diretório privado do Windows, aproximadamente **1,09 MiB** comprimido. O comando terminou com código 0; o arquivo foi encontrado e recebeu SHA-256 local.
- `pg_restore 17.12 --list` abriu o inventário sem erro. **89 entradas de TABLE DATA**: `public` 7, `neo_private` 45, `auth` 27, `storage` 10. Presença específica de `auth.users`, `storage.objects` e `neo_private.shop_orders` confirmada pelo TOC. `pg_restore --file=NUL` concluiu com código 0, testando a decodificação integral do arquivo, **não** a restauração.
- S3 privado via Cyberduck: **7 buckets** acessados, dos quais 5 possuem objetos; arquivos baixados preservando os nomes e as subpastas, com conferência de **34 arquivos e 58.258.075 bytes**, exatamente correspondentes ao inventário remoto anterior. Foi criado `storage-sha256.csv` com **34 hashes SHA-256 locais**.
- O painel de configuração S3 da Produção passou a exibir **nenhuma access key**, após revogação da credencial temporária usada para a transferência.
- Confirmação independente por consulta SQL `READ ONLY` após esse procedimento: **8 contas Auth, 18 pedidos e 34 objetos em Storage**, distribuídos em `neo-community-avatars=3`, `neo-library=6`, `neo-private=15`, `neo-shop-products=6` e `neo-support=4`. Os buckets `neo-community` e `neo-community-files` estavam vazios no inventário anterior.

## Limites e riscos explicitamente retidos

1. `pg_dump` personalizado não demonstra sozinho captura de *roles* globais, segredos, variáveis de Edge, Auth/SMTP/CAPTCHA, cron, configurações externas, Deploys Vercel, nem arquivos físicos Storage (estes foram copiados em procedimento separado).
2. O arquivo PostgreSQL **não foi restaurado em clone isolado**. O TOC e a decodificação integral são verificações úteis, mas não provam restauração completa nem execução das sete migrações sobre dados oficiais.
3. Os hashes Storage registrados são dos arquivos **locais**, sem comparação SHA-256 byte a byte com os 34 objetos de origem. A conferência de nomes/contagens e bytes não substitui isso.
4. Dump e Storage foram coletados em instantes diferentes: **não existe garantia de snapshot transacional conjunto**.
5. O operador **optou explicitamente por não reiniciar Windows nem instalar Docker/WSL nesta rodada** e autorizou continuar as demais verificações sem o ensaio local de restauração. Isto registra **aceitação consciente de risco operacional, não aprovação fictícia do teste**, tampouco autorização irrestrita para DDL, Edge, pagamentos ou merge.
6. O backup está exclusivamente sob guarda do proprietário. Recomenda-se segundo exemplar **criptografado e fora do equipamento** e retenção controlada, dada a presença provável de dados pessoais.

## Decisão desta rodada

- **BACKUP EXPORTADO: EVIDENCIADO** por operação local e agregados read-only.
- **RECUPERAÇÃO RESTAURADA: NÃO COMPROVADA — ensaio local dispensado pelo proprietário nesta rodada, risco registrado.**
- **PR #25: CONTINUA NO-GO** por riscos independentes de semântica SQL, RLS/grants, contratos Auth/Edge, sandbox Mercado Pago Orders, ledger, Vercel e permissões de publicação.
- A dispensa do ensaio **não apaga a pendência técnica**. Pode-se revisitar a escolha após verificações complementares e decisão de implantação específica. Nenhuma alteração em produção ou merge ocorreu neste registro.
