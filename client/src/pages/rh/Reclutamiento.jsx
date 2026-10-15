import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, Plus, X, Trash2, Paperclip, Download, UserPlus,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';

const CVS_BUCKET = 'candidate-cvs';

const STAGE_META = {
  nuevo:      { label: 'Nuevo',      color: 'bg-gray-100 text-gray-600 border-gray-200' },
  entrevista: { label: 'Entrevista', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  oferta:     { label: 'Oferta',     color: 'bg-purple-50 text-purple-700 border-purple-200' },
  rechazado:  { label: 'Rechazado',  color: 'bg-red-50 text-red-700 border-red-200' },
  contratado: { label: 'Contratado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

function JobOpeningModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', department: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('hr_job_openings').insert([{
        title: form.title, department: form.department || null, notes: form.notes || null,
      }]);
      if (error) throw error;
      onSaved();
    } catch (err) {
      alert('Error al guardar vacante: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Nueva Vacante</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Puesto *</label>
            <input type="text" required className="input-field" value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Departamento</label>
            <input type="text" className="input-field" value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea rows={2} className="input-field" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Crear Vacante'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CandidateModal({ jobOpeningId, onClose, onSaved }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', notes: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let cv_path = null;
      let cv_file_name = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `cvs/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from(CVS_BUCKET).upload(path, file);
        if (uploadError) throw uploadError;
        cv_path = path;
        cv_file_name = file.name;
      }
      const { error } = await supabase.from('hr_candidates').insert([{
        job_opening_id: jobOpeningId,
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        notes: form.notes || null,
        cv_path, cv_file_name,
      }]);
      if (error) throw error;
      onSaved();
    } catch (err) {
      alert('Error al guardar candidato: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Nuevo Candidato</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre Completo *</label>
            <input type="text" required className="input-field" value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input-field" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input type="text" className="input-field" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Paperclip size={13} /> CV (PDF, opcional)</label>
            <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer" />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea rows={2} className="input-field" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Agregar Candidato'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Reclutamiento() {
  const { canManageRH } = useRole();
  const [openings, setOpenings] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingOpenings, setLoadingOpenings] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);

  const loadOpenings = useCallback(async () => {
    setLoadingOpenings(true);
    try {
      const { data, error } = await supabase
        .from('hr_job_openings')
        .select('*, candidates:hr_candidates(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOpenings(data || []);
      if (!selectedId && data?.length) setSelectedId(data[0].id);
    } catch (err) {
      console.error('Error al cargar vacantes:', err.message);
    } finally {
      setLoadingOpenings(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCandidates = useCallback(async () => {
    if (!selectedId) { setCandidates([]); return; }
    setLoadingCandidates(true);
    try {
      const { data, error } = await supabase
        .from('hr_candidates')
        .select('*')
        .eq('job_opening_id', selectedId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCandidates(data || []);
    } catch (err) {
      console.error('Error al cargar candidatos:', err.message);
    } finally {
      setLoadingCandidates(false);
    }
  }, [selectedId]);

  useEffect(() => { loadOpenings(); }, [loadOpenings]);
  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  const handleToggleOpeningStatus = async (job) => {
    const next = job.status === 'abierta' ? 'cerrada' : 'abierta';
    const { error } = await supabase.from('hr_job_openings')
      .update({ status: next, closed_at: next === 'cerrada' ? todayISO() : null })
      .eq('id', job.id);
    if (error) alert('Error: ' + error.message);
    else loadOpenings();
  };

  const handleDeleteOpening = async (job) => {
    if (!window.confirm(`¿Eliminar la vacante "${job.title}" y todos sus candidatos?`)) return;
    const { error } = await supabase.from('hr_job_openings').delete().eq('id', job.id);
    if (error) alert('Error al eliminar: ' + error.message);
    else {
      if (selectedId === job.id) setSelectedId(null);
      loadOpenings();
    }
  };

  const handleStageChange = async (candidate, stage) => {
    const { error } = await supabase.from('hr_candidates').update({ stage }).eq('id', candidate.id);
    if (error) alert('Error: ' + error.message);
    else loadCandidates();
  };

  const handleDeleteCandidate = async (candidate) => {
    if (!window.confirm('¿Eliminar este candidato?')) return;
    try {
      if (candidate.cv_path) await supabase.storage.from(CVS_BUCKET).remove([candidate.cv_path]);
      const { error } = await supabase.from('hr_candidates').delete().eq('id', candidate.id);
      if (error) throw error;
      loadCandidates();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handleDownloadCv = async (candidate) => {
    try {
      const { data: blob, error } = await supabase.storage.from(CVS_BUCKET).download(candidate.cv_path);
      if (error) throw error;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = candidate.cv_file_name || 'cv.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al descargar: ' + err.message);
    }
  };

  const selectedJob = openings.find((o) => o.id === selectedId);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="text-brand-500" /> Reclutamiento / Vacantes
          </h1>
          <p className="text-sm text-gray-500">Gestión de vacantes abiertas y seguimiento de candidatos.</p>
        </div>
        {canManageRH && (
          <button onClick={() => setJobModalOpen(true)} className="btn-primary flex items-center gap-1.5">
            <Plus size={16} /> Nueva Vacante
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Lista de Vacantes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-1">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">
            Vacantes ({openings.length})
          </div>
          <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
            {loadingOpenings ? (
              <p className="p-4 text-sm text-gray-500">Cargando...</p>
            ) : openings.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No hay vacantes registradas.</p>
            ) : (
              openings.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${selectedId === job.id ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm truncate">{job.title}</p>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      job.status === 'abierta' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {job.status === 'abierta' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{job.department || 'Sin depto.'} · {job.candidates?.[0]?.count ?? 0} candidato(s)</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Candidatos de la vacante seleccionada */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2">
          {!selectedJob ? (
            <p className="p-6 text-sm text-gray-400">Selecciona una vacante para ver sus candidatos.</p>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold text-gray-900">{selectedJob.title}</p>
                  <p className="text-xs text-gray-400">{selectedJob.department || 'Sin departamento'} · Abierta desde {selectedJob.opened_at}</p>
                </div>
                {canManageRH && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCandidateModalOpen(true)} className="btn-secondary text-xs flex items-center gap-1.5">
                      <UserPlus size={14} /> Agregar Candidato
                    </button>
                    <button onClick={() => handleToggleOpeningStatus(selectedJob)} className="btn-secondary text-xs">
                      {selectedJob.status === 'abierta' ? 'Cerrar Vacante' : 'Reabrir Vacante'}
                    </button>
                    <button onClick={() => handleDeleteOpening(selectedJob)} className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                      <th className="py-2.5 px-4">Candidato</th>
                      <th className="py-2.5 px-4">Contacto</th>
                      <th className="py-2.5 px-4">Etapa</th>
                      <th className="py-2.5 px-4">CV</th>
                      {canManageRH && <th className="py-2.5 px-4 text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {loadingCandidates ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">Cargando...</td></tr>
                    ) : candidates.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin candidatos todavía.</td></tr>
                    ) : (
                      candidates.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-4 font-medium text-gray-900">{c.full_name}</td>
                          <td className="py-2.5 px-4 text-xs text-gray-500">
                            {c.email || '—'}
                            {c.phone && <span className="block">{c.phone}</span>}
                          </td>
                          <td className="py-2.5 px-4">
                            {canManageRH ? (
                              <select
                                value={c.stage}
                                onChange={(e) => handleStageChange(c, e.target.value)}
                                className={`px-2 py-1 rounded-lg text-xs font-medium border ${STAGE_META[c.stage]?.color || ''}`}
                              >
                                {Object.entries(STAGE_META).map(([k, v]) => (
                                  <option key={k} value={k}>{v.label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STAGE_META[c.stage]?.color || ''}`}>
                                {STAGE_META[c.stage]?.label}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            {c.cv_path ? (
                              <button onClick={() => handleDownloadCv(c)} className="text-blue-600 hover:text-blue-800 text-xs font-medium inline-flex items-center gap-1">
                                <Download size={13} /> Ver
                              </button>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          {canManageRH && (
                            <td className="py-2.5 px-4 text-right">
                              <button onClick={() => handleDeleteCandidate(c)} className="text-red-600 hover:text-red-800 text-xs font-medium">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {jobModalOpen && (
        <JobOpeningModal onClose={() => setJobModalOpen(false)} onSaved={() => { setJobModalOpen(false); loadOpenings(); }} />
      )}
      {candidateModalOpen && selectedId && (
        <CandidateModal
          jobOpeningId={selectedId}
          onClose={() => setCandidateModalOpen(false)}
          onSaved={() => { setCandidateModalOpen(false); loadCandidates(); loadOpenings(); }}
        />
      )}
    </div>
  );
}
