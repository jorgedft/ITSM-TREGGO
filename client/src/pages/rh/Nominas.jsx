import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Receipt, Plus, X, Download, Paperclip, Trash2, CheckCircle2, Pencil,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';

const BUCKET = 'payroll-receipts';
const STATUS_META = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  pagado:    { label: 'Pagado',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function currency(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

const EMPTY_FORM = {
  employee_id: '', period_label: '', period_start: todayISO(), period_end: todayISO(),
  gross_pay: '', deductions: '', net_pay: '', status: 'pendiente',
};

function PayrollModal({ initial, employees, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const gross = Number(form.gross_pay) || 0;
    const ded = Number(form.deductions) || 0;
    if (form.gross_pay !== '' || form.deductions !== '') {
      setForm((f) => ({ ...f, net_pay: (gross - ded).toFixed(2) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gross_pay, form.deductions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let receipt_path = initial?.receipt_path || null;
      let receipt_file_name = initial?.receipt_file_name || null;

      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `receipts/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
        if (uploadError) throw uploadError;
        receipt_path = path;
        receipt_file_name = file.name;
      }

      const payload = {
        employee_id: form.employee_id,
        period_label: form.period_label,
        period_start: form.period_start,
        period_end: form.period_end,
        gross_pay: form.gross_pay === '' ? null : Number(form.gross_pay),
        deductions: form.deductions === '' ? null : Number(form.deductions),
        net_pay: form.net_pay === '' ? null : Number(form.net_pay),
        status: form.status,
        paid_at: form.status === 'pagado' ? (initial?.paid_at || todayISO()) : null,
        receipt_path,
        receipt_file_name,
      };

      if (isEdit) {
        const { error } = await supabase.from('hr_payroll').update(payload).eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hr_payroll').insert([payload]);
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Editar Registro' : 'Nuevo Registro de Nómina'}</h2>
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
          </div>

          <div>
            <label className="label">Periodo *</label>
            <input type="text" required placeholder="Ej. Quincena 1 - Enero 2026" className="input-field"
              value={form.period_label} onChange={(e) => setForm((f) => ({ ...f, period_label: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Del *</label>
              <input type="date" required className="input-field" value={form.period_start}
                onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} />
            </div>
            <div>
              <label className="label">Al *</label>
              <input type="date" required className="input-field" value={form.period_end}
                onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Percepciones</label>
              <input type="number" step="0.01" className="input-field" value={form.gross_pay}
                onChange={(e) => setForm((f) => ({ ...f, gross_pay: e.target.value }))} />
            </div>
            <div>
              <label className="label">Deducciones</label>
              <input type="number" step="0.01" className="input-field" value={form.deductions}
                onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} />
            </div>
            <div>
              <label className="label">Neto</label>
              <input type="number" step="0.01" className="input-field" value={form.net_pay}
                onChange={(e) => setForm((f) => ({ ...f, net_pay: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Estatus</label>
            <select className="input-field" value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Paperclip size={13} /> Recibo (PDF, opcional)</label>
            <input ref={fileRef} type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer" />
            {initial?.receipt_file_name && !file && (
              <p className="text-[11px] text-gray-400 mt-1">Ya tiene: {initial.receipt_file_name} (sube otro para reemplazarlo)</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Nominas() {
  const { canManageRH } = useRole();
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase.from('employees').select('id, full_name').order('full_name');
    setEmployees(data || []);
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('hr_payroll')
        .select('*, employee:employees(full_name)')
        .order('period_start', { ascending: false });
      if (employeeFilter) query = query.eq('employee_id', employeeFilter);
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error('Error al cargar nóminas:', err.message);
    } finally {
      setLoading(false);
    }
  }, [employeeFilter, statusFilter]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleMarkPaid = async (r) => {
    const { error } = await supabase.from('hr_payroll').update({ status: 'pagado', paid_at: todayISO() }).eq('id', r.id);
    if (error) alert('Error: ' + error.message);
    else loadRecords();
  };

  const handleDelete = async (r) => {
    if (!window.confirm('¿Eliminar este registro de nómina?')) return;
    try {
      if (r.receipt_path) await supabase.storage.from(BUCKET).remove([r.receipt_path]);
      const { error } = await supabase.from('hr_payroll').delete().eq('id', r.id);
      if (error) throw error;
      loadRecords();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handleDownloadReceipt = async (r) => {
    try {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(r.receipt_path);
      if (error) throw error;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = r.receipt_file_name || 'recibo.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al descargar: ' + err.message);
    }
  };

  const handleExport = (format) => {
    const rows = records.map((r) => ({
      Colaborador: r.employee?.full_name || '—',
      Periodo: r.period_label,
      Del: r.period_start,
      Al: r.period_end,
      Percepciones: r.gross_pay ?? '',
      Deducciones: r.deductions ?? '',
      Neto: r.net_pay ?? '',
      Estatus: STATUS_META[r.status]?.label || r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nominas');
    XLSX.writeFile(wb, `nominas_${todayISO()}.${format}`, { bookType: format });
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="text-brand-500" /> Nóminas y Recibos
          </h1>
          <p className="text-sm text-gray-500">Pre-nómina y recibos de pago del personal.</p>
        </div>
        {canManageRH && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-1.5 text-xs">
              <Download size={14} /> CSV
            </button>
            <button onClick={() => handleExport('xlsx')} className="btn-secondary flex items-center gap-1.5 text-xs">
              <Download size={14} /> XLSX
            </button>
            <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary flex items-center gap-1.5">
              <Plus size={16} /> Nuevo Registro
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
                <th className="py-3 px-4">Periodo</th>
                <th className="py-3 px-4">Percepciones</th>
                <th className="py-3 px-4">Deducciones</th>
                <th className="py-3 px-4">Neto</th>
                <th className="py-3 px-4">Estatus</th>
                <th className="py-3 px-4">Recibo</th>
                {canManageRH && <th className="py-3 px-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">Cargando...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No hay registros de nómina.</td></tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{r.employee?.full_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-700">
                      {r.period_label}
                      <span className="block text-[11px] text-gray-400">{r.period_start} → {r.period_end}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{currency(r.gross_pay)}</td>
                    <td className="py-3 px-4 text-gray-700">{currency(r.deductions)}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{currency(r.net_pay)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_META[r.status]?.color || ''}`}>
                        {STATUS_META[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {r.receipt_path ? (
                        <button onClick={() => handleDownloadReceipt(r)} className="text-blue-600 hover:text-blue-800 text-xs font-medium inline-flex items-center gap-1">
                          <Download size={13} /> Ver
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    {canManageRH && (
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        {r.status === 'pendiente' && (
                          <button onClick={() => handleMarkPaid(r)} className="text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-1 text-xs font-medium">
                            <CheckCircle2 size={13} /> Pagar
                          </button>
                        )}
                        <button onClick={() => { setEditing(r); setModalOpen(true); }} className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs font-medium">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(r)} className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 text-xs font-medium">
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
        <PayrollModal
          initial={editing}
          employees={employees}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadRecords(); }}
        />
      )}
    </div>
  );
}
