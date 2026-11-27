# Scripts SQL — Supabase

> 📄 **¿Necesitas reconstruir el proyecto desde cero** (perdiste acceso a la cuenta de
> Supabase original)? Lee primero [`SCHEMA.md`](./SCHEMA.md) — documenta toda la
> estructura de la base de datos (incluidas las tablas que nunca tuvieron un script
> aquí) y señala un par de inconsistencias encontradas en el código que conviene
> conocer antes de reconstruir. El script `000_schema_bootstrap.sql` recrea esas
> tablas "sin migración"; corre ese primero, y solo si estás partiendo de cero.

Corre los scripts **en orden** en el SQL Editor de Supabase (dashboard → SQL Editor → New query):

0. `000_schema_bootstrap.sql` — **solo si reconstruyes el proyecto desde cero**: recrea `profiles`, `assets`, `phones`, `licenses`, `network_devices`, `ip_addresses`, `domains`, `maintenance_logs`, `maintenance_workflows`, `responsivas`, `credentials`, `tickets`, `ticket_comments` y el bucket `workflow-attachments` (todo esto se creó originalmente a mano en el Table Editor y nunca tuvo script en este repo). Si tu base de datos original sigue intacta, **no lo corras ahí**. Dos de sus bloques dependen de 001 y 003 respectivamente y se auto-omiten con un aviso si los corres antes — vuelve a correr este script una vez más (es idempotente) después de llegar al 003 para completarlos.
1. `001_roles_y_rls.sql` — crea la función `current_user_role()` y las políticas RLS base.
2. `002_ajustar_check_de_role.sql` — amplía el CHECK de `profiles.role` para aceptar `admin`/`ti`/`rh` (solo hace falta una vez, ya corrido).
3. `003_tabla_employees.sql` — agrega los campos del módulo Colaboradores a la tabla `employees`.
4. `004_tabla_hr_attendance.sql` — crea las tablas del módulo Incidencias y Asistencia (`hr_attendance` y `hr_checador_map`).
5. `005_limpiar_serial_number_vacios.sql` — corrige equipos guardados con `serial_number = ''` en vez de `NULL`.
6. `006_bitacora_auditoria.sql` — crea `audit_log` y engancha triggers de auditoría a las tablas principales (Equipos, Teléfonos, Licencias, Red, Mantenimiento, Bóveda, Colaboradores, Asistencia, Tickets, Perfiles). Visible en el módulo **Administración**, solo para admin/ti.
7. `007_tabla_hr_vacaciones.sql` — tabla `hr_vacation_requests` (solicitudes de vacaciones/permisos) + saldo de días por colaborador.
8. `008_tabla_hr_payroll.sql` — tabla `hr_payroll` + bucket de almacenamiento `payroll-receipts` para los PDF de recibos.
9. `009_tabla_hr_reclutamiento.sql` — tablas `hr_job_openings` y `hr_candidates` + bucket `candidate-cvs` para los CV.
10. `010_notificaciones.sql` — tablas `notifications` y `push_subscriptions`, triggers que avisan de tickets nuevos/asignados y solicitudes de vacaciones, y habilita Realtime en `notifications`. Después de correr este script, sigue la guía en `functions/send-push/README.md` para activar las notificaciones push reales (requiere Supabase CLI).
11. `011_mantenimiento_programado.sql` — tabla `maintenance_schedules` (mantenimientos preventivos a futuro, con recurrencia mensual/trimestral/semestral/anual) y aviso automático al crear uno nuevo. Incluye una función opcional `notify_due_maintenance()` para recordatorios diarios de próximos/vencidos (requiere habilitar la extensión `pg_cron` y programarla, instrucciones dentro del script).
12. `012_formatos_facturas.sql` — módulo **Formatos y Facturas** (dentro de Administración, solo admin/ti): tablas `purchase_requests` (Solicitud de Compra), `purchase_orders` (Orden de Compra) y `document_vault` (bóveda de facturas/cotizaciones) + bucket de almacenamiento `document-vault` para los archivos adjuntos.
13. `013_alinear_esquema_recuperado.sql` — corre esto **después** de `000_schema_bootstrap.sql` si estás reconstruyendo el proyecto desde cero. Agrega columnas reales que existían en el proyecto original pero que el frontend actual nunca llegó a usar (se descubrieron leyendo el esquema OpenAPI del proyecto viejo vía su Service Role Key, que seguía funcionando aunque el dashboard estaba bloqueado por MFA) — ver detalle en `SCHEMA.md`.
14. `014_registros_ti.sql` — módulo **Registros de TI** (Administración, solo admin/ti): tabla `it_records` para altas/bajas/cambios, solicitudes de acceso, incidentes, cartas responsivas, control de respaldos y visitas de proveedores, con folio automático por formato y año (ABC-2026-0001).
15. `015_cotizaciones.sql` — módulo **Cotizaciones** (Administración, solo admin/ti): tablas `quote_settings` (datos y logo del emisor), `quote_clients`, `quote_catalog` (productos y servicios) y `quotes` (partidas en jsonb, IVA / IVA incluido / sin IVA, retenciones ISR e IVA) con folio automático por año (COT-2026-0001).

