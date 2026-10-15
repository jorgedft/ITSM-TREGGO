-- =====================================================================
-- Módulo Reclutamiento / Vacantes
-- =====================================================================

create table if not exists public.hr_job_openings (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    department text,
    status text not null default 'abierta',
    opened_at date not null default current_date,
    closed_at date,
    notes text,
    created_at timestamptz not null default now()
);

alter table public.hr_job_openings drop constraint if exists hr_job_openings_status_check;
alter table public.hr_job_openings
    add constraint hr_job_openings_status_check
    check (status in ('abierta', 'cerrada'));

create table if not exists public.hr_candidates (
    id uuid primary key default gen_random_uuid(),
    job_opening_id uuid not null references public.hr_job_openings(id) on delete cascade,
    full_name text not null,
    email text,
    phone text,
    cv_path text,
    cv_file_name text,
    stage text not null default 'nuevo',
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.hr_candidates drop constraint if exists hr_candidates_stage_check;
alter table public.hr_candidates
    add constraint hr_candidates_stage_check
    check (stage in ('nuevo', 'entrevista', 'oferta', 'rechazado', 'contratado'));

create index if not exists hr_candidates_job_opening_idx on public.hr_candidates (job_opening_id);

alter table public.hr_job_openings enable row level security;
alter table public.hr_candidates enable row level security;

drop policy if exists "hr_job_openings_full_rh" on public.hr_job_openings;
create policy "hr_job_openings_full_rh"
    on public.hr_job_openings for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti', 'rh'))
    with check (public.current_user_role() in ('admin', 'ti', 'rh'));

drop policy if exists "hr_candidates_full_rh" on public.hr_candidates;
create policy "hr_candidates_full_rh"
    on public.hr_candidates for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti', 'rh'))
    with check (public.current_user_role() in ('admin', 'ti', 'rh'));

drop trigger if exists audit_trg on public.hr_job_openings;
create trigger audit_trg after insert or update or delete on public.hr_job_openings
    for each row execute function public.audit_trigger_func();

drop trigger if exists audit_trg on public.hr_candidates;
create trigger audit_trg after insert or update or delete on public.hr_candidates
    for each row execute function public.audit_trigger_func();

-- Bucket de almacenamiento para CVs de candidatos.
insert into storage.buckets (id, name, public)
values ('candidate-cvs', 'candidate-cvs', false)
on conflict (id) do nothing;

drop policy if exists "candidate_cvs_rh_access" on storage.objects;
create policy "candidate_cvs_rh_access"
    on storage.objects for all
    to authenticated
    using (bucket_id = 'candidate-cvs' and public.current_user_role() in ('admin', 'ti', 'rh'))
    with check (bucket_id = 'candidate-cvs' and public.current_user_role() in ('admin', 'ti', 'rh'));
