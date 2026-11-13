-- =====================================================================
-- Bootstrap del esquema "pre-existente"
-- =====================================================================
-- Recrea, con la mejor inferencia posible a partir del código fuente del
-- cliente, las tablas que en el proyecto original se crearon directo desde
-- el Table Editor de Supabase y NUNCA tuvieron un script .sql en este
-- repositorio (por eso no aparecen en 001-012).
--
-- ÚSALO SOLO SI ESTÁS RECONSTRUYENDO EL PROYECTO DESDE CERO (perdiste el
-- acceso a la cuenta de Supabase original). Si todavía tienes la base de
-- datos original intacta, NO corras este script ahí — podría chocar con
-- columnas/constraints reales que no coinciden exactamente con esta
-- inferencia (ver supabase/SCHEMA.md para las notas de incertidumbre,
-- marcadas con ⚠️ más abajo también).
--
-- Orden de scripts para una reconstrucción completa:
--   1. Este archivo (000_schema_bootstrap.sql)
--   2. 001_roles_y_rls.sql ... 012_formatos_facturas.sql (en orden, ver README.md)
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles (normalmente la crea/llena un trigger de Supabase Auth sobre
-- auth.users; aquí solo se deja la forma de la tabla que el código espera).
-- Si tu proyecto nuevo ya tiene esta tabla via una plantilla de Supabase,
-- SOLO agrega las columnas que falten con los ALTER de abajo.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    email text,
    role text not null default 'ti',
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists is_active boolean not null default true;

