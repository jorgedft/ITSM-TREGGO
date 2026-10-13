-- =====================================================================
-- Corrige equipos ya guardados con serial_number = '' (texto vacío)
-- en vez de NULL. El UNIQUE constraint "assets_serial_number_key" trata
-- dos textos vacíos como duplicados, pero permite varios NULL.
-- El formulario ya se corrigió para guardar NULL de ahora en adelante;
-- este script limpia lo que ya estaba guardado así.
-- =====================================================================

update public.assets
set serial_number = null
where serial_number is not null and trim(serial_number) = '';

-- (Opcional) Si tienes el mismo problema en otras tablas con campos
-- únicos y texto vacío, se limpiarían igual, por ejemplo:
-- update public.phones set imei = null where imei is not null and trim(imei) = '';
