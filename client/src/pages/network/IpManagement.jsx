import { useState, useEffect } from 'react';
import { Network, Search, RefreshCw, Save, HardDriveDownload, Globe, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../../services/supabase';

export default function IpManagement() {
  const [segment, setSegment] = useState('192.168.1');
  const [ipList, setIpList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Estados para Modal y Dominios
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [domains, setDomains] = useState([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [newDomain, setNewDomain] = useState({
    domain_name: '',
    provider: '',
    dns_provider: '',
    ip_address: '',
    expiration_date: '',
    notes: ''
  });

  useEffect(() => {
    generateSegmentTemplate(segment);
  }, []);

  // Cargar dominios al abrir el modal
  useEffect(() => {
    if (isDomainModalOpen) {
      fetchDomains();
    }
  }, [isDomainModalOpen]);

  const generateSegmentTemplate = async (prefix) => {
    setLoading(true);
    const template = [];
    for (let i = 1; i <= 254; i++) {
      template.push({
        ip_address: `${prefix}.${i}`,
        device_type: 'PC',
        status: 'AVAILABLE',
        mac_address: '',
        assigned_to_text: '',
        notes: ''
      });
    }

    try {
      const { data, error } = await supabase
        .from('ip_addresses')
        .select('*')
        .like('ip_address', `${prefix}.%`);

      if (error) throw error;

      if (data && data.length > 0) {
        const savedMap = new Map(
          data.map(item => [
            item.ip_address,
            {
              ...item,
              assigned_to_text: item.assigned_user_text || item.assigned_to_text || ''
            }
          ])
        );

        const merged = template.map(item => savedMap.get(item.ip_address) || item);
        setIpList(merged);
      } else {
        setIpList(template);
      }
    } catch (err) {
      console.error('Error al cargar datos de IP:', err);
      setIpList(template);
    } finally {
      setLoading(false);
    }
  };

  // --- Funciones CRUD Dominios ---
  const fetchDomains = async () => {
    setLoadingDomains(true);
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (err) {
      alert(`Error al cargar dominios: ${err.message}`);
    } finally {
      setLoadingDomains(false);
    }
  };

  const handleAddDomain = async (e) => {
  e.preventDefault();
  if (!newDomain.domain_name.trim()) return;

  // Sanitizar el objeto: convierte los campos vacíos "" a null
  const payload = {
    domain_name: newDomain.domain_name.trim(),
    provider: newDomain.provider.trim() || null,
    dns_provider: newDomain.dns_provider.trim() || null,
    ip_address: newDomain.ip_address.trim() || null,
    expiration_date: newDomain.expiration_date || null, // Importante para evitar error de sintaxis en fechas
    notes: newDomain.notes.trim() || null
  };

  try {
    const { data, error } = await supabase
      .from('domains')
      .insert([payload])
      .select();

    if (error) throw error;

    setDomains([data[0], ...domains]);
    
    // Limpiar el formulario
    setNewDomain({
      domain_name: '',
      provider: '',
      dns_provider: '',
      ip_address: '',
      expiration_date: '',
      notes: ''
    });
  } catch (err) {
    alert(`Error al guardar dominio: ${err.message}`);
  }
};

  const handleDeleteDomain = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este dominio?')) return;

    try {
      const { error } = await supabase
        .from('domains')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setDomains(domains.filter(d => d.id !== id));
    } catch (err) {
      alert(`Error al eliminar dominio: ${err.message}`);
    }
  };

  const handleSegmentChange = (e) => {
    e.preventDefault();
    generateSegmentTemplate(segment);
  };

  const updateIpRow = (ipAddress, field, value) => {
    setIpList(prev => prev.map(row => {
      if (row.ip_address === ipAddress) {
        const updated = { ...row, [field]: value };
        if (field === 'assigned_to_text' || field === 'mac_address') {
          const hasUser = updated.assigned_to_text && updated.assigned_to_text.trim();
          const hasMac = updated.mac_address && updated.mac_address.trim();
          updated.status = (hasUser || hasMac) ? 'ASSIGNED' : 'AVAILABLE';
        }
        return updated;
      }
      return row;
    }));
  };

  const saveSingleRow = async (row) => {
    try {
      const { error } = await supabase
        .from('ip_addresses')
        .upsert([{
          ip_address: row.ip_address,
          device_type: row.device_type,
          status: row.status,
          mac_address: row.mac_address,
          assigned_user_text: row.assigned_to_text,
          notes: row.notes
        }], { onConflict: 'ip_address' });

      if (error) throw error;
      alert(`Guardado con éxito: ${row.ip_address}`);
    } catch (err) {
      alert(`Error al guardar en Supabase: ${err.message}`);
    }
  };

  const saveAllRows = async () => {
    setSavingGlobal(true);
    try {
      const recordsToSave = ipList.map(row => ({
        ip_address: row.ip_address,
        device_type: row.device_type,
        status: row.status,
        mac_address: row.mac_address,
        assigned_user_text: row.assigned_to_text,
        notes: row.notes
      }));

      const { error } = await supabase
        .from('ip_addresses')
        .upsert(recordsToSave, { onConflict: 'ip_address' });

      if (error) throw error;
      alert(`Segmento ${segment}.X guardado globalmente con éxito (${recordsToSave.length} registros).`);
    } catch (err) {
      alert(`Error al guardar el segmento en Supabase: ${err.message}`);
    } finally {
      setSavingGlobal(false);
    }
  };

  const filteredIps = ipList.filter(item => {
    const matchesFilter = filter === 'ALL' || item.status === filter;
    const matchesSearch = item.ip_address.includes(searchTerm) ||
      (item.device_type && item.device_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.assigned_to_text && item.assigned_to_text.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.mac_address && item.mac_address.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado con Botones Principales */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="text-blue-600" /> Mapa de Red Local - Asignación de IP's
          </h1>
          <p className="text-sm text-gray-500">Plantilla dinámica de direccionamiento por segmento (1.1 al 1.254).</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDomainModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Globe size={18} />
            Gestionar Dominios Web
          </button>

          <button
            onClick={saveAllRows}
            disabled={savingGlobal || loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <HardDriveDownload size={18} />
            {savingGlobal ? 'Guardando Segmento...' : 'Guardar Todo el Segmento'}
          </button>
        </div>
      </div>

      {/* Selector de Segmento y Filtros */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSegmentChange} className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Red / Segmento:</label>
          <input
            type="text"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            placeholder="Ej: 192.168.1"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-mono w-36 focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <RefreshCw size={14} /> Cargar Segmento
          </button>
        </form>

        <div className="flex gap-2">
          {['ALL', 'AVAILABLE', 'ASSIGNED', 'RESERVED'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'ALL' ? 'Todas (254)' : s === 'AVAILABLE' ? 'Disponibles' : s === 'ASSIGNED' ? 'En Uso' : 'Reservadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Buscador Rápido */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Filtrar por IP, host, tipo de dispositivo, MAC o usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        />
      </div>

      {/* Tabla Interactiva de IPs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Generando plantilla del segmento {segment}.X...</div>
        ) : (
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase z-10">
                <tr>
                  <th className="py-3 px-4">Dirección IP</th>
                  <th className="py-3 px-4">Tipo Dispositivo</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Dirección MAC</th>
                  <th className="py-3 px-4">Usuario / Equipo Asignado</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredIps.map((row) => (
                  <tr key={row.ip_address} className="hover:bg-blue-50/50">
                    <td className="py-2 px-4 font-mono font-bold text-gray-900">{row.ip_address}</td>
                    
                    <td className="py-2 px-4">
                      <select
                        value={row.device_type}
                        onChange={(e) => updateIpRow(row.ip_address, 'device_type', e.target.value)}
                        className="px-2 py-1 border rounded text-xs bg-white"
                      >
                        <option value="PC">PC / Laptop</option>
                        <option value="SWITCH">Switch</option>
                        <option value="ROUTER">Router / Firewall</option>
                        <option value="ACCESS POINT">Access Point</option>
                        <option value="SERVER">Servidor</option>
                        <option value="IMPRESORA">Impresora</option>
                        <option value="CAMARA">Cámara IP</option>
                        <option value="LIBRE">Libre / Reserva</option>
                      </select>
                    </td>

                    <td className="py-2 px-4">
                      <select
                        value={row.status}
                        onChange={(e) => updateIpRow(row.ip_address, 'status', e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-bold border ${
                          row.status === 'AVAILABLE' ? 'bg-green-50 text-green-700 border-green-200' :
                          row.status === 'ASSIGNED' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        <option value="AVAILABLE">Disponible</option>
                        <option value="ASSIGNED">En Uso</option>
                        <option value="RESERVED">Reservada</option>
                      </select>
                    </td>

                    <td className="py-2 px-4">
                      <input
                        type="text"
                        placeholder="00:1A:2B:3C:4D:5E"
                        value={row.mac_address || ''}
                        onChange={(e) => updateIpRow(row.ip_address, 'mac_address', e.target.value)}
                        className="px-2 py-1 border rounded text-xs font-mono w-32 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    <td className="py-2 px-4">
                      <input
                        type="text"
                        placeholder="Escribe Usuario o Nombre de PC..."
                        value={row.assigned_to_text || ''}
                        onChange={(e) => updateIpRow(row.ip_address, 'assigned_to_text', e.target.value)}
                        className="px-2 py-1 border rounded text-xs w-full max-w-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    <td className="py-2 px-4 text-center">
                      <button
                        onClick={() => saveSingleRow(row)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Guardar este registro"
                      >
                        <Save size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Gestión de Dominios */}
      {isDomainModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="px-6 py-4 bg-indigo-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Globe size={20} /> Gestión de Dominios y Hosting
              </h2>
              <button 
                onClick={() => setIsDomainModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Formulario de Registro */}
              <form onSubmit={handleAddDomain} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Plus size={16} className="text-indigo-600" /> Registrar Nuevo Dominio
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 font-medium">Dominio / URL *</label>
                    <input
                      type="text"
                      placeholder="ejemplo.com"
                      required
                      value={newDomain.domain_name}
                      onChange={(e) => setNewDomain({ ...newDomain, domain_name: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 border rounded-md text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 font-medium">Proveedor Host</label>
                    <input
                      type="text"
                      placeholder="AWS, Hostinger, Vercel..."
                      value={newDomain.provider}
                      onChange={(e) => setNewDomain({ ...newDomain, provider: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 border rounded-md text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 font-medium">DNS Provider</label>
                    <input
                      type="text"
                      placeholder="Cloudflare, Route53..."
                      value={newDomain.dns_provider}
                      onChange={(e) => setNewDomain({ ...newDomain, dns_provider: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 border rounded-md text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 font-medium">IP del Servidor / Apuntamineto</label>
                    <input
                      type="text"
                      placeholder="192.0.2.1"
                      value={newDomain.ip_address}
                      onChange={(e) => setNewDomain({ ...newDomain, ip_address: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 border rounded-md text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 font-medium">Fecha Vencimiento</label>
                    <input
                      type="date"
                      value={newDomain.expiration_date}
                      onChange={(e) => setNewDomain({ ...newDomain, expiration_date: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 border rounded-md text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 font-medium">Notas</label>
                    <input
                      type="text"
                      placeholder="Credenciales, SSL, etc."
                      value={newDomain.notes}
                      onChange={(e) => setNewDomain({ ...newDomain, notes: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 border rounded-md text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus size={14} /> Guardar Dominio
                  </button>
                </div>
              </form>

              {/* Tabla de Dominios */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {loadingDomains ? (
                  <div className="p-6 text-center text-xs text-gray-500">Cargando dominios...</div>
                ) : domains.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500">No hay dominios registrados actualmente.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-gray-100 border-b border-gray-200 font-semibold text-gray-600">
                        <tr>
                          <th className="py-2.5 px-3">Dominio</th>
                          <th className="py-2.5 px-3">Proveedor Host</th>
                          <th className="py-2.5 px-3">DNS</th>
                          <th className="py-2.5 px-3">IP Apuntada</th>
                          <th className="py-2.5 px-3">Vencimiento</th>
                          <th className="py-2.5 px-3">Notas</th>
                          <th className="py-2.5 px-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {domains.map((d) => (
                          <tr key={d.id} className="hover:bg-gray-50">
                            <td className="py-2 px-3 font-semibold text-indigo-600">{d.domain_name}</td>
                            <td className="py-2 px-3">{d.provider || '-'}</td>
                            <td className="py-2 px-3">{d.dns_provider || '-'}</td>
                            <td className="py-2 px-3 font-mono">{d.ip_address || '-'}</td>
                            <td className="py-2 px-3">{d.expiration_date || '-'}</td>
                            <td className="py-2 px-3 text-gray-500 max-w-xs truncate">{d.notes || '-'}</td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => handleDeleteDomain(d.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                title="Eliminar Dominio"
                              >
                                <Trash2 size={14} />
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

            {/* Footer Modal */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setIsDomainModalOpen(false)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-xs font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}