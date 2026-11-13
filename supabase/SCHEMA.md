# Esquema de la base de datos — ITSM Treggo

Este documento reconstruye la estructura completa de la base de datos de Supabase
a partir del código fuente del repositorio (consultas `.select()`, `.insert()`,
`.update()`, formularios, exportaciones CSV/XLSX y los scripts SQL en esta misma
carpeta). Se generó porque se perdió el acceso a la cuenta de Supabase Cloud y
el panel (Table Editor / SQL Editor) ya no está disponible, pero **el código sí
refleja fielmente qué columnas usa cada módulo**.

> ⚠️ Algunas tablas (ver sección "Tablas sin migración en el repo") nunca
> tuvieron un script `CREATE TABLE` aquí — se crearon directamente desde el
> Table Editor de Supabase en los inicios del proyecto. Sus columnas de abajo
> están **inferidas del código**, no copiadas de un script. Los tipos de datos
> (texto vs. numérico vs. fecha) son la inferencia más razonable según cómo se
> usan, pero no son 100% verificables sin acceso al panel. Hay un script
> (`000_schema_bootstrap.sql`) que las recrea con esa mejor inferencia, por si
> necesitas reconstruir el proyecto desde cero en una cuenta nueva.
>
> Las tablas que **sí** se crearon con un script `.sql` en esta carpeta (001 a
> 012) están 100% confirmadas — ahí se copian literalmente los `CREATE TABLE`.

---

## Índice de tablas por módulo

| Módulo | Tablas |
|---|---|
| Autenticación / Usuarios | `profiles` |
| Equipos (ITAM) | `assets`, `maintenance_logs`, `maintenance_workflows`, `maintenance_schedules` |
| Telefonía | `phones` |
| Licencias | `licenses` |
| Red / Dominios | `ip_addresses`, `domains`, `network_devices` (sin uso actual) |
| Responsivas | `responsivas` |
| Bóveda de Credenciales | `credentials` |
| Mesa de Ayuda | `tickets`, `ticket_comments` (sin uso actual) |
| RH — Colaboradores | `employees` |
| RH — Asistencia | `hr_attendance`, `hr_checador_map` |
| RH — Vacaciones | `hr_vacation_requests` |
| RH — Nóminas | `hr_payroll` |
| RH — Reclutamiento | `hr_job_openings`, `hr_candidates` |
| Administración | `audit_log` |
| Formatos y Facturas | `purchase_requests`, `purchase_orders`, `document_vault` |
| Notificaciones | `notifications`, `push_subscriptions` |

---

## Tablas con migración confirmada en el repo (001–012)

Estas están definidas literalmente en `supabase/0XX_*.sql`. Aquí solo un resumen
rápido — el detalle exacto (constraints, índices, triggers) está en cada script.

### `profiles` (RLS/rol ajustado en 001 y 002; la tabla en sí la crea Supabase Auth)
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | = `auth.users.id` |
| `full_name` | text | |
| `email` | text | |
| `role` | text | CHECK `admin`/`ti`/`rh` (002) |
| `is_active` | boolean | default `true` — usado por `notify_roles()` (010) para filtrar destinatarios |
| `created_at` | timestamptz | |

> No hay un script en el repo que haga el `CREATE TABLE public.profiles` ni el
> trigger que la llena al registrarse un usuario (`on auth.users insert`).
> Eso se configuró directo en el dashboard. Ver plantilla sugerida en
> `000_schema_bootstrap.sql`.

### `employees` (003, + columnas agregadas en 007)
`id` uuid PK · `full_name` text not null · `employee_number` text (único si no vacío) ·
`email` text · `phone` text · `position` text · `department` text · `hire_date` date ·
`contract_type` text (CHECK `planta`/`temporal`/`honorarios`) · `status` text default `'activo'`
(CHECK `activo`/`baja`) · `salary` numeric · `notes` text · `vacation_days_per_year` integer
default `12` (007) · `created_at`, `updated_at` timestamptz.

### `hr_checador_map` (004)
`device_id` text PK · `device_name` text · `employee_id` uuid FK→`employees.id` · `updated_at`.

### `hr_attendance` (004)
`id` uuid PK · `employee_id` uuid FK→`employees.id` · `date` date · `type` text default
`'asistencia'` (CHECK asistencia/retardo/falta/permiso/incapacidad/home_office/otro) ·
`check_in` time · `check_out` time · `source` text default `'checador'` (CHECK checador/manual) ·
`notes` text · `created_at`, `updated_at` · UNIQUE (`employee_id`, `date`).

