-- =====================================================================
-- 016 — Parche de seguridad + Bóveda cifrada
-- =====================================================================
-- Requiere: 001 (current_user_role), 006 (audit_log / audit_trigger_func).
-- Es idempotente: se puede volver a correr.
--
-- Qué hace:
--   1. Cuentas nuevas SIN rol (quedan "pendientes" hasta que un admin las
--      apruebe) y usuarios desactivados sin acceso a nada.
--   2. Evita que un usuario se cambie a sí mismo el rol / is_active.
--   3. Los módulos de TI (incluida la Bóveda) solo se pueden LEER por
--      admin y ti (antes los leía cualquier usuario autenticado).
--   4. Tickets / comentarios exigen tener un rol.
--   5. La bitácora de auditoría deja de guardar contraseñas, y se
--      redactan las que ya estaban guardadas.
--   6. Bóveda cifrada en el navegador: tablas vault_config y
--      vault_access_log, y un trigger que impide guardar contraseñas en
--      texto plano una vez configurada la bóveda.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rol: sin rol por defecto + usuarios desactivados no tienen rol
-- ---------------------------------------------------------------------
alter table public.profiles alter column role drop not null;
alter table public.profiles alter column role drop default;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Sin rol: la cuenta queda pendiente hasta que un admin la apruebe.
    insert into public.profiles (id, full_name, email, role)
    values (new.id, new.raw_user_meta_data->>'full_name', new.email, null)
    on conflict (id) do nothing;
    return new;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
    select role from public.profiles where id = auth.uid() and is_active;
$$;

-- ---------------------------------------------------------------------
-- 2. Nadie (salvo un admin) puede cambiar roles ni reactivarse
--    (la política de profiles permitía editar la propia fila completa,
--    incluyendo "role": cualquiera podía hacerse admin).
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- auth.uid() es null cuando corre el SQL Editor o la service key: se permite.
    if auth.uid() is not null and public.current_user_role() is distinct from 'admin' then
        if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
            raise exception 'Solo un administrador puede cambiar el rol o el estado de una cuenta.'
                using errcode = '42501';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists protect_profile_privileges_trg on public.profiles;
create trigger protect_profile_privileges_trg
    before update on public.profiles
    for each row execute function public.protect_profile_privileges();

-- Un perfil nuevo creado por un cliente (no admin) nunca puede traer rol.
-- (insert ya está limitado a admin por la política, esto es defensa extra)

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
    on public.profiles for select
    to authenticated
    using (id = auth.uid() or public.current_user_role() is not null);

-- ---------------------------------------------------------------------
-- 3. Módulos de TI: lectura solo admin / ti (la política "_write_ti_admin"
--    ya es FOR ALL y cubre también el SELECT).
-- ---------------------------------------------------------------------
do $$
declare
    t text;
    ti_tables text[] := array[
        'assets', 'phones', 'licenses', 'software_licenses', 'network_devices',
        'ip_addresses', 'domains', 'maintenance_logs', 'maintenance_workflows',
        'responsivas', 'credentials'
    ];
