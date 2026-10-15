import { useState, useEffect, useCallback } from 'react';
import {
  Settings, ChevronDown, ChevronRight, Search, PlusCircle, Pencil, Trash2,
} from 'lucide-react';
import { supabase } from '../../services/supabase';

const PAGE_SIZE = 50;

const TABLE_LABELS = {
  assets: 'Equipos',
  phones: 'Telefonía',
  licenses: 'Licencias',
  software_licenses: 'Licencias',
  network_devices: 'Red (Dispositivos)',
  ip_addresses: 'Red (IPs)',
  domains: 'Dominios',
  maintenance_logs: 'Mantenimiento',
  maintenance_workflows: 'Bóveda de Guías',
  responsivas: 'Responsivas',
  credentials: 'Bóveda de Credenciales',
  employees: 'Colaboradores',
  hr_attendance: 'Asistencia',
  hr_checador_map: 'Checador (mapeo)',
  tickets: 'Tickets',
  profiles: 'Usuarios / Perfiles',
};

const ACTION_META = {
  INSERT: { label: 'Creación', icon: PlusCircle, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  UPDATE: { label: 'Modificación', icon: Pencil, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DELETE: { label: 'Eliminación', icon: Trash2, className: 'bg-red-50 text-red-700 border-red-200' },
};

// Oculta campos sensibles (contraseñas) al mostrar el detalle del cambio.
const SENSITIVE_FIELDS = ['password_hash', 'password'];

function sanitize(obj) {
  if (!obj) return obj;
  const clone = { ...obj };
  SENSITIVE_FIELDS.forEach((f) => { if (f in clone) clone[f] = '••••••••'; });
  return clone;
}

function getRecordLabel(entry) {
  const data = entry.new_data || entry.old_data || {};
  return data.full_name || data.asset_tag || data.asset_code || data.domain_name
    || data.phone_number || data.software_name || data.title || data.ip_address
    || entry.record_id || '—';
}

function AuditRow({ entry }) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[entry.action] || ACTION_META.UPDATE;
  const ActionIcon = meta.icon;

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <td className="py-2.5 px-4 text-xs text-gray-500 whitespace-nowrap">
          {new Date(entry.created_at).toLocaleString('es-MX')}
        </td>
        <td className="py-2.5 px-4 text-sm text-gray-800">
          {entry.actor?.full_name || <span className="text-gray-400 italic">Sistema</span>}
        </td>
        <td className="py-2.5 px-4 text-sm text-gray-700">{TABLE_LABELS[entry.table_name] || entry.table_name}</td>
        <td className="py-2.5 px-4">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}>
            <ActionIcon size={12} /> {meta.label}
          </span>
        </td>
        <td className="py-2.5 px-4 text-sm text-gray-600 truncate max-w-[220px]">{getRecordLabel(entry)}</td>
        <td className="py-2.5 px-4 text-xs text-gray-500">
          {entry.changed_fields?.length ? entry.changed_fields.join(', ') : '—'}
        </td>
        <td className="py-2.5 px-4 text-right">
          {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50/70">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {entry.old_data && (
                <div>
                  <p className="font-semibold text-gray-500 mb-1 uppercase tracking-wider text-[10px]">Antes</p>
                  <pre className="bg-white border border-gray-200 rounded-lg p-2.5 overflow-x-auto text-[11px] text-gray-700 max-h-56">
                    {JSON.stringify(sanitize(entry.old_data), null, 2)}
                  </pre>
                </div>
              )}
              {entry.new_data && (
                <div>
                  <p className="font-semibold text-gray-500 mb-1 uppercase tracking-wider text-[10px]">Después</p>
                  <pre className="bg-white border border-gray-200 rounded-lg p-2.5 overflow-x-auto text-[11px] text-gray-700 max-h-56">
                    {JSON.stringify(sanitize(entry.new_data), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Administracion() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').order('full_name').then(({ data }) => setUsers(data || []));
  }, []);

  const loadLogs = useCallback(async (pageToLoad) => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select('*, actor:profiles(full_name)')
        .order('created_at', { ascending: false })
        .range(pageToLoad * PAGE_SIZE, pageToLoad * PAGE_SIZE + PAGE_SIZE - 1);

      if (tableFilter) query = query.eq('table_name', tableFilter);
      if (actionFilter) query = query.eq('action', actionFilter);
      if (userFilter) query = query.eq('actor_id', userFilter);

      const { data, error } = await query;
      if (error) throw error;

      setHasMore((data || []).length === PAGE_SIZE);
      setLogs((prev) => (pageToLoad === 0 ? (data || []) : [...prev, ...(data || [])]));
    } catch (err) {
      console.error('Error al cargar la bitácora:', err.message);
    } finally {
      setLoading(false);
    }
  }, [tableFilter, actionFilter, userFilter]);

  useEffect(() => {
    setPage(0);
    loadLogs(0);
  }, [loadLogs]);

  const filteredLogs = logs.filter((entry) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      getRecordLabel(entry).toLowerCase().includes(q) ||
      entry.actor?.full_name?.toLowerCase().includes(q) ||
      (TABLE_LABELS[entry.table_name] || entry.table_name).toLowerCase().includes(q)
    );
  });

  const tableOptions = Object.keys(TABLE_LABELS);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="text-brand-500" /> Administración
        </h1>
        <p className="text-sm text-gray-500">Bitácora de auditoría: quién hizo qué y cuándo, en todos los módulos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar usuario, registro, módulo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} className="input-field">
          <option value="">Todos los módulos</option>
          {tableOptions.map((t) => (
            <option key={t} value={t}>{TABLE_LABELS[t]}</option>
          ))}
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input-field">
          <option value="">Todas las acciones</option>
          <option value="INSERT">Creación</option>
          <option value="UPDATE">Modificación</option>
          <option value="DELETE">Eliminación</option>
        </select>
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="input-field">
          <option value="">Todos los usuarios</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Módulo</th>
                <th className="py-3 px-4">Acción</th>
                <th className="py-3 px-4">Registro</th>
                <th className="py-3 px-4">Campos modificados</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading && logs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">Cargando bitácora...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No hay actividad registrada con estos filtros.</td></tr>
              ) : (
                filteredLogs.map((entry) => <AuditRow key={entry.id} entry={entry} />)
              )}
            </tbody>
          </table>
        </div>

        {hasMore && !loading && filteredLogs.length > 0 && (
          <div className="p-3 border-t border-gray-100 text-center">
            <button
              onClick={() => { const next = page + 1; setPage(next); loadLogs(next); }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Cargar más
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
