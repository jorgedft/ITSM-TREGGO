import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Users, Plus, Pencil, Trash2, Download, Upload, X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';

const CONTRACT_TYPES = [
    { value: 'planta', label: 'Planta' },
    { value: 'temporal', label: 'Temporal' },
    { value: 'honorarios', label: 'Honorarios' },
];

const STATUS_OPTIONS = [
    { value: 'activo', label: 'Activo' },
    { value: 'baja', label: 'Baja' },
];

// Encabezados usados para exportar/importar CSV y XLSX.
const COLUMNS = [
    { key: 'employee_number', header: 'Número de Empleado' },
    { key: 'full_name',       header: 'Nombre Completo' },
    { key: 'email',           header: 'Email' },
    { key: 'phone',           header: 'Teléfono' },
    { key: 'position',        header: 'Puesto' },
    { key: 'department',      header: 'Departamento' },
    { key: 'hire_date',       header: 'Fecha de Ingreso' },
    { key: 'contract_type',   header: 'Tipo de Contrato' },
    { key: 'status',          header: 'Estatus' },
    { key: 'salary',          header: 'Sueldo' },
    { key: 'notes',           header: 'Notas' },
];

const EMPTY_FORM = {
    employee_number: '',
    full_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    hire_date: '',
    contract_type: 'planta',
    status: 'activo',
    salary: '',
    notes: '',
};

