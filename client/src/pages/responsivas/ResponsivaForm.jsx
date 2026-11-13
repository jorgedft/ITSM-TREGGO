import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { ArrowLeft, Save } from 'lucide-react';

export default function ResponsivaForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    user_id: '',
    notes: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, full_name');
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error al cargar usuarios:', err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('responsivas').insert([
        { ...formData, status: 'PENDING' }
      ]);
      if (error) throw error;
      navigate('/responsivas');
    } catch (err) {
      alert(`Error al generar carta responsiva: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/responsivas')}
          className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-100">Generar Carta Responsiva</h1>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Empleado / Usuario</label>
          <select
            required
            value={formData.user_id}
            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 rounded-lg focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Selecciona un empleado...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name || u.id}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Observaciones o Términos Adicionales</label>
          <textarea
            rows="4"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 rounded-lg focus:ring-2 focus:ring-sky-500"
            placeholder="Especifica detalles sobre la entrega del equipo o accesorios incluidos..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => navigate('/responsivas')}
            className="px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={16} /> {loading ? 'Generando...' : 'Generar Responsiva'}
          </button>
        </div>
      </form>
    </div>
  );
}