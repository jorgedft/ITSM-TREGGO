-- =====================================================================
-- Notificaciones (en-app + disparador para push reales)
-- =====================================================================
-- Esta tabla es el "buzón" de cada usuario dentro de la app (campanita).
-- Cada vez que se inserta una fila aquí, un Database Webhook de Supabase
-- (configurado en el dashboard, ver supabase/functions/send-push/README.md)
-- llama a la Edge Function "send-push" para mandar también la notificación
-- real del navegador/celular.
-- =====================================================================

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    body text,
    link text,
    type text not null default 'general',
    read boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id, read);

-- Habilita Supabase Realtime en esta tabla para que la campanita se
-- actualice en vivo mientras la pestaña está abierta (independiente del
-- push real, que llega aunque esté cerrada).
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'notifications'
    ) then
        alter publication supabase_realtime add table public.notifications;
    end if;
end $$;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
    on public.notifications for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
    on public.notifications for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- Nadie inserta notificaciones a mano desde el cliente: solo las crean
-- las funciones de este archivo (SECURITY DEFINER, corren como el dueño
-- de la base y no dependen de las políticas de arriba).

-- Suscripciones de notificaciones push del navegador/celular de cada usuario.
-- Un usuario puede tener varias (celular + laptop, por ejemplo).
create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own"
    on public.push_subscriptions for all
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- =====================================================================
-- Funciones para crear notificaciones
-- =====================================================================

-- Notifica a un usuario puntual.
create or replace function public.notify_user(p_user_id uuid, p_title text, p_body text, p_link text, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.notifications (user_id, title, body, link, type)
    values (p_user_id, p_title, p_body, p_link, p_type);
end;
$$;

-- Notifica a todos los usuarios activos que tengan alguno de los roles dados.
create or replace function public.notify_roles(p_roles text[], p_title text, p_body text, p_link text, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.notifications (user_id, title, body, link, type)
    select id, p_title, p_body, p_link, p_type
    from public.profiles
    where role = any(p_roles) and coalesce(is_active, true);
end;
$$;

-- =====================================================================
-- Triggers que generan notificaciones automáticamente
-- =====================================================================

-- Nuevo ticket -> avisa a TI.
create or replace function public.trg_notify_new_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.notify_roles(
        array['admin', 'ti'],
        'Nuevo ticket: ' || coalesce(NEW.title, NEW.ticket_number, ''),
        'Categoría: ' || coalesce(NEW.category, 'General'),
        '/tickets/' || NEW.id,
        'ticket_nuevo'
    );
    return NEW;
end;
$$;

-- Ticket asignado a alguien -> avisa a esa persona.
create or replace function public.trg_notify_ticket_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if NEW.assigned_to is not null and NEW.assigned_to is distinct from OLD.assigned_to then
        perform public.notify_user(
            NEW.assigned_to,
            'Se te asignó un ticket',
            coalesce(NEW.title, NEW.ticket_number, ''),
            '/tickets/' || NEW.id,
            'ticket_asignado'
        );
    end if;
    return NEW;
end;
$$;

-- Nueva solicitud de vacaciones/permiso -> avisa a RH.
create or replace function public.trg_notify_vacation_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_employee_name text;
begin
    select full_name into v_employee_name from public.employees where id = NEW.employee_id;
    perform public.notify_roles(
        array['admin', 'rh'],
        'Nueva solicitud de vacaciones/permiso',
        coalesce(v_employee_name, 'Un colaborador') || ' solicitó ' || NEW.days_requested || ' día(s)',
        '/rh/vacaciones',
        'vacacion_nueva'
    );
    return NEW;
end;
$$;

do $$
begin
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tickets') then
        drop trigger if exists notify_new_ticket_trg on public.tickets;
        create trigger notify_new_ticket_trg after insert on public.tickets
            for each row execute function public.trg_notify_new_ticket();

        drop trigger if exists notify_ticket_assigned_trg on public.tickets;
        create trigger notify_ticket_assigned_trg after update on public.tickets
            for each row execute function public.trg_notify_ticket_assigned();
    end if;

    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='hr_vacation_requests') then
        drop trigger if exists notify_vacation_request_trg on public.hr_vacation_requests;
        create trigger notify_vacation_request_trg after insert on public.hr_vacation_requests
            for each row execute function public.trg_notify_vacation_request();
    end if;
end $$;
