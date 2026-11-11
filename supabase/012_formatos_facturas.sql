-- =====================================================================
-- Módulo Formatos y Facturas (Administración)
-- =====================================================================
-- Agrega:
--   1. purchase_requests  -> plantilla "Solicitud de Compra"
--   2. purchase_orders    -> plantilla "Orden de Compra"
--   3. document_vault     -> bóveda de facturas / cotizaciones (archivo + metadatos)
--
-- Acceso: igual que el resto de "Administración" -> solo admin y ti.
-- Requiere public.current_user_role() y public.audit_trigger_func()
-- (ver 001_roles_y_rls.sql y 006_bitacora_auditoria.sql).
-- =====================================================================

-- 1. SOLICITUDES DE COMPRA ------------------------------------------------
create table if not exists public.purchase_requests (
    id uuid primary key default gen_random_uuid(),
    folio text,
    request_date date not null default current_date,
    requesting_area text,
    requester text,
    cost_center text,
    provider text,
    issues_invoice boolean default true,
    payment_method text,              -- efectivo | transferencia | credito | tdc | otro
    bank_details text,
    payment_date date,
    items jsonb not null default '[]'::jsonb,   -- [{item, description, quantity, unit, unit_cost, total_cost, provider}]
    subtotal numeric default 0,
    iva numeric default 0,
    other_tax numeric default 0,
    total numeric default 0,
    required_date date,
    justification text,
    status text not null default 'pendiente',   -- pendiente | aprobada | rechazada
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.purchase_requests drop constraint if exists purchase_requests_status_check;
alter table public.purchase_requests
    add constraint purchase_requests_status_check
    check (status in ('pendiente', 'aprobada', 'rechazada'));

create index if not exists purchase_requests_created_at_idx on public.purchase_requests (created_at desc);
create index if not exists purchase_requests_status_idx on public.purchase_requests (status);

alter table public.purchase_requests enable row level security;

drop policy if exists "purchase_requests_ti_admin" on public.purchase_requests;
create policy "purchase_requests_ti_admin"
    on public.purchase_requests for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti'))
    with check (public.current_user_role() in ('admin', 'ti'));

drop trigger if exists audit_trg on public.purchase_requests;
create trigger audit_trg after insert or update or delete on public.purchase_requests
    for each row execute function public.audit_trigger_func();


-- 2. ÓRDENES DE COMPRA ----------------------------------------------------
create table if not exists public.purchase_orders (
    id uuid primary key default gen_random_uuid(),
    folio text,                       -- p.ej. OC-1026-15
    request_date date not null default current_date,
    status text not null default 'pendiente',   -- pendiente | aprobada | rechazada
    requester text,
    department text,
    expense_type text,
    provider text,
    description text,
    items jsonb not null default '[]'::jsonb,   -- [{description, quantity, unit, unit_price, total_price}]
    subtotal numeric default 0,
    iva numeric default 0,
    total numeric default 0,
    order_number text,
    order_date date,
    awarded_provider text,
    payment_terms text,
    delivery_time text,
    netsuite_po text,
    elaborated_by text,
    authorized_by text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.purchase_orders drop constraint if exists purchase_orders_status_check;
alter table public.purchase_orders
    add constraint purchase_orders_status_check
    check (status in ('pendiente', 'aprobada', 'rechazada'));

create index if not exists purchase_orders_created_at_idx on public.purchase_orders (created_at desc);
create index if not exists purchase_orders_status_idx on public.purchase_orders (status);

alter table public.purchase_orders enable row level security;

drop policy if exists "purchase_orders_ti_admin" on public.purchase_orders;
create policy "purchase_orders_ti_admin"
    on public.purchase_orders for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti'))
    with check (public.current_user_role() in ('admin', 'ti'));

drop trigger if exists audit_trg on public.purchase_orders;
create trigger audit_trg after insert or update or delete on public.purchase_orders
    for each row execute function public.audit_trigger_func();


-- 3. BÓVEDA DE FACTURAS Y COTIZACIONES ------------------------------------
create table if not exists public.document_vault (
    id uuid primary key default gen_random_uuid(),
    doc_type text not null,           -- factura | cotizacion | orden_compra | otro
    folio text,
    provider_client text,
    issue_date date,
    amount numeric,
    payment_status text not null default 'pendiente', -- pagada | pendiente | vencida
    department text,
    notes text,
    file_path text not null,
    file_name text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.document_vault drop constraint if exists document_vault_doc_type_check;
alter table public.document_vault
    add constraint document_vault_doc_type_check
    check (doc_type in ('factura', 'cotizacion', 'orden_compra', 'otro'));

alter table public.document_vault drop constraint if exists document_vault_payment_status_check;
alter table public.document_vault
    add constraint document_vault_payment_status_check
    check (payment_status in ('pagada', 'pendiente', 'vencida'));

create index if not exists document_vault_created_at_idx on public.document_vault (created_at desc);
create index if not exists document_vault_doc_type_idx on public.document_vault (doc_type);
create index if not exists document_vault_payment_status_idx on public.document_vault (payment_status);

alter table public.document_vault enable row level security;

drop policy if exists "document_vault_ti_admin" on public.document_vault;
create policy "document_vault_ti_admin"
    on public.document_vault for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti'))
    with check (public.current_user_role() in ('admin', 'ti'));

drop trigger if exists audit_trg on public.document_vault;
create trigger audit_trg after insert or update or delete on public.document_vault
    for each row execute function public.audit_trigger_func();

-- Bucket de almacenamiento para los archivos de la bóveda (facturas/cotizaciones).
insert into storage.buckets (id, name, public)
values ('document-vault', 'document-vault', false)
on conflict (id) do nothing;

drop policy if exists "document_vault_files_ti_admin" on storage.objects;
create policy "document_vault_files_ti_admin"
    on storage.objects for all
    to authenticated
    using (bucket_id = 'document-vault' and public.current_user_role() in ('admin', 'ti'))
    with check (bucket_id = 'document-vault' and public.current_user_role() in ('admin', 'ti'));
