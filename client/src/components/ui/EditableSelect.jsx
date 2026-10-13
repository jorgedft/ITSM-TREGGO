import { useState } from 'react';
import { Check, X } from 'lucide-react';

const CUSTOM_FLAG = '__custom__';

// <select> que admite escribir un valor manual (texto o número) cuando
// ninguna opción de la lista aplica. Si el valor actual no está en
// `options`, se agrega automáticamente para no perderlo (útil con datos
// ya guardados que no coinciden con el catálogo predefinido).
export function EditableSelect({ name, value, onChange, options, placeholder = 'Escribe un valor...', className = 'input-field' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    const normalized = options.map((opt) => (typeof opt === 'object' ? opt : { value: opt, label: opt }));
    const hasValue = normalized.some((opt) => opt.value === value);
    const allOptions = hasValue || !value ? normalized : [...normalized, { value, label: value }];

    const commitCustom = () => {
        const trimmed = draft.trim();
        setEditing(false);
        setDraft('');
        if (trimmed) onChange({ target: { name, value: trimmed } });
    };

    if (editing) {
        return (
            <div className="flex gap-1.5">
                <input
                    type="text"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitCustom(); }
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    placeholder={placeholder}
                    className={className}
                />
                <button type="button" onClick={commitCustom} className="px-2 text-emerald-600 hover:text-emerald-700" title="Confirmar">
                    <Check size={18} />
                </button>
                <button type="button" onClick={() => setEditing(false)} className="px-2 text-gray-400 hover:text-gray-600" title="Cancelar">
                    <X size={18} />
                </button>
            </div>
        );
    }

    return (
        <select
            name={name}
            value={value}
            onChange={(e) => {
                if (e.target.value === CUSTOM_FLAG) setEditing(true);
                else onChange(e);
            }}
            className={className}
        >
            {allOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
            <option value={CUSTOM_FLAG}>➕ Agregar opción personalizada...</option>
        </select>
    );
}
