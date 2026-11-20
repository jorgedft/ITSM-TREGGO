import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, Eye, Pencil, Trash2, X, Search, FileDown, Printer, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../services/supabase';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import PdfPreviewModal from '../formatos/PdfPreviewModal';
import { renderRecordPDF, printPdf, formatDateEs } from '../formatos/pdfTemplates';
import { TONE_CLASSES, statusMeta, emptyValues, recordToValues, displayValue } from './formats';

const assetLabel = (a) =>
  `${a.asset_tag || a.asset_code || 'Sin etiqueta'} — ${[a.brand, a.model].filter(Boolean).join(' ') || 'Sin modelo'}${a.serial_number ? ` · SN ${a.serial_number}` : ''}`;
const phoneLabel = (p) =>
  `${[p.brand, p.model].filter(Boolean).join(' ') || 'Teléfono'} · ${p.phone_number || 'sin línea'}${p.imei ? ` · IMEI ${p.imei}` : ''}`;

function FieldInput({ field, value, onChange, lookups }) {
  if (field.type === 'checklist') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-white/10 bg-black/20 p-3">
        {value.map((item, idx) => (
          <label key={item.label} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={item.done}
              onChange={(e) => onChange(value.map((it, i) => (i === idx ? { ...it, done: e.target.checked } : it)))}
              className="accent-sky-500"
            />
            {item.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === 'textarea') {
    return <textarea rows={3} required={field.required} className="input-field" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === 'select') {
    return (
      <select required={field.required} className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {!field.default && <option value="">Selecciona...</option>}
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === 'asset' || field.type === 'phone') {
    const options = field.type === 'asset' ? lookups.asset : lookups.phone;
    return (
      <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Ninguno —</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }
  const type = field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text';
  return (
    <input
      type={type}
      required={field.required}
      list={field.type === 'person' ? 'registros-people' : undefined}
      className="input-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function RecordsTab({ format }) {
  const [values, setValues] = useState(() => emptyValues(format));
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lookups, setLookups] = useState({ asset: [], phone: [] });

  const needsAssets = format.fields.some((f) => f.type === 'asset');
  const needsPhones = format.fields.some((f) => f.type === 'phone');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('it_records')
      .select('*')
      .eq('kind', format.key)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) console.error('Error al cargar registros:', error.message);
    setRecords(data || []);
    setLoading(false);
  }, [format.key]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  useEffect(() => {
    (async () => {
      const next = { asset: [], phone: [] };
      if (needsAssets) {
        const { data } = await supabase.from('assets').select('id, asset_tag, asset_code, brand, model, serial_number').order('asset_tag');
        next.asset = (data || []).map((a) => ({ id: a.id, label: assetLabel(a) }));
      }
      if (needsPhones) {
        const { data } = await supabase.from('phones').select('id, brand, model, phone_number, imei').order('brand');
        next.phone = (data || []).map((p) => ({ id: p.id, label: phoneLabel(p) }));
      }
      setLookups(next);
    })();
  }, [needsAssets, needsPhones]);

  const setField = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const reset = () => { setValues(emptyValues(format)); setEditingId(null); };

  // Registro tal como se guardaría (también sirve para la vista previa antes de guardar).
  const buildRecord = useCallback((vals, extra = {}) => {
    const { record_date, status, ...rest } = vals;
    const data = { ...rest };
    format.fields.forEach((f) => {
      if (f.type === 'asset' || f.type === 'phone') {
        const found = lookups[f.type].find((o) => o.id === vals[f.name]);
        data[`${f.name}_label`] = found ? found.label : (vals[f.name] ? (vals[`${f.name}_label`] || '') : '');
      }
    });
    return { kind: format.key, record_date: record_date || null, status, title: format.title(vals), data, ...extra };
  }, [format, lookups]);

  const handleSave = async (e) => {
    e.preventDefault();
    const problem = format.validate?.(values);
    if (problem) { alert(problem); return; }
    setSaving(true);
    try {
      const row = buildRecord(values);
      const { error } = editingId
        ? await supabase.from('it_records').update({ ...row, updated_at: new Date().toISOString() }).eq('id', editingId)
        : await supabase.from('it_records').insert([row]);
      if (error) throw error;
      reset();
      loadRecords();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rec) => {
    setEditingId(rec.id);
    setValues(recordToValues(format, rec));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (rec) => {
    if (!window.confirm(`¿Eliminar el registro ${rec.folio || ''}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('it_records').delete().eq('id', rec.id);
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    if (editingId === rec.id) reset();
    loadRecords();
  };

  const fileBase = (rec) => `${format.key}-${rec.folio || 'borrador'}`;
  const buildPreviewDoc = useCallback(() => renderRecordPDF(format, preview), [format, preview]);

  const exportList = () => {
    const rows = filtered.map((rec) => {
      const row = { Folio: rec.folio, [format.dateLabel]: formatDateEs(rec.record_date), Estatus: statusMeta(format, rec.status).label };
      format.fields.forEach((f) => { row[f.label] = f.type === 'date' ? formatDateEs(rec.data?.[f.name]) : displayValue(f, rec.data); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, format.label.slice(0, 31));
    XLSX.writeFile(wb, `${format.key}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      return `${r.folio} ${r.title} ${JSON.stringify(r.data)}`.toLowerCase().includes(q);
    });
  }, [records, search, statusFilter]);

  const wide = (f) => f.type === 'textarea' || f.type === 'checklist';

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="card space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <format.icon size={18} className="text-sky-400" />
            {editingId ? `Editar — ${format.pdfTitle}` : `Nuevo — ${format.pdfTitle}`}
          </h2>
          {editingId && (
            <button type="button" onClick={reset} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
              <X size={14} /> Cancelar edición
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label">{format.dateLabel}</label>
            <input type="date" required className="input-field" value={values.record_date} onChange={(e) => setField('record_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Estatus</label>
            <select className="input-field" value={values.status} onChange={(e) => setField('status', e.target.value)}>
              {format.statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {format.fields.map((f) => (
            <div key={f.name} className={wide(f) ? 'sm:col-span-2 lg:col-span-3' : ''}>
              <label className="label">{f.label}{f.required ? ' *' : ''}</label>
              <FieldInput field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} lookups={lookups} />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <button type="button" onClick={() => setPreview(buildRecord(values, { folio: editingId ? records.find((r) => r.id === editingId)?.folio : null }))} className="btn-secondary flex items-center gap-2">
            <Eye size={15} /> Vista previa
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={15} /> {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar registro'}
          </button>
        </div>
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-sm text-slate-300 mr-auto">Historial ({filtered.length})</span>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input-field pl-8 w-48" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input-field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos los estatus</option>
            {format.statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={exportList} disabled={filtered.length === 0} className="btn-secondary flex items-center gap-1.5 disabled:opacity-50">
            <FileSpreadsheet size={14} /> Excel
          </button>
        </div>

        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={format.icon} title="Sin registros" description="Los registros que guardes con el formulario de arriba aparecerán aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-black/20 border-b border-white/10 text-[10px] font-semibold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Resumen</th>
                  <th className="py-2.5 px-3">Estatus</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((rec) => {
                  const meta = statusMeta(format, rec.status);
                  return (
                    <tr key={rec.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-300">{rec.folio || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-400">{formatDateEs(rec.record_date)}</td>
                      <td className="py-2.5 px-3 text-slate-200 max-w-[320px] truncate">{rec.title || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setPreview(rec)} title="Vista previa" className="text-slate-500 hover:text-sky-400"><Eye size={14} /></button>
                          <button onClick={() => handleEdit(rec)} title="Editar" className="text-slate-500 hover:text-sky-400"><Pencil size={14} /></button>
                          <button onClick={() => renderRecordPDF(format, rec).save(`${fileBase(rec)}.pdf`)} title="Descargar PDF" className="text-slate-500 hover:text-red-400"><FileDown size={14} /></button>
                          <button onClick={() => printPdf(renderRecordPDF(format, rec))} title="Imprimir" className="text-slate-500 hover:text-slate-200"><Printer size={14} /></button>
                          <button onClick={() => handleDelete(rec)} title="Eliminar" className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && (
        <PdfPreviewModal
          title={format.pdfTitle}
          filename={fileBase(preview)}
          buildDoc={buildPreviewDoc}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
