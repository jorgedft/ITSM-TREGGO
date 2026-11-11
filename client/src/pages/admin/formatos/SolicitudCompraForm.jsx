import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, FileDown, FileSpreadsheet, Printer, Pencil, X, ClipboardList,
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { renderSolicitudCompraPDF, printPdf, formatCurrency, formatDateEs, PAYMENT_METHOD_LABELS } from './pdfTemplates';
import { exportSolicitudCompraExcel } from './excelTemplates';

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABELS);

const STATUS_META = {
  pendiente: 'bg-amber-950 text-amber-400 border-amber-800',
  aprobada: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  rechazada: 'bg-red-950 text-red-400 border-red-800',
};

function emptyItem() {
  return { description: '', quantity: 1, unit: 'PZA', unit_cost: 0, provider: '' };
}

function emptyForm(fullName) {
  return {
    folio: '',
    request_date: new Date().toISOString().slice(0, 10),
    requesting_area: '',
    requester: fullName || '',
    cost_center: 'TREGGO',
    provider: '',
    issues_invoice: true,
    payment_method: 'transferencia',
    bank_details: '',
    payment_date: '',
    items: [emptyItem()],
    iva: 0,
    other_tax: 0,
    required_date: '',
    justification: '',
    status: 'pendiente',
  };
}

