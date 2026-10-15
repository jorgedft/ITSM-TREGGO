-- =====================================================================
-- Módulo Nóminas y Recibos
-- =====================================================================

create table if not exists public.hr_payroll (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.employees(id) on delete cascade,
    period_label text not null,
    period_start date not null,
    period_end date not null,
    gross_pay numeric,
    deductions numeric,
    net_pay numeric,
    status text not null default 'pendiente',
    receipt_path text,
    receipt_file_name text,
    paid_at date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.hr_payroll drop constraint if exists hr_payroll_status_check;
alter table public.hr_payroll
    add constraint hr_payroll_status_check
    check (status in ('pendiente', 'pagado'));

create index if not exists hr_payroll_employee_idx on public.hr_payroll (employee_id);
create index if not exists hr_payroll_period_idx on public.hr_payroll (period_start, period_end);

alter table public.hr_payroll enable row level security;

drop policy if exists "hr_payroll_full_rh" on public.hr_payroll;
create policy "hr_payroll_full_rh"
    on public.hr_payroll for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti', 'rh'))
    with check (public.current_user_role() in ('admin', 'ti', 'rh'));

drop trigger if exists audit_trg on public.hr_payroll;
create trigger audit_trg after insert or update or delete on public.hr_payroll
    for each row execute function public.audit_trigger_func();

-- Bucket de almacenamiento para los PDF de recibos de nómina.
insert into storage.buckets (id, name, public)
values ('payroll-receipts', 'payroll-receipts', false)
on conflict (id) do nothing;

drop policy if exists "payroll_receipts_rh_access" on storage.objects;
create policy "payroll_receipts_rh_access"
    on storage.objects for all
    to authenticated
    using (bucket_id = 'payroll-receipts' and public.current_user_role() in ('admin', 'ti', 'rh'))
    with check (bucket_id = 'payroll-receipts' and public.current_user_role() in ('admin', 'ti', 'rh'));
