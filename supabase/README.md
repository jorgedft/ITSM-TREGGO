# Scripts SQL — Supabase

## Cómo ejecutar `001_roles_y_rls.sql`

1. Entra a tu proyecto en [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Pega el contenido completo de `001_roles_y_rls.sql`.
3. Revisa la lista `ti_tables` y `rh_tables` dentro del script: si alguna tabla de tu base tiene otro nombre, ajústala antes de correr.
4. Ejecuta (Run). El script es idempotente: puedes volver a correrlo sin duplicar políticas (usa `drop policy if exists`).
5. Asigna el rol correcto a cada usuario en la tabla `profiles`:

   ```sql
   update public.profiles set role = 'admin' where email = 'jorge.daniel@treggo.mx';
   update public.profiles set role = 'rh'    where email = 'correo-de-rh@treggo.mx';
   ```

   Roles válidos: `admin`, `ti`, `rh`.

## Qué queda protegido

| Módulo | admin / ti | rh |
|---|---|---|
| Equipos, Teléfonos, Licencias, Red/IPs, Mantenimiento, Bóveda | Lectura + escritura | Solo lectura |
| Tickets | Lectura + escritura total | Lectura total, escritura solo en los propios |
| Recursos Humanos (Colaboradores, etc.) | Lectura + escritura | Lectura + escritura |

La UI (botones ocultos) es solo una ayuda visual; la restricción real vive en estas políticas RLS, así que aunque alguien use la API de Supabase directamente desde el navegador, no podrá escribir donde no tiene permiso.

## Pendiente cuando se diseñen más módulos de RH

Cuando crees las tablas de Incidencias/Asistencia, Vacaciones, Nómina o Reclutamiento, agrégalas al arreglo `rh_tables` en el script (están comentadas como ejemplo) y vuelve a correrlo.
