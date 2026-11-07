import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { ArrowLeft, Save } from 'lucide-react';

export default function LicenseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    software_name: '',
    provider: '',
    license_key: '',
    seats_purchased: 1,
    expiration_date: '',
    notes: '',
  });

  useEffect(() => {
    if (isEdit) fetchLicenseDetail();
  }, [id]);

  const fetchLicenseDetail = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('licenses').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) {
        setFormData({
          software_name: data.software_name || '',
          provider: data.provider || '',
          license_key: data.license_key || '',
          seats_purchased: data.seats_purchased || 1,
          expiration_date: data.expiration_date ? data.expiration_date.split('T')[0] : '',
          notes: data.notes || '',
        });
      }
    } catch (err) {
      console.error('Error al cargar detalle:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      expiration_date: formData.expiration_date === '' ? null : formData.expiration_date,
    };

    try {
      let error;
      if (isEdit) {
        ({ error } = await supabase.from('licenses').update(payload).eq('id', id));
      } else {
        ({ error } = await supabase.from('licenses').insert([payload]));
      }

      if (error) throw error;
      navigate('/licenses');
    } catch (err) {
      alert(`Error al guardar licencia: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/licenses')}
          className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-100">
          {isEdit ? 'Editar Licencia' : 'Nueva Licencia de Software'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Nombre del Software / Servicio</label>
          <input
            type="text"
            required
            value={formData.software_name}
            onChange={(e) => setFormData({ ...formData, software_name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-900 focus:ring-2 focus:ring-sky-500 text-slate-100 placeholder-slate-500"
            placeholder="Microsoft 365, Adobe Creative Cloud, Antivirus..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Proveedor / Marca</label>
          <input
            type="text"
            value={formData.provider}
            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
            className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-900 focus:ring-2 focus:ring-sky-500 text-slate-100 placeholder-slate-500"
            placeholder="Microsoft, Adobe, Fortinet..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Clave de Licencia / Product Key</label>
          <input
            type="text"
            value={formData.license_key}
            onChange={(e) => setFormData({ ...formData, license_key: e.target.value })}
            className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-900 focus:ring-2 focus:ring-sky-500 text-slate-100 placeholder-slate-500 font-mono"
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Asientos / Usuarios Comprados</label>
            <input
              type="number"
              min="1"
              value={formData.seats_purchased}
              onChange={(e) => setFormData({ ...formData, seats_purchased: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-900 focus:ring-2 focus:ring-sky-500 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Fecha de Expiración</label>
            <input
              type="date"
              value={formData.expiration_date}
              onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-900 focus:ring-2 focus:ring-sky-500 text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Notas / Observaciones</label>
          <textarea
            rows="3"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-900 focus:ring-2 focus:ring-sky-500 text-slate-100 placeholder-slate-500"
            placeholder="Comentarios adicionales sobre la suscripción..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={() => navigate('/licenses')}
            className="px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={16} /> {loading ? 'Guardando...' : 'Guardar Licencia'}
          </button>
        </div>
      </form>
    </div>
  );
}