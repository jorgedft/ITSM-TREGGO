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
    return <div className="p-8 text-center text-slate-500">Cargando datos del equipo...</div>;
  }

  if (!asset) {
    return <div className="p-8 text-center text-red-400">Equipo no encontrado.</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/assets')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-100"
        >
          <ArrowLeft size={18} /> Volver a Inventario
        </button>
        {canManageTI && (
          <button
            onClick={() => navigate(`/assets/${asset.id}/edit`)}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Edit size={16} /> Editar Equipo
          </button>
        )}
      </div>

      <div className="glass-panel rounded-xl overflow-hidden p-6 space-y-6">
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-950 text-sky-400 rounded-lg">
              <Laptop size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{asset.brand} {asset.model}</h1>
              <p className="text-sm font-mono text-slate-400">Código: {asset.asset_code}</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-xs font-semibold">
            {asset.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase">Especificaciones</h3>
            <p className="text-sm text-slate-300"><strong className="text-slate-200">Categoría:</strong> {asset.category}</p>
            <p className="text-sm text-slate-300"><strong className="text-slate-200">Nº de Serie:</strong> {asset.serial_number}</p>
            <p className="text-sm text-slate-300"><strong className="text-slate-200">Fecha de Registro:</strong> {new Date(asset.created_at).toLocaleDateString()}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase">Asignación</h3>
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <User size={16} className="text-slate-500" />
              {asset.profiles?.full_name ? (
                <span>{asset.profiles.full_name} ({asset.profiles.email})</span>
              ) : (
                <span className="text-slate-500 italic">Equipo no asignado</span>
              )}
            </div>
          </div>
        </div>

        {asset.notes && (
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-sm font-semibold text-slate-400 uppercase mb-1">Notas / Observaciones</h3>
            <p className="text-sm text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-700">{asset.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
