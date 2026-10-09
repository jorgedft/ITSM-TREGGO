-- =====================================================================
-- Módulo Incidencias y Asistencia
-- =====================================================================

-- Mapeo entre el ID interno del reloj checador y el colaborador real.
-- Se llena la primera vez que aparece un ID nuevo en una importación;
-- las importaciones siguientes ya lo resuelven solas.
create table if not exists public.hr_checador_map (
    device_id text primary key,
    device_name text,
    employee_id uuid references public.employees(id) on delete set null,
    updated_at timestamptz not null default now()
);

-- Resumen de asistencia por colaborador y día. Una importación del
-- checador hace upsert sobre (employee_id, date); los registros de
-- falta/permiso/incapacidad se capturan a mano.
create table if not exists public.hr_attendance (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.employees(id) on delete cascade,
    date date not null,
    type text not null default 'asistencia',
    check_in time,
    check_out time,
    source text not null default 'checador',
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (employee_id, date)
);

alter table public.hr_attendance drop constraint if exists hr_attendance_type_check;
alter table public.hr_attendance
    add constraint hr_attendance_type_check
    check (type in ('asistencia', 'retardo', 'falta', 'permiso', 'incapacidad', 'home_office', 'otro'));

alter table public.hr_attendance drop constraint if exists hr_attendance_source_check;
alter table public.hr_attendance
    add constraint hr_attendance_source_check
    check (source in ('checador', 'manual'));

-- RLS: acceso total para admin, ti y rh (igual que el resto de RH).
-- Requiere que current_user_role() ya exista (ver 001_roles_y_rls.sql).
alter table public.hr_checador_map enable row level security;
alter table public.hr_attendance enable row level security;

drop policy if exists "hr_checador_map_full_rh" on public.hr_checador_map;
create policy "hr_checador_map_full_rh"
    on public.hr_checador_map for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti', 'rh'))
    with check (public.current_user_role() in ('admin', 'ti', 'rh'));

drop policy if exists "hr_attendance_full_rh" on public.hr_attendance;
create policy "hr_attendance_full_rh"
    on public.hr_attendance for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti', 'rh'))
    with check (public.current_user_role() in ('admin', 'ti', 'rh'));