function EmployeeFormModal({ initial, onClose, onSaved }) {
    const [form, setForm] = useState(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const isEdit = Boolean(initial?.id);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                hire_date: form.hire_date || null,
                salary: form.salary === '' ? null : Number(form.salary),
                employee_number: form.employee_number || null,
            };

            if (isEdit) {
                const { error } = await supabase.from('employees').update(payload).eq('id', initial.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('employees').insert([payload]);
                if (error) throw error;
            }
            onSaved();
        } catch (err) {
            alert('Error al guardar colaborador: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isEdit ? 'Editar Colaborador' : 'Nuevo Colaborador'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Número de Empleado</label>
                            <input name="employee_number" value={form.employee_number} onChange={handleChange}
                                placeholder="Ej. EMP-001" className="input-field" />
                        </div>
                        <div>
                            <label className="label">Nombre Completo *</label>
                            <input name="full_name" required value={form.full_name} onChange={handleChange}
                                className="input-field" />
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <input type="email" name="email" value={form.email} onChange={handleChange}
                                className="input-field" />
                        </div>
                        <div>
                            <label className="label">Teléfono</label>
                            <input name="phone" value={form.phone} onChange={handleChange} className="input-field" />
                        </div>
                        <div>
                            <label className="label">Puesto</label>
                            <input name="position" value={form.position} onChange={handleChange} className="input-field" />
                        </div>
                        <div>
                            <label className="label">Departamento</label>
                            <input name="department" value={form.department} onChange={handleChange} className="input-field" />
                        </div>
                        <div>
                            <label className="label">Fecha de Ingreso</label>
                            <input type="date" name="hire_date" value={form.hire_date || ''} onChange={handleChange}
                                className="input-field" />
                        </div>
                        <div>
                            <label className="label">Tipo de Contrato</label>
                            <select name="contract_type" value={form.contract_type} onChange={handleChange} className="input-field">
                                {CONTRACT_TYPES.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Estatus</label>
                            <select name="status" value={form.status} onChange={handleChange} className="input-field">
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Sueldo</label>
                            <input type="number" step="0.01" name="salary" value={form.salary} onChange={handleChange}
                                placeholder="0.00" className="input-field" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="label">Notas</label>
                            <textarea name="notes" rows={2} value={form.notes} onChange={handleChange} className="input-field" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" disabled={saving} className="btn-primary">
                            {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Colaboradores() {
    const { canManageRH } = useRole();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);

    const loadEmployees = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('employees').select('*').order('full_name', { ascending: true });
            if (statusFilter) query = query.eq('status', statusFilter);
            const { data, error } = await query;
            if (error) throw error;
            setEmployees(data || []);
        } catch (err) {
            console.error('Error al cargar colaboradores:', err.message);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { loadEmployees(); }, [loadEmployees]);

    const filtered = employees.filter((e) => {
        const q = search.toLowerCase();
        return (
            e.full_name?.toLowerCase().includes(q) ||
            e.email?.toLowerCase().includes(q) ||
            e.position?.toLowerCase().includes(q) ||
            e.department?.toLowerCase().includes(q) ||
            e.employee_number?.toLowerCase().includes(q)
        );
    });

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este colaborador? Esta acción no se puede deshacer.')) return;
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) {
            alert('Error al eliminar: ' + error.message);
        } else {
            loadEmployees();
        }
    };

    const buildExportRows = () =>
        filtered.map((e) => {
            const row = {};
            COLUMNS.forEach(({ key, header }) => {
                row[header] = e[key] ?? '';
            });
            return row;
        });

    const handleExport = (format) => {
        const ws = XLSX.utils.json_to_sheet(buildExportRows());
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
        const filename = `colaboradores_${new Date().toISOString().slice(0, 10)}.${format}`;
        XLSX.writeFile(wb, filename, { bookType: format });
    };

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([Object.fromEntries(COLUMNS.map((c) => [c.header, '']))]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
        XLSX.writeFile(wb, 'plantilla_colaboradores.xlsx', { bookType: 'xlsx' });
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            const headerToKey = Object.fromEntries(COLUMNS.map((c) => [c.header, c.key]));

            const payload = rows
                .map((row) => {
                    const record = {};
                    Object.entries(row).forEach(([header, value]) => {
                        const key = headerToKey[header.trim()];
                        if (key) record[key] = String(value).trim();
                    });
                    return record;
                })
                .filter((r) => r.full_name)
                .map((r) => ({
                    ...r,
                    salary: r.salary ? Number(r.salary) : null,
                    status: r.status === 'baja' ? 'baja' : 'activo',
                    contract_type: ['planta', 'temporal', 'honorarios'].includes(r.contract_type) ? r.contract_type : 'planta',
                    hire_date: r.hire_date || null,
                    employee_number: r.employee_number || null,
                }));

            if (payload.length === 0) {
                alert('No se encontraron filas válidas (falta la columna "Nombre Completo").');
                return;
            }

            const { error } = await supabase.from('employees').insert(payload);
            if (error) throw error;

            alert(`Se importaron ${payload.length} colaboradores.`);
            loadEmployees();
        } catch (err) {
            alert('Error al importar: ' + err.message);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="text-brand-500" /> Colaboradores ({filtered.length})
                    </h1>
                    <p className="text-sm text-gray-500">Directorio y expedientes del personal.</p>
                </div>

                {canManageRH && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={handleDownloadTemplate} className="btn-secondary flex items-center gap-1.5 text-xs">
                            <Download size={14} /> Plantilla
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            className="btn-secondary flex items-center gap-1.5 text-xs disabled:opacity-50"
                        >
                            <Upload size={14} /> {importing ? 'Importando...' : 'Importar CSV/XLSX'}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleImportFile}
                            className="hidden"
                        />
                        <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-1.5 text-xs">
                            <Download size={14} /> CSV
                        </button>
                        <button onClick={() => handleExport('xlsx')} className="btn-secondary flex items-center gap-1.5 text-xs">
                            <Download size={14} /> XLSX
                        </button>
                        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary flex items-center gap-1.5">
                            <Plus size={16} /> Nuevo Colaborador
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative sm:col-span-2">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, puesto, departamento, email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-field pl-9"
                    />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
                    <option value="">Todos los estatus</option>
                    {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                                <th className="py-3 px-4"># Empleado</th>
                                <th className="py-3 px-4">Nombre</th>
                                <th className="py-3 px-4">Puesto / Depto.</th>
                                <th className="py-3 px-4">Contacto</th>
                                <th className="py-3 px-4">Ingreso</th>
                                <th className="py-3 px-4">Contrato</th>
                                <th className="py-3 px-4">Estatus</th>
                                {canManageRH && <th className="py-3 px-4 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-500">Cargando colaboradores...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No hay colaboradores registrados.</td></tr>
                            ) : (
                                filtered.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 font-mono text-xs text-gray-600">{emp.employee_number || '—'}</td>
                                        <td className="py-3 px-4 font-semibold text-gray-900">{emp.full_name}</td>
                                        <td className="py-3 px-4 text-gray-700">
                                            {emp.position || '—'}
                                            {emp.department && <span className="block text-xs text-gray-400">{emp.department}</span>}
                                        </td>
                                        <td className="py-3 px-4 text-gray-700 text-xs">
                                            {emp.email || '—'}
                                            {emp.phone && <span className="block">{emp.phone}</span>}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-gray-600">{emp.hire_date || '—'}</td>
                                        <td className="py-3 px-4 text-xs text-gray-600 capitalize">{emp.contract_type || '—'}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                emp.status === 'activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                                            }`}>
                                                {emp.status === 'activo' ? 'Activo' : 'Baja'}
                                            </span>
                                        </td>
                                        {canManageRH && (
                                            <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                                                <button onClick={() => { setEditing(emp); setModalOpen(true); }}
                                                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs font-medium">
                                                    <Pencil size={13} /> Editar
                                                </button>
                                                <button onClick={() => handleDelete(emp.id)}
                                                    className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 text-xs font-medium">
                                                    <Trash2 size={13} /> Eliminar
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && (
                <EmployeeFormModal
                    initial={editing}
                    onClose={() => setModalOpen(false)}
                    onSaved={() => { setModalOpen(false); loadEmployees(); }}
                />
            )}
        </div>
    );
}
