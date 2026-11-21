import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Eye, Copy, FileDown, Printer, FileSignature } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import PdfPreviewModal from '../formatos/PdfPreviewModal';
import { formatDateEs, printPdf } from '../formatos/pdfTemplates';
import QuoteEditor from './QuoteEditor';
import { renderQuotePDF } from './quotePdf';
import { newQuote, quoteFromRow, addDays, formatMoney, QUOTE_STATUSES, TONES } from './quoteMath';

const statusTone = (value) => TONES[QUOTE_STATUSES.find((s) => s.value === value)?.tone || 'slate'];

export default function QuotesTab({ clients, catalog, settings, onClientsChanged }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = lista | estado del editor
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('quote_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) console.error('Error al cargar cotizaciones:', error.message);
    setQuotes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = (r) => r.valid_until && r.valid_until < today && ['borrador', 'enviada'].includes(r.status);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      return !q || `${r.folio} ${r.client_snapshot?.name}`.toLowerCase().includes(q);
    });
  }, [quotes, search, statusFilter]);

  const changeStatus = async (row, status) => {
    const { error } = await supabase.from('quotes').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) { alert('Error al cambiar el estatus: ' + error.message); return; }
    setQuotes((list) => list.map((r) => (r.id === row.id ? { ...r, status } : r)));
  };

  const duplicate = async (row) => {
    // eslint-disable-next-line no-unused-vars
    const { id, folio, created_at, updated_at, created_by, ...rest } = row;
    const date = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('quotes').insert([{
      ...rest, status: 'borrador', quote_date: date, valid_until: addDays(date, settings?.default_validity_days ?? 15),
    }]);
    if (error) { alert('Error al duplicar: ' + error.message); return; }
    load();
  };

  const remove = async (row) => {
    if (!window.confirm(`¿Eliminar la cotización ${row.folio}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('quotes').delete().eq('id', row.id);
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    load();
  };

  const buildPreviewDoc = useCallback(() => renderQuotePDF(preview, settings), [preview, settings]);

  if (editing) {
    return (
      <QuoteEditor
        initial={editing}
        clients={clients}
        catalog={catalog}
        settings={settings}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
        onClientsChanged={onClientsChanged}
      />
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/10">
        <span className="font-semibold text-sm text-slate-300 mr-auto">Cotizaciones ({filtered.length})</span>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-8 w-52" placeholder="Folio o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estatus</option>
          {QUOTE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => setEditing(newQuote(settings))} className="btn-primary"><Plus size={15} /> Nueva cotización</button>
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title={quotes.length ? 'Sin resultados' : 'Aún no hay cotizaciones'}
          description={quotes.length ? 'Prueba con otro folio, cliente o estatus.' : 'Crea tu primera cotización; puedes usar los productos del catálogo y tus clientes.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-black/20 border-b border-white/10 text-[10px] font-semibold text-slate-400 uppercase">
                <th className="py-2.5 px-3">Folio</th><th className="py-2.5 px-3">Fecha</th><th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3 text-right">Total</th><th className="py-2.5 px-3">Vigencia</th>
                <th className="py-2.5 px-3">Estatus</th><th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-300">{r.folio}</td>
                  <td className="py-2.5 px-3 text-slate-400">{formatDateEs(r.quote_date)}</td>
                  <td className="py-2.5 px-3 text-slate-100 max-w-[240px] truncate">{r.client_snapshot?.name || '—'}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-200 tabular-nums">{formatMoney(r.total, r.currency)}</td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                    {r.valid_until ? formatDateEs(r.valid_until) : '—'}
                    {isExpired(r) && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${TONES.amber}`}>Vencida</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={r.status}
                      onChange={(e) => changeStatus(r, e.target.value)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 ${statusTone(r.status)}`}
                      aria-label="Cambiar estatus"
                    >
                      {QUOTE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setPreview(r)} title="Vista previa" className="text-slate-500 hover:text-sky-400"><Eye size={14} /></button>
                      <button onClick={() => setEditing(quoteFromRow(r))} title="Editar" className="text-slate-500 hover:text-sky-400"><Pencil size={14} /></button>
                      <button onClick={() => duplicate(r)} title="Duplicar" className="text-slate-500 hover:text-sky-400"><Copy size={14} /></button>
                      <button onClick={() => renderQuotePDF(r, settings).save(`cotizacion-${r.folio}.pdf`)} title="Descargar PDF" className="text-slate-500 hover:text-red-400"><FileDown size={14} /></button>
                      <button onClick={() => printPdf(renderQuotePDF(r, settings))} title="Imprimir" className="text-slate-500 hover:text-slate-200"><Printer size={14} /></button>
                      <button onClick={() => remove(r)} title="Eliminar" className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <PdfPreviewModal title="Cotización" filename={`cotizacion-${preview.folio}`} buildDoc={buildPreviewDoc} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
