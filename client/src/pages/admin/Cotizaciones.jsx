import { useState, useEffect, useCallback } from 'react';
import { FileSignature, Package, UserRound, Store, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import QuotesTab from './cotizaciones/QuotesTab';
import CatalogTab from './cotizaciones/CatalogTab';
import ClientsTab from './cotizaciones/ClientsTab';
import SettingsTab from './cotizaciones/SettingsTab';

const TABS = [
  { key: 'cotizaciones', label: 'Cotizaciones', icon: FileSignature },
  { key: 'catalogo', label: 'Catálogo', icon: Package },
  { key: 'clientes', label: 'Clientes', icon: UserRound },
  { key: 'negocio', label: 'Mi negocio', icon: Store },
];

export default function Cotizaciones() {
  const [tab, setTab] = useState('cotizaciones');
  const [settings, setSettings] = useState(null);
  const [clients, setClients] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const loadClients = useCallback(async () => {
    const { data, error } = await supabase.from('quote_clients').select('*').order('name');
    if (error) setLoadError(error.message); else setClients(data || []);
  }, []);

  const loadCatalog = useCallback(async () => {
    const { data, error } = await supabase.from('quote_catalog').select('*').order('name');
    if (error) setLoadError(error.message); else setCatalog(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('quote_settings').select('*').eq('id', 1).maybeSingle();
      if (error) setLoadError(error.message);
      setSettings(data || {});
      await Promise.all([loadClients(), loadCatalog()]);
      setReady(true);
    })();
  }, [loadClients, loadCatalog]);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <FileSignature className="text-brand-500" /> Cotizaciones
        </h1>
        <p className="text-sm text-slate-400">Arma cotizaciones por partidas con tu catálogo y tus clientes, con o sin IVA, y expórtalas en PDF.</p>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-800/60 bg-amber-950/40 p-4 text-sm text-amber-300">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            No se pudieron cargar los datos del módulo: <span className="font-mono text-xs">{loadError}</span>
            <div className="text-xs text-amber-400/80 mt-1">Si es la primera vez, corre <span className="font-mono">supabase/015_cotizaciones.sql</span> en el SQL Editor de Supabase.</div>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors -mb-px ${
              tab === key ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {ready && (
        <>
          {tab === 'cotizaciones' && (
            <QuotesTab clients={clients} catalog={catalog} settings={settings} onClientsChanged={loadClients} />
          )}
          {tab === 'catalogo' && <CatalogTab catalog={catalog} onChanged={loadCatalog} />}
          {tab === 'clientes' && <ClientsTab clients={clients} onChanged={loadClients} />}
          {tab === 'negocio' && <SettingsTab settings={settings} onSaved={setSettings} />}
        </>
      )}
    </div>
  );
}