### `hr_vacation_requests` (007)
`id` uuid PK · `employee_id` uuid FK→`employees.id` · `type` text default `'vacaciones'`
(CHECK vacaciones/permiso_con_goce/permiso_sin_goce) · `start_date` date · `end_date` date ·
`days_requested` numeric · `status` text default `'pendiente'` (CHECK pendiente/aprobado/rechazado) ·
`reason` text · `reviewed_by` uuid FK→`profiles.id` · `reviewed_at` timestamptz · `notes` text ·
`created_at`, `updated_at`.

### `hr_payroll` (008)
`id` uuid PK · `employee_id` uuid FK→`employees.id` · `period_label` text · `period_start` date ·
`period_end` date · `gross_pay` numeric · `deductions` numeric · `net_pay` numeric ·
`status` text default `'pendiente'` (CHECK pendiente/pagado) · `receipt_path` text ·
`receipt_file_name` text · `paid_at` date · `notes` text · `created_at`, `updated_at`.
Bucket: `payroll-receipts`.

### `hr_job_openings` (009)
`id` uuid PK · `title` text not null · `department` text · `status` text default `'abierta'`
(CHECK abierta/cerrada) · `opened_at` date default hoy · `closed_at` date · `notes` text · `created_at`.

### `hr_candidates` (009)
`id` uuid PK · `job_opening_id` uuid FK→`hr_job_openings.id` · `full_name` text not null ·
`email` text · `phone` text · `cv_path` text · `cv_file_name` text · `stage` text default `'nuevo'`
(CHECK nuevo/entrevista/oferta/rechazado/contratado) · `notes` text · `created_at`, `updated_at`.
Bucket: `candidate-cvs`.

### `audit_log` (006)
`id` uuid PK · `table_name` text · `record_id` text · `action` text (CHECK INSERT/UPDATE/DELETE) ·
`actor_id` uuid FK→`profiles.id` · `old_data` jsonb · `new_data` jsonb · `changed_fields` text[] ·
`created_at`. Alimentada por el trigger genérico `audit_trigger_func()`, enganchado a casi
todas las tablas (ver el script para la lista exacta).

### `notifications` (010)
`id` uuid PK · `user_id` uuid FK→`profiles.id` · `title` text not null · `body` text ·
`link` text · `type` text default `'general'` · `read` boolean default `false` · `created_at`.
Realtime habilitado.

### `push_subscriptions` (010)
`id` uuid PK · `user_id` uuid FK→`profiles.id` · `endpoint` text unique · `p256dh` text ·
`auth` text · `created_at`.

### `maintenance_schedules` (011)
`id` uuid PK · `asset_id` uuid FK→`assets.id` · `title` text not null · `maintenance_type` text
default `'Preventivo'` · `technician_name` text · `scheduled_date` date not null · `recurrence`
text default `'none'` (CHECK none/monthly/quarterly/semiannual/yearly) · `status` text default
`'pendiente'` (CHECK pendiente/completado/cancelado) · `completed_log_id` uuid FK→`maintenance_logs.id` ·
`notes` text · `created_at`, `updated_at`.

### `purchase_requests`, `purchase_orders`, `document_vault` (012)
Ver `012_formatos_facturas.sql` — definidas completas ahí (Solicitud de Compra, Orden de
Compra y Bóveda de Facturas/Cotizaciones del módulo "Formatos y Facturas").

---

## Tablas SIN migración en el repo (inferidas del código)

Estas se crearon directo en Supabase y nunca tuvieron un script `.sql` aquí. Las columnas
están tomadas de los formularios, `.select()` y exportaciones CSV/XLSX que las usan.

### `assets` (Equipos — ITAM)
| Columna | Tipo inferido | Notas |
|---|---|---|
| `id` | uuid PK | |
| `asset_tag` | text | Etiqueta/código visible (ej. `TG00002`). [AssetForm.jsx](../client/src/pages/itam/AssetForm.jsx) |
| `asset_code` | text | Duplicado de `asset_tag` que el formulario también llena "por compatibilidad con esquemas previos" — probablemente el nombre de columna original antes de renombrarse a `asset_tag`. **Ambas columnas reciben el mismo valor al guardar.** |
| `asset_type` | text | Ej. "Laptop/CPU"; lista editable, sin CHECK aparente |
| `brand` | text | |
| `model` | text | |
| `serial_number` | text | **UNIQUE** (nullable) — ver `005_limpiar_serial_number_vacios.sql` |
| `status` | text | "Disponible" / "Asignado" / "En Mantenimiento" / "Baja" (sin CHECK confirmado, el front limita las opciones) |
| `condition` | text | "Nuevo" / "Excelente" / "Bueno" / "Regular" / "Malo" |
| `assigned_to` | text | **Texto libre** con el nombre de la persona (no es FK). *Ver nota de inconsistencia abajo.* |
| `location` | text | Valor de la lista `LOCATIONS` (constants.js), editable/libre |
| `warranty_info` | text | |
| `warranty_expiration` | date | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | (asumido, no confirmado en código) |

