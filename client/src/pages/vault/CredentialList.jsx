import { useState, useEffect, useCallback, useRef } from "react";
import {
  Key, Plus, Search, Eye, EyeOff, Copy, Check, Lock, Unlock, History, Settings2, AlertTriangle,
  ExternalLink, Trash2, Edit, ShieldCheck, RefreshCw, DownloadCloud, UploadCloud
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useRole } from "../../hooks/useRole";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { useVault } from "./useVault";
import { isCiphertext } from "./vaultCrypto";
import { SetupModal, UnlockModal, RecoverModal, SettingsModal, AccessLogModal } from "./VaultModals";

const CATEGORIES = ["Todas", "Servidores", "Cuentas Web", "Redes / Routers", "Software / Licencias", "Bases de Datos", "General"];
const REVEAL_MS = 15_000;      // la contraseña visible se vuelve a ocultar sola
const CLIPBOARD_MS = 30_000;   // el portapapeles se limpia solo
const EMPTY_FORM = { title: "", category: "Cuentas Web", username: "", password: "", url_link: "", assigned_to: "", notes: "" };
const BACKUP_COLS = "id, title, category, username, password_hash, url_link, assigned_to, notes, is_encrypted, created_at";
const CONFIG_COLS = "version, kdf_iterations, pass_salt, wrapped_dek_pass, recovery_salt, wrapped_dek_recovery";

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

// Generador con aleatoriedad criptográfica (sin sesgo de módulo).
function randomPassword(length = 20) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  const limit = 256 - (256 % chars.length);
  let out = "";
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of buf) {
      if (b < limit && out.length < length) out += chars[b % chars.length];
    }
  }
  return out;
}

