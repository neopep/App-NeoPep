# Preparação da publicação oficial

**NO-GO para produção.** A aplicação depende de catálogo remoto autenticado, histórico reconciliado, evidência de restauração e aprovação específica. O diretório supabase/migrations contém históricos de instalação e de Teste. Preserve-os como referência e evite replay.

## Auditoria somente leitura

1. Usar conexões autenticadas separadas, em perfis PostgreSQL locais fora do Git. Confirmar no painel o destino de cada perfil, produção cpslafpzjtbpmoxxysaa e Teste qnuluspqfazdppciermw. Conferir TLS e o projeto no host ou usuário do pooler, sem credenciais em argumentos ou logs.
2. Em diretório privado e com umask 077, executar `PGSERVICE=neopep_prod_read psql -XqAt -f release/production/catalog.sql > prod-antes.jsonl` e repetir com o perfil de Teste para gerar teste.jsonl. Qualquer erro invalida a captura. O SQL usa transação somente leitura, inclui ACL, RLS, cron e ledger e compara definições por hash.
3. Executar `python3 release/production/compare-catalog.py prod-antes.jsonl teste.jsonl > delta.json`. Distinguir mudanças semânticas de formatação em sessão administrativa. Confirmar visibilidade do cron e do ledger antes de interpretar ausências.
4. Pelo painel administrativo, inventariar Edge, verify_jwt, Auth, callbacks, CORS, SMTP, CAPTCHA, DNS, Vercel e recuperação. Registrar configurações públicas, presença e nomes das variáveis. O catálogo PostgreSQL não verifica esses serviços.

## Ordem de preparação dos lotes

| Lote | Insumos do Git | Condição para produzir SQL executável |
|---|---|---|
| Linha de base | Esquema oficial e catálogo real | Reconhecer objetos instalados com hashes, grants e dados preservados. Definir baseline de produção após revisão, sem importar ledger de Teste. |
| Administração e métricas | 20261121170551, 20261121181510, 20261121183535, 20261121184939, 20261121190211, 20261121192900 | Identificar objetos ausentes, dependências e diferenças de permissões. Preservar opt-in. |
| Campanhas App e editor | 20261121195231, 20261121200721 | Manter distribuição fechada. Reconciliar a criação de bucket com o lote Storage. |
| Campanhas push e WhatsApp manual | 20261121195245, 20261121231451 | Adiar gatilhos que alimentem fila sem gate eficaz no backend. Preservar o default de community_preferences.push_enabled e o cron oficial. |
| Multiagentes | 202611200001, 202611200002 | Fundação antes de runtime. Revisar RPCs renomeadas de suporte, claim e finish, filas e agente padrão antes de alterar a IA oficial. |
| Connect inerte | 20261121233733, 20261122003342, 20261122152200 | Reconstruir dependências intermediárias de atualização, grupos e evidências. Manter serviço pausado, assinador e brokers suspensos. |
| Storage | private-buckets.sql e políticas dos módulos | Lote separado. O SQL adiciona apenas buckets privados vazios, valida colisões e reverte em divergência. Remover sobreposição com INSERTs dos SQL de referência ao elaborar o delta aprovado. |

O histórico relatado de Teste inclui 20261122022149, 20261122040259, 20261122044929 e 20261122151856 sem arquivo do mesmo ID no snapshot de homologação. Comparar as definições instaladas, inclusive a predecessora de 20261122152200, antes de preparar SQL incremental. Usar fixtures de contratos somente em ambiente isolado. Ensaiar lotes em restauração sanitizada. Fixar hashes, ordem, pré-condições e limites de locks.

## Execução e recuperação futura

- Obter ponto de recuperação do banco e comprovar restauração em ambiente isolado. Fazer cópia separada dos objetos de Storage e ensaiar recuperação com autorização. Registrar o SHA Vercel anterior e versões de Edge.
- Capturar catálogo e contagens agregadas antes de cada lote. Interromper em caso de drift, locks ou filas inesperadas. Preservar o cron oficial.
- Executar somente o lote aprovado. Repetir a captura e rodar `python3 release/production/verify-invariants.py prod-antes.jsonl prod-depois.jsonl`. Comparar o delta com o manifesto aprovado e verificar isolamento, filas, pedidos, pagamentos e objetos privados.
- Em falha antes do commit, reverter a transação. Após commit, desligar ativações novas no servidor, restaurar código ou Edge anterior quando compatível e preparar migração compensatória. Preservar dados e auditoria. Reconciliar IDs de transação e webhooks antes de reversão financeira. Restauração na origem oficial exige avaliação de perda de gravações posteriores e autorização.
- Publicar o frontend por último, após decisão Go. Confirmar no painel a supressão de deploy da branch de preparação. Após publicação autorizada, observar Vercel READY e testar a origem oficial.
