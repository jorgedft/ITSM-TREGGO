-- =====================================================================
-- Bitácora de Auditoría
-- =====================================================================
-- Registra automáticamente cada INSERT/UPDATE/DELETE en las tablas
-- importantes del sistema, usando un trigger genérico de Postgres.
-- Esto funciona sin importar si el cambio viene de la app web, de un
-- script o de la API de Supabase directamente.
--
-- Requiere que ya exista public.current_user_role() (ver 001_roles_y_rls.sql).
-- =====================================================================

create table if not exists public.audit_log (
    id uuid primary key default gen_random_uuid(),
    table_name text not null,
    record_id text,
    action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
    actor_id uuid references public.profiles(id) on delete set null,
    old_data jsonb,
    new_data jsonb,
    changed_fields text[],
    created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_table_name_idx on public.audit_log (table_name);
create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id);

-- Solo admin y ti pueden leer la bitácora (puede contener referencias a
-- credenciales, sueldos, etc.). Nadie puede insertar/editar/borrar a mano:
-- solo el trigger (que corre con privilegios de servicio) puede escribir aquí.
alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select_ti_admin" on public.audit_log;
create policy "audit_log_select_ti_admin"
    on public.audit_log for select
    to authenticated
    using (public.current_user_role() in ('admin', 'ti'));

-- Función genérica de auditoría. SECURITY DEFINER para poder escribir en
-- audit_log sin depender de los permisos RLS del usuario que hizo el cambio.
create or replace function public.audit_trigger_func()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_record_id text;
    v_changed_fields text[];
begin
    if (TG_OP = 'DELETE') then
        v_record_id := (to_jsonb(OLD)->>'id');
        insert into public.audit_log (table_name, record_id, action, actor_id, old_data)
        values (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), to_jsonb(OLD));
        return OLD;
    elsif (TG_OP = 'UPDATE') then
        v_record_id := (to_jsonb(NEW)->>'id');
        select array_agg(key) into v_changed_fields
        from jsonb_each(to_jsonb(NEW)) n(key, value)
        where n.value is distinct from (to_jsonb(OLD) -> n.key);
        insert into public.audit_log (table_name, record_id, action, actor_id, old_data, new_data, changed_fields)
        values (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), to_jsonb(OLD), to_jsonb(NEW), v_changed_fields);
        return NEW;
    else -- INSERT
        v_record_id := (to_jsonb(NEW)->>'id');
        insert into public.audit_log (table_name, record_id, action, actor_id, new_data)
        values (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), to_jsonb(NEW));
        return NEW;
    end if;
end;
$$;

-- Engancha el trigger a las tablas importantes (se salta las que no existan).
do $$
declare
    audited_tables text[] := array[
        'assets', 'phones', 'licenses', 'software_licenses',
        'network_devices', 'ip_addresses', 'domains',
        'maintenance_logs', 'maintenance_workflows',
        'responsivas', 'credentials', 'employees',
        'hr_attendance', 'hr_checador_map', 'tickets', 'profiles'
    ];
    t text;
begin
    foreach t in array audited_tables loop
        if exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = t) then
            execute format('drop trigger if exists audit_trg on public.%I;', t);
            execute format(
                'create trigger audit_trg after insert or update or delete on public.%I
                 for each row execute function public.audit_trigger_func();',
                t
            );
        else
            raise notice 'Tabla % no existe, se omite de la bitácora.', t;
        end if;
    end loop;
end $$;
