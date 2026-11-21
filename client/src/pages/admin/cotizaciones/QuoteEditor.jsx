import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, Save, Eye, X, UserPlus } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import PdfPreviewModal from '../formatos/PdfPreviewModal';
import { ClientFormModal } from './ClientsTab';
import { renderQuotePDF } from './quotePdf';
import {
  calcQuote, formatMoney, emptyItem, quoteToRow, TAX_MODES, QUOTE_STATUSES, DEFAULT_RET_ISR, DEFAULT_RET_IVA,
} from './quoteMath';

export default function QuoteEditor({ initial, clients, catalog, settings, onClose, onSaved, onClientsChanged }) {
  const [q, setQ] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [clientModal, setClientModal] = useState(false);

  const set = (k, v) => setQ((s) => ({ ...s, [k]: v }));
  const setItem = (idx, k, v) => setQ((s) => ({ ...s, items: s.items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)) }));
  const removeItem = (idx) => setQ((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));
  const addFree = () => setQ((s) => ({ ...s, items: [...s.items, emptyItem()] }));

  const addFromCatalog = (id) => {
    const c = catalog.find((x) => x.id === id);
    if (!c) return;
    const row = { ...emptyItem(), catalog_id: c.id, description: c.name, detail: c.description || '', unit: c.unit, unit_price: c.unit_price };
    // Si la única partida está vacía, la reemplaza en lugar de dejar una fila en blanco arriba.
    setQ((s) => ({ ...s, items: s.items.length === 1 && !s.items[0].description.trim() ? [row] : [...s.items, row] }));
  };

  const calc = useMemo(() => calcQuote(q), [q]);
  const activeCatalog = useMemo(() => catalog.filter((c) => c.active), [catalog]);
  const noTax = q.tax_mode === 'none';

  const validate = () => {
    if (!q.client_id && !(q.client_free || '').trim()) return 'Elige un cliente o escribe el nombre del cliente.';
    if (!q.items.some((it) => (it.description || '').trim())) return 'Agrega al menos una partida con descripción.';
    return null;
  };

  const save = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) { alert(problem); return; }
    setSaving(true);
    const row = quoteToRow(q, clients);
    const { error } = q.id
      ? await supabase.from('quotes').update({ ...row, updated_at: new Date().toISOString() }).eq('id', q.id)
      : await supabase.from('quotes').insert([row]);
    setSaving(false);
    if (error) { alert('Error al guardar la cotización: ' + error.message); return; }
    onSaved();
  };

  const openPreview = () => setPreview({ ...quoteToRow(q, clients), folio: q.folio || null });
  const buildPreviewDoc = useCallback(() => renderQuotePDF(preview, settings), [preview, settings]);

  return (
    <>
    <form onSubmit={save} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">{q.id ? `Editar cotización ${q.folio || ''}` : 'Nueva cotización'}</h2>
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><X size={14} /> Cancelar</button>
      </div>

      {/* Datos generales */}
      <div className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Cliente</label>
          <div className="flex gap-2">
            <select className="input-field" value={q.client_id} onChange={(e) => set('client_id', e.target.value)}>
              <option value="">— Cliente sin registrar —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => setClientModal(true)} className="btn-secondary shrink-0" title="Registrar un cliente nuevo"><UserPlus size={15} /></button>
          </div>
          {!q.client_id && (
            <input className="input-field mt-2" placeholder="Nombre del cliente *" value={q.client_free} onChange={(e) => set('client_free', e.target.value)} />
          )}
        </div>
        <div><label className="label">Fecha</label><input type="date" required className="input-field" value={q.quote_date} onChange={(e) => set('quote_date', e.target.value)} /></div>
        <div><label className="label">Vigencia hasta</label><input type="date" className="input-field" value={q.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></div>
        <div>
          <label className="label">Moneda</label>
          <select className="input-field" value={q.currency} onChange={(e) => set('currency', e.target.value)}>
            <option value="MXN">Pesos (MXN)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        <div>
          <label className="label">Estatus</label>
          <select className="input-field" value={q.status} onChange={(e) => set('status', e.target.value)}>
            {QUOTE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Partidas */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-200 mr-auto">Partidas</h3>
          <select
            className="input-field w-auto max-w-[260px]"
            value=""
            onChange={(e) => { addFromCatalog(e.target.value); e.target.value = ''; }}
            disabled={activeCatalog.length === 0}
          >
            <option value="">{activeCatalog.length ? '+ Agregar del catálogo…' : 'Catálogo vacío'}</option>
            {['producto', 'servicio'].map((kind) => {
              const group = activeCatalog.filter((c) => c.kind === kind);
              return group.length ? (
                <optgroup key={kind} label={kind === 'producto' ? 'Productos' : 'Servicios'}>
                  {group.map((c) => <option key={c.id} value={c.id}>{c.name} — {formatMoney(c.unit_price, q.currency)}</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
          <button type="button" onClick={addFree} className="btn-secondary"><Plus size={14} /> Partida libre</button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              <tr className="bg-black/20 text-slate-400 uppercase text-[10px]">
                <th className="py-2 px-2 text-left w-8">#</th>
                <th className="py-2 px-2 text-left">Descripción</th>
                <th className="py-2 px-2 text-left w-20">Cant.</th>
                <th className="py-2 px-2 text-left w-20">Unidad</th>
                <th className="py-2 px-2 text-left w-28">Precio unit.</th>
                <th className="py-2 px-2 text-left w-20">Desc. %</th>
                <th className="py-2 px-2 text-right w-28">Importe</th>
                <th className="py-2 px-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {q.items.map((it, idx) => (
                <tr key={idx} className="align-top">
                  <td className="py-2 px-2 text-slate-500">{idx + 1}</td>
                  <td className="p-1.5">
                    <input className="input-field text-xs py-1.5" placeholder="Producto o servicio" value={it.description} onChange={(e) => setItem(idx, 'description', e.target.value)} />
                    <input className="input-field text-[11px] py-1 mt-1 text-slate-400" placeholder="Detalle (opcional)" value={it.detail} onChange={(e) => setItem(idx, 'detail', e.target.value)} />
                  </td>
                  <td className="p-1.5"><input type="number" step="any" min="0" className="input-field text-xs py-1.5" value={it.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} /></td>
                  <td className="p-1.5"><input className="input-field text-xs py-1.5" value={it.unit} onChange={(e) => setItem(idx, 'unit', e.target.value)} /></td>
                  <td className="p-1.5"><input type="number" step="any" min="0" className="input-field text-xs py-1.5" value={it.unit_price} onChange={(e) => setItem(idx, 'unit_price', e.target.value)} /></td>
                  <td className="p-1.5"><input type="number" step="any" min="0" max="100" className="input-field text-xs py-1.5" value={it.discount_pct} onChange={(e) => setItem(idx, 'discount_pct', e.target.value)} /></td>
                  <td className="py-3 px-2 text-right font-medium text-slate-200 tabular-nums">{formatMoney(calc.lines[idx]?.net, q.currency)}</td>
                  <td className="p-1.5 text-center pt-3">
                    <button type="button" onClick={() => removeItem(idx)} disabled={q.items.length === 1} title="Quitar partida" className="text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-500"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Impuestos y totales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h3 className="text-sm font-bold text-slate-200">Impuestos</h3>
          <div className="space-y-2">
            {TAX_MODES.map((m) => (
              <label key={m.value} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${q.tax_mode === m.value ? 'border-sky-500/60 bg-sky-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                <input type="radio" name="tax_mode" className="mt-0.5 accent-sky-500" checked={q.tax_mode === m.value} onChange={() => set('tax_mode', m.value)} />
                <span>
                  <span className="block text-sm font-medium text-slate-200">{m.label}</span>
                  <span className="block text-[11px] text-slate-500">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {!noTax && (
            <div className="max-w-[160px]">
              <label className="label">Tasa de IVA %</label>
              <input type="number" step="any" min="0" className="input-field" value={q.tax_rate} onChange={(e) => set('tax_rate', e.target.value)} />
            </div>
          )}

          <div className="space-y-2 pt-1">
            <p className="label mb-0">Retenciones (servicios profesionales)</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none w-36">
                <input type="checkbox" className="accent-sky-500" checked={Number(q.ret_isr_rate) > 0} onChange={(e) => set('ret_isr_rate', e.target.checked ? DEFAULT_RET_ISR : 0)} />
                Retención ISR
              </label>
              {Number(q.ret_isr_rate) > 0 && (
                <div className="flex items-center gap-1"><input type="number" step="any" min="0" className="input-field w-24 py-1" value={q.ret_isr_rate} onChange={(e) => set('ret_isr_rate', e.target.value)} /><span className="text-slate-500 text-sm">%</span></div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 text-sm select-none w-36 ${noTax ? 'text-slate-600' : 'text-slate-300 cursor-pointer'}`}>
                <input type="checkbox" className="accent-sky-500" disabled={noTax} checked={!noTax && Number(q.ret_iva_rate) > 0} onChange={(e) => set('ret_iva_rate', e.target.checked ? DEFAULT_RET_IVA : 0)} />
                Retención IVA
              </label>
              {!noTax && Number(q.ret_iva_rate) > 0 && (
                <div className="flex items-center gap-1"><input type="number" step="any" min="0" className="input-field w-24 py-1" value={q.ret_iva_rate} onChange={(e) => set('ret_iva_rate', e.target.value)} /><span className="text-slate-500 text-sm">%</span></div>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Se calculan sobre el subtotal. Valores usuales: ISR 10% e IVA 10.6667% (dos terceras partes del IVA).</p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-bold text-slate-200 mb-4">Totales</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Subtotal</dt><dd className="text-slate-200 tabular-nums">{formatMoney(calc.subtotal, q.currency)}</dd></div>
            {calc.discountTotal > 0 && <div className="flex justify-between text-xs"><dt className="text-slate-500">Descuento ya aplicado en partidas</dt><dd className="text-slate-500 tabular-nums">{formatMoney(calc.discountTotal, q.currency)}</dd></div>}
            <div className="flex justify-between">
              <dt className="text-slate-400">{noTax ? 'IVA' : `IVA (${Number(q.tax_rate) || 0}%)${q.tax_mode === 'included' ? ' incluido' : ''}`}</dt>
              <dd className="text-slate-200 tabular-nums">{noTax ? 'Sin IVA' : formatMoney(calc.tax, q.currency)}</dd>
            </div>
            {calc.retIsr > 0 && <div className="flex justify-between"><dt className="text-slate-400">Retención ISR ({Number(q.ret_isr_rate)}%)</dt><dd className="text-slate-200 tabular-nums">- {formatMoney(calc.retIsr, q.currency)}</dd></div>}
            {calc.retIva > 0 && <div className="flex justify-between"><dt className="text-slate-400">Retención IVA ({Number(q.ret_iva_rate)}%)</dt><dd className="text-slate-200 tabular-nums">- {formatMoney(calc.retIva, q.currency)}</dd></div>}
            <div className="flex justify-between items-baseline pt-3 border-t border-white/10">
              <dt className="font-bold text-slate-200">{q.currency === 'MXN' ? 'Total MXN' : 'Total'}</dt>
              <dd className="text-2xl font-extrabold text-sky-400 tabular-nums">{formatMoney(calc.total, q.currency)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Condiciones */}
      <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Condiciones de pago</label><input className="input-field" value={q.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} /></div>
        <div><label className="label">Tiempo de entrega</label><input className="input-field" value={q.delivery_time} onChange={(e) => set('delivery_time', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">Notas</label><textarea rows={3} className="input-field" value={q.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="button" onClick={openPreview} className="btn-secondary"><Eye size={15} /> Vista previa</button>
        <button type="submit" disabled={saving} className="btn-primary"><Save size={15} /> {saving ? 'Guardando...' : q.id ? 'Guardar cambios' : 'Guardar cotización'}</button>
      </div>

    </form>

    {/* Fuera del <form>: el modal de cliente es otro formulario y los botones de la vista previa no deben enviar este */}
    {preview && (
      <PdfPreviewModal title="Cotización" filename={`cotizacion-${preview.folio || 'borrador'}`} buildDoc={buildPreviewDoc} onClose={() => setPreview(null)} />
    )}
    {clientModal && (
      <ClientFormModal
        onClose={() => setClientModal(false)}
        onSaved={(client) => { setClientModal(false); onClientsChanged(); set('client_id', client.id); }}
      />
    )}
    </>
  );
}