⚠️ **Inconsistencia encontrada:** [AssetDetail.jsx](../client/src/pages/itam/AssetDetail.jsx)
hace `select('*, profiles:assigned_to(full_name, email)')`, es decir, trata `assigned_to`
como una **FK a `profiles.id` (uuid)**. Pero el formulario de alta/edición
([AssetForm.jsx](../client/src/pages/itam/AssetForm.jsx)) y el resto del código
(`AssetList.jsx`, CSV, búsqueda) tratan `assigned_to` como **texto libre con el nombre**.
No se pudo determinar con certeza cuál es el tipo real en la base de datos sin acceso al
panel. Si al reconstruir ves errores en la ficha de detalle de un equipo, esa es la causa.

### `phones` (Telefonía)
`id` uuid PK · `brand` text · `model` text · `imei` text (también se lee `imei1` como alias
en algunas exportaciones, probablemente no existe como columna real) · `phone_number` text ·
`assigned_to` text (libre) · `contract_plan` text (también alias `plan`) · `department` text ·
`esim` boolean (nullable) · `service_start_date` date · `service_end_date` date ·
`created_at` timestamptz.

### `licenses` (Licencias de software)
`id` uuid PK · `software_name` text not null · `provider` text · `license_key` text ·
`seats_purchased` integer default `1` · `expiration_date` date (nullable = licencia perpetua) ·
`notes` text · `created_at`, `updated_at` timestamptz (`updated_at` se actualiza a mano desde
[EditLicenseModal.jsx](../client/src/components/licencias/EditLicenseModal.jsx)).

⚠️ **Bug encontrado (no de este documento, del código actual):** [Dashboard.jsx](../client/src/pages/Dashboard.jsx)
consulta `supabase.from("software_licenses")...eq("status","expired")` para la tarjeta
"Licencias Software", pero la tabla real es `licenses` y, por lo visto en
`LicenseList.jsx`/`LicenseForm.jsx`, **no existe una columna `status`** (el estatus de
vencimiento se calcula en el cliente a partir de `expiration_date`). Ambos conteos del
Dashboard para licencias casi seguro siempre devuelven `0`. Esto es independiente de la
reconstrucción del esquema, pero vale la pena corregirlo si se nota.

### `network_devices` (Red — parece sin uso actual)
`id` uuid PK · `name` text · `ip_address` text · `mac_address` text · `location` text ·
`created_at`. Solo lo consulta [NetworkList.jsx](../client/src/pages/licencias/NetworkList.jsx),
que no está enrutado en `App.jsx` (el módulo de Red activo es `IpManagement.jsx`, que usa
`ip_addresses`/`domains`). Es posible que esta tabla ya no se use, pero se incluye por si
tiene datos históricos.

### `ip_addresses` (Mapa de Red)
`ip_address` text **PK/UNIQUE** (se hace `upsert(..., {onConflict:'ip_address'})`) ·
`device_type` text (PC/SWITCH/ROUTER/ACCESS POINT/SERVER/IMPRESORA/CAMARA/LIBRE) ·
`status` text (AVAILABLE/ASSIGNED/RESERVED) · `mac_address` text · `assigned_user_text` text
(nombre libre; el código también contempla el nombre alterno `assigned_to_text` como
fallback de lectura, por si la columna real se llamara distinto) · `notes` text · `created_at`.

### `domains` (Dominios)
`id` uuid PK · `domain_name` text not null · `provider` text · `dns_provider` text ·
`ip_address` text · `expiration_date` date · `notes` text · `created_at`.

### `maintenance_logs` (Bitácora de mantenimiento)
`id` uuid PK · `asset_id` uuid FK→`assets.id` · `maintenance_type` text · `technician_name` text ·
`description` text · `created_at`. (El archivo legacy `MaintenanceLog.jsx`, que no parece
enrutado, lee un campo `type` en vez de `maintenance_type` — probablemente quedó desactualizado;
el módulo activo `MaintenanceList.jsx` usa `maintenance_type`.)

### `maintenance_workflows` (Bóveda de guías/documentos de mantenimiento)
`id` uuid PK · `title` text not null · `category` text default `'General'` · `file_path` text ·
`file_name` text · `created_at`. Bucket: `workflow-attachments`.

### `responsivas` (Cartas responsivas)
`id` uuid PK · `user_id` uuid FK→`profiles.id` · `notes` text · `status` text default
`'PENDING'` (valores vistos: `PENDING`, `SIGNED`) · `created_at`.

