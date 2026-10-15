-- =====================================================================
-- Mantenimientos Programados (preventivos a futuro, con recurrencia)
-- =====================================================================

create table if not exists public.maintenance_schedules (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.assets(id) on delete cascade,
    title text not null,
    maintenance_type text not null default 'Preventivo',
    technician_name text,
    scheduled_date date not null,
    recurrence text not null default 'none',
    status text not null default 'pendiente',
    completed_log_id uuid references public.maintenance_logs(id) on delete set null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.maintenance_schedules drop constraint if exists maintenance_schedules_recurrence_check;
alter table public.maintenance_schedules
    add constraint maintenance_schedules_recurrence_check
    check (recurrence in ('none', 'monthly', 'quarterly', 'semiannual', 'yearly'));

alter table public.maintenance_schedules drop constraint if exists maintenance_schedules_status_check;
alter table public.maintenance_schedules
    add constraint maintenance_schedules_status_check
    check (status in ('pendiente', 'completado', 'cancelado'));

create index if not exists maintenance_schedules_asset_idx on public.maintenance_schedules (asset_id);
create index if not exists maintenance_schedules_status_date_idx on public.maintenance_schedules (status, scheduled_date);

alter table public.maintenance_schedules enable row level security;

drop policy if exists "maintenance_schedules_write_ti_admin" on public.maintenance_schedules;
create policy "maintenance_schedules_write_ti_admin"
    on public.maintenance_schedules for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti'))
    with check (public.current_user_role() in ('admin', 'ti'));

drop trigger if exists audit_trg on public.maintenance_schedules;
create trigger audit_trg after insert or update or delete on public.maintenance_schedules
    for each row execute function public.audit_trigger_func();

-- Nuevo mantenimiento programado -> avisa a TI (requiere 010_notificaciones.sql).
create or replace function public.trg_notify_new_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_asset_code text;
begin
    select coalesce(asset_tag, asset_code) into v_asset_code from public.assets where id = NEW.asset_id;
    perform public.notify_roles(
        array['admin', 'ti'],
        'Mantenimiento programado: ' || NEW.title,
        coalesce(v_asset_code, '') || ' — programado para ' || to_char(NEW.scheduled_date, 'DD/MM/YYYY'),
        '/maintenance',
        'mantenimiento_programado'
    );
    return NEW;
end;
$$;

do $$
begin
    if exists (select 1 from pg_proc where proname = 'notify_roles') then
        drop trigger if exists notify_new_schedule_trg on public.maintenance_schedules;
        create trigger notify_new_schedule_trg after insert on public.maintenance_schedules
            for each row execute function public.trg_notify_new_schedule();
    else
        raise notice 'notify_roles() no existe todavia (corre 010_notificaciones.sql primero). Se omite el aviso automatico.';
    end if;
end $$;

-- =====================================================================
-- (Opcional) Recordatorio diario de mantenimientos próximos/vencidos.
-- Requiere habilitar la extensión pg_cron (Database → Extensions en el
-- dashboard de Supabase) y programar esta función una vez al día:
--
--   select cron.schedule('aviso-mantenimientos', '0 13 * * *',
--     $$select public.notify_due_maintenance()$$);
-- =====================================================================
create or replace function public.notify_due_maintenance()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    r record;
begin
    for r in
        select ms.*, coalesce(a.asset_tag, a.asset_code) as asset_code
        from public.maintenance_schedules ms
        join public.assets a on a.id = ms.asset_id
        where ms.status = 'pendiente'
          and ms.scheduled_date <= current_date + interval '3 days'
    loop
        perform public.notify_roles(
            array['admin', 'ti'],
            case when r.scheduled_date < current_date
                 then 'Mantenimiento VENCIDO: ' || r.title
                 else 'Mantenimiento próximo: ' || r.title end,
            coalesce(r.asset_code, '') || ' — ' || to_char(r.scheduled_date, 'DD/MM/YYYY'),
            '/maintenance',
            'mantenimiento_recordatorio'
        );
    end loop;
end;
$$;
