-- =====================================================================
-- Módulo Registros de TI (Administración)
-- =====================================================================
-- Una sola tabla para los formatos de gestión de TI; el tipo de formato va
-- en "kind" y los campos propios de cada formato en "data" (jsonb):
--   alta_baja_cambio | acceso | incidente | responsiva | respaldo | visita
--
-- Acceso: solo admin y ti (igual que el resto de Administración).
-- Requiere public.current_user_role() (001) y public.audit_trigger_func() (006).
-- =====================================================================

create table if not exists public.it_records (
    id uuid primary key default gen_random_uuid(),
    kind text not null,
    folio text,
    record_date date not null default current_date,
    title text,
    status text,
    data jsonb not null default '{}'::jsonb,
    created_by uuid default auth.uid() references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.it_records drop constraint if exists it_records_kind_check;
alter table public.it_records
    add constraint it_records_kind_check
    check (kind in ('alta_baja_cambio', 'acceso', 'incidente', 'responsiva', 'respaldo', 'visita'));

create index if not exists it_records_kind_date_idx on public.it_records (kind, record_date desc);

-- Folio automático por formato y año: ABC-2026-0001, INC-2026-0007, etc.
create or replace function public.it_records_set_folio()
returns trigger
language plpgsql
as $$
declare
    v_prefix text;
    v_year text;
    v_next integer;
begin
    if NEW.folio is null or NEW.folio = '' then
        v_year := to_char(coalesce(NEW.record_date, current_date), 'YYYY');
        v_prefix := case NEW.kind
            when 'alta_baja_cambio' then 'ABC'
            when 'acceso' then 'ACC'
            when 'incidente' then 'INC'
            when 'responsiva' then 'RES'
            when 'respaldo' then 'BKP'
            when 'visita' then 'VIS'
            else 'REG'
        end;
        select coalesce(max((regexp_match(folio, '([0-9]+)$'))[1]::integer), 0) + 1
          into v_next
          from public.it_records
         where kind = NEW.kind
           and folio like v_prefix || '-' || v_year || '-%';
        NEW.folio := v_prefix || '-' || v_year || '-' || lpad(v_next::text, 4, '0');
    end if;
    return NEW;
end;
$$;

drop trigger if exists it_records_folio_trg on public.it_records;
create trigger it_records_folio_trg before insert on public.it_records
    for each row execute function public.it_records_set_folio();

alter table public.it_records enable row level security;

drop policy if exists "it_records_ti_admin" on public.it_records;
create policy "it_records_ti_admin"
    on public.it_records for all
    to authenticated
    using (public.current_user_role() in ('admin', 'ti'))
    with check (public.current_user_role() in ('admin', 'ti'));

drop trigger if exists audit_trg on public.it_records;
create trigger audit_trg after insert or update or delete on public.it_records
    for each row execute function public.audit_trigger_func();
