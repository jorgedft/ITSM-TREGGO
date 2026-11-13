import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Monitor, Smartphone, Shield, Network, Wrench, BookOpen, Ticket, AlertCircle,
  Clock, CheckCircle, ArrowRight, ArrowUpRight, Activity, CalendarClock,
  ShieldAlert, Sparkles, FileStack,
} from "lucide-react";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";

const DAY_MS = 86400000;

// Colores de identidad para los estados de equipo (paleta categórica validada
// para fondo oscuro, en orden fijo). El texto nunca usa estos colores.
const ASSET_STATES = [
  { key: "Asignado", label: "Asignados", color: "#3987e5" },
  { key: "En Mantenimiento", label: "En mantenimiento", color: "#d95926" },
  { key: "Disponible", label: "Disponibles", color: "#199e70" },
  { key: "Baja", label: "De baja", color: "#c98500" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - today) / DAY_MS);
}

function formatShortDate(dateStr) {
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// Anima un número de 0 al valor final (se omite si el usuario pide menos movimiento).
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !target) { setValue(target || 0); return undefined; }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function StatCard({ label, value, icon: Icon, tint, glow, sub, to, delay }) {
  const shown = useCountUp(value);
  return (
    <Link
      to={to}
      style={{ animationDelay: `${delay}ms` }}
      className={`dash-rise group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-800/40 backdrop-blur-xl p-4
        transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-xl ${glow}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400`}
    >
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl opacity-25 transition-opacity duration-300 group-hover:opacity-60 ${tint}`} />
      <div className="relative flex items-start justify-between">
        <div className={`${tint} p-3 rounded-xl text-white shadow-lg shadow-black/20 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
          <Icon size={22} />
        </div>
        <ArrowUpRight size={18} className="text-slate-600 transition-all duration-300 group-hover:text-slate-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <p className="relative mt-4 text-3xl font-extrabold tracking-tight text-slate-100 tabular-nums">{shown}</p>
      <p className="relative text-xs font-medium text-slate-400">{label}</p>
      {sub && <p className="relative mt-1 text-[11px] font-semibold text-slate-500 truncate">{sub}</p>}
    </Link>
  );
}

