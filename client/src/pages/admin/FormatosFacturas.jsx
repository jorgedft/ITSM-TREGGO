import { useState } from 'react';
import { FileStack, ClipboardList, FileText, Archive } from 'lucide-react';
import SolicitudCompraForm from './formatos/SolicitudCompraForm';
import OrdenCompraForm from './formatos/OrdenCompraForm';
import DocumentVault from './formatos/DocumentVault';

const TABS = [
  { key: 'solicitud', label: 'Solicitud de Compra', icon: ClipboardList },
  { key: 'orden', label: 'Orden de Compra', icon: FileText },
  { key: 'boveda', label: 'Bóveda de Documentos', icon: Archive },
];

export default function FormatosFacturas() {
  const [tab, setTab] = useState('solicitud');

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <FileStack className="text-brand-500" /> Formatos y Facturas
        </h1>
        <p className="text-sm text-slate-400">
          Llena y exporta solicitudes/órdenes de compra, e imprime o guarda facturas y cotizaciones en la bóveda documental.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-white/10">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'solicitud' && <SolicitudCompraForm />}
      {tab === 'orden' && <OrdenCompraForm />}
      {tab === 'boveda' && <DocumentVault />}
    </div>
  );
}
