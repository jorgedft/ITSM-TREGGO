import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, FileDown, FileSpreadsheet, Printer, Pencil, X, FileText, Eye,
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { renderOrdenCompraPDF, printPdf, formatCurrency, formatDateEs } from './pdfTemplates';
import { exportOrdenCompraExcel, MAX_TEMPLATE_ITEMS } from './xlsxTemplates';
import PdfPreviewModal from './PdfPreviewModal';

const STATUS_META = {
  pendiente: 'bg-amber-950 text-amber-400 border-amber-800',
  aprobada: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  rechazada: 'bg-red-950 text-red-400 border-red-800',
};

function emptyItem() {
  return { description: '', quantity: 1, unit: 'UNIDADES', unit_price: 0 };
}

function emptyForm() {
  return {
    folio: '',
    request_date: new Date().toISOString().slice(0, 10),
    status: 'pendiente',
    requester: '',
    department: '',
    expense_type: '',
    provider: '',
    description: '',
    items: [emptyItem()],
    order_number: '',
    order_date: '',
    awarded_provider: '',
    payment_terms: '',
    delivery_time: '',
    netsuite_po: '',
    elaborated_by: '',
    authorized_by: '',
  };
}

export default function OrdenCompraForm() {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error al cargar órdenes de compra:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

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

  const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        subtotal,
        iva,
        total,
        folio: form.folio || null,
        department: form.department || null,
        expense_type: form.expense_type || null,
        provider: form.provider || null,
        description: form.description || null,
        order_number: form.order_number || null,
        order_date: form.order_date || null,
        awarded_provider: form.awarded_provider || null,
        payment_terms: form.payment_terms || null,
        delivery_time: form.delivery_time || null,
        netsuite_po: form.netsuite_po || null,
        elaborated_by: form.elaborated_by || null,
        authorized_by: form.authorized_by || null,
      };
      const { error } = editingId
        ? await supabase.from('purchase_orders').update(payload).eq('id', editingId)
        : await supabase.from('purchase_orders').insert([payload]);
      if (error) throw error;
      resetForm();
      loadOrders();
    } catch (err) {
      alert('Error al guardar la orden de compra: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ord) => {
    setEditingId(ord.id);
    setForm({
      folio: ord.folio || '',
      request_date: ord.request_date || new Date().toISOString().slice(0, 10),
      status: ord.status || 'pendiente',
      requester: ord.requester || '',
      department: ord.department || '',
      expense_type: ord.expense_type || '',
      provider: ord.provider || '',
      description: ord.description || '',
      items: ord.items?.length ? ord.items : [emptyItem()],
      order_number: ord.order_number || '',
      order_date: ord.order_date || '',
      awarded_provider: ord.awarded_provider || '',
      payment_terms: ord.payment_terms || '',
      delivery_time: ord.delivery_time || '',
      netsuite_po: ord.netsuite_po || '',
      elaborated_by: ord.elaborated_by || '',
      authorized_by: ord.authorized_by || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (ord) => {
    if (!window.confirm(`¿Eliminar la orden${ord.folio ? ` "${ord.folio}"` : ''}? Esta acción no se puede deshacer.`)) return;
    try {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', ord.id);
      if (error) throw error;
      if (editingId === ord.id) resetForm();
      loadOrders();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handleExportPDF = (ord) => renderOrdenCompraPDF(ord).save(`orden-compra-${ord.order_number || ord.folio || ord.id.slice(0, 8)}.pdf`);
  const handlePrint = (ord) => printPdf(renderOrdenCompraPDF(ord));
  const fileBase = (ord) => `orden-compra-${ord.order_number || ord.folio || (ord.id ? ord.id.slice(0, 8) : 'borrador')}`;
  const handleExportExcel = (ord) => {
    if ((ord.items || []).length > MAX_TEMPLATE_ITEMS) {
      alert(`El formato de Excel admite máximo ${MAX_TEMPLATE_ITEMS} partidas; las adicionales no se incluirán (el PDF sí las muestra todas).`);
    }
    exportOrdenCompraExcel(ord, `${fileBase(ord)}.xlsx`)
      .catch((err) => alert('Error al exportar Excel: ' + err.message));
  };
  const buildPreviewDoc = useCallback(() => renderOrdenCompraPDF(preview), [preview]);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="card space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <FileText size={18} className="text-sky-400" />
            {editingId ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
          </h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
              <X size={14} /> Cancelar edición
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Folio de solicitud</label>
            <input className="input-field" value={form.folio} onChange={(e) => updateField('folio', e.target.value)} placeholder="OC-0001-01" />
          </div>
          <div>
            <label className="label">Fecha solicitud</label>
            <input type="date" className="input-field" value={form.request_date} onChange={(e) => updateField('request_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Estatus</label>
            <select className="input-field" value={form.status} onChange={(e) => updateField('status', e.target.value)}>
              <option value="pendiente">Pendiente</option>
              <option value="aprobada">Aprobada</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>
          <div>
            <label className="label">Solicitante</label>
            <input className="input-field" value={form.requester} onChange={(e) => updateField('requester', e.target.value)} />
          </div>
          <div>
            <label className="label">Depto. / Centro de costo</label>
            <input className="input-field" value={form.department} onChange={(e) => updateField('department', e.target.value)} />
          </div>
          <div>
            <label className="label">Tipo de gasto</label>
            <input className="input-field" value={form.expense_type} onChange={(e) => updateField('expense_type', e.target.value)} placeholder="Insumo/Material" />
          </div>
          <div>
            <label className="label">Proveedor</label>
            <input className="input-field" value={form.provider} onChange={(e) => updateField('provider', e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="label">Descripción de lo solicitado</label>
            <input className="input-field" value={form.description} onChange={(e) => updateField('description', e.target.value)} />
          </div>
        </div>

        {/* Partidas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Partidas — detalle de productos</label>
            <button type="button" onClick={addItem} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
              <Plus size={14} /> Agregar partida
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900/60 text-slate-400 uppercase text-[10px]">
                  <th className="py-2 px-2 text-left">Descripción del producto</th>
                  <th className="py-2 px-2 text-left w-20">Cant.</th>
                  <th className="py-2 px-2 text-left w-24">Unidad</th>
                  <th className="py-2 px-2 text-left w-28">Precio Unit.</th>
                  <th className="py-2 px-2 text-left w-28">Precio Total</th>
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
                      <input type="number" step="any" className="input-field text-xs py-1.5" value={it.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} />
                    </td>
                    <td className="p-1.5 text-slate-300 font-medium">
                      {formatCurrency((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
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

        {/* Totales (fijos: IVA 16%, igual que el formato original) */}
        <div className="flex flex-col items-end gap-1.5 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 w-32 text-right">Subtotal:</span>
            <span className="font-semibold text-slate-200 w-28 text-right">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 w-32 text-right">I.V.A. (16%):</span>
            <span className="font-semibold text-slate-200 w-28 text-right">{formatCurrency(iva)}</span>
          </div>
          <div className="flex items-center gap-3 pt-1 border-t border-slate-700">
            <span className="text-slate-300 w-32 text-right font-bold">Total con I.V.A.:</span>
            <span className="font-bold text-sky-400 w-28 text-right">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Seguimiento de la orden */}
        <div>
          <label className="label">Datos de seguimiento de la orden</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] text-slate-500">No. de Orden de Compra</label>
              <input className="input-field" value={form.order_number} onChange={(e) => updateField('order_number', e.target.value)} placeholder="OC-1026-15" />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Fecha de la orden</label>
              <input type="date" className="input-field" value={form.order_date} onChange={(e) => updateField('order_date', e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Proveedor adjudicado</label>
              <input className="input-field" value={form.awarded_provider} onChange={(e) => updateField('awarded_provider', e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Condiciones de pago</label>
              <input className="input-field" value={form.payment_terms} onChange={(e) => updateField('payment_terms', e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Tiempo de entrega</label>
              <input className="input-field" value={form.delivery_time} onChange={(e) => updateField('delivery_time', e.target.value)} placeholder="3 a 5 días" />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">No. PO en NetSuite</label>
              <input className="input-field" value={form.netsuite_po} onChange={(e) => updateField('netsuite_po', e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Elaboró (Compras)</label>
              <input className="input-field" value={form.elaborated_by} onChange={(e) => updateField('elaborated_by', e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Autorizó (Dirección)</label>
              <input className="input-field" value={form.authorized_by} onChange={(e) => updateField('authorized_by', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
          <button type="button" onClick={() => setPreview({ ...form, subtotal, iva, total })} className="btn-secondary flex items-center gap-2">
            <Eye size={15} /> Vista previa
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={15} /> {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar orden'}
          </button>
        </div>
      </form>

      {/* Historial */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 font-semibold text-sm text-slate-300">
          Historial de Órdenes de Compra ({orders.length})
        </div>
        {loading ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState icon={FileText} title="Sin órdenes registradas" description="Crea tu primera orden de compra con el formulario de arriba." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">No. Orden</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Proveedor</th>
                  <th className="py-2.5 px-3">Descripción</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3">Estatus</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-700/40">
                    <td className="py-2.5 px-3 font-mono text-slate-300">{ord.order_number || ord.folio || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-400">{formatDateEs(ord.request_date)}</td>
                    <td className="py-2.5 px-3 text-slate-200">{ord.provider || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-[220px] truncate">{ord.description || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-200">{formatCurrency(ord.total)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_META[ord.status] || STATUS_META.pendiente}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setPreview(ord)} title="Vista previa" className="text-slate-500 hover:text-sky-400"><Eye size={14} /></button>
                        <button onClick={() => handleEdit(ord)} title="Editar" className="text-slate-500 hover:text-sky-400"><Pencil size={14} /></button>
                        <button onClick={() => handleExportPDF(ord)} title="Exportar PDF" className="text-slate-500 hover:text-red-400"><FileDown size={14} /></button>
                        <button onClick={() => handleExportExcel(ord)} title="Exportar Excel" className="text-slate-500 hover:text-emerald-400"><FileSpreadsheet size={14} /></button>
                        <button onClick={() => handlePrint(ord)} title="Imprimir" className="text-slate-500 hover:text-slate-200"><Printer size={14} /></button>
                        <button onClick={() => handleDelete(ord)} title="Eliminar" className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && (
        <PdfPreviewModal
          title="Orden de Compra"
          filename={fileBase(preview)}
          buildDoc={buildPreviewDoc}
          onExportExcel={() => handleExportExcel(preview)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