begin
    foreach t in array ti_tables loop
        if exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = t) then
            execute format('drop policy if exists "%s_select_all" on public.%I;', t, t);
            execute format('drop policy if exists "%s_write_ti_admin" on public.%I;', t, t);
            execute format(
                'create policy "%s_write_ti_admin" on public.%I for all to authenticated
                 using (public.current_user_role() in (''admin'', ''ti''))
                 with check (public.current_user_role() in (''admin'', ''ti''));', t, t);
        end if;
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Tickets: exigir un rol (las cuentas pendientes no ven ni crean nada)
-- ---------------------------------------------------------------------
do $$
begin
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tickets') then
        drop policy if exists "tickets_select_all" on public.tickets;
        create policy "tickets_select_all" on public.tickets for select to authenticated
            using (public.current_user_role() is not null);

        drop policy if exists "tickets_insert_all" on public.tickets;
        create policy "tickets_insert_all" on public.tickets for insert to authenticated
            with check (public.current_user_role() is not null);

        drop policy if exists "tickets_update_owner_or_ti" on public.tickets;
        create policy "tickets_update_owner_or_ti" on public.tickets for update to authenticated
            using ((requester_id = auth.uid() and public.current_user_role() is not null)
                   or public.current_user_role() in ('admin', 'ti'))
            with check ((requester_id = auth.uid() and public.current_user_role() is not null)
                        or public.current_user_role() in ('admin', 'ti'));
    end if;

    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'ticket_comments') then
        drop policy if exists "ticket_comments_select_all" on public.ticket_comments;
        create policy "ticket_comments_select_all" on public.ticket_comments for select to authenticated
            using (public.current_user_role() is not null);

        drop policy if exists "ticket_comments_insert_all" on public.ticket_comments;
        create policy "ticket_comments_insert_all" on public.ticket_comments for insert to authenticated
            with check (public.current_user_role() is not null);
    end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Bitácora de auditoría sin contraseñas
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger_func()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_record_id text;
    v_changed_fields text[];
    v_old jsonb;
    v_new jsonb;
    v_secret text[] := array['password_hash', 'password'];
    k text;
begin
    if TG_OP in ('UPDATE', 'DELETE') then v_old := to_jsonb(OLD); end if;
    if TG_OP in ('UPDATE', 'INSERT') then v_new := to_jsonb(NEW); end if;

    if TG_OP = 'UPDATE' then
        -- Los campos cambiados se calculan ANTES de ocultar los secretos.
        select array_agg(key) into v_changed_fields
        from jsonb_each(v_new) n(key, value)
        where n.value is distinct from (v_old -> n.key);
    end if;

    -- Nunca se guardan contraseñas (ni cifradas) en la bitácora.
    foreach k in array v_secret loop
        if v_old ? k then v_old := jsonb_set(v_old, array[k], '"[oculto]"'); end if;
        if v_new ? k then v_new := jsonb_set(v_new, array[k], '"[oculto]"'); end if;
    end loop;

    if TG_OP = 'DELETE' then
        v_record_id := v_old->>'id';
        insert into public.audit_log (table_name, record_id, action, actor_id, old_data)
        values (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old);
        return OLD;
    elsif TG_OP = 'UPDATE' then
        v_record_id := v_new->>'id';
        insert into public.audit_log (table_name, record_id, action, actor_id, old_data, new_data, changed_fields)
        values (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new, v_changed_fields);
        return NEW;
    else
        v_record_id := v_new->>'id';
        insert into public.audit_log (table_name, record_id, action, actor_id, new_data)
        values (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_new);
        return NEW;
    end if;
end;
$$;

-- Redacta las contraseñas que ya estaban guardadas en la bitácora
-- (solo se reemplaza el valor del campo; el resto del registro no se toca).
update public.audit_log
   set old_data = jsonb_set(old_data, '{password_hash}', '"[oculto]"')
 where old_data ? 'password_hash' and old_data->>'password_hash' is distinct from '[oculto]';
update public.audit_log
   set new_data = jsonb_set(new_data, '{password_hash}', '"[oculto]"')
 where new_data ? 'password_hash' and new_data->>'password_hash' is distinct from '[oculto]';
update public.audit_log
   set old_data = jsonb_set(old_data, '{password}', '"[oculto]"')
 where old_data ? 'password' and old_data->>'password' is distinct from '[oculto]';
update public.audit_log
   set new_data = jsonb_set(new_data, '{password}', '"[oculto]"')
 where new_data ? 'password' and new_data->>'password' is distinct from '[oculto]';

