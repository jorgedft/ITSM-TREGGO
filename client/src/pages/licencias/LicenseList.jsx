import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Plus, Pencil, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useRole } from '../../hooks/useRole';
import { EditLicenseModal } from '../../components/licencias/EditLicenseModal';

export default function LicenseList() {
  const { canManageTI } = useRole();
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para el Modal de Edición
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (err) {
      console.error('Error al cargar licencias:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (license) => {
    setSelectedLicense(license);
    setIsModalOpen(true);
  };

  // Función para calcular los días restantes y retornar el badge de estado
  const getExpirationBadge = (expirationDate) => {
    if (!expirationDate) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
          Perpetua
        </span>
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ajuste de fecha de vencimiento sin desfase de zona horaria (UTC)
    const [year, month, day] = expirationDate.split('T')[0].split('-');
    const expDate = new Date(year, month - 1, day);

    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <div className="flex flex-col gap-1 items-start">
          <span className="text-slate-300">{expDate.toLocaleDateString()}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-950 text-red-400 border border-red-800">
            <XCircle size={12} /> Vencida ({Math.abs(diffDays)} días)
          </span>
        </div>
      );
    }

    if (diffDays <= 30) {
      return (
        <div className="flex flex-col gap-1 items-start">
          <span className="text-slate-300 font-medium">{expDate.toLocaleDateString()}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800 animate-pulse">
            <AlertTriangle size={12} /> Próxima a vencer ({diffDays} {diffDays === 1 ? 'día' : 'días'})
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1 items-start">
        <span className="text-slate-300">{expDate.toLocaleDateString()}</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
          <CheckCircle size={12} /> Vigente ({diffDays} días)
        </span>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gestión de Licencias de Software</h1>
          <p className="text-sm text-slate-400">Control de suscripciones, llaves de activación y vencimientos.</p>
        </div>
        {canManageTI && (
          <button
            onClick={() => navigate('/licenses/new')}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nueva Licencia
          </button>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando catálogo de licencias...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-3 px-4">Software</th>
                  <th className="py-3 px-4">Proveedor / Tipo</th>
                  <th className="py-3 px-4">Clave / Key</th>
                  <th className="py-3 px-4">Vencimiento / Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-sm">
                {licenses.map((lic) => (
                  <tr key={lic.id} className="hover:bg-slate-700/40">
                    <td className="py-3 px-4 font-semibold text-slate-100">{lic.software_name}</td>
                    <td className="py-3 px-4 text-slate-400">{lic.provider || 'N/A'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-sky-400">{lic.license_key || 'N/A'}</td>
                    <td className="py-3 px-4">
                      {getExpirationBadge(lic.expiration_date)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canManageTI ? (
                        <button
                          onClick={() => handleEditClick(lic)}
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 text-xs font-semibold hover:bg-sky-950 px-2 py-1 rounded transition-colors"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edición */}
      <EditLicenseModal
        license={selectedLicense}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchLicenses}
      />
    </div>
  );
}