export default function SolicitudCompraForm() {
  const { profile } = useAuth();
  const [form, setForm] = useState(() => emptyForm(profile?.full_name));
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error al cargar solicitudes de compra:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const updateItem = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0), 0);
  const total = subtotal + (Number(form.iva) || 0) + (Number(form.other_tax) || 0);

  const resetForm = () => {
    setForm(emptyForm(profile?.full_name));
    setEditingId(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        subtotal,
        total,
        iva: Number(form.iva) || 0,
        other_tax: Number(form.other_tax) || 0,
        requesting_area: form.requesting_area || null,
        cost_center: form.cost_center || null,
        provider: form.provider || null,
        bank_details: form.bank_details || null,
        payment_date: form.payment_date || null,
        required_date: form.required_date || null,
        justification: form.justification || null,
        folio: form.folio || null,
      };
      const { error } = editingId
        ? await supabase.from('purchase_requests').update(payload).eq('id', editingId)
        : await supabase.from('purchase_requests').insert([payload]);
      if (error) throw error;
      resetForm();
      loadRequests();
    } catch (err) {
      alert('Error al guardar la solicitud: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (req) => {
    setEditingId(req.id);
    setForm({
      folio: req.folio || '',
      request_date: req.request_date || new Date().toISOString().slice(0, 10),
      requesting_area: req.requesting_area || '',
      requester: req.requester || '',
      cost_center: req.cost_center || '',
      provider: req.provider || '',
      issues_invoice: req.issues_invoice ?? true,
      payment_method: req.payment_method || 'transferencia',
      bank_details: req.bank_details || '',
      payment_date: req.payment_date || '',
      items: req.items?.length ? req.items : [emptyItem()],
      iva: req.iva || 0,
      other_tax: req.other_tax || 0,
      required_date: req.required_date || '',
      justification: req.justification || '',
      status: req.status || 'pendiente',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (req) => {
    if (!window.confirm(`¿Eliminar la solicitud${req.folio ? ` "${req.folio}"` : ''}? Esta acción no se puede deshacer.`)) return;
    try {
      const { error } = await supabase.from('purchase_requests').delete().eq('id', req.id);
      if (error) throw error;
      if (editingId === req.id) resetForm();
      loadRequests();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handleExportPDF = (req) => renderSolicitudCompraPDF(req).save(`solicitud-compra-${req.folio || req.id.slice(0, 8)}.pdf`);
  const handlePrint = (req) => printPdf(renderSolicitudCompraPDF(req));
  const handleExportExcel = (req) => exportSolicitudCompraExcel(req, `solicitud-compra-${req.folio || req.id.slice(0, 8)}.xlsx`);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="card space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <ClipboardList size={18} className="text-sky-400" />
            {editingId ? 'Editar Solicitud de Compra' : 'Nueva Solicitud de Compra'}
          </h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
              <X size={14} /> Cancelar edición
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Folio</label>
            <input className="input-field" value={form.folio} onChange={(e) => updateField('folio', e.target.value)} placeholder="SC-0001" />
          </div>
          <div>
            <label className="label">Fecha de solicitud</label>
            <input type="date" className="input-field" value={form.request_date} onChange={(e) => updateField('request_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Área solicitante</label>
            <input className="input-field" value={form.requesting_area} onChange={(e) => updateField('requesting_area', e.target.value)} placeholder="TI" />
          </div>
          <div>
            <label className="label">Solicitante</label>
            <input className="input-field" value={form.requester} onChange={(e) => updateField('requester', e.target.value)} />
          </div>
          <div>
            <label className="label">Centro de costo</label>
            <input className="input-field" value={form.cost_center} onChange={(e) => updateField('cost_center', e.target.value)} />
          </div>
          <div>
            <label className="label">Proveedor</label>
            <input className="input-field" value={form.provider} onChange={(e) => updateField('provider', e.target.value)} />
          </div>
          <div>
            <label className="label">¿Emite factura?</label>
            <select className="input-field" value={form.issues_invoice ? '1' : '0'} onChange={(e) => updateField('issues_invoice', e.target.value === '1')}>
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </div>
          <div>
            <label className="label">Condiciones de pago</label>
            <select className="input-field" value={form.payment_method} onChange={(e) => updateField('payment_method', e.target.value)}>
              {PAYMENT_METHODS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fecha de pago</label>
            <input type="date" className="input-field" value={form.payment_date} onChange={(e) => updateField('payment_date', e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Datos bancarios</label>
            <input className="input-field" value={form.bank_details} onChange={(e) => updateField('bank_details', e.target.value)} placeholder="Banco, cuenta, CLABE..." />
          </div>
          <div>
            <label className="label">Estatus</label>
            <select className="input-field" value={form.status} onChange={(e) => updateField('status', e.target.value)}>
              <option value="pendiente">Pendiente</option>
              <option value="aprobada">Aprobada</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>
        </div>

        {/* Partidas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Partidas solicitadas</label>
            <button type="button" onClick={addItem} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
              <Plus size={14} /> Agregar partida
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900/60 text-slate-400 uppercase text-[10px]">
                  <th className="py-2 px-2 text-left">Descripción</th>
                  <th className="py-2 px-2 text-left w-20">Cant.</th>
                  <th className="py-2 px-2 text-left w-20">Unidad</th>
                  <th className="py-2 px-2 text-left w-28">Costo Unit.</th>
                  <th className="py-2 px-2 text-left w-28">Costo Total</th>
                  <th className="py-2 px-2 text-left w-32">Proveedor</th>
                  <th className="py-2 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {form.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-1.5">
                      <input className="input-field text-xs py-1.5" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                    </td>
                    <td className="p-1.5">
                      <input type="number" step="any" className="input-field text-xs py-1.5" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                    </td>
                    <td className="p-1.5">
                      <input className="input-field text-xs py-1.5" value={it.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                    </td>
                    <td className="p-1.5">
                      <input type="number" step="any" className="input-field text-xs py-1.5" value={it.unit_cost} onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)} />
                    </td>
                    <td className="p-1.5 text-slate-300 font-medium">
                      {formatCurrency((Number(it.quantity) || 0) * (Number(it.unit_cost) || 0))}
                    </td>
                    <td className="p-1.5">
                      <input className="input-field text-xs py-1.5" value={it.provider} onChange={(e) => updateItem(idx, 'provider', e.target.value)} />
                    </td>
                    <td className="p-1.5 text-center">
                      <button type="button" onClick={() => removeItem(idx)} className="text-slate-500 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totales */}
        <div className="flex flex-col items-end gap-1.5 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 w-32 text-right">Subtotal:</span>
            <span className="font-semibold text-slate-200 w-28 text-right">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 w-32 text-right">IVA:</span>
            <input type="number" step="any" className="input-field text-xs py-1 w-28 text-right" value={form.iva} onChange={(e) => updateField('iva', e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 w-32 text-right">Otro impuesto:</span>
            <input type="number" step="any" className="input-field text-xs py-1 w-28 text-right" value={form.other_tax} onChange={(e) => updateField('other_tax', e.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-1 border-t border-slate-700">
            <span className="text-slate-300 w-32 text-right font-bold">Total:</span>
            <span className="font-bold text-sky-400 w-28 text-right">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha de producto/servicio requerido</label>
            <input type="date" className="input-field" value={form.required_date} onChange={(e) => updateField('required_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Justificación de la compra</label>
            <input className="input-field" value={form.justification} onChange={(e) => updateField('justification', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={15} /> {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar solicitud'}
          </button>
        </div>
      </form>

      {/* Historial */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 font-semibold text-sm text-slate-300">
          Historial de Solicitudes ({requests.length})
        </div>
        {loading ? (
          <Spinner />
        ) : requests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Sin solicitudes registradas" description="Crea tu primera solicitud de compra con el formulario de arriba." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Solicitante</th>
                  <th className="py-2.5 px-3">Proveedor</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3">Estatus</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-700/40">
                    <td className="py-2.5 px-3 font-mono text-slate-300">{req.folio || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-400">{formatDateEs(req.request_date)}</td>
                    <td className="py-2.5 px-3 text-slate-200">{req.requester || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-400">{req.provider || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-200">{formatCurrency(req.total)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_META[req.status] || STATUS_META.pendiente}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(req)} title="Editar" className="text-slate-500 hover:text-sky-400"><Pencil size={14} /></button>
                        <button onClick={() => handleExportPDF(req)} title="Exportar PDF" className="text-slate-500 hover:text-red-400"><FileDown size={14} /></button>
                        <button onClick={() => handleExportExcel(req)} title="Exportar Excel" className="text-slate-500 hover:text-emerald-400"><FileSpreadsheet size={14} /></button>
                        <button onClick={() => handlePrint(req)} title="Imprimir" className="text-slate-500 hover:text-slate-200"><Printer size={14} /></button>
                        <button onClick={() => handleDelete(req)} title="Eliminar" className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