-- ---------------------------------------------------------------------
-- 6. Bóveda cifrada (el cifrado ocurre en el navegador; aquí solo se
--    guardan llaves ENVUELTAS, nunca la frase maestra ni la llave de
--    recuperación).
-- ---------------------------------------------------------------------
create table if not exists public.vault_config (
    id smallint primary key default 1 check (id = 1),
    version smallint not null default 1,
    kdf_iterations integer not null check (kdf_iterations >= 200000),
    pass_salt text not null,
    wrapped_dek_pass text not null,
    recovery_salt text not null,
    wrapped_dek_recovery text not null,
    updated_at timestamptz not null default now(),
    updated_by uuid references public.profiles(id) on delete set null
);

alter table public.vault_config enable row level security;

drop policy if exists "vault_config_select" on public.vault_config;
create policy "vault_config_select" on public.vault_config for select to authenticated
    using (public.current_user_role() in ('admin', 'ti'));

drop policy if exists "vault_config_insert" on public.vault_config;
create policy "vault_config_insert" on public.vault_config for insert to authenticated
    with check (public.current_user_role() in ('admin', 'ti'));

drop policy if exists "vault_config_update" on public.vault_config;
create policy "vault_config_update" on public.vault_config for update to authenticated
    using (public.current_user_role() in ('admin', 'ti'))
    with check (public.current_user_role() in ('admin', 'ti'));
-- (sin política DELETE: la configuración no se puede borrar desde la app)

-- Registro de accesos: solo se agrega, nunca se edita ni se borra.
create table if not exists public.vault_access_log (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid default auth.uid() references public.profiles(id) on delete set null,
    action text not null check (action in (
        'setup', 'unlock', 'unlock_failed', 'reveal', 'copy',
        'change_phrase', 'recovery_reset', 'backup', 'restore', 'migrate'
    )),
    credential_id uuid,
    credential_title text,
    created_at timestamptz not null default now()
);
create index if not exists vault_access_log_created_idx on public.vault_access_log (created_at desc);

alter table public.vault_access_log enable row level security;

drop policy if exists "vault_access_log_select" on public.vault_access_log;
create policy "vault_access_log_select" on public.vault_access_log for select to authenticated
    using (public.current_user_role() in ('admin', 'ti'));

drop policy if exists "vault_access_log_insert" on public.vault_access_log;
create policy "vault_access_log_insert" on public.vault_access_log for insert to authenticated
    with check (public.current_user_role() in ('admin', 'ti') and actor_id = auth.uid());
-- (sin políticas UPDATE/DELETE: append-only)

-- Una vez configurada la bóveda, credentials.password_hash solo acepta
-- texto cifrado con el formato "v1.<iv>.<ciphertext>" (base64url).
-- Las filas antiguas en texto plano pueden seguir existiendo hasta que se
-- migren desde la app, pero no se puede escribir texto plano nuevo.
create or replace function public.enforce_credential_encryption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from public.vault_config) then
        return new;
    end if;
    if new.password_hash is null or new.password_hash = '' then
        return new;
    end if;
    if tg_op = 'UPDATE' and new.password_hash is not distinct from old.password_hash then
        return new;
    end if;
    if new.password_hash !~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$' then
        raise exception 'La bóveda está cifrada: la contraseña debe guardarse cifrada.'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

drop trigger if exists enforce_credential_encryption_trg on public.credentials;
create trigger enforce_credential_encryption_trg
    before insert or update on public.credentials
    for each row execute function public.enforce_credential_encryption();

-- Evita que la configuración se vacíe/reemplace con llaves inválidas por error:
-- las llaves envueltas deben tener el formato esperado.
alter table public.vault_config drop constraint if exists vault_config_format_chk;
alter table public.vault_config add constraint vault_config_format_chk check (
    wrapped_dek_pass ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    and wrapped_dek_recovery ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
);

-- ---------------------------------------------------------------------
-- Después de correr esto:
--   * Las cuentas nuevas quedan "pendientes". Para aprobar una:
--       update public.profiles set role = 'ti' where email = 'persona@treggo.mx';
-- ---------------------------------------------------------------------