function AssetStatusBar({ counts, total }) {
  const [active, setActive] = useState(null);
  const segments = ASSET_STATES.map((s) => ({ ...s, count: counts[s.key] || 0 })).filter((s) => s.count > 0);
  const known = segments.reduce((sum, s) => sum + s.count, 0);
  const other = total - known;

  if (total === 0) {
    return <p className="text-sm text-slate-500 py-6 text-center">Aún no hay equipos registrados.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-md" role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.count}`).join(", ")}>
        {segments.map((s) => (
          <div
            key={s.key}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            title={`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
            className={`dash-grow h-full min-w-[6px] transition-opacity duration-200 ${active && active !== s.key ? "opacity-30" : "opacity-100"}`}
          />
        ))}
        {other > 0 && (
          <div title={`Otros: ${other}`} style={{ width: `${(other / total) * 100}%` }} className="dash-grow h-full min-w-[6px] bg-slate-600" />
        )}
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {segments.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 ${active === s.key ? "bg-white/5" : ""}`}
          >
            <span className="flex items-center gap-2 text-slate-300 min-w-0">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-semibold text-slate-100 tabular-nums">
              {s.count} <span className="font-normal text-slate-500">· {Math.round((s.count / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const QUICK_ACTIONS = [
  { to: "/assets", label: "Equipos", icon: Monitor, accent: "text-blue-400 group-hover:bg-blue-500/20" },
  { to: "/phones/new", label: "Nueva línea", icon: Smartphone, accent: "text-sky-400 group-hover:bg-sky-500/20" },
  { to: "/licenses/new", label: "Nueva licencia", icon: Shield, accent: "text-emerald-400 group-hover:bg-emerald-500/20" },
  { to: "/vault", label: "Bóveda", icon: BookOpen, accent: "text-purple-400 group-hover:bg-purple-500/20" },
  { to: "/network", label: "Red e IPs", icon: Network, accent: "text-indigo-400 group-hover:bg-indigo-500/20" },
  { to: "/admin/formatos", label: "Formatos", icon: FileStack, accent: "text-amber-400 group-hover:bg-amber-500/20" },
];

const TICKET_STATUS = {
  open: { label: "Abierto", icon: AlertCircle, className: "bg-sky-950/60 text-sky-400 border-sky-800/60" },
  in_progress: { label: "En progreso", icon: Clock, className: "bg-amber-950/60 text-amber-400 border-amber-800/60" },
  waiting: { label: "En espera", icon: Clock, className: "bg-orange-950/60 text-orange-400 border-orange-800/60" },
  resolved: { label: "Resuelto", icon: CheckCircle, className: "bg-emerald-950/60 text-emerald-400 border-emerald-800/60" },
  closed: { label: "Cerrado", icon: CheckCircle, className: "bg-slate-800 text-slate-400 border-slate-700" },
};

const PANEL = "dash-rise rounded-2xl border border-white/10 bg-slate-800/40 backdrop-blur-xl p-5 shadow-xl shadow-black/10";

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    assetCounts: {}, totalAssets: 0, totalPhones: 0, licenses: [], totalMaintenances: 0,
    totalWorkflows: 0, schedules: [], openTickets: 0, tickets: [],
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const results = await Promise.allSettled([
        supabase.from("assets").select("status"),
        supabase.from("phones").select("*", { count: "exact", head: true }),
        supabase.from("licenses").select("id, software_name, expiration_date"),
        supabase.from("maintenance_logs").select("*", { count: "exact", head: true }),
        supabase.from("maintenance_workflows").select("*", { count: "exact", head: true }),
        supabase.from("maintenance_schedules")
          .select("id, title, scheduled_date, asset:assets(asset_tag, asset_code)")
          .eq("status", "pendiente").order("scheduled_date", { ascending: true }).limit(5),
        supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "OPEN"]),
        supabase.from("tickets")
          .select("id, ticket_number, title, status, priority, created_at, requester:profiles!tickets_requester_id_fkey(full_name)")
          .order("created_at", { ascending: false }).limit(5),
      ]);
      const rows = (i) => (results[i].status === "fulfilled" && results[i].value?.data) || [];
      const count = (i) => (results[i].status === "fulfilled" && results[i].value?.count) || 0;

      const assets = rows(0);
      const assetCounts = assets.reduce((acc, a) => {
        const key = a.status || "Disponible";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      setData({
        assetCounts, totalAssets: assets.length, totalPhones: count(1), licenses: rows(2),
        totalMaintenances: count(3), totalWorkflows: count(4), schedules: rows(5),
        openTickets: count(6), tickets: rows(7),
      });
      setLoading(false);
    }
    load();
  }, []);

  const licenseAlerts = data.licenses
    .filter((l) => l.expiration_date)
    .map((l) => ({ ...l, days: daysUntil(l.expiration_date) }))
    .filter((l) => l.days <= 30)
    .sort((a, b) => a.days - b.days);
  const expiredLicenses = licenseAlerts.filter((l) => l.days < 0).length;
  const assigned = data.assetCounts.Asignado || 0;
  const today = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="relative space-y-6 pb-8">
      {/* Encabezado */}
      <div className="dash-rise relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-sky-600/25 via-slate-800/40 to-purple-600/20 backdrop-blur-xl p-6 shadow-xl shadow-black/10">
        <div className="dash-sheen pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/80 capitalize">{today}</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              {greeting()}, {profile?.full_name?.split(" ")[0] || "Usuario"}
            </h1>
            <p className="text-slate-400 text-sm mt-1">Así está hoy la infraestructura y los servicios de TI.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Sistema en línea
            </span>
            <Link to="/tickets/new" className="btn-primary shadow-lg shadow-sky-900/40 transition-transform duration-200 hover:scale-105 active:scale-95">
              <Sparkles size={15} /> Nuevo ticket
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl border border-white/10 bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Equipos" value={data.totalAssets} icon={Monitor} tint="bg-blue-600" glow="hover:shadow-blue-900/40"
            sub={`${assigned} asignados`} to="/assets" delay={60} />
          <StatCard label="Líneas y telefonía" value={data.totalPhones} icon={Smartphone} tint="bg-sky-500" glow="hover:shadow-sky-900/40"
            sub="Dispositivos registrados" to="/phones" delay={120} />
          <StatCard label="Licencias de software" value={data.licenses.length} icon={Shield} tint="bg-emerald-500" glow="hover:shadow-emerald-900/40"
            sub={expiredLicenses > 0 ? `${expiredLicenses} vencidas` : "Ninguna vencida"} to="/licenses" delay={180} />
          <StatCard label="Mantenimientos" value={data.totalMaintenances} icon={Wrench} tint="bg-purple-600" glow="hover:shadow-purple-900/40"
            sub={`${data.totalWorkflows} guías en bóveda`} to="/maintenance" delay={240} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estado del inventario */}
        <div className={`${PANEL} lg:col-span-2`} style={{ animationDelay: "280ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Activity size={18} className="text-sky-400" /> Estado del inventario de equipos
            </h2>
            <Link to="/assets" className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 group">
              Ver equipos <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
          {loading ? <div className="h-24 rounded-xl bg-white/5 animate-pulse" /> : <AssetStatusBar counts={data.assetCounts} total={data.totalAssets} />}
        </div>

        {/* Atención requerida */}
        <div className={PANEL} style={{ animationDelay: "340ms" }}>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
            <ShieldAlert size={18} className="text-amber-400" /> Requiere atención
          </h2>
          <ul className="space-y-2">
            {licenseAlerts.slice(0, 3).map((l) => (
              <li key={l.id}>
                <Link to="/licenses" className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 transition-all duration-200 hover:border-white/25 hover:bg-white/5 hover:translate-x-1">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-200 truncate">{l.software_name}</span>
                    <span className="block text-[11px] text-slate-500">Licencia · vence {formatShortDate(l.expiration_date)}</span>
                  </span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${l.days < 0 ? "bg-red-950/60 text-red-400 border-red-800/60" : "bg-amber-950/60 text-amber-400 border-amber-800/60"}`}>
                    {l.days < 0 ? "Vencida" : l.days === 0 ? "Hoy" : `${l.days} d`}
                  </span>
                </Link>
              </li>
            ))}
            {data.schedules.slice(0, 3).map((s) => {
              const days = daysUntil(s.scheduled_date);
              return (
                <li key={s.id}>
                  <Link to="/maintenance" className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 transition-all duration-200 hover:border-white/25 hover:bg-white/5 hover:translate-x-1">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-200 truncate">{s.title}</span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        <CalendarClock size={11} className="inline mr-1 -mt-0.5" />
                        {s.asset?.asset_tag || s.asset?.asset_code || "Equipo"} · {formatShortDate(s.scheduled_date)}
                      </span>
                    </span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${days < 0 ? "bg-red-950/60 text-red-400 border-red-800/60" : "bg-sky-950/60 text-sky-400 border-sky-800/60"}`}>
                      {days < 0 ? "Atrasado" : days === 0 ? "Hoy" : `${days} d`}
                    </span>
                  </Link>
                </li>
              );
            })}
            {!loading && licenseAlerts.length === 0 && data.schedules.length === 0 && (
              <li className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle size={28} className="text-emerald-400" />
                <span className="text-sm text-slate-400">Todo al día: sin licencias por vencer ni mantenimientos pendientes.</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="dash-rise space-y-3" style={{ animationDelay: "400ms" }}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map(({ to, label, icon: Icon, accent }) => (
            <Link key={to} to={to}
              className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-slate-800/40 backdrop-blur-xl p-3.5 text-center
                transition-all duration-200 hover:-translate-y-1 hover:border-white/25 hover:shadow-lg hover:shadow-black/20 active:scale-95">
              <span className={`p-2.5 rounded-lg bg-black/20 transition-all duration-200 group-hover:scale-110 ${accent}`}>
                <Icon size={20} />
              </span>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-slate-100">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Tickets recientes */}
      <div className={PANEL} style={{ animationDelay: "460ms" }}>
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Ticket size={18} className="text-sky-400" /> Tickets recientes
            {data.openTickets > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-sky-950/60 text-sky-400 border-sky-800/60">
                {data.openTickets} abiertos
              </span>
            )}
          </h2>
          <Link to="/tickets" className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 group">
            Ver todos <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
        {data.tickets.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">No hay tickets registrados todavía.</p>
            <Link to="/tickets/new" className="mt-2 inline-block text-xs font-semibold text-sky-400 hover:text-sky-300">Crear el primero</Link>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.tickets.map((t) => {
              const meta = TICKET_STATUS[String(t.status || "open").toLowerCase()] || TICKET_STATUS.open;
              const StatusIcon = meta.icon;
              return (
                <li key={t.id}>
                  <Link to={`/tickets/${t.id}`} className="group flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-white/5">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-200 truncate group-hover:text-white">{t.title}</span>
                      <span className="block text-[11px] text-slate-500">
                        {t.requester?.full_name || "Sin solicitante"} · {new Date(t.created_at).toLocaleDateString("es-MX")}
                      </span>
                    </span>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${meta.className}`}>
                      <StatusIcon size={12} /> {meta.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
