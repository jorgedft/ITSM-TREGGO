import { useState, useEffect, useCallback } from "react";
import { 
  Key, Plus, Search, Eye, EyeOff, Copy, Check, 
  ExternalLink, Trash2, Edit, ShieldCheck, RefreshCw 
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useRole } from "../../hooks/useRole";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";

const CATEGORIES = ["Todas", "Servidores", "Cuentas Web", "Redes / Routers", "Software / Licencias", "Bases de Datos", "General"];

export default function CredentialList() {
  const { canManageTI } = useRole();
  const [credentials, setCredentials] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  
  // Estado para visibilidad de contraseñas individuales
  const [showPassword, setShowPassword] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Estados del Modal (Crear / Editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "Cuentas Web",
    username: "",
    password_hash: "",
    url_link: "",
    assigned_to: "",
    notes: ""
  });

  // Cargar credenciales y empleados
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: credsData }, { data: empData }] = await Promise.all([
        supabase
          .from("credentials")
          .select("*, employee:employees!credentials_assigned_to_fkey(full_name)")
          .order("title", { ascending: true }),
        supabase
          .from("employees")
          .select("id, full_name")
          .order("full_name", { ascending: true })
      ]);

      setCredentials(credsData || []);
      setEmployees(empData || []);
    } catch (err) {
      console.error("Error al cargar credenciales:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Copiar al portapapeles
  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Alternar mostrar/ocultar contraseña
  const toggleShowPassword = (id) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Abrir Modal para crear/editar
  const handleOpenModal = (cred = null) => {
    if (cred) {
      setEditingId(cred.id);
      setFormData({
        title: cred.title || "",
        category: cred.category || "General",
        username: cred.username || "",
        password_hash: cred.password_hash || "",
        url_link: cred.url_link || "",
        assigned_to: cred.assigned_to || "",
        notes: cred.notes || ""
      });
    } else {
      setEditingId(null);
      setFormData({
        title: "",
        category: "Cuentas Web",
        username: "",
        password_hash: "",
        url_link: "",
        assigned_to: "",
        notes: ""
      });
    }
    setIsModalOpen(true);
  };

  // Guardar credencial
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        assigned_to: formData.assigned_to || null
      };

      const { error } = editingId
        ? await supabase.from("credentials").update(payload).eq("id", editingId)
        : await supabase.from("credentials").insert([payload]);

      if (error) throw error;
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert(`Error al guardar: ${err.message}`);
    }
  };

  // Eliminar credencial
  const handleDelete = async (id, title) => {
    if (!window.confirm(`¿Estás seguro de eliminar el acceso para "${title}"?`)) return;
    try {
      const { error } = await supabase.from("credentials").delete().eq("id", id);
      if (error) throw error;
      loadData();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  // Generador de Contraseñas seguras
  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
    let pass = "";
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password_hash: pass }));
  };

  // Filtrado de credenciales
  const filteredCredentials = credentials.filter((c) => {
    const matchesSearch = 
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.username && c.username.toLowerCase().includes(search.toLowerCase())) ||
      (c.notes && c.notes.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = selectedCategory === "Todas" || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Key size={24} className="text-brand-500" />
            Gestor de Accesos y Bóveda de Claves
          </h1>
          <p className="text-xs text-gray-500">Administración centralizada de credenciales y accesos de TI</p>
        </div>
        {canManageTI && (
          <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nueva Credencial
          </button>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="card py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, usuario u observación..."
            className="input-field pl-9 text-sm"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button onClick={loadData} className="btn-secondary text-sm py-2">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Listado de Credenciales */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : filteredCredentials.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Sin credenciales registradas"
            description="Agrega cuentas de acceso, servidores o licencias a la bóveda."
            action={
              <button onClick={() => handleOpenModal()} className="btn-primary text-sm">
                + Nueva credencial
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Servicio / Recurso</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Categoría</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Usuario / ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Contraseña</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Responsable</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCredentials.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                        {item.title}
                        {item.url_link && (
                          <a
                            href={item.url_link.startsWith("http") ? item.url_link : `https://${item.url_link}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-500 hover:text-brand-700"
                            title="Ir al enlace"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                      {item.notes && <div className="text-xs text-gray-400 truncate max-w-xs">{item.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">
                      <div className="flex items-center gap-2">
                        <span>{item.username || "—"}</span>
                        {item.username && (
                          <button
                            onClick={() => handleCopy(item.username, `user_${item.id}`)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copiar usuario"
                          >
                            {copiedId === `user_${item.id}` ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-800 min-w-[100px] inline-block">
                          {showPassword[item.id] ? item.password_hash : "••••••••••••"}
                        </span>
                        <button
                          onClick={() => toggleShowPassword(item.id)}
                          className="text-gray-400 hover:text-gray-600"
                          title={showPassword[item.id] ? "Ocultar" : "Mostrar"}
                        >
                          {showPassword[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => handleCopy(item.password_hash, `pass_${item.id}`)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Copiar contraseña"
                        >
                          {copiedId === `pass_${item.id}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {item.employee?.full_name || "Sin asignar"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManageTI ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="text-gray-400 hover:text-blue-600"
                            title="Editar"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            className="text-gray-400 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para Crear / Editar Credencial */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Key size={18} className="text-brand-500" />
                {editingId ? "Editar Credencial" : "Nueva Credencial"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del Servicio / Recurso *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Servidor de Dominio / Panel AWS"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field text-sm w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input-field text-sm w-full"
                  >
                    {CATEGORIES.filter((c) => c !== "Todas").map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Usuario / ID / Email</label>
                  <input
                    type="text"
                    placeholder="admin / user@empresa.com"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="input-field text-sm w-full"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Contraseña / Token *</label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-xs text-brand-600 font-medium hover:underline"
                  >
                    Generar segura
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Escribe o genera una clave"
                  value={formData.password_hash}
                  onChange={(e) => setFormData({ ...formData, password_hash: e.target.value })}
                  className="input-field text-sm font-mono w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">URL / Enlace / Dirección IP</label>
                <input
                  type="text"
                  placeholder="https://panel.empresa.com o 192.168.1.1"
                  value={formData.url_link}
                  onChange={(e) => setFormData({ ...formData, url_link: e.target.value })}
                  className="input-field text-sm w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable / Asignado</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="input-field text-sm w-full"
                >
                  <option value="">Sin asignar / Uso general</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notas u Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Puerto, PIN de recuperación, reglas de acceso..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field text-sm w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-sm">
                  Guardar Bóveda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}