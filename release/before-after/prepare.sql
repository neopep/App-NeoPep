-- NeoPep PR #36 | DRAFT: review-only private comparisons schema.
-- DO NOT APPLY until existing schema, policies, backups and deletion flows are verified.
begin;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('neo-comparisons','neo-comparisons',false,5242880,array['image/jpeg'])
on conflict (id) do nothing;

create table if not exists public.neo_saved_comparisons (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 path text not null unique,
 before_photo_id uuid not null,
 after_photo_id uuid not null,
 before_date date not null,
 after_date date not null,
 created_at timestamptz not null default now(),
 constraint neo_comparison_different_photos check (before_photo_id <> after_photo_id),
 constraint neo_comparison_date_order check (before_date < after_date),
 constraint neo_comparison_path check (path = user_id::text || '/' || id::text || '.jpg')
);

alter table public.neo_saved_comparisons enable row level security;
revoke all on public.neo_saved_comparisons from public, anon;
grant select, insert, delete on public.neo_saved_comparisons to authenticated;

create policy neo_saved_comparisons_owner_read
on public.neo_saved_comparisons for select to authenticated
using (user_id = (select auth.uid()));

create policy neo_saved_comparisons_owner_insert
on public.neo_saved_comparisons for insert to authenticated
with check (
 user_id = (select auth.uid())
 and exists (
   select 1 from public.neo_photos p
   where p.id = before_photo_id
     and p.user_id = (select auth.uid())
     and p.role = 'progress' and p.date = before_date
 )
 and exists (
   select 1 from public.neo_photos p
   where p.id = after_photo_id
     and p.user_id = (select auth.uid())
     and p.role = 'progress' and p.date = after_date
 )
);

create policy neo_saved_comparisons_owner_delete
on public.neo_saved_comparisons for delete to authenticated
using (user_id = (select auth.uid()));

create policy neo_comparisons_storage_read
on storage.objects for select to authenticated
using (
 bucket_id = 'neo-comparisons'
 and (storage.foldername(name))[1] = (select auth.uid())::text
 and exists (
   select 1 from public.neo_saved_comparisons c
   where c.path = name and c.user_id = (select auth.uid())
 )
);

create policy neo_comparisons_storage_upload
on storage.objects for insert to authenticated
with check (
 bucket_id = 'neo-comparisons'
 and (storage.foldername(name))[1] = (select auth.uid())::text
 and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}[.]jpg$')
);

create policy neo_comparisons_storage_delete
on storage.objects for delete to authenticated
using (
 bucket_id = 'neo-comparisons'
 and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
