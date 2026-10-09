import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    CalendarCheck, Upload, Plus, Pencil, Trash2, X, Download, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';

const TYPE_META = {
    asistencia:  { label: 'Asistencia',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    retardo:     { label: 'Retardo',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
    falta:       { label: 'Falta',       color: 'bg-red-50 text-red-700 border-red-200' },
    permiso:     { label: 'Permiso',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
    incapacidad: { label: 'Incapacidad', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    home_office: { label: 'Home Office', color: 'bg-sky-50 text-sky-700 border-sky-200' },
    otro:        { label: 'Otro',        color: 'bg-gray-100 text-gray-600 border-gray-200' },
};
const MANUAL_TYPES = ['falta', 'permiso', 'incapacidad', 'home_office', 'otro'];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}
function pad2(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function timeKey(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function normalize(str) {
    return (str || '')
        .toUpperCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Parsea el reporte crudo del reloj checador (una fila por marca de
// entrada/salida, sin resumen por día). Formato esperado por columna:
// [ , ID, Nombre, "Fecha / Hora" dd/mm/yyyy HH:mm, Estado, , Tipo ]
function parseChecadorCsv(text) {
    const lines = text.split(/\r?\n/);
    const events = [];
    for (const line of lines) {
        const cells = line.split(',').map((c) => c.trim());
        const deviceId = cells[1];
        const rawName = cells[2];
        const dateTimeStr = cells[3];
        const estado = cells[4];
        if (!deviceId || !/^\d+$/.test(deviceId)) continue;
        if (!rawName) continue;
        const m = dateTimeStr?.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
        if (!m) continue;
        const [, dd, mm, yyyy, hh, min] = m;
        const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
        events.push({ deviceId, rawName, dt, estado });
    }
    return events;
}

// Agrupa las marcas por empleado+día: la más temprana = entrada,
// la más tardía = salida (el campo "Estado" del reloj no es confiable).
function groupEvents(events) {
    const groups = new Map(); // key: deviceId|date -> { deviceId, rawName, date, punches: [] }
    for (const ev of events) {
        const key = `${ev.deviceId}|${dateKey(ev.dt)}`;
        if (!groups.has(key)) {
            groups.set(key, { deviceId: ev.deviceId, rawName: ev.rawName, date: dateKey(ev.dt), punches: [] });
        }
        groups.get(key).punches.push(ev.dt);
    }
    return Array.from(groups.values()).map((g) => {
        const sorted = g.punches.sort((a, b) => a - b);
        return {
            ...g,
            checkIn: sorted[0],
            checkOut: sorted.length > 1 ? sorted[sorted.length - 1] : null,
        };
    });
}

function suggestEmployee(rawName, employees) {
    const normRaw = normalize(rawName);
    const rawTokens = new Set(normRaw.split(' '));
    let best = null;
    let bestScore = 0;
    for (const emp of employees) {
        const empTokens = normalize(emp.full_name).split(' ');
        const score = empTokens.filter((t) => rawTokens.has(t)).length;
        if (score > bestScore) { bestScore = score; best = emp; }
    }
    return bestScore >= 2 ? best : null;
}

function MappingModal({ pending, employees, onCancel, onConfirm }) {
    const [choices, setChoices] = useState(() =>
        Object.fromEntries(pending.map((p) => [p.deviceId, suggestEmployee(p.rawName, employees)?.id || '']))
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="text-amber-500" size={20} />
                    <h2 className="text-lg font-bold text-gray-900">Vincular colaboradores nuevos</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    Estos IDs del checador no están vinculados a ningún colaborador todavía.
                    Vincúlalos una vez; las próximas importaciones ya los reconocerán solas.
                </p>

                <div className="space-y-3">
                    {pending.map((p) => (
                        <div key={p.deviceId} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-400">ID checador {p.deviceId}</p>
                                <p className="font-medium text-gray-800 truncate">{p.rawName}</p>
                            </div>
                            <select
                                className="input-field flex-1"
                                value={choices[p.deviceId]}
                                onChange={(e) => setChoices((c) => ({ ...c, [p.deviceId]: e.target.value }))}
                            >
                                <option value="">— Omitir por ahora —</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-2 pt-5 border-t border-gray-100 mt-5">
                    <button onClick={onCancel} className="btn-secondary">Cancelar</button>
                    <button onClick={() => onConfirm(choices)} className="btn-primary">Confirmar y continuar</button>
                </div>
            </div>
        </div>
    );
}

function ManualEntryModal({ employees, onClose, onSaved }) {
    const [form, setForm] = useState({
        employee_id: '', date: todayISO(), type: 'falta',
        check_in: '', check_out: '', notes: '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                employee_id: form.employee_id,
                date: form.date,
                type: form.type,
                check_in: form.check_in || null,
                check_out: form.check_out || null,
                source: 'manual',
                notes: form.notes || null,
            };
            const { error } = await supabase
                .from('hr_attendance')
                .upsert([payload], { onConflict: 'employee_id,date' });
            if (error) throw error;
            onSaved();
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Registrar Incidencia</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Colaborador *</label>
                        <select required className="input-field" value={form.employee_id}
                            onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}>
                            <option value="">-- Seleccionar --</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Fecha *</label>
                            <input type="date" required className="input-field" value={form.date}
                                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">Tipo *</label>
                            <select className="input-field" value={form.type}
                                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                                {MANUAL_TYPES.map((t) => (
                                    <option key={t} value={t}>{TYPE_META[t].label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {form.type === 'home_office' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Entrada</label>
                                <input type="time" className="input-field" value={form.check_in}
                                    onChange={(e) => setForm((f) => ({ ...f, check_in: e.target.value }))} />
                            </div>
                            <div>
                                <label className="label">Salida</label>
                                <input type="time" className="input-field" value={form.check_out}
                                    onChange={(e) => setForm((f) => ({ ...f, check_out: e.target.value }))} />
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="label">Notas</label>
                        <textarea rows={2} className="input-field" value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" disabled={saving} className="btn-primary">
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Asistencia() {
    const { canManageRH } = useRole();
    const [employees, setEmployees] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(daysAgoISO(7));
    const [dateTo, setDateTo] = useState(todayISO());
    const [employeeFilter, setEmployeeFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [horaLimite, setHoraLimite] = useState('08:30');
    const [importing, setImporting] = useState(false);
    const [pendingMap, setPendingMap] = useState(null); // { groups, pendingEmployees }
    const [manualOpen, setManualOpen] = useState(false);
    const fileInputRef = useRef(null);

    const loadEmployees = useCallback(async () => {
        const { data } = await supabase.from('employees').select('id, full_name').order('full_name');
        setEmployees(data || []);
    }, []);

    const loadRecords = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('hr_attendance')
                .select('*, employee:employees(full_name)')
                .gte('date', dateFrom)
                .lte('date', dateTo)
                .order('date', { ascending: false });
            if (employeeFilter) query = query.eq('employee_id', employeeFilter);
            if (typeFilter) query = query.eq('type', typeFilter);
            const { data, error } = await query;
            if (error) throw error;
            setRecords(data || []);
        } catch (err) {
            console.error('Error al cargar asistencia:', err.message);
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, employeeFilter, typeFilter]);

    useEffect(() => { loadEmployees(); }, [loadEmployees]);
    useEffect(() => { loadRecords(); }, [loadRecords]);

    const commitGroups = async (groups, deviceToEmployee) => {
        const rows = groups
            .map((g) => {
                const employeeId = deviceToEmployee[g.deviceId];
                if (!employeeId) return null;
                const checkInKey = timeKey(g.checkIn);
                const isLate = !!g.checkOut && checkInKey > horaLimite;
                return {
                    employee_id: employeeId,
                    date: g.date,
                    type: g.checkOut ? (isLate ? 'retardo' : 'asistencia') : 'asistencia',
                    check_in: checkInKey,
                    check_out: g.checkOut ? timeKey(g.checkOut) : null,
                    source: 'checador',
                    notes: g.checkOut ? null : 'Incompleto: falta marca de salida',
                };
            })
            .filter(Boolean);

        if (rows.length === 0) {
            alert('No hay marcas de colaboradores vinculados para importar.');
            return;
        }

        const { error } = await supabase.from('hr_attendance').upsert(rows, { onConflict: 'employee_id,date' });
        if (error) { alert('Error al guardar asistencia: ' + error.message); return; }
        alert(`Se importaron ${rows.length} registros de asistencia.`);
        loadRecords();
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const buffer = await file.arrayBuffer();
            const text = new TextDecoder('windows-1252').decode(buffer);
            const events = parseChecadorCsv(text);
            if (events.length === 0) {
                alert('No se encontraron marcas válidas en el archivo.');
                return;
            }
            const groups = groupEvents(events);

            const deviceIds = Array.from(new Set(groups.map((g) => g.deviceId)));
            const { data: mapped } = await supabase
                .from('hr_checador_map')
                .select('device_id, employee_id')
                .in('device_id', deviceIds);
            const deviceToEmployee = Object.fromEntries((mapped || []).map((m) => [m.device_id, m.employee_id]));

            const unresolved = deviceIds.filter((id) => !deviceToEmployee[id]);
            if (unresolved.length > 0) {
                const pending = unresolved.map((id) => ({
                    deviceId: id,
                    rawName: groups.find((g) => g.deviceId === id)?.rawName || id,
                }));
                setPendingMap({ groups, deviceToEmployee, pending });
            } else {
                await commitGroups(groups, deviceToEmployee);
            }
        } catch (err) {
            alert('Error al importar: ' + err.message);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleConfirmMapping = async (choices) => {
        const { groups, deviceToEmployee, pending } = pendingMap;
        const newMappings = pending
            .filter((p) => choices[p.deviceId])
            .map((p) => ({ device_id: p.deviceId, device_name: p.rawName, employee_id: choices[p.deviceId] }));

        if (newMappings.length > 0) {
            const { error } = await supabase.from('hr_checador_map').upsert(newMappings, { onConflict: 'device_id' });
            if (error) { alert('Error al guardar el mapeo: ' + error.message); return; }
        }

        const merged = { ...deviceToEmployee, ...Object.fromEntries(newMappings.map((m) => [m.device_id, m.employee_id])) };
        setPendingMap(null);
        await commitGroups(groups, merged);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este registro de asistencia?')) return;
        const { error } = await supabase.from('hr_attendance').delete().eq('id', id);
        if (error) alert('Error al eliminar: ' + error.message);
        else loadRecords();
    };

    const handleExport = (format) => {
        const rows = records.map((r) => ({
            Fecha: r.date,
            Colaborador: r.employee?.full_name || '—',
            Entrada: r.check_in || '',
            Salida: r.check_out || '',
            Tipo: TYPE_META[r.type]?.label || r.type,
            Origen: r.source === 'checador' ? 'Checador' : 'Manual',
            Notas: r.notes || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
        XLSX.writeFile(wb, `asistencia_${dateFrom}_a_${dateTo}.${format}`, { bookType: format });
    };

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CalendarCheck className="text-brand-500" /> Incidencias y Asistencia
                    </h1>
                    <p className="text-sm text-gray-500">Importa el reporte del reloj checador o registra incidencias a mano.</p>
                </div>

                {canManageRH && (
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-gray-500 flex items-center gap-1">
                            Hora límite entrada
                            <input type="time" value={horaLimite} onChange={(e) => setHoraLimite(e.target.value)}
                                className="input-field py-1 text-xs w-24" />
                        </label>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            className="btn-secondary flex items-center gap-1.5 text-xs disabled:opacity-50"
                        >
                            <Upload size={14} /> {importing ? 'Procesando...' : 'Importar reporte del checador'}
                        </button>
                        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
                        <button onClick={() => setManualOpen(true)} className="btn-primary flex items-center gap-1.5">
                            <Plus size={16} /> Registrar Incidencia
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                    <label className="label">Desde</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field" />
                </div>
                <div>
                    <label className="label">Hasta</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field" />
                </div>
                <div className="sm:col-span-2">
                    <label className="label">Colaborador</label>
                    <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="input-field">
                        <option value="">Todos</option>
                        {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label">Tipo</label>
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field">
                        <option value="">Todos</option>
                        {Object.entries(TYPE_META).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {canManageRH && (
                <div className="flex justify-end gap-2">
                    <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-1.5 text-xs">
                        <Download size={14} /> CSV
                    </button>
                    <button onClick={() => handleExport('xlsx')} className="btn-secondary flex items-center gap-1.5 text-xs">
                        <Download size={14} /> XLSX
                    </button>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                                <th className="py-3 px-4">Fecha</th>
                                <th className="py-3 px-4">Colaborador</th>
                                <th className="py-3 px-4">Entrada</th>
                                <th className="py-3 px-4">Salida</th>
                                <th className="py-3 px-4">Tipo</th>
                                <th className="py-3 px-4">Origen</th>
                                <th className="py-3 px-4">Notas</th>
                                {canManageRH && <th className="py-3 px-4 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-500">Cargando...</td></tr>
                            ) : records.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Sin registros en este rango.</td></tr>
                            ) : (
                                records.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 text-xs text-gray-600">{r.date}</td>
                                        <td className="py-3 px-4 font-medium text-gray-900">{r.employee?.full_name || '—'}</td>
                                        <td className="py-3 px-4 font-mono text-xs">{r.check_in || '—'}</td>
                                        <td className="py-3 px-4 font-mono text-xs">{r.check_out || '—'}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_META[r.type]?.color || ''}`}>
                                                {TYPE_META[r.type]?.label || r.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-xs text-gray-500 capitalize">{r.source}</td>
                                        <td className="py-3 px-4 text-xs text-gray-500 max-w-xs truncate">{r.notes || '—'}</td>
                                        {canManageRH && (
                                            <td className="py-3 px-4 text-right">
                                                <button onClick={() => handleDelete(r.id)}
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

            {pendingMap && (
                <MappingModal
                    pending={pendingMap.pending}
                    employees={employees}
                    onCancel={() => setPendingMap(null)}
                    onConfirm={handleConfirmMapping}
                />
            )}

            {manualOpen && (
                <ManualEntryModal
                    employees={employees}
                    onClose={() => setManualOpen(false)}
                    onSaved={() => { setManualOpen(false); loadRecords(); }}
                />
            )}
        </div>
    );
}
