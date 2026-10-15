import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Plane, Plus, X, Check, Ban, Trash2, Download,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../hooks/useRole';

const TYPE_META = {
  vacaciones:        { label: 'Vacaciones',           color: 'bg-sky-50 text-sky-700 border-sky-200' },
  permiso_con_goce:  { label: 'Permiso con goce',     color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  permiso_sin_goce:  { label: 'Permiso sin goce',     color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const STATUS_META = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  aprobado:  { label: 'Aprobado',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rechazado: { label: 'Rechazado', color: 'bg-red-50 text-red-700 border-red-200' },
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

function daysBetweenInclusive(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
}

function RequestModal({ employees, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee_id: '', type: 'vacaciones', start_date: todayISO(), end_date: todayISO(),
    days_requested: 1, reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    setForm((f) => ({ ...f, days_requested: daysBetweenInclusive(f.start_date, f.end_date) }));
  }, [form.start_date, form.end_date]);

  useEffect(() => {
    if (!form.employee_id) { setBalance(null); return; }
    (async () => {
      const employee = employees.find((e) => e.id === form.employee_id);
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from('hr_vacation_requests')
        .select('days_requested')
        .eq('employee_id', form.employee_id)
        .eq('type', 'vacaciones')
        .eq('status', 'aprobado')
        .gte('start_date', `${year}-01-01`)
        .lte('start_date', `${year}-12-31`);
      const used = (data || []).reduce((sum, r) => sum + Number(r.days_requested || 0), 0);
      const total = employee?.vacation_days_per_year ?? 12;
      setBalance({ total, used, available: total - used });
    })();
  }, [form.employee_id, employees]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('hr_vacation_requests').insert([{
        employee_id: form.employee_id,
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
        days_requested: form.days_requested,
        reason: form.reason || null,
        status: 'pendiente',
      }]);
      if (error) throw error;
      onSaved();
    } catch (err) {
      alert('Error al guardar la solicitud: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Nueva Solicitud</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Colaborador *</label>
            <select required className="input-field" value={form.employee_id}
              onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}>
              <option value="">-- Seleccionar --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
            {balance && (
              <p className="text-xs text-gray-500 mt-1">
                Saldo {new Date().getFullYear()}: <span className="font-semibold text-gray-700">{balance.available}</span> de {balance.total} días disponibles
                {balance.available < 0 && <span className="text-red-600 font-semibold"> (excedido)</span>}
              </p>
            )}
          </div>

          <div>
            <label className="label">Tipo *</label>
            <select className="input-field" value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {Object.entries(TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha Inicio *</label>
              <input type="date" required className="input-field" value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha Fin *</label>
              <input type="date" required min={form.start_date} className="input-field" value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Días solicitados</label>
            <input type="number" min="0" step="0.5" className="input-field" value={form.days_requested}
              onChange={(e) => setForm((f) => ({ ...f, days_requested: Number(e.target.value) }))} />
            <p className="text-[11px] text-gray-400 mt-1">Calculado automáticamente por fecha; puedes ajustarlo si aplica media jornada u otro criterio.</p>
          </div>

          <div>
            <label className="label">Motivo / Notas</label>
            <textarea rows={2} className="input-field" value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Vacaciones() {
  const { user } = useAuth();
  const { canManageRH } = useRole();
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase.from('employees').select('id, full_name, vacation_days_per_year').order('full_name');
    setEmployees(data || []);
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('hr_vacation_requests')
        .select('*, employee:employees(full_name), reviewer:profiles!hr_vacation_requests_reviewed_by_fkey(full_name)')
        .order('created_at', { ascending: false });
      if (employeeFilter) query = query.eq('employee_id', employeeFilter);
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error al cargar solicitudes:', err.message);
    } finally {
      setLoading(false);
    }
  }, [employeeFilter, statusFilter]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleReview = async (id, status) => {
    const { error } = await supabase
      .from('hr_vacation_requests')
      .update({ status, reviewed_by: user?.id || null, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadRequests();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta solicitud?')) return;
    const { error } = await supabase.from('hr_vacation_requests').delete().eq('id', id);
    if (error) alert('Error al eliminar: ' + error.message);
    else loadRequests();
  };

  const handleExport = (format) => {
    const rows = requests.map((r) => ({
      Colaborador: r.employee?.full_name || '—',
      Tipo: TYPE_META[r.type]?.label || r.type,
      'Fecha Inicio': r.start_date,
      'Fecha Fin': r.end_date,
      Días: r.days_requested,
      Estatus: STATUS_META[r.status]?.label || r.status,
      'Revisado por': r.reviewer?.full_name || '—',
      Motivo: r.reason || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vacaciones');
    XLSX.writeFile(wb, `vacaciones_${todayISO()}.${format}`, { bookType: format });
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Plane className="text-brand-500" /> Vacaciones y Permisos
          </h1>
          <p className="text-sm text-gray-500">Solicitudes, aprobación y saldo de días disponibles.</p>
        </div>
        {canManageRH && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-1.5 text-xs">
              <Download size={14} /> CSV
            </button>
            <button onClick={() => handleExport('xlsx')} className="btn-secondary flex items-center gap-1.5 text-xs">
              <Download size={14} /> XLSX
            </button>
            <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-1.5">
              <Plus size={16} /> Nueva Solicitud
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="input-field">
          <option value="">Todos los colaboradores</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.full_name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
          <option value="">Todos los estatus</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Fechas</th>
                <th className="py-3 px-4">Días</th>
                <th className="py-3 px-4">Estatus</th>
                <th className="py-3 px-4">Revisado por</th>
                {canManageRH && <th className="py-3 px-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">Cargando...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No hay solicitudes registradas.</td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{r.employee?.full_name || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_META[r.type]?.color || ''}`}>
                        {TYPE_META[r.type]?.label || r.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">{r.start_date} → {r.end_date}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{r.days_requested}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_META[r.status]?.color || ''}`}>
                        {STATUS_META[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{r.reviewer?.full_name || '—'}</td>
                    {canManageRH && (
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        {r.status === 'pendiente' && (
                          <>
                            <button onClick={() => handleReview(r.id, 'aprobado')}
                              className="text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-1 text-xs font-medium">
                              <Check size={13} /> Aprobar
                            </button>
                            <button onClick={() => handleReview(r.id, 'rechazado')}
                              className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 text-xs font-medium">
                              <Ban size={13} /> Rechazar
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDelete(r.id)}
                          className="text-gray-400 hover:text-red-600 inline-flex items-center gap-1 text-xs font-medium">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <RequestModal
          employees={employees}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadRequests(); }}
        />
      )}
    </div>
  );
}