16. `016_seguridad_boveda.sql` — **parche de seguridad + Bóveda cifrada**. (a) Las cuentas nuevas quedan **sin rol** (pendientes) hasta que un admin las apruebe, y un usuario ya no puede cambiarse a sí mismo el rol; (b) los módulos de TI (incluida la Bóveda) solo los lee admin/ti; (c) tickets exigen tener rol; (d) `audit_log` deja de guardar contraseñas y se redactan las ya guardadas; (e) crea `vault_config` y `vault_access_log` y un trigger que rechaza contraseñas en texto plano una vez configurada la bóveda. **Córrelo antes de desplegar la versión del frontend que trae la Bóveda cifrada** (si no, el módulo mostrará un aviso de error). Después, entra a Bóveda → "Configurar bóveda" y guarda la llave de recuperación **fuera del sistema**.

Los scripts 7, 8, 9, 10 y 11 dependen de que ya exista `public.audit_trigger_func()` (del script 6), así que ese debe ir antes. El 11 también usa `notify_roles()` (del script 10) si está disponible.

Cada script es idempotente: puedes volver a correrlo sin duplicar nada.

## Asignar roles

```sql
update public.profiles set role = 'admin' where email = 'jorge.daniel@treggo.mx';
update public.profiles set role = 'rh'    where email = 'correo-de-rh@treggo.mx';
```

Roles válidos: `admin`, `ti`, `rh`. Una cuenta sin rol (`role is null`) o con `is_active = false` no puede leer nada: la app le muestra "Cuenta pendiente de aprobación". Para aprobar una cuenta nueva, corre el `update` de arriba (el registro público está desactivado; las cuentas se crean desde Authentication → Users).

## Qué queda protegido

| Módulo | admin / ti | rh |
|---|---|---|
| Equipos, Teléfonos, Licencias, Red/IPs, Mantenimiento, Bóveda, Formatos y Facturas | Lectura + escritura | **Sin acceso** (bloqueado en UI y en base de datos) |
| Tickets | Lectura + escritura total | Lectura total, escritura solo en los propios |
| Recursos Humanos (Colaboradores, y lo que se agregue después) | Lectura + escritura | Lectura + escritura |

La UI bloquea la navegación (no se puede ni entrar), y las políticas RLS bloquean también el acceso directo a la API de Supabase, así que la restricción es real en ambas capas.

## Pendiente cuando se diseñen más módulos de RH

Cuando crees las tablas de Vacaciones, Nómina o Reclutamiento, agrégalas al arreglo `rh_tables` en `001_roles_y_rls.sql` (están comentadas como ejemplo) y vuelve a correrlo, o dales su propio script de RLS como se hizo en `004_tabla_hr_attendance.sql`.
