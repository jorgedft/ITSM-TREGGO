import { useState, useEffect, useCallback, useRef } from "react";
import {
  Key, Plus, Search, Eye, EyeOff, Copy, Check,
  ExternalLink, Trash2, Edit, ShieldCheck, RefreshCw, DownloadCloud, UploadCloud
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useRole } from "../../hooks/useRole";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";

const CATEGORIES = ["Todas", "Servidores", "Cuentas Web", "Redes / Routers", "Software / Licencias", "Bases de Datos", "General"];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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

  // Respaldo / restauración de la bóveda completa
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const backupInputRef = useRef(null);

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

  // Respaldo completo de la bóveda: descarga TODAS las credenciales (sin
  // filtros de búsqueda/categoría) en un .json que puede volver a importarse
  // tal cual con "Restaurar respaldo". Guarda este archivo en un lugar seguro
  // (gestor de contraseñas, disco cifrado) — contiene las claves en texto.
  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const { data, error } = await supabase
        .from("credentials")
        .select("id, title, category, username, password_hash, url_link, assigned_to, notes, is_encrypted, created_at")
        .order("title", { ascending: true });
      if (error) throw error;

      const payload = {
        type: "itsm-treggo-bovedas-backup",
        generated_at: new Date().toISOString(),
        count: data.length,
        credentials: data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      downloadBlob(blob, `respaldo-bovedas-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (err) {
      alert("Error al generar el respaldo: " + err.message);
    } finally {
      setBackingUp(false);
    }
  };

  // Restaura un respaldo generado con "Descargar respaldo". Usa upsert por
  // "id", así que restaurar el mismo archivo varias veces no duplica nada:
  // si la credencial ya existe la actualiza, si no, la vuelve a crear.
  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : parsed.credentials;
      if (!Array.isArray(rows) || rows.length === 0) {
        alert("El archivo no tiene credenciales reconocibles.");
        return;
      }
      if (!window.confirm(`¿Restaurar ${rows.length} credencial(es) desde este respaldo? Las que ya existan (mismo id) se sobrescribirán.`)) return;

      const { error } = await supabase.from("credentials").upsert(rows, { onConflict: "id" });
      if (error) throw error;

      alert(`Respaldo restaurado: ${rows.length} credencial(es).`);
      loadData();
    } catch (err) {
      alert("Error al restaurar el respaldo: " + err.message);
    } finally {
      setRestoring(false);
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  };

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
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Key size={24} className="text-brand-500" />
            Gestor de Accesos y Bóveda de Claves
          </h1>
          <p className="text-xs text-slate-400">Administración centralizada de credenciales y accesos de TI</p>
        </div>
        {canManageTI && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBackup}
              disabled={backingUp}
              title="Descarga un .json con todas las credenciales, para guardarlo en un lugar seguro fuera del sistema"
              className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <DownloadCloud size={16} /> {backingUp ? "Generando..." : "Descargar respaldo"}
            </button>
            <button
              onClick={() => backupInputRef.current?.click()}
              disabled={restoring}
              title="Restaura credenciales desde un .json generado con 'Descargar respaldo'"
              className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <UploadCloud size={16} /> {restoring ? "Restaurando..." : "Restaurar respaldo"}
            </button>
            <input ref={backupInputRef} type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
            <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Nueva Credencial
            </button>
          </div>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="card py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
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
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
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
                <tr className="bg-black/20 border-b border-white/10">
                  <th className="text-left px-4 py-3 font-semibold text-slate-400">Servicio / Recurso</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400">Categoría</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400">Usuario / ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400">Contraseña</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400">Responsable</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCredentials.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
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
                      {item.notes && <div className="text-xs text-slate-500 truncate max-w-xs">{item.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300 font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <span>{item.username || "—"}</span>
                        {item.username && (
                          <button
                            onClick={() => handleCopy(item.username, `user_${item.id}`)}
                            className="text-slate-500 hover:text-slate-300"
                            title="Copiar usuario"
                          >
                            {copiedId === `user_${item.id}` ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-700 px-2 py-1 rounded text-slate-200 min-w-[100px] inline-block">
                          {showPassword[item.id] ? item.password_hash : "••••••••••••"}
                        </span>
                        <button
                          onClick={() => toggleShowPassword(item.id)}
                          className="text-slate-500 hover:text-slate-300"
                          title={showPassword[item.id] ? "Ocultar" : "Mostrar"}
                        >
                          {showPassword[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => handleCopy(item.password_hash, `pass_${item.id}`)}
                          className="text-slate-500 hover:text-slate-300"
                          title="Copiar contraseña"
                        >
                          {copiedId === `pass_${item.id}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {item.employee?.full_name || "Sin asignar"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManageTI ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="text-slate-500 hover:text-sky-400"
                            title="Editar"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            className="text-slate-500 hover:text-red-400"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
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

      {/* Modal para Crear / Editar Credencial */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="glass-modal rounded-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Key size={18} className="text-brand-500" />
                {editingId ? "Editar Credencial" : "Nueva Credencial"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre del Servicio / Recurso *</label>
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Categoría</label>
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Usuario / ID / Email</label>
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
                  <label className="block text-xs font-semibold text-slate-400">Contraseña / Token *</label>
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">URL / Enlace / Dirección IP</label>
                <input
                  type="text"
                  placeholder="https://panel.empresa.com o 192.168.1.1"
                  value={formData.url_link}
                  onChange={(e) => setFormData({ ...formData, url_link: e.target.value })}
                  className="input-field text-sm w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Responsable / Asignado</label>
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notas u Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Puerto, PIN de recuperación, reglas de acceso..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field text-sm w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
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