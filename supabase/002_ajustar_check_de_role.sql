-- =====================================================================
-- Ajusta el CHECK constraint de profiles.role para admitir 'admin',
-- 'ti' y 'rh'. Hay filas existentes con valores fuera de ese conjunto
-- (ej. 'user'), así que primero hay que normalizarlas o el ALTER
-- fallará con "check constraint ... is violated by some row".
-- =====================================================================

-- 1. Ver qué valores de role existen hoy y cuántas filas tiene cada uno.
select role, count(*) from public.profiles group by role;

-- 2. Normaliza cada fila a un valor válido. Ajusta el email de cada
--    quien corresponda; agrega una línea update por persona si hace falta.
--    Ejemplo (edita antes de correr):
update public.profiles set role = 'admin' where email = 'jorge.daniel@treggo.mx';
update public.profiles set role = 'rh'    where email = 'rh_1@treggo.mx';
-- Cualquier otra fila que haya quedado con un valor fuera de
-- ('admin','ti','rh') debe actualizarse aquí también, por ejemplo:
-- update public.profiles set role = 'ti' where role not in ('admin', 'ti', 'rh');

-- 3. Verifica que ya no quede ningún valor fuera del set permitido
--    (debe regresar 0 filas antes de continuar):
select * from public.profiles where role not in ('admin', 'ti', 'rh');

-- 4. Ahora sí, reemplaza el constraint.
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
    add constraint profiles_role_check
    check (role in ('admin', 'ti', 'rh'));
