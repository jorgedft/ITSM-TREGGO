import { useState, useEffect } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { supabase } from '../../services/supabase';
import RecordsTab from './registros/RecordsTab';
import { FORMATS } from './registros/formats';

export default function RegistrosTI() {
  const [active, setActive] = useState(FORMATS[0].key);
  const [people, setPeople] = useState([]);
  const format = FORMATS.find((f) => f.key === active);

  // Sugerencias de nombres (usuarios del sistema + colaboradores) para los campos de persona.
  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: employees }] = await Promise.all([
        supabase.from('profiles').select('full_name'),
        supabase.from('employees').select('full_name'),
      ]);
      const names = [...(profiles || []), ...(employees || [])].map((p) => p.full_name).filter(Boolean);
      setPeople([...new Set(names)].sort((a, b) => a.localeCompare(b)));
    })();
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ClipboardCheck className="text-brand-500" /> Registros de TI
        </h1>
        <p className="text-sm text-slate-400">
          Altas y bajas, accesos, incidentes, responsivas, respaldos y visitas de proveedores: captura, historial e impresión.
        </p>
      </div>

      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {FORMATS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors -mb-px ${
              active === key ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <datalist id="registros-people">
        {people.map((name) => <option key={name} value={name} />)}
      </datalist>

      <RecordsTab key={format.key} format={format} />
    </div>
  );
}
