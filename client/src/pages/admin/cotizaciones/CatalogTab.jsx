import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, X, Package, Save } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatMoney } from './quoteMath';

const EMPTY = { kind: 'producto', sku: '', name: '', description: '', unit: 'PZA', unit_price: '', active: true };
const KIND_TONE = {
  producto: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
  servicio: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
};

function CatalogModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...EMPTY, ...item, unit_price: item.unit_price ?? '' } : EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      kind: form.kind,
      sku: form.sku.trim() || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      unit: form.unit.trim() || (form.kind === 'servicio' ? 'SERV' : 'PZA'),
      unit_price: Number(form.unit_price) || 0,
      active: form.active,
    };
    const { error } = item?.id
      ? await supabase.from('quote_catalog').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', item.id)
      : await supabase.from('quote_catalog').insert([payload]);
    setSaving(false);
    if (error) { alert('Error al guardar: ' + error.message); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass-modal rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">{item?.id ? 'Editar' : 'Nuevo'} producto o servicio</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo</label>
            <select className="input-field" value={form.kind} onChange={set('kind')}>
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
            </select>
          </div>
          <div><label className="label">Clave / SKU</label><input className="input-field" value={form.sku} onChange={set('sku')} /></div>
        </div>
        <div><label className="label">Nombre *</label><input required autoFocus className="input-field" value={form.name} onChange={set('name')} /></div>
        <div><label className="label">Descripción (sale debajo del nombre en la cotización)</label><textarea rows={2} className="input-field" value={form.description} onChange={set('description')} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Unidad</label><input className="input-field" value={form.unit} onChange={set('unit')} placeholder="PZA, HR, SERV…" /></div>
          <div><label className="label">Precio unitario (sin IVA)</label><input type="number" step="any" min="0" className="input-field" value={form.unit_price} onChange={set('unit_price')} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
          <input type="checkbox" className="accent-sky-500" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
          Activo (aparece al armar cotizaciones)
        </label>
        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary"><Save size={15} /> {saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}

export default function CatalogTab({ catalog, onChanged }) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [modal, setModal] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((c) => (!kind || c.kind === kind) && (!q || `${c.name} ${c.sku} ${c.description}`.toLowerCase().includes(q)));
  }, [catalog, search, kind]);

  const remove = async (c) => {
    if (!window.confirm(`¿Eliminar "${c.name}" del catálogo? Las cotizaciones ya hechas no cambian.`)) return;
    const { error } = await supabase.from('quote_catalog').delete().eq('id', c.id);
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    onChanged();
  };

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/10">
        <span className="font-semibold text-sm text-slate-300 mr-auto">Catálogo ({filtered.length})</span>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-8 w-52" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Productos y servicios</option>
          <option value="producto">Solo productos</option>
          <option value="servicio">Solo servicios</option>
        </select>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={15} /> Nuevo</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="Catálogo vacío" description="Registra tus productos y servicios con su precio para insertarlos en las cotizaciones." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-black/20 border-b border-white/10 text-[10px] font-semibold text-slate-400 uppercase">
                <th className="py-2.5 px-3">Tipo</th><th className="py-2.5 px-3">SKU</th><th className="py-2.5 px-3">Nombre</th>
                <th className="py-2.5 px-3">Unidad</th><th className="py-2.5 px-3 text-right">Precio</th>
                <th className="py-2.5 px-3">Estado</th><th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((c) => (
                <tr key={c.id} className={`hover:bg-white/5 transition-colors ${c.active ? '' : 'opacity-50'}`}>
                  <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${KIND_TONE[c.kind]}`}>{c.kind}</span></td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{c.sku || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-100">
                    <div className="font-medium">{c.name}</div>
                    {c.description && <div className="text-[11px] text-slate-500 truncate max-w-xs">{c.description}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{c.unit}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-200">{formatMoney(c.unit_price)}</td>
                  <td className="py-2.5 px-3 text-slate-400">{c.active ? 'Activo' : 'Inactivo'}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setModal(c)} title="Editar" className="text-slate-500 hover:text-sky-400"><Pencil size={14} /></button>
                      <button onClick={() => remove(c)} title="Eliminar" className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <CatalogModal item={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); onChanged(); }} />}
    </div>
  );
}