-- Trigger sugerido para que cada alta en auth.users cree su fila en
-- public.profiles automáticamente (ajusta el role por defecto si quieres).
-- Verifica primero que no exista ya algo equivalente en tu proyecto nuevo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, email, role)
    values (new.id, new.raw_user_meta_data->>'full_name', new.email, 'ti')
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- assets (Equipos — ITAM)
-- ⚠️ "assigned_to" se guarda como TEXTO LIBRE (nombre de la persona) en
-- casi todo el código (AssetForm.jsx, AssetList.jsx, CSV), pero
-- AssetDetail.jsx lo consulta como si fuera FK a profiles. Se deja como
-- TEXT aquí (la mayoría de los usos), pero si AssetDetail.jsx deja de
-- funcionar tras la reconstrucción, esa es la causa — ver SCHEMA.md.
-- ---------------------------------------------------------------------
create table if not exists public.assets (
    id uuid primary key default gen_random_uuid(),
    asset_tag text,
    asset_code text,              -- duplicado de asset_tag (compatibilidad histórica)
    asset_type text,
    brand text,
    model text,
    serial_number text,
    status text default 'Asignado',
    condition text default 'Excelente',
    assigned_to text,
    location text,
    warranty_info text,
    warranty_expiration date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

drop index if exists assets_serial_number_key;
create unique index assets_serial_number_key
    on public.assets (serial_number)
    where serial_number is not null;


-- ---------------------------------------------------------------------
-- phones (Telefonía)
-- ---------------------------------------------------------------------
create table if not exists public.phones (
    id uuid primary key default gen_random_uuid(),
    brand text,
    model text,
    imei text,
    phone_number text,
    assigned_to text,
    contract_plan text,
    department text,
    esim boolean,
    service_start_date date,
    service_end_date date,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- licenses (Licencias de software)
-- ⚠️ Dashboard.jsx consulta la tabla "software_licenses" con una columna
-- "status" que aquí NO se recrea, porque el resto del código (LicenseList/
-- LicenseForm) confirma que la tabla real es "licenses" y no usa "status"
-- (el vencimiento se calcula en el cliente desde expiration_date). Revisa
-- la nota en SCHEMA.md si quieres corregir ese bug del Dashboard.
-- ---------------------------------------------------------------------
create table if not exists public.licenses (
    id uuid primary key default gen_random_uuid(),
    software_name text not null,
    provider text,
    license_key text,
    seats_purchased integer default 1,
    expiration_date date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- network_devices (parece sin uso actual; se incluye por si tiene datos
-- históricos — ver nota en SCHEMA.md)
-- ---------------------------------------------------------------------
create table if not exists public.network_devices (
    id uuid primary key default gen_random_uuid(),
    name text,
    ip_address text,
    mac_address text,
    location text,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- ip_addresses (Mapa de Red)
-- ---------------------------------------------------------------------
create table if not exists public.ip_addresses (
    ip_address text primary key,
    device_type text default 'PC',
    status text default 'AVAILABLE',
    mac_address text,
    assigned_user_text text,
    notes text,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- domains (Dominios)
-- ---------------------------------------------------------------------
create table if not exists public.domains (
    id uuid primary key default gen_random_uuid(),
    domain_name text not null,
    provider text,
    dns_provider text,
    ip_address text,
    expiration_date date,
    notes text,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- maintenance_logs (Bitácora de mantenimiento)
-- Debe existir ANTES que maintenance_schedules (011), que la referencia.
-- ---------------------------------------------------------------------
create table if not exists public.maintenance_logs (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid references public.assets(id) on delete cascade,
    maintenance_type text default 'Preventivo',
    technician_name text,
    description text,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- maintenance_workflows (Bóveda de guías de mantenimiento)
-- ---------------------------------------------------------------------
create table if not exists public.maintenance_workflows (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    category text default 'General',
    file_path text,
    file_name text,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- responsivas (Cartas responsivas)
-- ---------------------------------------------------------------------
create table if not exists public.responsivas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete set null,
    notes text,
    status text not null default 'PENDING',
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- credentials (Bóveda de Credenciales de TI)
-- ⚠️ "password_hash" guarda la contraseña en TEXTO PLANO en el código
-- actual (ver SCHEMA.md) — se mantiene el nombre de columna tal cual para
-- no romper el código, pero no es un hash real.
-- ---------------------------------------------------------------------
-- OJO: "assigned_to" se deja sin la referencia FK aquí porque "employees"
-- todavía no existe en este punto (la crea 003_tabla_employees.sql, que
-- corre después). Más abajo, al final de este archivo, hay un bloque que
-- agrega esa FK si "employees" ya existe — vuelve a correr ese bloque (o
-- todo este script) después del 003 si lo corriste antes.
create table if not exists public.credentials (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    category text default 'General',
    username text,
    password_hash text,
    url_link text,
    assigned_to uuid,
    notes text,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- tickets (Mesa de Ayuda)
-- ⚠️ Columna del solicitante: se usa "requester_id" aquí porque así lo
-- esperan 001_roles_y_rls.sql y Dashboard.jsx (con la FK nombrada
-- tickets_requester_id_fkey, que TicketList.jsx/TicketDetail.jsx en
-- cambio no usan — ver advertencia detallada en SCHEMA.md). Si prefieres
-- que el código deje de estar dividido entre dos nombres, usa esta
-- columna como la única fuente de verdad y actualiza TicketList.jsx /
-- TicketDetail.jsx para consultar "requester_id" en vez de "user_id".
-- ---------------------------------------------------------------------
create table if not exists public.tickets (
    id uuid primary key default gen_random_uuid(),
    ticket_number text,
    title text not null,
    description text,
    category text default 'SOPORTE',
    priority text default 'MEDIUM',
    status text not null default 'OPEN',
    requester_id uuid default auth.uid() references public.profiles(id) on delete set null,
    assigned_to uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.tickets drop constraint if exists tickets_requester_id_fkey;
alter table public.tickets
    add constraint tickets_requester_id_fkey
    foreign key (requester_id) references public.profiles(id) on delete set null;

-- ticket_comments: referenciada defensivamente en 001_roles_y_rls.sql pero
-- sin uso visible en el frontend actual. Se incluye por si la necesitas.
create table if not exists public.ticket_comments (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid references public.tickets(id) on delete cascade,
    author_id uuid references public.profiles(id) on delete set null,
    comment text,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- Bucket de almacenamiento para las guías/documentos de mantenimiento
-- (maintenance_workflows). Tampoco tenía script en el repo; se recrea
-- aquí con el mismo criterio de acceso (admin/ti) que el resto de TI.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('workflow-attachments', 'workflow-attachments', false)
on conflict (id) do nothing;

-- La política depende de current_user_role(), que recién crea 001_roles_y_rls.sql
-- (este script 000 corre antes). Si no existe todavía, se omite con un aviso;
-- basta con volver a correr este bloque (o todo 000) después del 001.
do $$
begin
    if exists (select 1 from pg_proc where proname = 'current_user_role') then
        drop policy if exists "workflow_attachments_ti_admin" on storage.objects;
        execute 'create policy "workflow_attachments_ti_admin"
            on storage.objects for all
            to authenticated
            using (bucket_id = ''workflow-attachments'' and public.current_user_role() in (''admin'', ''ti''))
            with check (bucket_id = ''workflow-attachments'' and public.current_user_role() in (''admin'', ''ti''));';
    else
        raise notice 'current_user_role() no existe todavia (corre 001_roles_y_rls.sql primero). Vuelve a correr este bloque de 000_schema_bootstrap.sql despues de ese script.';
    end if;
end $$;


-- ---------------------------------------------------------------------
-- FK diferida: credentials.assigned_to -> employees.id
-- "employees" la crea 003_tabla_employees.sql (después de este script), así
-- que la FK se agrega aquí solo si ya existe. Si corriste 000 antes del 003,
-- vuelve a correr este bloque (o todo 000) después de ese script.
-- ---------------------------------------------------------------------
do $$
begin
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'employees') then
        alter table public.credentials drop constraint if exists credentials_assigned_to_fkey;
        alter table public.credentials
            add constraint credentials_assigned_to_fkey
            foreign key (assigned_to) references public.employees(id) on delete set null;
    else
        raise notice 'La tabla "employees" no existe todavia (corre 003_tabla_employees.sql primero). Vuelve a correr este bloque de 000_schema_bootstrap.sql despues de ese script.';
    end if;
end $$;