### `credentials` (Bóveda de Credenciales de TI)
`id` uuid PK · `title` text not null · `category` text (Servidores/Cuentas Web/Redes-Routers/
Software-Licencias/Bases de Datos/General) · `username` text · `password_hash` text (⚠️ a
pesar del nombre, el código guarda y lee la **contraseña en texto plano**, no un hash real) ·
`url_link` text · `assigned_to` uuid FK→`employees.id` (constraint `credentials_assigned_to_fkey`) ·
`notes` text.

### `tickets` (Mesa de Ayuda)
`id` uuid PK · `title` text · `description` text · `category` text (HARDWARE/SOFTWARE/REDES/
ACCESOS/SOPORTE) · `priority` text (LOW/MEDIUM/HIGH/URGENT) · `status` text default `'OPEN'` ·
`ticket_number` text (usado en `Dashboard.jsx` y en el trigger de notificación de 010) ·
`assigned_to` uuid FK→`profiles.id` (nullable; dispara notificación al asignarse, ver 010) ·
`created_at`.

⚠️ **Inconsistencia encontrada — el solicitante del ticket:**
- `001_roles_y_rls.sql` y `Dashboard.jsx` usan **`requester_id`** (con una FK nombrada
  `tickets_requester_id_fkey`, y la política RLS compara `requester_id = auth.uid()`).
- `TicketList.jsx` y `TicketDetail.jsx` en cambio hacen `select('*, profiles:user_id(...)')`,
  es decir usan **`user_id`**.
- `TicketForm.jsx` no envía ni `requester_id` ni `user_id` al crear el ticket — probablemente
  la columna real tiene un `default auth.uid()`, lo que apunta a que **`requester_id` es el
  nombre correcto** y `user_id` en `TicketList`/`TicketDetail` quedó desactualizado de una
  versión anterior del esquema.
- **No se pudo confirmar con certeza cuál de las dos existe realmente** sin acceso al panel.
  Si al reconstruir el proyecto la lista de tickets no muestra el nombre del solicitante,
  esta es la causa — hay que unificar ambos archivos a la columna real.

### `ticket_comments` (referenciada en RLS, sin uso visible en el frontend)
Declarada defensivamente en `001_roles_y_rls.sql` (políticas de lectura/inserción para todos
los autenticados) pero ningún componente del cliente la consulta hoy. Es posible que no
exista realmente, o que se haya planeado y no se haya llegado a usar en la UI.

---

## Buckets de Storage

| Bucket | Usado por | Público |
|---|---|---|
| `workflow-attachments` | `maintenance_workflows` (guías de mantenimiento) | No |
| `payroll-receipts` | `hr_payroll` (recibos de nómina) | No |
| `candidate-cvs` | `hr_candidates` (CVs) | No |
| `document-vault` | `document_vault` (facturas/cotizaciones) | No |

---

## Funciones y triggers clave

- `public.current_user_role()` — rol del usuario autenticado (001).
- `public.audit_trigger_func()` — bitácora genérica de auditoría (006).
- `public.notify_user()` / `public.notify_roles()` — crean notificaciones (010).
- `public.trg_notify_new_ticket()`, `trg_notify_ticket_assigned()`, `trg_notify_vacation_request()`,
  `trg_notify_new_schedule()` — triggers que llaman a lo anterior.
- `public.notify_due_maintenance()` — función opcional para recordatorios diarios (requiere `pg_cron`).

## Qué falta para reconstruir el proyecto desde cero (si pierdes la cuenta actual)

1. Crear el proyecto nuevo en Supabase.
2. Correr `000_schema_bootstrap.sql` (recrea las tablas "sin migración" de este documento,
   con la mejor inferencia posible — revísalo antes de correrlo, especialmente las notas de
   inconsistencia de `assets.assigned_to` y `tickets.requester_id` vs `user_id`). Dos de sus
   bloques dependen de scripts posteriores y se auto-omiten con un aviso (`raise notice`) si
   corres todo en una sola pasada desde cero — no pasa nada, vuelve a correr `000` completo
   una vez más al final y esos dos bloques ya completarán lo que falte:
   - La política del bucket `workflow-attachments` (necesita `current_user_role()`, de 001).
   - La FK `credentials.assigned_to → employees.id` (necesita la tabla `employees`, de 003).
3. Correr en orden `001_roles_y_rls.sql` → `012_formatos_facturas.sql` (ver `supabase/README.md`).
4. Volver a correr `000_schema_bootstrap.sql` una vez más (idempotente) para completar los dos
   bloques diferidos del paso 2.
5. Volver a dar de alta el bucket de avatares/logo si lo hubiera (no se detectó ninguno además
   de los 4 listados arriba).
6. Recrear manualmente el trigger de `auth.users` → `public.profiles` (ver plantilla en
   `000_schema_bootstrap.sql`), las variables de entorno (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`) en Vercel, y volver a desplegar la
   Edge Function `send-push` (ver `supabase/functions/send-push/README.md`).
