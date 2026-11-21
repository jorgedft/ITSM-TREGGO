-- =====================================================================
-- Módulo Cotizaciones (Administración)
-- =====================================================================
-- Cotizaciones independientes con catálogo de productos/servicios, clientes
-- y datos del emisor (logo incluido). Acceso: solo admin y ti.
-- Requiere public.current_user_role() (001) y public.audit_trigger_func() (006).
-- =====================================================================

-- 1. DATOS DEL EMISOR (una sola fila, id = 1) ---------------------------
-- El logo se guarda como data URL (se reduce en el navegador antes de subirlo).
-- Esta tabla NO lleva trigger de auditoría: el logo inflaría la bitácora.
create table if not exists public.quote_settings (
    id smallint primary key default 1 check (id = 1),
    business_name text,
    legal_name text,
    rfc text,
    email text,
    phone text,
    website text,
    address text,
    logo text,
    logo_ratio numeric,
    bank_info text,
    default_validity_days integer not null default 15,
    default_payment_terms text,
    default_delivery text,
    default_notes text,
    updated_at timestamptz not null default now()
);

insert into public.quote_settings (id) values (1) on conflict (id) do nothing;

-- 2. CLIENTES ------------------------------------------------------------
create table if not exists public.quote_clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    contact_name text,
    rfc text,
    email text,
    phone text,
    address text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. CATÁLOGO DE PRODUCTOS Y SERVICIOS ---------------------------------
create table if not exists public.quote_catalog (
    id uuid primary key default gen_random_uuid(),
    kind text not null default 'producto',
    sku text,
    name text not null,
    description text,
    unit text not null default 'PZA',
    unit_price numeric not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.quote_catalog drop constraint if exists quote_catalog_kind_check;
alter table public.quote_catalog
    add constraint quote_catalog_kind_check check (kind in ('producto', 'servicio'));

-- 4. COTIZACIONES --------------------------------------------------------
-- items: [{description, detail, quantity, unit, unit_price, discount_pct, catalog_id}]
-- client_snapshot conserva los datos del cliente al momento de cotizar, así la
-- cotización no cambia si después se edita o elimina el cliente.
-- tax_mode: none = sin IVA | add = precios sin IVA (se suma) | included = precios con IVA incluido
create table if not exists public.quotes (
    id uuid primary key default gen_random_uuid(),
    folio text,
    quote_date date not null default current_date,
    valid_until date,
    client_id uuid references public.quote_clients(id) on delete set null,
    client_snapshot jsonb not null default '{}'::jsonb,
    status text not null default 'borrador',
    currency text not null default 'MXN',
    items jsonb not null default '[]'::jsonb,
    tax_mode text not null default 'add',
    tax_rate numeric not null default 16,
    ret_isr_rate numeric not null default 0,
    ret_iva_rate numeric not null default 0,
    subtotal numeric not null default 0,
    discount_total numeric not null default 0,
    tax_amount numeric not null default 0,
    ret_isr_amount numeric not null default 0,
    ret_iva_amount numeric not null default 0,
    total numeric not null default 0,
    payment_terms text,
    delivery_time text,
    notes text,
    created_by uuid default auth.uid() references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes
    add constraint quotes_status_check check (status in ('borrador', 'enviada', 'aceptada', 'rechazada'));

alter table public.quotes drop constraint if exists quotes_tax_mode_check;
alter table public.quotes
    add constraint quotes_tax_mode_check check (tax_mode in ('none', 'add', 'included'));

alter table public.quotes drop constraint if exists quotes_currency_check;
alter table public.quotes
    add constraint quotes_currency_check check (currency in ('MXN', 'USD'));

create index if not exists quotes_date_idx on public.quotes (quote_date desc);
create index if not exists quotes_client_idx on public.quotes (client_id);

-- Folio automático por año: COT-2026-0001
create or replace function public.quotes_set_folio()
returns trigger
language plpgsql
as $$
declare
    v_year text;
    v_next integer;
begin
    if NEW.folio is null or NEW.folio = '' then
        v_year := to_char(coalesce(NEW.quote_date, current_date), 'YYYY');
        select coalesce(max((regexp_match(folio, '([0-9]+)$'))[1]::integer), 0) + 1
          into v_next
          from public.quotes
         where folio like 'COT-' || v_year || '-%';
        NEW.folio := 'COT-' || v_year || '-' || lpad(v_next::text, 4, '0');
    end if;
    return NEW;
end;
$$;

drop trigger if exists quotes_folio_trg on public.quotes;
create trigger quotes_folio_trg before insert on public.quotes
    for each row execute function public.quotes_set_folio();

-- 5. SEGURIDAD (RLS) Y AUDITORÍA ----------------------------------------
do $$
declare
    t text;
begin
    foreach t in array array['quote_settings', 'quote_clients', 'quote_catalog', 'quotes'] loop
        execute format('alter table public.%I enable row level security;', t);
        execute format('drop policy if exists "%s_ti_admin" on public.%I;', t, t);
        execute format(
            'create policy "%s_ti_admin" on public.%I for all to authenticated
             using (public.current_user_role() in (''admin'', ''ti''))
             with check (public.current_user_role() in (''admin'', ''ti''));',
            t, t
        );
    end loop;

    foreach t in array array['quote_clients', 'quote_catalog', 'quotes'] loop
        execute format('drop trigger if exists audit_trg on public.%I;', t);
        execute format(
            'create trigger audit_trg after insert or update or delete on public.%I
             for each row execute function public.audit_trigger_func();',
            t
        );
    end loop;
end $$;
