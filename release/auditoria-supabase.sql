-- NeoPeptídeos: auditoria SOMENTE LEITURA para executar no SQL Editor do Supabase.
-- Não migra, apaga ou modifica dados. Não retorna nomes, e-mails, registros de saúde ou fotografias.
-- Os resultados exigem interpretação; não constituem certificado de segurança.

-- 1. Tabelas do aplicativo e ativação de Row Level Security.
select n.nspname as esquema,c.relname as tabela,c.relrowsecurity as rls_ativada
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and (n.nspname='neo_private' or (n.nspname='public' and c.relname like 'neo_%'))
order by 1,2;

-- 2. Privilégios diretos das contas anônima e autenticada, sem consultar registros.
select n.nspname as esquema,c.relname as tabela,
 has_table_privilege('anon',c.oid,'SELECT') as anon_le,
 has_table_privilege('anon',c.oid,'INSERT') as anon_insere,
 has_table_privilege('anon',c.oid,'UPDATE') as anon_edita,
 has_table_privilege('authenticated',c.oid,'SELECT') as autenticado_le
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and (n.nspname='neo_private' or (n.nspname='public' and c.relname like 'neo_%'))
order by 1,2;

-- 3. Políticas existentes (somente metadados).
select schemaname,tablename,policyname,cmd,roles
from pg_policies where schemaname='neo_private' or (schemaname='public' and tablename like 'neo_%') or (schemaname='storage' and tablename='objects')
order by 1,2,3;

-- 4. Privacidade dos buckets do aplicativo. Não lista arquivos.
select id,public,file_size_limit,allowed_mime_types from storage.buckets
where id in ('neo-private','neo-community','neo-community-files','neo-support','neo-shop-products') order by id;

-- 5. Publicação Realtime: verificar se contém o sinal público por usuário, sem adicionar tabelas de saúde.
select pubname,schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' order by 2,3;

-- 6. Instalação dos pontos de entrada, sem executar operações financeiras ou administrativas.
select assinatura,to_regprocedure(assinatura) is not null as instalada from (values
 ('public.neo_admin_access()'),('public.neo_community_members(text,jsonb)'),
 ('public.neo_support(text,jsonb)'),('public.neo_support_attachment_access(text,boolean)'),
 ('public.neo_shop(text,jsonb)'),('public.neo_shop_payment_claim(uuid,uuid)'),
 ('public.neo_shop_payment_event(uuid,text,text,bigint,text)'),
 ('public.neo_support_deletion_media(uuid)'),('public.neo_shop_deletion_check(uuid)'),
 ('public.neo_push_claim()'),('public.neo_community_push_claim()'),('public.neo_support_push_claim()')
) t(assinatura);

-- 7. Permissões de execução expostas ao papel anônimo (funções do app).
select p.proname as funcao,pg_get_function_identity_arguments(p.oid) as argumentos,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_executa
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'neo_%' order by 1,2;

-- 8. Indicadores agregados para dimensionamento, sem conteúdo pessoal.
select pg_size_pretty(pg_database_size(current_database())) as tamanho_banco;
select count(*) as total_contas from auth.users;
