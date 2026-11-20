import { ClipboardCheck, KeyRound, ShieldAlert, Laptop, DatabaseBackup, UserCheck } from 'lucide-react';

// Definición de los formatos de gestión de TI. El motor (RecordsTab) y el PDF
// leen esta configuración; agregar un formato nuevo es agregar un objeto aquí
// (más su valor en el CHECK de it_records.kind y su prefijo de folio en SQL).
//
// Tipos de campo: text, person (con sugerencias de nombres), textarea, date,
// time, select, checklist, asset, phone.

const st = (value, label, tone) => ({ value, label, tone });

export const FORMATS = [
  {
    key: 'alta_baja_cambio',
    label: 'Alta / Baja / Cambio',
    pdfTitle: 'Alta, Baja o Cambio de Usuario',
    icon: UserCheck,
    dateLabel: 'Fecha efectiva del movimiento',
    statuses: [st('pendiente', 'Pendiente', 'amber'), st('en_proceso', 'En proceso', 'sky'), st('completado', 'Completado', 'emerald')],
    title: (v) => [v.movement, v.person_name].filter(Boolean).join(' — '),
    fields: [
      { name: 'movement', label: 'Movimiento', type: 'select', required: true, options: ['Alta', 'Baja', 'Cambio de puesto o área'] },
      { name: 'person_name', label: 'Colaborador', type: 'person', required: true },
      { name: 'position', label: 'Puesto', type: 'text' },
      { name: 'department', label: 'Área / Departamento', type: 'text' },
      { name: 'supervisor', label: 'Jefe inmediato', type: 'person' },
      { name: 'new_position', label: 'Nuevo puesto o área (solo en cambios)', type: 'text' },
      {
        name: 'tasks', label: 'Cuentas y accesos a gestionar (marca los ya ejecutados)', type: 'checklist',
        items: ['Cuenta de correo', 'Cuenta de NetSuite', 'Acceso a VPN', 'Carpetas de red / Drive', 'Equipo de cómputo (entrega o recolección)',
          'Teléfono / línea', 'Licencias de software', 'Accesos físicos / gafete', 'Otros accesos'],
      },
      { name: 'done_by', label: 'Responsable de TI que ejecuta', type: 'person' },
      { name: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
    signatures: ['Solicitó (RH / Jefe inmediato)', 'Ejecutó (TI)'],
  },
  {
    key: 'acceso',
    label: 'Solicitud de acceso',
    pdfTitle: 'Solicitud de Acceso o Permisos',
    icon: KeyRound,
    dateLabel: 'Fecha de solicitud',
    statuses: [st('pendiente', 'Pendiente', 'amber'), st('aprobada', 'Aprobada', 'sky'), st('otorgada', 'Otorgada', 'emerald'), st('rechazada', 'Rechazada', 'red')],
    title: (v) => [v.beneficiary || v.requester,
      (v.systems || []).filter((i) => i.done).map((i) => i.label).join(', ')].filter(Boolean).join(' — '),
    fields: [
      { name: 'requester', label: 'Solicitante', type: 'person', required: true },
      { name: 'beneficiary', label: 'Usuario que recibirá el acceso', type: 'person', required: true },
      { name: 'department', label: 'Área / Departamento', type: 'text' },
      { name: 'approver', label: 'Autoriza (jefe del solicitante)', type: 'person', required: true },
      { name: 'systems', label: 'Sistemas o recursos solicitados', type: 'checklist', items: ['NetSuite', 'VPN', 'Carpetas compartidas', 'Correo / grupos de distribución', 'Sistema de facturación', 'Otro'] },
      { name: 'access_detail', label: 'Detalle del acceso (rol, carpeta, nivel de permiso)', type: 'textarea', required: true },
      { name: 'justification', label: 'Justificación', type: 'textarea' },
      { name: 'access_type', label: 'Tipo de acceso', type: 'select', options: ['Permanente', 'Temporal'], default: 'Permanente' },
      { name: 'valid_until', label: 'Vigencia hasta (si es temporal)', type: 'date' },
      { name: 'granted_date', label: 'Fecha en que TI otorgó el acceso', type: 'date' },
    ],
    signatures: ['Solicitante', 'Autoriza (Jefe inmediato)', 'Otorgó (TI)'],
  },
  {
    key: 'incidente',
    label: 'Incidentes',
    pdfTitle: 'Reporte de Incidente de TI o Seguridad',
    icon: ShieldAlert,
    dateLabel: 'Fecha del incidente',
    statuses: [st('abierto', 'Abierto', 'amber'), st('investigacion', 'En investigación', 'sky'), st('resuelto', 'Resuelto', 'emerald'), st('cerrado', 'Cerrado', 'slate')],
    title: (v) => [v.incident_type, v.affected_user].filter(Boolean).join(' — '),
    fields: [
      { name: 'incident_type', label: 'Tipo de incidente', type: 'select', required: true,
        options: ['Falla de equipo', 'Pérdida o robo de equipo', 'Correo sospechoso / phishing', 'Acceso indebido', 'Malware / virus', 'Falla de red o servicio', 'Otro'] },
      { name: 'severity', label: 'Severidad', type: 'select', options: ['Baja', 'Media', 'Alta', 'Crítica'], default: 'Media' },
      { name: 'detected_time', label: 'Hora de detección', type: 'time' },
      { name: 'reporter', label: 'Reportado por', type: 'person' },
      { name: 'affected_user', label: 'Usuario o área afectada', type: 'person' },
      { name: 'affected_asset', label: 'Equipo involucrado (opcional)', type: 'asset' },
      { name: 'data_exposed', label: '¿Hubo exposición de información?', type: 'select', options: ['No', 'Sí', 'Por determinar'], default: 'Por determinar' },
      { name: 'description', label: 'Descripción de lo ocurrido', type: 'textarea', required: true },
      { name: 'actions', label: 'Acciones tomadas', type: 'textarea' },
      { name: 'resolution', label: 'Resolución / causa raíz', type: 'textarea' },
      { name: 'resolved_date', label: 'Fecha de resolución', type: 'date' },
    ],
    signatures: ['Reportó', 'Atendió (TI)'],
  },
  {
    key: 'responsiva',
    label: 'Carta responsiva',
    pdfTitle: 'Carta Responsiva de Equipo Asignado',
    icon: Laptop,
    dateLabel: 'Fecha de entrega',
    statuses: [st('activa', 'Activa', 'emerald'), st('devuelta', 'Devuelta', 'slate')],
    title: (v) => v.recipient || '',
    fields: [
      { name: 'recipient', label: 'Colaborador que recibe', type: 'person', required: true },
      { name: 'position', label: 'Puesto', type: 'text' },
      { name: 'department', label: 'Área / Departamento', type: 'text' },
      { name: 'asset_id', label: 'Equipo de cómputo (del inventario)', type: 'asset' },
      { name: 'phone_id', label: 'Teléfono (del inventario)', type: 'phone' },
      { name: 'equipment_other', label: 'Otro equipo o accesorios (cargador, mouse, funda…)', type: 'text' },
      { name: 'condition', label: 'Condición al entregar', type: 'select', options: ['Nuevo', 'Bueno', 'Regular'], default: 'Bueno' },
      { name: 'return_date', label: 'Fecha de devolución', type: 'date' },
      { name: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
    validate: (v) => (v.asset_id || v.phone_id || (v.equipment_other || '').trim()
      ? null : 'Indica al menos un equipo: de cómputo, teléfono u otro.'),
    // Texto legal del formato impreso. Conviene que Legal/RH lo revise antes de usarlo.
    clauses: [
      'Recibo de TREGGO el equipo descrito en este documento, en la condición indicada, para uso exclusivo de mis actividades laborales.',
      'Me comprometo a cuidarlo, a no prestarlo a terceros y a no instalar software, ni modificar su configuración, sin autorización del área de TI.',
      'Reportaré de inmediato a TI cualquier falla, daño, pérdida o robo del equipo; en caso de robo o pérdida informaré también a mi jefe inmediato.',
      'La información de la empresa almacenada en el equipo es propiedad de TREGGO y debo protegerla con las medidas de seguridad indicadas por TI.',
      'Devolveré el equipo y sus accesorios cuando la empresa lo solicite, cambie mi puesto o termine mi relación laboral.',
    ],
    signatures: ['Recibe (colaborador)', 'Entrega (TI)'],
  },
  {
    key: 'respaldo',
    label: 'Control de respaldos',
    pdfTitle: 'Control de Respaldos',
    icon: DatabaseBackup,
    dateLabel: 'Fecha del respaldo',
    statuses: [st('exitoso', 'Exitoso', 'emerald'), st('con_errores', 'Con errores', 'amber'), st('fallido', 'Fallido', 'red')],
    title: (v) => v.scope || '',
    fields: [
      { name: 'scope', label: 'Qué se respaldó', type: 'text', required: true },
      { name: 'backup_type', label: 'Tipo de respaldo', type: 'select', options: ['Completo', 'Incremental', 'Diferencial', 'Exportación manual'], default: 'Completo' },
      { name: 'destination', label: 'Destino / ubicación del respaldo', type: 'text', required: true },
      { name: 'size', label: 'Tamaño aproximado', type: 'text' },
      { name: 'responsible', label: 'Responsable', type: 'person' },
      { name: 'restore_tested', label: '¿Se probó la restauración?', type: 'select', options: ['Pendiente', 'Sí', 'No'], default: 'Pendiente' },
      { name: 'restore_date', label: 'Fecha de la prueba de restauración', type: 'date' },
      { name: 'restore_result', label: 'Resultado de la prueba', type: 'textarea' },
      { name: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
    signatures: ['Realizó', 'Revisó'],
  },
  {
    key: 'visita',
    label: 'Proveedores y visitas',
    pdfTitle: 'Control de Proveedores Externos y Visitas',
    icon: ClipboardCheck,
    dateLabel: 'Fecha de la visita',
    statuses: [st('programada', 'Programada', 'amber'), st('en_curso', 'En curso', 'sky'), st('concluida', 'Concluida', 'emerald')],
    title: (v) => [v.company, v.visitor].filter(Boolean).join(' — '),
    fields: [
      { name: 'company', label: 'Empresa / proveedor', type: 'text', required: true },
      { name: 'visitor', label: 'Nombre de quien visita', type: 'text', required: true },
      { name: 'entry_time', label: 'Hora de entrada', type: 'time' },
      { name: 'exit_time', label: 'Hora de salida', type: 'time' },
      { name: 'accompanied_by', label: 'Acompañó / autorizó', type: 'person' },
      { name: 'credentials_revoked', label: '¿Se revocaron los accesos temporales?', type: 'select', options: ['No aplica', 'Sí', 'No'], default: 'No aplica' },
      { name: 'purpose', label: 'Motivo de la visita / trabajo a realizar', type: 'textarea', required: true },
      { name: 'accesses', label: 'Accesos utilizados (cuentas, red, acceso físico)', type: 'textarea' },
      { name: 'work_done', label: 'Trabajo realizado', type: 'textarea' },
      { name: 'installed', label: 'Software o equipo que dejó instalado', type: 'textarea' },
      { name: 'followup', label: 'Pendientes / seguimiento', type: 'textarea' },
    ],
    signatures: ['Proveedor / visitante', 'Acompañó (TI)'],
  },
];

export const FORMAT_BY_KEY = Object.fromEntries(FORMATS.map((f) => [f.key, f]));

export const TONE_CLASSES = {
  amber: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
  sky: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
  emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
  red: 'bg-red-950/60 text-red-400 border-red-800/60',
  slate: 'bg-slate-800 text-slate-400 border-slate-700',
};

export function statusMeta(format, value) {
  return format.statuses.find((s) => s.value === value) || format.statuses[0];
}

export function emptyChecklist(field) {
  return field.items.map((label) => ({ label, done: false }));
}

// Valores iniciales de un formulario nuevo (record_date y status incluidos).
export function emptyValues(format) {
  const values = { record_date: new Date().toISOString().slice(0, 10), status: format.statuses[0].value };
  format.fields.forEach((f) => {
    if (f.type === 'checklist') values[f.name] = emptyChecklist(f);
    else values[f.name] = f.default ?? '';
  });
  return values;
}

// Convierte un registro guardado en valores de formulario (mezcla con los
// valores vacíos por si el formato ganó campos después de guardar el registro).
export function recordToValues(format, record) {
  const base = emptyValues(format);
  const data = record.data || {};
  const merged = { ...base, ...data, record_date: record.record_date || base.record_date, status: record.status || base.status };
  format.fields.filter((f) => f.type === 'checklist').forEach((f) => {
    const saved = Array.isArray(data[f.name]) ? data[f.name] : [];
    merged[f.name] = f.items.map((label) => ({ label, done: Boolean(saved.find((s) => s.label === label)?.done) }));
  });
  return merged;
}

// Texto legible de un campo (para listas, Excel y PDF).
export function displayValue(field, data) {
  const value = data?.[field.name];
  if (field.type === 'asset' || field.type === 'phone') return data?.[`${field.name}_label`] || '';
  if (field.type === 'checklist') {
    return (Array.isArray(value) ? value : []).filter((i) => i.done).map((i) => i.label).join(', ');
  }
  return value == null ? '' : String(value);
}
