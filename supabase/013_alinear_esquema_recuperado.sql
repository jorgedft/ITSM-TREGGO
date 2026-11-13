-- =====================================================================
-- Alinear esquema reconstruido (000) con el esquema REAL del proyecto viejo
-- =====================================================================
-- 000_schema_bootstrap.sql infirió las columnas leyendo el código del
-- frontend (solo lo que la UI actual usa). Al recuperar acceso de solo
-- lectura al proyecto viejo vía su API (la Service Role Key seguía
-- funcionando aunque el dashboard estaba bloqueado por MFA), se pudo leer
-- su esquema OpenAPI real y aparecieron columnas adicionales que el
-- frontend nunca llegó a usar (quedaron de un diseño más amplio).
--
-- Corre esto ANTES de migrar los datos reales del proyecto viejo, para que
-- ninguna fila se rechace por "columna no existe".
-- =====================================================================

-- assets: columnas adicionales reales (no usadas por el frontend actual)
alter table public.assets
  add column if not exists purchase_date date,
  add column if not exists warranty_until date,
  add column if not exists purchase_price numeric,
  add column if not exists specs jsonb,
  add column if not exists notes text,
  add column if not exists assigned_at timestamptz,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists department text,
  add column if not exists category text default 'Laptop';

-- phones
alter table public.phones
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- licenses: "seats" existía además de "seats_purchased" (duplicado histórico)
alter table public.licenses
  add column if not exists seats integer default 1;

-- maintenance_workflows
alter table public.maintenance_workflows
  add column if not exists steps text default '',
  add column if not exists tags text;

-- profiles: columnas adicionales reales
alter table public.profiles
  add column if not exists department text,
  add column if not exists phone_ext text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default now();

-- credentials
alter table public.credentials
  add column if not exists is_encrypted boolean not null default false;

-- ip_addresses: el PK real es "id" (uuid), no "ip_address". Se reestructura
-- aquí porque la tabla está vacía todavía (nada que perder).
alter table public.ip_addresses drop constraint if exists ip_addresses_pkey;
alter table public.ip_addresses add column if not exists id uuid default gen_random_uuid();
update public.ip_addresses set id = gen_random_uuid() where id is null;
alter table public.ip_addresses alter column id set not null;
alter table public.ip_addresses add constraint ip_addresses_pkey primary key (id);
alter table public.ip_addresses drop constraint if exists ip_addresses_ip_address_key;
alter table public.ip_addresses add constraint ip_addresses_ip_address_key unique (ip_address);
alter table public.ip_addresses
  add column if not exists subnet text default '192.168.1.0/24',
  add column if not exists asset_id uuid references public.assets(id) on delete set null,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

-- tickets: columnas adicionales reales
alter table public.tickets
  add column if not exists asset_id uuid references public.assets(id) on delete set null,
  add column if not exists resolution text,
  add column if not exists resolved_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists due_date timestamptz,
  add column if not exists sla_breached boolean not null default false,
  add column if not exists attachments jsonb,
  add column if not exists tags text[],
  add column if not exists updated_at timestamptz not null default now();

-- ticket_comments: la columna real es "body" + "is_internal", no "comment"
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='ticket_comments' and column_name='comment') then
    alter table public.ticket_comments rename column comment to body;
  end if;
end $$;
alter table public.ticket_comments
  add column if not exists is_internal boolean not null default false;

-- responsivas: estructura real más amplia que la que usa hoy el frontend
alter table public.responsivas
  add column if not exists folio text,
  add column if not exists asset_id uuid references public.assets(id) on delete set null,
  add column if not exists phone_id uuid references public.phones(id) on delete set null,
  add column if not exists signed_at date default current_date,
  add column if not exists pdf_url text,
  add column if not exists pdf_path text,
  add column if not exists return_date date,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.responsivas alter column status set default 'active';
