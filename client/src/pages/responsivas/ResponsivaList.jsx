import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Plus, FileText } from 'lucide-react';
import { useRole } from '../../hooks/useRole';

export default function ResponsivaList() {
  const { canManageTI } = useRole();
  const navigate = useNavigate();
  const [responsivas, setResponsivas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResponsivas();
  }, []);

  const fetchResponsivas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('responsivas')
        .select('*, profiles:user_id(full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResponsivas(data || []);
    } catch (err) {
      console.error('Error al cargar responsivas:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cartas Responsivas</h1>
          <p className="text-sm text-gray-500">Gestión de resguardos y asignación formal de activos al personal.</p>
        </div>
        {canManageTI && (
          <button
            onClick={() => navigate('/responsivas/new')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nueva Responsiva
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando responsivas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Empleado</th>
                  <th className="py-3 px-4">Fecha Emisión</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {responsivas.map((resp) => (
                  <tr key={resp.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-blue-600">
                      RES-{resp.id.toString().slice(0, 6)}
                    </td>
                    <td className="py-3 px-4 text-gray-800">
                      {resp.profiles?.full_name || 'Sin Asignar'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(resp.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        resp.status === 'SIGNED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {resp.status === 'SIGNED' ? 'Firmada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate(`/responsivas/${resp.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                      >
                        Ver Documento
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}