-- =====================================================================
-- Amplía la tabla "employees" (hoy solo tiene id/full_name, usada en
-- Bóveda para asignar credenciales) con los campos del módulo
-- Colaboradores de RH. Es seguro correrlo aunque la tabla ya exista:
-- usa "add column if not exists" y no borra nada.
-- =====================================================================

create table if not exists public.employees (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    created_at timestamptz not null default now()
);

alter table public.employees add column if not exists employee_number text;
alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists phone text;
alter table public.employees add column if not exists position text;
alter table public.employees add column if not exists department text;
alter table public.employees add column if not exists hire_date date;
alter table public.employees add column if not exists contract_type text;
alter table public.employees add column if not exists status text not null default 'activo';
alter table public.employees add column if not exists salary numeric;
alter table public.employees add column if not exists notes text;
alter table public.employees add column if not exists updated_at timestamptz not null default now();

-- Evita duplicar número de empleado (permite null para registros viejos sin número).
drop index if exists employees_employee_number_key;
create unique index employees_employee_number_key
    on public.employees (employee_number)
    where employee_number is not null and employee_number <> '';

alter table public.employees drop constraint if exists employees_status_check;
alter table public.employees
    add constraint employees_status_check check (status in ('activo', 'baja'));

alter table public.employees drop constraint if exists employees_contract_type_check;
alter table public.employees
    add constraint employees_contract_type_check
    check (contract_type is null or contract_type in ('planta', 'temporal', 'honorarios'));

-- RLS: admin, ti y rh tienen acceso total (ya se cubre en 001_roles_y_rls.sql,
-- esto lo deja explícito por si 003 se corre antes o por separado).
alter table public.employees enable row level security;

drop policy if exists "employees_full_rh" on public.employees;
create policy "employees_full_rh"
    on public.employees for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti', 'rh'))
    with check (public.current_user_role() in ('admin', 'ti', 'rh'));
