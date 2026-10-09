-- =====================================================================
-- ITSM Treggo — Roles (admin / ti / rh) + Row Level Security
-- =====================================================================
-- Ejecutar completo en: Supabase Dashboard → SQL Editor → New query
--
-- Qué hace:
--   1. Crea una función que lee el rol del usuario autenticado sin
--      provocar recursión en las políticas de RLS.
--   2. Activa RLS en las tablas del sistema.
--   3. Define las políticas:
--        - admin y ti  -> acceso total (SELECT/INSERT/UPDATE/DELETE)
--                         en TODOS los módulos (TI y RH).
--        - rh          -> acceso total en módulos de RH,
--                         SOLO LECTURA en módulos de TI.
--
-- IMPORTANTE antes de correrlo:
--   - Revisa que los nombres de tabla coincidan con tu base real
--     (ajusta la lista TI_TABLES más abajo si falta/sobra alguna).
--   - Después de correr el script, asigna el rol correcto a cada
--     usuario existente, por ejemplo:
--       update public.profiles set role = 'admin' where email = 'jorge.daniel@treggo.mx';
--   - Los valores válidos de profiles.role usados por el sistema son:
--       'admin', 'ti', 'rh'
-- =====================================================================

-- 1. Función auxiliar: rol del usuario autenticado actual.
--    SECURITY DEFINER evita que esta consulta dispare de nuevo las
--    políticas de RLS sobre "profiles" (evitaría recursión infinita).
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
    select role from public.profiles where id = auth.uid();
$$;

-- 2. Tabla profiles: todos los autenticados pueden leer (se usa para
--    mostrar nombres en relaciones: assignee, requester, etc.);
--    solo admin puede crear/editar/borrar perfiles de otros.
--    Cada usuario puede editar su propio perfil (campos no sensibles
--    se filtran ya en el backend / updateUser).
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
    on public.profiles for select
    to authenticated
    using (true);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
    on public.profiles for update
    to authenticated
    using (id = auth.uid() or public.current_user_role() = 'admin')
    with check (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
    on public.profiles for insert
    to authenticated
    with check (public.current_user_role() = 'admin');

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
    on public.profiles for delete
    to authenticated
    using (public.current_user_role() = 'admin');


-- 3. Módulos de INFRAESTRUCTURA Y TI
--    Lectura: admin, ti, rh (todos los autenticados).
--    Escritura (insert/update/delete): solo admin y ti.
--    Ajusta esta lista si tu base tiene nombres distintos.
do $$
declare
    ti_tables text[] := array[
        'assets',
        'phones',
        'licenses',
        'software_licenses',
        'network_devices',
        'ip_addresses',
        'domains',
        'maintenance_logs',
        'maintenance_workflows',
        'responsivas',
        'credentials'
    ];
    t text;
begin
    foreach t in array ti_tables loop
        if exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = t) then

            execute format('alter table public.%I enable row level security;', t);

            execute format('drop policy if exists "%s_select_all" on public.%I;', t, t);
            execute format(
                'create policy "%s_select_all" on public.%I for select to authenticated using (true);',
                t, t
            );

            execute format('drop policy if exists "%s_write_ti_admin" on public.%I;', t, t);
            execute format(
                'create policy "%s_write_ti_admin" on public.%I for all to authenticated
                 using (public.current_user_role() in (''admin'', ''ti''))
                 with check (public.current_user_role() in (''admin'', ''ti''));',
                t, t
            );
        else
            raise notice 'Tabla % no existe, se omite.', t;
        end if;
    end loop;
end $$;


-- 4. Helpdesk (tickets): módulo compartido, no exclusivo de TI.
--    Cualquier autenticado puede crear tickets y ver/comentar los suyos;
--    admin y ti pueden gestionar todos.
do $$
begin
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = 'tickets') then
        execute 'alter table public.tickets enable row level security;';

        execute 'drop policy if exists "tickets_select_all" on public.tickets;';
        execute 'create policy "tickets_select_all" on public.tickets for select to authenticated using (true);';

        execute 'drop policy if exists "tickets_insert_all" on public.tickets;';
        execute 'create policy "tickets_insert_all" on public.tickets for insert to authenticated with check (true);';

        execute 'drop policy if exists "tickets_update_owner_or_ti" on public.tickets;';
        execute 'create policy "tickets_update_owner_or_ti" on public.tickets for update to authenticated
                 using (requester_id = auth.uid() or public.current_user_role() in (''admin'', ''ti''))
                 with check (requester_id = auth.uid() or public.current_user_role() in (''admin'', ''ti''));';

        execute 'drop policy if exists "tickets_delete_ti_admin" on public.tickets;';
        execute 'create policy "tickets_delete_ti_admin" on public.tickets for delete to authenticated
                 using (public.current_user_role() in (''admin'', ''ti''));';
    end if;

    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = 'ticket_comments') then
        execute 'alter table public.ticket_comments enable row level security;';

        execute 'drop policy if exists "ticket_comments_select_all" on public.ticket_comments;';
        execute 'create policy "ticket_comments_select_all" on public.ticket_comments for select to authenticated using (true);';

        execute 'drop policy if exists "ticket_comments_insert_all" on public.ticket_comments;';
        execute 'create policy "ticket_comments_insert_all" on public.ticket_comments for insert to authenticated with check (true);';
    end if;
end $$;


-- 5. Módulo de RECURSOS HUMANOS
--    "employees" ya existe hoy (se usa en Bóveda para asignar
--    credenciales). admin, ti y rh tienen acceso total.
--    Cuando se diseñen las tablas de incidencias/asistencia,
--    vacaciones, nómina y reclutamiento, agrégalas a rh_tables.
do $$
declare
    rh_tables text[] := array[
        'employees'
        -- , 'hr_attendance'
        -- , 'hr_vacation_requests'
        -- , 'hr_payroll'
        -- , 'hr_job_openings'
    ];
    t text;
begin
    foreach t in array rh_tables loop
        if exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = t) then

            execute format('alter table public.%I enable row level security;', t);

            execute format('drop policy if exists "%s_full_rh" on public.%I;', t, t);
            execute format(
                'create policy "%s_full_rh" on public.%I for all to authenticated
                 using (public.current_user_role() in (''admin'', ''ti'', ''rh''))
                 with check (public.current_user_role() in (''admin'', ''ti'', ''rh''));',
                t, t
            );
        else
            raise notice 'Tabla % no existe, se omite.', t;
        end if;
    end loop;
end $$;
