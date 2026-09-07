import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../services/supabase";
import {
  Plus, Wrench, ShieldCheck, AlertTriangle, BookOpen,
  Search, Trash2, X, CheckCircle, Cpu, Filter, Paperclip, FileDown, Eye, Edit, Download
} from "lucide-react";
import { renderAsync as renderDocx } from "docx-preview";
import * as XLSX from "xlsx";

const WORKFLOW_BUCKET = "workflow-attachments";
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".txt"];
const MAX_FILE_SIZE_MB = 10;

const EMPTY_VIEWER = { open: false, loading: false, error: null, type: null, fileName: "", pdfUrl: null, textContent: null };

function getFileExtension(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

export default function MaintenanceList() {
  const [maintenances, setMaintenances] = useState([]);
  const [assets, setAssets] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Estado Form Mantenimiento (Soporta Edición)
  const [editingMaintenanceId, setEditingMaintenanceId] = useState(null);
  const [formMaintenance, setFormMaintenance] = useState({
    asset_id: "",
    type: "Preventivo",
    technician: "",
    description: ""
  });

  // Estado Form Workflow (Sin etiquetas ni instrucciones; Categoría libre)
  const [formWorkflow, setFormWorkflow] = useState({
    title: "",
    category: ""
  });
  const [workflowFile, setWorkflowFile] = useState(null);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const fileInputRef = useRef(null);

  // Estado del visor de archivos adjuntos
  const [viewer, setViewer] = useState(EMPTY_VIEWER);
  const [xlsxHtml, setXlsxHtml] = useState("");
  const [docxBlob, setDocxBlob] = useState(null);
  const docxContainerRef = useRef(null);

  // Cargar Mantenimientos, Equipos y Workflows
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Obtener bitácora de mantenimientos
      const { data: logsData } = await supabase
        .from("maintenance_logs")
        .select("*, asset:assets(asset_code, brand, model)")
        .order("created_at", { ascending: false });

      // 2. Obtener lista de activos/equipos
      const { data: assetsData } = await supabase
        .from("assets")
        .select("id, asset_code, brand, model");

      // 3. Obtener guías/workflows de la bóveda
      const { data: wfData } = await supabase
        .from("maintenance_workflows")
        .select("*")
        .order("created_at", { ascending: false });

      setMaintenances(logsData || []);
      setAssets(assetsData || []);
      setWorkflows(wfData || []);
    } catch (err) {
      console.error("Error al cargar datos:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Guardar o Actualizar Mantenimiento
  const handleSaveMaintenance = async (e) => {
    e.preventDefault();
    if (!formMaintenance.asset_id || !formMaintenance.description) return;

    try {
      if (editingMaintenanceId) {
        // Modo Actualizar
        const { error } = await supabase
          .from("maintenance_logs")
          .update({
            asset_id: formMaintenance.asset_id,
            maintenance_type: formMaintenance.type,
            technician_name: formMaintenance.technician,
            description: formMaintenance.description,
          })
          .eq("id", editingMaintenanceId);

        if (error) throw error;
      } else {
        // Modo Crear
        const { error } = await supabase
          .from("maintenance_logs")
          .insert([{
            asset_id: formMaintenance.asset_id,
            maintenance_type: formMaintenance.type,
            technician_name: formMaintenance.technician,
            description: formMaintenance.description,
          }]);

        if (error) throw error;
      }

      setFormMaintenance({ asset_id: "", type: "Preventivo", technician: "", description: "" });
      setEditingMaintenanceId(null);
      fetchData();
    } catch (err) {
      alert("Error al guardar mantenimiento: " + err.message);
    }
  };

  // Cargar Mantenimiento para Editar
  const handleEditMaintenance = (item) => {
    setEditingMaintenanceId(item.id);
    setFormMaintenance({
      asset_id: item.asset_id || "",
      type: item.maintenance_type || "Preventivo",
      technician: item.technician_name || "",
      description: item.description || ""
    });
  };

  // Cancelar Edición de Mantenimiento
  const handleCancelEditMaintenance = () => {
    setEditingMaintenanceId(null);
    setFormMaintenance({ asset_id: "", type: "Preventivo", technician: "", description: "" });
  };

  // Eliminar Mantenimiento
  const handleDeleteMaintenance = async (id) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este registro de mantenimiento?")) return;
    try {
      const { error } = await supabase
        .from("maintenance_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchData();
    } catch (err) {
      alert("Error al eliminar mantenimiento: " + err.message);
    }
  };

  // Exportar Mantenimientos a Excel (.xlsx)
  const handleExportToExcel = () => {
    if (filteredMaintenances.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const dataToExport = filteredMaintenances.map((m) => ({
      Fecha: new Date(m.created_at).toLocaleDateString(),
      "Código Equipo": m.asset?.asset_code || "N/A",
      Marca: m.asset?.brand || "",
      Modelo: m.asset?.model || "",
      "Tipo de Servicio": m.maintenance_type || "",
      Técnico: m.technician_name || "N/A",
      Descripción: m.description || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mantenimientos");
    XLSX.writeFile(workbook, `Reporte_Mantenimientos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Seleccionar archivo adjunto para la guía
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setWorkflowFile(null);
      return;
    }

    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert(`Formato no permitido. Solo se aceptan: ${ALLOWED_EXTENSIONS.join(", ")}`);
      e.target.value = "";
      setWorkflowFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`);
      e.target.value = "";
      setWorkflowFile(null);
      return;
    }

    setWorkflowFile(file);
  };

  // Guardar Workflow / Guía
  const handleCreateWorkflow = async (e) => {
    e.preventDefault();
    if (!formWorkflow.title) return;

    setSavingWorkflow(true);
    try {
      let filePath = null;
      let fileName = null;

      if (workflowFile) {
        const safeName = workflowFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `workflows/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(WORKFLOW_BUCKET)
          .upload(path, workflowFile);

        if (uploadError) throw uploadError;

        filePath = path;
        fileName = workflowFile.name;
      }

      const { error } = await supabase
        .from("maintenance_workflows")
        .insert([{
          title: formWorkflow.title,
          category: formWorkflow.category.trim() || "General",
          file_path: filePath,
          file_name: fileName
        }]);

      if (error) throw error;

      setFormWorkflow({ title: "", category: "" });
      setWorkflowFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchData();
    } catch (err) {
      alert("Error al guardar workflow: " + err.message);
    } finally {
      setSavingWorkflow(false);
    }
  };

  // Eliminar Workflow / Guía de la Bóveda
  const handleDeleteWorkflow = async (id, filePath) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este documento/workflow?")) return;

    try {
      if (filePath) {
        await supabase.storage.from(WORKFLOW_BUCKET).remove([filePath]);
      }

      const { error } = await supabase
        .from("maintenance_workflows")
        .delete()
        .eq("id", id);

      if (error) throw error;

      fetchData();
    } catch (err) {
      alert("Error al eliminar el workflow: " + err.message);
    }
  };

  // Descargar archivo adjunto de una guía
  const handleDownloadFile = async (filePath, fileName) => {
    try {
      const { data: blob, error } = await supabase.storage
        .from(WORKFLOW_BUCKET)
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "archivo";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error al descargar archivo: " + err.message);
    }
  };

  // Abrir visor interno para archivo adjunto
  const handleViewFile = async (filePath, fileName) => {
    const ext = getFileExtension(fileName);
    setXlsxHtml("");
    setDocxBlob(null);
    setViewer({ ...EMPTY_VIEWER, open: true, loading: true, type: ext, fileName });

    try {
      const { data: blob, error } = await supabase.storage
        .from(WORKFLOW_BUCKET)
        .download(filePath);

      if (error) throw error;

      if (ext === ".pdf") {
        const pdfUrl = URL.createObjectURL(blob);
        setViewer((v) => ({ ...v, loading: false, pdfUrl }));
      } else if (ext === ".txt") {
        const textContent = await blob.text();
        setViewer((v) => ({ ...v, loading: false, textContent }));
      } else if (ext === ".xlsx") {
        const buffer = await blob.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        setXlsxHtml(XLSX.utils.sheet_to_html(firstSheet));
        setViewer((v) => ({ ...v, loading: false }));
      } else if (ext === ".docx") {
        setDocxBlob(blob);
        setViewer((v) => ({ ...v, loading: false }));
      } else {
        setViewer((v) => ({ ...v, loading: false, error: "Formato no soportado para vista previa." }));
      }
    } catch (err) {
      setViewer((v) => ({ ...v, loading: false, error: err.message }));
    }
  };

  useEffect(() => {
    if (viewer.open && viewer.type === ".docx" && docxBlob && docxContainerRef.current) {
      docxContainerRef.current.innerHTML = "";
      renderDocx(docxBlob, docxContainerRef.current, undefined, { inWrapper: true })
        .catch((err) => setViewer((v) => ({ ...v, error: err.message })));
    }
  }, [viewer.open, viewer.type, docxBlob]);

  const closeViewer = () => {
    if (viewer.pdfUrl) URL.revokeObjectURL(viewer.pdfUrl);
    setViewer(EMPTY_VIEWER);
    setXlsxHtml("");
    setDocxBlob(null);
  };

  // Filtrado de mantenimientos
  const filteredMaintenances = maintenances.filter(m =>
    m.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.asset?.asset_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-slate-100">

      {/* Header & Acciones */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-sky-400 flex items-center gap-2">
            <Wrench className="w-6 h-6" /> Gestor de Mantenimiento & Servicios TI
          </h1>
          <p className="text-slate-400 text-sm">Registro de intervenciones, métricas y bóveda de procedimientos.</p>
        </div>
        <button
          onClick={() => setShowWorkflowModal(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium shadow transition-all"
        >
          <BookOpen className="w-4 h-4" /> Bóveda de Workflows ({workflows.length})
        </button>
      </div>

      {/* Tarjetas del Dashboard / Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <span className="text-xs text-slate-400 font-semibold uppercase">Total Intervenciones</span>
          <div className="text-2xl font-bold text-slate-100">{maintenances.length}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <span className="text-xs text-slate-400 font-semibold uppercase">Mantenimientos Preventivos</span>
          <div className="text-2xl font-bold text-sky-400">
            {maintenances.filter(m => m.maintenance_type === "Preventivo").length}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <span className="text-xs text-slate-400 font-semibold uppercase">Mantenimientos Correctivos</span>
          <div className="text-2xl font-bold text-amber-400">
            {maintenances.filter(m => m.maintenance_type === "Correctivo").length}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <span className="text-xs text-purple-400 font-semibold uppercase">Guías en Bóveda</span>
          <div className="text-2xl font-bold text-purple-300">{workflows.length}</div>
        </div>
      </div>

      {/* Grid Principal: Formulario + Tabla */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Formulario de Registro / Edición */}
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl h-fit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              {editingMaintenanceId ? <Edit className="w-5 h-5 text-amber-400" /> : <Plus className="w-5 h-5 text-sky-400" />}
              {editingMaintenanceId ? "Editar Mantenimiento" : "Registrar Nuevo Mantenimiento"}
            </h2>
            {editingMaintenanceId && (
              <button
                onClick={handleCancelEditMaintenance}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Cancelar
              </button>
            )}
          </div>

          <form onSubmit={handleSaveMaintenance} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Equipo / Activo (*)</label>
              <select
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-sky-500 outline-none"
                value={formMaintenance.asset_id}
                onChange={(e) => setFormMaintenance({ ...formMaintenance, asset_id: e.target.value })}
              >
                <option value="">-- Seleccionar Equipo --</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_code} - {a.brand} {a.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Servicio</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-sky-500 outline-none"
                value={formMaintenance.type}
                onChange={(e) => setFormMaintenance({ ...formMaintenance, type: e.target.value })}
              >
                <option value="Preventivo">Preventivo</option>
                <option value="Correctivo">Correctivo</option>
                <option value="Limpieza">Limpieza</option>
                <option value="Actualización">Actualización</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Técnico / Responsable</label>
              <input
                type="text"
                placeholder="Ej. Daniel"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-sky-500 outline-none"
                value={formMaintenance.technician}
                onChange={(e) => setFormMaintenance({ ...formMaintenance, technician: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Descripción del Trabajo (*)</label>
              <textarea
                required
                rows={3}
                placeholder="Detalla las tareas realizadas..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-sky-500 outline-none"
                value={formMaintenance.description}
                onChange={(e) => setFormMaintenance({ ...formMaintenance, description: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className={`w-full font-medium py-2.5 rounded-lg transition-all text-white ${
                editingMaintenanceId ? "bg-amber-600 hover:bg-amber-500" : "bg-sky-600 hover:bg-sky-500"
              }`}
            >
              {editingMaintenanceId ? "Actualizar Mantenimiento" : "Guardar Mantenimiento"}
            </button>
          </form>
        </div>

        {/* Tabla de Registros */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 p-5 rounded-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-slate-200">Historial de Intervenciones</h2>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Botón Exportar */}
              <button
                onClick={handleExportToExcel}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                title="Exportar mantenimientos a Excel"
              >
                <Download className="w-3.5 h-3.5" /> Exportar Excel
              </button>

              {/* Buscador */}
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por equipo o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:border-sky-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 uppercase text-xs">
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Equipo</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Descripción</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-slate-300">
                {filteredMaintenances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No hay registros de mantenimiento almacenados.
                    </td>
                  </tr>
                ) : (
                  filteredMaintenances.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-750">
                      <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-200">
                        {item.asset?.asset_code || "Sin activo"}<br />
                        <span className="text-xs text-slate-400">{item.asset?.brand} {item.asset?.model}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          item.maintenance_type === "Preventivo" ? "bg-sky-950 text-sky-400 border border-sky-800" :
                          item.maintenance_type === "Correctivo" ? "bg-amber-950 text-amber-400 border border-amber-800" :
                          item.maintenance_type === "Limpieza" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" :
                          "bg-purple-950 text-purple-400 border border-purple-800"
                        }`}>
                          {item.maintenance_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                        {item.description}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => handleEditMaintenance(item)}
                          className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMaintenance(item.id)}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Bóveda de Workflows / Guías */}
      {showWorkflowModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3 mb-4">
              <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                <BookOpen className="w-6 h-6" /> Bóveda de Guías & Workflows
              </h3>
              <button
                onClick={() => setShowWorkflowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Formulario Crear Workflow */}
              <form onSubmit={handleCreateWorkflow} className="space-y-3 bg-slate-900/60 p-4 border border-slate-700/60 rounded-lg">
                <h4 className="font-semibold text-purple-300 text-sm">Registrar Nuevo Procedimiento</h4>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Título de la Guía</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Configurar VPN Tailscale"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 outline-none"
                    value={formWorkflow.title}
                    onChange={(e) => setFormWorkflow({ ...formWorkflow, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoría (Escribir libremente)</label>
                  <input
                    type="text"
                    placeholder="Ej. Software, Redes, Servidores..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 outline-none"
                    value={formWorkflow.category}
                    onChange={(e) => setFormWorkflow({ ...formWorkflow, category: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Archivo Adjunto (opcional)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.docx,.xlsx,.txt"
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
                  />
                  {workflowFile && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Seleccionado: {workflowFile.name} ({(workflowFile.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    Formatos permitidos: PDF, DOCX, XLSX, TXT — máx. {MAX_FILE_SIZE_MB} MB
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={savingWorkflow}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded transition-all"
                >
                  {savingWorkflow ? "Guardando..." : "Guardar Guía"}
                </button>
              </form>

              {/* Lista de Guías en la Bóveda */}
              <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2">
                <h4 className="font-semibold text-slate-300 text-sm">Procedimientos Almacenados</h4>
                {workflows.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No hay guías registradas todavía.</p>
                ) : (
                  workflows.map((wf) => (
                    <div key={wf.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-sky-400 text-xs">{wf.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700">
                            {wf.category || "General"}
                          </span>
                          <button
                            onClick={() => handleDeleteWorkflow(wf.id, wf.file_path)}
                            className="text-slate-400 hover:text-red-400 transition-colors"
                            title="Eliminar guía"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {wf.file_path && (
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={() => handleViewFile(wf.file_path, wf.file_name)}
                            className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 underline"
                          >
                            <Eye className="w-3 h-3" /> {wf.file_name || "Ver archivo"}
                          </button>
                          <button
                            onClick={() => handleDownloadFile(wf.file_path, wf.file_name)}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-300 underline"
                          >
                            <FileDown className="w-3 h-3" /> Descargar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visor interno de archivos adjuntos */}
      {viewer.open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[60] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-700 px-5 py-3 shrink-0">
              <h3 className="text-sm font-semibold text-slate-200 truncate pr-4">{viewer.fileName}</h3>
              <button onClick={closeViewer} className="text-slate-400 hover:text-white shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-900">
              {viewer.loading && (
                <p className="text-slate-400 text-sm text-center py-10">Cargando archivo...</p>
              )}
              {viewer.error && (
                <p className="text-red-400 text-sm text-center py-10">Error al mostrar el archivo: {viewer.error}</p>
              )}

              {!viewer.loading && !viewer.error && viewer.type === ".pdf" && viewer.pdfUrl && (
                <iframe
                  src={viewer.pdfUrl}
                  title={viewer.fileName}
                  className="w-full h-[75vh] rounded border border-slate-700 bg-white"
                />
              )}

              {!viewer.loading && !viewer.error && viewer.type === ".txt" && (
                <pre className="text-xs text-slate-200 whitespace-pre-wrap bg-slate-950 p-4 rounded border border-slate-800">
                  {viewer.textContent}
                </pre>
              )}

              {!viewer.loading && !viewer.error && viewer.type === ".xlsx" && (
                <div
                  className="xlsx-preview overflow-auto bg-white rounded p-2 text-black"
                  dangerouslySetInnerHTML={{ __html: xlsxHtml }}
                />
              )}

              {!viewer.loading && !viewer.error && viewer.type === ".docx" && (
                <div ref={docxContainerRef} className="docx-preview bg-white rounded p-4 text-black overflow-auto" />
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .xlsx-preview table { border-collapse: collapse; width: 100%; font-size: 12px; }
        .xlsx-preview td, .xlsx-preview th { border: 1px solid #cbd5e1; padding: 4px 8px; }
        .docx-preview .docx-wrapper { background: transparent; padding: 0; }
      `}</style>

    </div>
  );
}