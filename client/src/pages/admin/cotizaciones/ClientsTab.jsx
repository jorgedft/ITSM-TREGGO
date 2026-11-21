import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, X, UserRound, Save } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { EmptyState } from '../../../components/ui/EmptyState';

const EMPTY = { name: '', contact_name: '', rfc: '', email: '', phone: '', address: '', notes: '' };

export function ClientFormModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState(client ? { ...EMPTY, ...client } : EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = Object.fromEntries(
      Object.keys(EMPTY).map((k) => [k, (form[k] || '').trim() || null]),
    );
    payload.name = form.name.trim();
    const { data, error } = client?.id
      ? await supabase.from('quote_clients').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', client.id).select().single()
      : await supabase.from('quote_clients').insert([payload]).select().single();
    setSaving(false);
    if (error) { alert('Error al guardar el cliente: ' + error.message); return; }
    onSaved(data);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass-modal rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">{client?.id ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div>
          <label className="label">Nombre o razón social *</label>
          <input required autoFocus className="input-field" value={form.name} onChange={set('name')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Contacto</label><input className="input-field" value={form.contact_name} onChange={set('contact_name')} /></div>
          <div><label className="label">RFC</label><input className="input-field uppercase" value={form.rfc} onChange={set('rfc')} /></div>
          <div><label className="label">Correo</label><input type="email" className="input-field" value={form.email} onChange={set('email')} /></div>
          <div><label className="label">Teléfono</label><input className="input-field" value={form.phone} onChange={set('phone')} /></div>
        </div>
        <div><label className="label">Dirección</label><input className="input-field" value={form.address} onChange={set('address')} /></div>
        <div><label className="label">Notas internas</label><textarea rows={2} className="input-field" value={form.notes} onChange={set('notes')} /></div>
        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary"><Save size={15} /> {saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}

export default function ClientsTab({ clients, onChanged }) {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | cliente

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => !q || `${c.name} ${c.contact_name} ${c.rfc} ${c.email}`.toLowerCase().includes(q));
  }, [clients, search]);

  const remove = async (c) => {
    if (!window.confirm(`¿Eliminar al cliente "${c.name}"? Las cotizaciones que ya le hiciste conservan sus datos.`)) return;
    const { error } = await supabase.from('quote_clients').delete().eq('id', c.id);
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    onChanged();
  };

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/10">
        <span className="font-semibold text-sm text-slate-300 mr-auto">Clientes ({filtered.length})</span>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-8 w-56" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={15} /> Nuevo cliente</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={UserRound} title="Sin clientes" description="Agrega a tus clientes para cotizarles con un par de clics." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-black/20 border-b border-white/10 text-[10px] font-semibold text-slate-400 uppercase">
                <th className="py-2.5 px-3">Cliente</th><th className="py-2.5 px-3">Contacto</th><th className="py-2.5 px-3">RFC</th>
                <th className="py-2.5 px-3">Correo / Teléfono</th><th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-100">{c.name}</td>
                  <td className="py-2.5 px-3 text-slate-400">{c.contact_name || '—'}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{c.rfc || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-400">{[c.email, c.phone].filter(Boolean).join(' · ') || '—'}</td>
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

      {modal && (
        <ClientFormModal
          client={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onChanged(); }}
        />
      )}
    </div>
  );
}
