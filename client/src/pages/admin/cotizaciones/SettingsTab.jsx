import { useState } from 'react';
import { Save, ImagePlus, Trash2 } from 'lucide-react';
import { supabase } from '../../../services/supabase';

const MAX_LOGO_FILE_MB = 3;
const MAX_LOGO_WIDTH = 520;

// Reduce el logo en el navegador y lo devuelve como data URL + proporción ancho/alto.
function prepareLogo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Los SVG no tienen resolución propia (suelen medir ~150 px): se rasterizan al ancho máximo para que no se vean borrosos.
      const isSvg = file.type === 'image/svg+xml';
      const scale = isSvg ? MAX_LOGO_WIDTH / img.width : Math.min(1, MAX_LOGO_WIDTH / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ logo: canvas.toDataURL('image/png'), ratio: canvas.width / canvas.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

const FIELDS = [
  ['business_name', 'Nombre comercial'],
  ['legal_name', 'Razón social / nombre completo'],
  ['rfc', 'RFC'],
  ['email', 'Correo'],
  ['phone', 'Teléfono'],
  ['website', 'Sitio web'],
];

export default function SettingsTab({ settings, onSaved }) {
  const [form, setForm] = useState(() => ({
    business_name: '', legal_name: '', rfc: '', email: '', phone: '', website: '', address: '', logo: '', logo_ratio: null,
    bank_info: '', default_validity_days: 15, default_payment_terms: '', default_delivery: '', default_notes: '',
    ...Object.fromEntries(Object.entries(settings || {}).map(([k, v]) => [k, v ?? (k === 'default_validity_days' ? 15 : '')])),
  }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Selecciona un archivo de imagen (PNG, JPG o WebP).'); return; }
    if (file.size > MAX_LOGO_FILE_MB * 1024 * 1024) { alert(`El logo supera ${MAX_LOGO_FILE_MB} MB.`); return; }
    try {
      const { logo, ratio } = await prepareLogo(file);
      setForm((f) => ({ ...f, logo, logo_ratio: ratio }));
    } catch (err) { alert(err.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const text = (k) => (form[k] || '').toString().trim() || null;
    const payload = {
      id: 1,
      business_name: text('business_name'), legal_name: text('legal_name'), rfc: text('rfc'), email: text('email'),
      phone: text('phone'), website: text('website'), address: text('address'), bank_info: text('bank_info'),
      logo: form.logo || null, logo_ratio: form.logo ? form.logo_ratio : null,
      default_validity_days: Math.max(0, Number(form.default_validity_days) || 15),
      default_payment_terms: text('default_payment_terms'), default_delivery: text('default_delivery'), default_notes: text('default_notes'),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('quote_settings').upsert(payload, { onConflict: 'id' }).select().single();
    setSaving(false);
    if (error) { alert('Error al guardar: ' + error.message); return; }
    onSaved(data);
    alert('Datos de tu negocio guardados.');
  };

  return (
    <form onSubmit={submit} className="card space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-100">Datos del emisor</h2>
        <p className="text-xs text-slate-400">Aparecen en el encabezado y el pie de cada cotización en PDF.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="h-20 w-52 rounded-lg border border-dashed border-white/20 bg-white flex items-center justify-center overflow-hidden">
          {form.logo ? <img src={form.logo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-400">Sin logo</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer">
            <ImagePlus size={15} /> {form.logo ? 'Cambiar logo' : 'Subir logo'}
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
          </label>
          {form.logo && (
            <button type="button" onClick={() => setForm((f) => ({ ...f, logo: '', logo_ratio: null }))} className="btn-secondary">
              <Trash2 size={15} /> Quitar
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 w-full">Se recomienda un PNG con fondo transparente o blanco; se reduce automáticamente.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map(([k, label]) => (
          <div key={k}><label className="label">{label}</label><input className="input-field" value={form[k]} onChange={set(k)} /></div>
        ))}
        <div className="sm:col-span-2"><label className="label">Dirección</label><input className="input-field" value={form.address} onChange={set('address')} /></div>
        <div className="sm:col-span-2">
          <label className="label">Datos para pago (banco, cuenta, CLABE)</label>
          <textarea rows={2} className="input-field" value={form.bank_info} onChange={set('bank_info')} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-200 mb-3">Valores por defecto en cotizaciones nuevas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="label">Vigencia (días)</label><input type="number" min="0" className="input-field" value={form.default_validity_days} onChange={set('default_validity_days')} /></div>
          <div><label className="label">Condiciones de pago</label><input className="input-field" value={form.default_payment_terms} onChange={set('default_payment_terms')} placeholder="50% anticipo, 50% contra entrega" /></div>
          <div><label className="label">Tiempo de entrega</label><input className="input-field" value={form.default_delivery} onChange={set('default_delivery')} /></div>
          <div className="sm:col-span-3"><label className="label">Notas</label><textarea rows={2} className="input-field" value={form.default_notes} onChange={set('default_notes')} /></div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-white/10">
        <button type="submit" disabled={saving} className="btn-primary"><Save size={15} /> {saving ? 'Guardando...' : 'Guardar datos'}</button>
      </div>
    </form>
  );
}
