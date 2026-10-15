# Scripts SQL — Supabase

Corre los scripts **en orden** en el SQL Editor de Supabase (dashboard → SQL Editor → New query):

1. `001_roles_y_rls.sql` — crea la función `current_user_role()` y las políticas RLS base.
2. `002_ajustar_check_de_role.sql` — amplía el CHECK de `profiles.role` para aceptar `admin`/`ti`/`rh` (solo hace falta una vez, ya corrido).
3. `003_tabla_employees.sql` — agrega los campos del módulo Colaboradores a la tabla `employees`.
4. `004_tabla_hr_attendance.sql` — crea las tablas del módulo Incidencias y Asistencia (`hr_attendance` y `hr_checador_map`).
5. `005_limpiar_serial_number_vacios.sql` — corrige equipos guardados con `serial_number = ''` en vez de `NULL`.
6. `006_bitacora_auditoria.sql` — crea `audit_log` y engancha triggers de auditoría a las tablas principales (Equipos, Teléfonos, Licencias, Red, Mantenimiento, Bóveda, Colaboradores, Asistencia, Tickets, Perfiles). Visible en el módulo **Administración**, solo para admin/ti.

Cada script es idempotente: puedes volver a correrlo sin duplicar nada.

## Asignar roles

```sql
update public.profiles set role = 'admin' where email = 'jorge.daniel@treggo.mx';
update public.profiles set role = 'rh'    where email = 'correo-de-rh@treggo.mx';
```

Roles válidos: `admin`, `ti`, `rh`.

## Qué queda protegido

| Módulo | admin / ti | rh |
|---|---|---|
| Equipos, Teléfonos, Licencias, Red/IPs, Mantenimiento, Bóveda | Lectura + escritura | **Sin acceso** (bloqueado en UI y en base de datos) |
| Tickets | Lectura + escritura total | Lectura total, escritura solo en los propios |
| Recursos Humanos (Colaboradores, y lo que se agregue después) | Lectura + escritura | Lectura + escritura |

La UI bloquea la navegación (no se puede ni entrar), y las políticas RLS bloquean también el acceso directo a la API de Supabase, así que la restricción es real en ambas capas.

## Pendiente cuando se diseñen más módulos de RH

Cuando crees las tablas de Vacaciones, Nómina o Reclutamiento, agrégalas al arreglo `rh_tables` en `001_roles_y_rls.sql` (están comentadas como ejemplo) y vuelve a correrlo, o dales su propio script de RLS como se hizo en `004_tabla_hr_attendance.sql`.