export default function CredentialList() {
  const { canManageTI } = useRole();
  const vault = useVault();
  const [credentials, setCredentials] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  // Contraseñas descifradas visibles ahora mismo (id -> texto) y el aviso de copiado
  const [revealed, setRevealed] = useState({});
  const revealTimers = useRef({});
  const [copiedId, setCopiedId] = useState(null);
  const clipTimer = useRef(null);

  // Modales de la bóveda
  const [modal, setModal] = useState(null); // setup | unlock | recover | settings | log
  const pendingAction = useRef(null);
  const [migrating, setMigrating] = useState(false);

  // Respaldo / restauración
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const backupInputRef = useRef(null);

  // Modal crear / editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: credsData }, { data: empData }] = await Promise.all([
        supabase
          .from("credentials")
          .select("*, employee:employees!credentials_assigned_to_fkey(full_name)")
          .order("title", { ascending: true }),
        supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
      ]);
      setCredentials(credsData || []);
      setEmployees(empData || []);
    } catch (err) {
      console.error("Error al cargar credenciales:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (canManageTI) loadData(); else setLoading(false); }, [loadData, canManageTI]);

  // Al bloquearse la bóveda se descarta todo lo descifrado.
  useEffect(() => {
    if (vault.status !== "unlocked") {
      Object.values(revealTimers.current).forEach(clearTimeout);
      revealTimers.current = {};
      setRevealed({});
    }
  }, [vault.status]);

  useEffect(() => () => {
    Object.values(revealTimers.current).forEach(clearTimeout);
    clearTimeout(clipTimer.current);
  }, []);

  // Ejecuta la acción pendiente en cuanto se desbloquea.
  // (no mientras se muestra la llave de recuperación: primero debe guardarla).
  useEffect(() => {
    if (vault.status === "unlocked" && modal !== "setup" && pendingAction.current) {
      const fn = pendingAction.current;
      pendingAction.current = null;
      setModal(null);
      fn();
    }
  }, [vault.status, modal]);

  // Pide configurar/desbloquear la bóveda y luego ejecuta `fn`.
  const withVault = (fn) => {
    if (vault.status === "unlocked") return fn();
    pendingAction.current = fn;
    setModal(vault.status === "none" ? "setup" : "unlock");
  };

  const closeModal = () => { pendingAction.current = null; setModal(null); };

  const legacyRows = credentials.filter((c) => c.password_hash && !isCiphertext(c.password_hash));

  // ── Ver / copiar (siempre quedan registrados) ──────────────────────
  const getPlain = async (item) => {
    await vault.log("reveal", item, true);
    return isCiphertext(item.password_hash) ? vault.decrypt(item.password_hash, item.id) : item.password_hash;
  };

  const hideReveal = (id) => {
    clearTimeout(revealTimers.current[id]);
    delete revealTimers.current[id];
    setRevealed((r) => { const n = { ...r }; delete n[id]; return n; });
  };

  const handleReveal = (item) => {
    if (revealed[item.id] !== undefined) return hideReveal(item.id);
    withVault(async () => {
      try {
        const plain = await getPlain(item);
        setRevealed((r) => ({ ...r, [item.id]: plain }));
        clearTimeout(revealTimers.current[item.id]);
        revealTimers.current[item.id] = setTimeout(() => hideReveal(item.id), REVEAL_MS);
      } catch (err) { alert(err.message); }
    });
  };

  const handleCopyPassword = (item) => {
    withVault(async () => {
      try {
        await vault.log("copy", item, true);
        const plain = isCiphertext(item.password_hash) ? await vault.decrypt(item.password_hash, item.id) : item.password_hash;
        await navigator.clipboard.writeText(plain);
        setCopiedId(`pass_${item.id}`);
        setTimeout(() => setCopiedId(null), 2000);
        clearTimeout(clipTimer.current);
        clipTimer.current = setTimeout(async () => {
          try {
            if ((await navigator.clipboard.readText()) === plain) await navigator.clipboard.writeText("");
          } catch { navigator.clipboard.writeText("").catch(() => {}); }
        }, CLIPBOARD_MS);
      } catch (err) { alert(err.message); }
    });
  };

  const handleCopyUser = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Migrar contraseñas antiguas (texto plano) a cifradas ───────────
  const handleMigrate = () => withVault(async () => {
    if (!window.confirm(`Se cifrarán ${legacyRows.length} contraseña(s) que hoy están en texto plano. ¿Continuar?`)) return;
    setMigrating(true);
    try {
      for (const c of legacyRows) {
        const enc = await vault.encrypt(c.password_hash, c.id);
        const { error } = await supabase.from("credentials").update({ password_hash: enc, is_encrypted: true }).eq("id", c.id);
        if (error) throw error;
      }
      await vault.log("migrate");
      alert("Listo: todas las contraseñas quedaron cifradas.");
      loadData();
    } catch (err) {
      alert("Error al cifrar: " + err.message);
      loadData();
    } finally { setMigrating(false); }
  });

  // ── Respaldo (solo texto cifrado) / restauración ───────────────────
  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const [{ data, error }, { data: cfg, error: cfgErr }] = await Promise.all([
        supabase.from("credentials").select(BACKUP_COLS).order("title", { ascending: true }),
        supabase.from("vault_config").select(CONFIG_COLS).maybeSingle(),
      ]);
      if (error) throw error;
      if (cfgErr) throw cfgErr;
      const rows = data.filter((r) => !r.password_hash || isCiphertext(r.password_hash));
      const skipped = data.length - rows.length;
      const payload = {
        type: "itsm-treggo-bovedas-backup",
        format: 2,
        generated_at: new Date().toISOString(),
        count: rows.length,
        vault_config: cfg,
        credentials: rows,
      };
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
        `respaldo-boveda-cifrado-${new Date().toISOString().slice(0, 10)}.json`);
      vault.log("backup");
      if (skipped > 0) alert(`${skipped} credencial(es) aún sin cifrar NO se incluyeron en el respaldo (para no exportar contraseñas en texto plano). Cífralas primero con "Cifrar ahora".`);
    } catch (err) {
      alert("Error al generar el respaldo: " + err.message);
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const parsed = JSON.parse(await file.text());
      const rows = Array.isArray(parsed) ? parsed : parsed.credentials;
      if (!Array.isArray(rows) || rows.length === 0) { alert("El archivo no tiene credenciales reconocibles."); return; }
      if (rows.some((r) => r.password_hash && !isCiphertext(r.password_hash))) {
        alert("El respaldo contiene contraseñas en texto plano (formato antiguo). Por seguridad no se restaura: pide uno nuevo generado con la bóveda cifrada.");
        return;
      }
      const clean = rows.map((r) => ({
        id: r.id, title: r.title, category: r.category, username: r.username, password_hash: r.password_hash,
        url_link: r.url_link, assigned_to: r.assigned_to, notes: r.notes, is_encrypted: !!r.password_hash, created_at: r.created_at,
      }));

      if (vault.status === "none") {
        if (!parsed.vault_config) { alert("Este respaldo no incluye la configuración de la bóveda; no se puede restaurar sin ella."); return; }
        if (!window.confirm("La bóveda de este sistema no está configurada. Se restaurará la configuración y las credenciales del respaldo (necesitarás la frase maestra original). ¿Continuar?")) return;
        const cfg = Object.fromEntries(CONFIG_COLS.split(", ").map((k) => [k, parsed.vault_config[k]]));
        const { error: cfgErr } = await supabase.from("vault_config").insert({ id: 1, ...cfg });
        if (cfgErr) throw cfgErr;
      } else {
        if (vault.status !== "unlocked") { withVault(() => alert("Bóveda desbloqueada. Vuelve a elegir el archivo para restaurar.")); return; }
        const probe = clean.find((r) => r.password_hash);
        if (probe) {
          try { await vault.decrypt(probe.password_hash, probe.id); }
          catch { alert("Este respaldo fue cifrado con otra bóveda (otra llave); no se restaura."); return; }
        }
        if (!window.confirm(`¿Restaurar ${clean.length} credencial(es) desde este respaldo? Las que ya existan (mismo id) se sobrescribirán.`)) return;
      }

      const { error } = await supabase.from("credentials").upsert(clean, { onConflict: "id" });
      if (error) throw error;
      vault.log("restore");
      alert(`Respaldo restaurado: ${clean.length} credencial(es).`);
      if (vault.status === "none") vault.reload();
      loadData();
    } catch (err) {
      alert("Error al restaurar el respaldo: " + err.message);
    } finally {
      setRestoring(false);
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  };

  // ── Crear / editar ─────────────────────────────────────────────────
  const openForm = (cred) => {
    if (cred) {
      setEditingId(cred.id);
      setFormData({
        title: cred.title || "", category: cred.category || "General", username: cred.username || "",
        password: "", url_link: cred.url_link || "", assigned_to: cred.assigned_to || "", notes: cred.notes || "",
      });
    } else {
      setEditingId(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };

  const handleOpenModal = (cred = null) => (cred ? openForm(cred) : withVault(() => openForm(null)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password && vault.status !== "unlocked") {
      // Se bloqueó por inactividad mientras editaba: pide la frase y conserva el formulario.
      return setModal("unlock");
    }
    setSaving(true);
    try {
      const id = editingId || crypto.randomUUID();
      const payload = {
        title: formData.title, category: formData.category, username: formData.username || null,
        url_link: formData.url_link || null, assigned_to: formData.assigned_to || null, notes: formData.notes || null,
      };
      if (formData.password) {
        payload.password_hash = await vault.encrypt(formData.password, id);
        payload.is_encrypted = true;
      }
      const { error } = editingId
        ? await supabase.from("credentials").update(payload).eq("id", id)
        : await supabase.from("credentials").insert([{ id, ...payload }]);
      if (error) throw error;
      if (revealed[id] !== undefined) hideReveal(id);
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      loadData();
    } catch (err) {
      alert(`Error al guardar: ${err.message}`);
    } finally { setSaving(false); }
  };

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

  const filteredCredentials = credentials.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.title.toLowerCase().includes(q) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q));
    const matchesCategory = selectedCategory === "Todas" || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!canManageTI) {
    return (
      <div className="card text-center py-12">
        <Lock size={32} className="mx-auto text-slate-500 mb-3" />
        <p className="text-slate-300 font-semibold">Sin acceso</p>
        <p className="text-xs text-slate-500">La bóveda de credenciales es solo para Administración y TI.</p>
      </div>
    );
  }

  const unlocked = vault.status === "unlocked";

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Key size={24} className="text-brand-500" />
            Gestor de Accesos y Bóveda de Claves
          </h1>
          <p className="text-xs text-slate-400">Credenciales cifradas de extremo a extremo · acceso solo Admin y TI · cada consulta queda registrada</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {vault.status === "none" && (
            <button onClick={() => setModal("setup")} className="btn-primary flex items-center gap-2 text-sm"><ShieldCheck size={16} /> Configurar bóveda</button>
          )}
          {vault.status === "locked" && (
            <button onClick={() => setModal("unlock")} className="btn-secondary flex items-center gap-2 text-sm"><Lock size={16} /> Bloqueada · Desbloquear</button>
          )}
          {unlocked && (
            <button onClick={vault.lock} className="btn-secondary flex items-center gap-2 text-sm text-emerald-300"><Unlock size={16} /> Desbloqueada · Bloquear</button>
          )}
          {(vault.status === "locked" || unlocked) && (
            <>
              <button onClick={() => setModal("log")} title="Quién vio o copió qué" className="btn-secondary flex items-center gap-2 text-sm"><History size={16} /> Accesos</button>
              <button onClick={() => setModal("settings")} title="Cambiar frase / llave de recuperación" className="btn-secondary flex items-center gap-2 text-sm"><Settings2 size={16} /></button>
            </>
          )}
          <button onClick={handleBackup} disabled={backingUp || vault.status === "loading"} title="Descarga un .json con las credenciales CIFRADAS" className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
            <DownloadCloud size={16} /> {backingUp ? "Generando..." : "Respaldo"}
          </button>
          <button onClick={() => backupInputRef.current?.click()} disabled={restoring || vault.status === "loading"} title="Restaura desde un respaldo cifrado" className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
            <UploadCloud size={16} /> {restoring ? "Restaurando..." : "Restaurar"}
          </button>
          <input ref={backupInputRef} type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
          <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nueva Credencial
          </button>
        </div>
      </div>

      {vault.status === "error" && (
        <div className="card border border-red-500/40 text-sm text-red-300 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>No se pudo leer la configuración de la bóveda: {vault.error}. Si es la primera vez, corre <code>supabase/016_seguridad_boveda.sql</code> en el SQL Editor. <button onClick={vault.reload} className="underline ml-1">Reintentar</button></div>
        </div>
      )}

      {vault.status === "none" && (
        <div className="card border border-amber-500/40 text-sm text-amber-200 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>La bóveda aún no está cifrada. Configúrala con una frase maestra para proteger las contraseñas{legacyRows.length > 0 ? ` (hay ${legacyRows.length} guardada(s) en texto plano)` : ""}.</div>
        </div>
      )}

      {vault.status !== "none" && vault.status !== "error" && legacyRows.length > 0 && (
        <div className="card border border-amber-500/40 text-sm text-amber-200 flex flex-wrap items-center gap-3">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">{legacyRows.length} credencial(es) siguen en texto plano.</span>
          <button onClick={handleMigrate} disabled={migrating} className="btn-primary text-sm">{migrating ? "Cifrando..." : "Cifrar ahora"}</button>
        </div>
      )}

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
                selectedCategory === cat ? "bg-brand-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button onClick={loadData} className="btn-secondary text-sm py-2" aria-label="Recargar">
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
            action={<button onClick={() => handleOpenModal()} className="btn-primary text-sm">+ Nueva credencial</button>}
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
                {filteredCredentials.map((item) => {
                  const isLegacy = item.password_hash && !isCiphertext(item.password_hash);
                  const shown = revealed[item.id];
                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          {item.title}
                          {item.url_link && (
                            <a
                              href={/^https?:\/\//i.test(item.url_link) ? item.url_link : `https://${item.url_link}`}
                              target="_blank"
                              rel="noopener noreferrer"
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
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300 font-medium">{item.category}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                          <span>{item.username || "—"}</span>
                          {item.username && (
                            <button onClick={() => handleCopyUser(item.username, `user_${item.id}`)} className="text-slate-500 hover:text-slate-300" title="Copiar usuario">
                              {copiedId === `user_${item.id}` ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.password_hash ? (
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-700 px-2 py-1 rounded text-slate-200 min-w-[100px] inline-block break-all">
                              {shown !== undefined ? shown : "••••••••••••"}
                            </span>
                            <button onClick={() => handleReveal(item)} className="text-slate-500 hover:text-slate-300" title={shown !== undefined ? "Ocultar" : "Mostrar (queda registrado)"}>
                              {shown !== undefined ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button onClick={() => handleCopyPassword(item)} className="text-slate-500 hover:text-slate-300" title="Copiar contraseña (queda registrado)">
                              {copiedId === `pass_${item.id}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                            {isLegacy && <span className="text-[10px] text-amber-400" title="Aún en texto plano">sin cifrar</span>}
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{item.employee?.full_name || "Sin asignar"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenModal(item)} className="text-slate-500 hover:text-sky-400" title="Editar"><Edit size={15} /></button>
                          <button onClick={() => handleDelete(item.id, item.title)} className="text-slate-500 hover:text-red-400" title="Eliminar"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales de la bóveda */}
      {modal === "setup" && (
        <SetupModal onSetup={vault.setup} onClose={closeModal} onFinished={() => setModal(null)} />
      )}
      {modal === "unlock" && (
        <UnlockModal
          onUnlock={async (p) => { await vault.unlock(p); if (!pendingAction.current) setModal(null); }}
          onClose={closeModal}
          onForgot={() => setModal("recover")}
        />
      )}
      {modal === "recover" && (
        <RecoverModal
          onRecover={async (r, p) => { await vault.recover(r, p); if (!pendingAction.current) setModal(null); }}
          onClose={closeModal}
        />
      )}
      {modal === "settings" && (
        <SettingsModal onChangePhrase={vault.changePhrase} onRegenerate={vault.regenerateRecovery} onClose={() => setModal(null)} />
      )}
      {modal === "log" && <AccessLogModal onClose={() => setModal(null)} />}

      {/* Modal para Crear / Editar Credencial */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 shadow-2xl rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Key size={18} className="text-brand-500" />
                {editingId ? "Editar Credencial" : "Nueva Credencial"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-300" aria-label="Cerrar">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre del Servicio / Recurso *</label>
                <input type="text" required placeholder="Ej: Servidor de Dominio / Panel AWS" value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-field text-sm w-full" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Categoría</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input-field text-sm w-full">
                    {CATEGORIES.filter((c) => c !== "Todas").map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Usuario / ID / Email</label>
                  <input type="text" placeholder="admin / user@empresa.com" value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="input-field text-sm w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-400">Contraseña / Token {editingId ? "" : "*"}</label>
                  <button type="button" onClick={() => setFormData((p) => ({ ...p, password: randomPassword() }))} className="text-xs text-brand-600 font-medium hover:underline">
                    Generar segura
                  </button>
                </div>
                <input
                  type="text"
                  required={!editingId}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={editingId ? "Déjalo vacío para conservar la actual" : "Escribe o genera una clave"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field text-sm font-mono w-full"
                />
                <p className="text-[11px] text-slate-500 mt-1">Se cifra en tu navegador antes de guardarse.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">URL / Enlace / Dirección IP</label>
                <input type="text" placeholder="https://panel.empresa.com o 192.168.1.1" value={formData.url_link}
                  onChange={(e) => setFormData({ ...formData, url_link: e.target.value })} className="input-field text-sm w-full" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Responsable / Asignado</label>
                <select value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} className="input-field text-sm w-full">
                  <option value="">Sin asignar / Uso general</option>
                  {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.full_name}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notas u Observaciones</label>
                <textarea rows={2} placeholder="Puerto, reglas de acceso... (no guardes contraseñas aquí: las notas no se cifran)" value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field text-sm w-full" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-50">{saving ? "Guardando..." : "Guardar Bóveda"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
