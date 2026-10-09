import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { ArrowLeft, Edit, Laptop, User, ShieldAlert } from 'lucide-react';
import { useRole } from '../../hooks/useRole';

export default function AssetDetail() {
  const { canManageTI } = useRole();
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAsset();
  }, [id]);

  const fetchAsset = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assets')
        .select('*, profiles:assigned_to(full_name, email)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAsset(data);
    } catch (err) {
      console.error('Error al cargar el detalle:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando datos del equipo...</div>;
  }

  if (!asset) {
    return <div className="p-8 text-center text-red-500">Equipo no encontrado.</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/assets')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={18} /> Volver a Inventario
        </button>
        {canManageTI && (
          <button
            onClick={() => navigate(`/assets/${asset.id}/edit`)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Edit size={16} /> Editar Equipo
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Laptop size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{asset.brand} {asset.model}</h1>
              <p className="text-sm font-mono text-gray-500">Código: {asset.asset_code}</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
            {asset.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Especificaciones</h3>
            <p className="text-sm"><strong className="text-gray-700">Categoría:</strong> {asset.category}</p>
            <p className="text-sm"><strong className="text-gray-700">Nº de Serie:</strong> {asset.serial_number}</p>
            <p className="text-sm"><strong className="text-gray-700">Fecha de Registro:</strong> {new Date(asset.created_at).toLocaleDateString()}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Asignación</h3>
            <div className="flex items-center gap-2 text-sm text-gray-800">
              <User size={16} className="text-gray-400" />
              {asset.profiles?.full_name ? (
                <span>{asset.profiles.full_name} ({asset.profiles.email})</span>
              ) : (
                <span className="text-gray-400 italic">Equipo no asignado</span>
              )}
            </div>
          </div>
        </div>

        {asset.notes && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Notas / Observaciones</h3>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">{asset.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}