import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Archive, Upload, Download, Trash2, Search, X, FileArchive,
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatCurrency, formatDateEs } from './pdfTemplates';

const BUCKET = 'document-vault';

const DOC_TYPE_LABELS = {
  factura: 'Factura',
  cotizacion: 'Cotización',
  orden_compra: 'Orden de Compra',
  otro: 'Otro',
};

const PAYMENT_STATUS_META = {
  pagada: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  pendiente: 'bg-amber-950 text-amber-400 border-amber-800',
  vencida: 'bg-red-950 text-red-400 border-red-800',
};

function emptyUpload() {
  return {
    doc_type: 'factura',
    folio: '',
    provider_client: '',
    issue_date: new Date().toISOString().slice(0, 10),
    amount: '',
    payment_status: 'pendiente',
    department: '',
    notes: '',
    file: null,
  };
}

export default function DocumentVault() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyUpload);
  const fileInputRef = useRef(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_vault')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocs(data || []);
    } catch (err) {
      console.error('Error al cargar la bóveda de documentos:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const filtered = docs.filter((d) => {
    if (typeFilter && d.doc_type !== typeFilter) return false;
    if (statusFilter && d.payment_status !== statusFilter) return false;
    if (dateFrom && d.issue_date && d.issue_date < dateFrom) return false;
    if (dateTo && d.issue_date && d.issue_date > dateTo) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = `${d.folio || ''} ${d.provider_client || ''} ${d.notes || ''} ${d.file_name || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const clearFilters = () => {
    setSearch(''); setTypeFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.file) { alert('Selecciona un archivo para guardar en la bóveda.'); return; }
    setUploading(true);
    try {
      const safeName = form.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `docs/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, form.file);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from('document_vault').insert([{
        doc_type: form.doc_type,
        folio: form.folio || null,
        provider_client: form.provider_client || null,
        issue_date: form.issue_date || null,
        amount: form.amount === '' ? null : Number(form.amount),
        payment_status: form.payment_status,
        department: form.department || null,
        notes: form.notes || null,
        file_path: path,
        file_name: form.file.name,
      }]);
      if (error) throw error;

      setModalOpen(false);
      setForm(emptyUpload());
      loadDocs();
    } catch (err) {
      alert('Error al guardar el documento: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name || 'documento';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al descargar: ' + err.message);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.file_name || doc.folio}" de la bóveda? Esta acción no se puede deshacer.`)) return;
    try {
      await supabase.storage.from(BUCKET).remove([doc.file_path]);
      const { error } = await supabase.from('document_vault').delete().eq('id', doc.id);
      if (error) throw error;
      loadDocs();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Archive size={18} className="text-sky-400" /> Bóveda de Facturas y Cotizaciones
          </h2>
          <p className="text-xs text-slate-400">Resguardo centralizado de facturas, cotizaciones y órdenes de compra con filtros de búsqueda.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Upload size={15} /> Guardar Documento
        </button>
      </div>

      {/* Filtros */}
      <div className="card py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por folio, proveedor/cliente, notas..."
            className="input-field pl-9 text-sm"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field text-sm w-auto">
          <option value="">Todos los tipos</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field text-sm w-auto">
          <option value="">Todos los estados</option>
          <option value="pagada">Pagada</option>
          <option value="pendiente">Pendiente</option>
          <option value="vencida">Vencida</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field text-sm w-auto" title="Desde" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field text-sm w-auto" title="Hasta" />
        {(search || typeFilter || statusFilter || dateFrom || dateTo) && (
          <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      {/* Listado */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileArchive}
            title="Sin documentos en la bóveda"
            description="Sube facturas, cotizaciones u órdenes de compra para resguardarlas aquí."
            action={<button onClick={() => setModalOpen(true)} className="btn-primary text-sm">+ Guardar documento</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Proveedor / Cliente</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3 text-right">Monto</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Archivo</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-700/40">
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-800 text-slate-300 border-slate-700">
                        {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{doc.folio || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-200">{doc.provider_client || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-400">{formatDateEs(doc.issue_date)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-200">{doc.amount != null ? formatCurrency(doc.amount) : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PAYMENT_STATUS_META[doc.payment_status] || PAYMENT_STATUS_META.pendiente}`}>
                        {doc.payment_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-[180px] truncate">{doc.file_name || '—'}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleDownload(doc)} title="Descargar" className="text-slate-500 hover:text-sky-400"><Download size={14} /></button>
                        <button onClick={() => handleDelete(doc)} title="Eliminar" className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de carga */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Upload size={18} className="text-sky-400" /> Guardar Documento
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-slate-300"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo de documento</label>
                  <select className="input-field" value={form.doc_type} onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value }))}>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Folio</label>
                  <input className="input-field" value={form.folio} onChange={(e) => setForm((f) => ({ ...f, folio: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Proveedor / Cliente</label>
                <input className="input-field" value={form.provider_client} onChange={(e) => setForm((f) => ({ ...f, provider_client: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" className="input-field" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Monto</label>
                  <input type="number" step="any" className="input-field" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Estado de pago</label>
                  <select className="input-field" value={form.payment_status} onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value }))}>
                    <option value="pendiente">Pendiente</option>
                    <option value="pagada">Pagada</option>
                    <option value="vencida">Vencida</option>
                  </select>
                </div>
                <div>
                  <label className="label">Departamento</label>
                  <input className="input-field" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea rows={2} className="input-field" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label className="label">Archivo (PDF, imagen, Excel...)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-950 file:text-sky-400 hover:file:bg-sky-900 cursor-pointer"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={uploading} className="btn-primary">{uploading ? 'Guardando...' : 'Guardar en Bóveda'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
