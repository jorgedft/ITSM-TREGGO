-- =====================================================================
-- Módulo Vacaciones y Permisos
-- =====================================================================

-- Días de vacaciones asignados al año para cada colaborador (ajustable
-- por persona; default 12 = mínimo de ley en México al primer año).
alter table public.employees add column if not exists vacation_days_per_year integer not null default 12;

create table if not exists public.hr_vacation_requests (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.employees(id) on delete cascade,
    type text not null default 'vacaciones',
    start_date date not null,
    end_date date not null,
    days_requested numeric not null,
    status text not null default 'pendiente',
    reason text,
    reviewed_by uuid references public.profiles(id) on delete set null,
    reviewed_at timestamptz,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.hr_vacation_requests drop constraint if exists hr_vacation_requests_type_check;
alter table public.hr_vacation_requests
    add constraint hr_vacation_requests_type_check
    check (type in ('vacaciones', 'permiso_con_goce', 'permiso_sin_goce'));

alter table public.hr_vacation_requests drop constraint if exists hr_vacation_requests_status_check;
alter table public.hr_vacation_requests
    add constraint hr_vacation_requests_status_check
    check (status in ('pendiente', 'aprobado', 'rechazado'));

create index if not exists hr_vacation_requests_employee_idx on public.hr_vacation_requests (employee_id);

-- RLS: admin, ti y rh tienen acceso total (igual que el resto de RH).
alter table public.hr_vacation_requests enable row level security;

drop policy if exists "hr_vacation_requests_full_rh" on public.hr_vacation_requests;
create policy "hr_vacation_requests_full_rh"
    on public.hr_vacation_requests for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti', 'rh'))
    with check (public.current_user_role() in ('admin', 'ti', 'rh'));

-- Bitácora de auditoría para este módulo también (ver 006_bitacora_auditoria.sql).
drop trigger if exists audit_trg on public.hr_vacation_requests;
create trigger audit_trg after insert or update or delete on public.hr_vacation_requests
    for each row execute function public.audit_trigger_func();
