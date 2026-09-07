import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Monitor,
  Smartphone,
  Shield,
  Network,
  Wrench,
  BookOpen,
  Ticket,
  AlertCircle,
  Clock,
  CheckCircle,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity
} from "lucide-react";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";

// Tarjeta de Estadística Reutilizable
function StatCard({ label, value, icon: Icon, color, sub, to }) {
  const content = (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-4">
      <div className={`${color} p-3.5 rounded-xl text-white shrink-0 shadow-sm`}>
        <Icon size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
          {value ?? "—"}
        </p>
        <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
        {sub && (
          <p className="text-[11px] font-semibold text-gray-400 mt-0.5 truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalAssets: 0,
    assignedAssets: 0,
    totalPhones: 0,
    totalLicenses: 0,
    expiredLicenses: 0,
    totalWorkflows: 0,
    totalMaintenances: 0,
    openTickets: 0,
  });
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);

      try {
        const results = await Promise.allSettled([
          supabase.from("assets").select("*", { count: "exact", head: true }),
          supabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "assigned"),
          supabase.from("phones").select("*", { count: "exact", head: true }),
          supabase.from("software_licenses").select("*", { count: "exact", head: true }),
          supabase.from("software_licenses").select("*", { count: "exact", head: true }).eq("status", "expired"),
          supabase.from("maintenance_workflows").select("*", { count: "exact", head: true }),
          supabase.from("maintenance_logs").select("*", { count: "exact", head: true }),
          supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
          supabase.from("tickets")
            .select("id, ticket_number, title, status, priority, category, created_at, requester:profiles!tickets_requester_id_fkey(full_name)")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        const getValue = (res) => (res.status === "fulfilled" && res.value?.count !== null ? res.value.count : 0);
        const getRecentTickets = (res) => (res.status === "fulfilled" && res.value?.data ? res.value.data : []);

        setStats({
          totalAssets: getValue(results[0]),
          assignedAssets: getValue(results[1]),
          totalPhones: getValue(results[2]),
          totalLicenses: getValue(results[3]),
          expiredLicenses: getValue(results[4]),
          totalWorkflows: getValue(results[5]),
          totalMaintenances: getValue(results[6]),
          openTickets: getValue(results[7]),
        });

        setTickets(getRecentTickets(results[8]));
      } catch (err) {
        console.error("Error al cargar métricas del Dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const statusIcons = {
    open: <AlertCircle size={14} className="text-blue-500" />,
    in_progress: <Clock size={14} className="text-amber-500" />,
    resolved: <CheckCircle size={14} className="text-emerald-500" />,
    closed: <CheckCircle size={14} className="text-gray-400" />,
    waiting: <Clock size={14} className="text-orange-400" />,
  };

  const statusBadges = {
    open: "bg-blue-50 text-blue-700 border-blue-200",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    closed: "bg-gray-100 text-gray-600 border-gray-200",
    waiting: "bg-orange-50 text-orange-700 border-orange-200",
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Saludo y Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Bienvenido, {profile?.full_name?.split(" ")[0] || "Usuario"} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Panel de Control General — Infraestructura y Servicios de TI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            En Linea
          </span>
        </div>
      </div>

      {/* Grid de KPIs / Estadísticas principales */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Equipos"
            value={stats.totalAssets}
            icon={Monitor}
            color="bg-blue-600"
            sub={`${stats.assignedAssets} asignados`}
            to="/assets"
          />
          <StatCard
            label="Líneas y Telefonía"
            value={stats.totalPhones}
            icon={Smartphone}
            color="bg-sky-500"
            sub="Dispositivos activos"
            to="/phones"
          />
          <StatCard
            label="Licencias Software"
            value={stats.totalLicenses}
            icon={Shield}
            color="bg-emerald-500"
            sub={
              stats.expiredLicenses > 0
                ? `⚠️ ${stats.expiredLicenses} expiradas`
                : "Al día"
            }
            to="/licenses"
          />
          <StatCard
            label="Mantenimientos / Servicios"
            value={stats.totalMaintenances}
            icon={Wrench}
            color="bg-purple-600"
            sub={`${stats.totalWorkflows} guías en bóveda`}
            to="/maintenance"
          />
        </div>
      )}

      {/* Accesos Rápidos Modulares */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
          <Activity size={16} /> Accesos Rápidos a Módulos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { to: "/assets/new", label: "Nuevo Equipo", icon: Monitor, color: "hover:border-blue-300 hover:bg-blue-50/50 text-blue-600" },
            { to: "/phones/new", label: "Nueva Línea", icon: Smartphone, color: "hover:border-sky-300 hover:bg-sky-50/50 text-sky-600" },
            { to: "/licenses/new", label: "Nueva Licencia", icon: Shield, color: "hover:border-emerald-300 hover:bg-emerald-50/50 text-emerald-600" },
            { to: "/vault", label: "Bóveda Guías", icon: BookOpen, color: "hover:border-purple-300 hover:bg-purple-50/50 text-purple-600" },
            { to: "/network", label: "Red & IPs", icon: Network, color: "hover:border-indigo-300 hover:bg-indigo-50/50 text-indigo-600" },
            { to: "/maintenance", label: "Servicios TI", icon: Wrench, color: "hover:border-amber-300 hover:bg-amber-50/50 text-amber-600" },
          ].map(({ to, label, icon: Icon, color }) => (
            <Link
              key={to}
              to={to}
              className={`bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-all duration-150 shadow-sm group ${color}`}
            >
              <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-white transition-colors">
                <Icon size={20} />
              </div>
              <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 leading-tight">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Sección Inferior: Tickets Recientes + Resumen de Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lista de Tickets Recientes (2 Columnas) */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Ticket size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Tickets Recientes</h2>
            </div>
            <Link
              to="/tickets"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
            >
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            {tickets.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400 text-sm">No hay tickets registrados recientemente.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Título</th>
                    <th className="py-2.5 px-3">Solicitante</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Prioridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <Link
                          to={`/tickets/${t.id}`}
                          className="font-mono font-semibold text-blue-600 hover:underline"
                        >
                          {t.ticket_number}
                        </Link>
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-800 max-w-[180px] truncate">
                        {t.title}
                      </td>
                      <td className="py-3 px-3 text-gray-500">
                        {t.requester?.full_name || "N/A"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium capitalize ${
                            statusBadges[t.status] || "bg-gray-50 text-gray-600 border-gray-200"
                          }`}
                        >
                          {statusIcons[t.status]}
                          {t.status?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`font-semibold capitalize ${
                            t.priority === "critical"
                              ? "text-red-600"
                              : t.priority === "high"
                              ? "text-orange-600"
                              : t.priority === "medium"
                              ? "text-blue-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Resumen de Estado / Alertas de Soporte (1 Columna) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <TrendingUp size={18} className="text-purple-600" />
            <h2 className="text-base font-bold text-gray-900">Resumen de Soporte</h2>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Tickets Abiertos</span>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                {stats.openTickets}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Licencias Vencidas</span>
              <span
                className={`text-sm font-bold px-2.5 py-0.5 rounded-full border ${
                  stats.expiredLicenses > 0
                    ? "text-red-600 bg-red-50 border-red-100"
                    : "text-emerald-600 bg-emerald-50 border-emerald-100"
                }`}
              >
                {stats.expiredLicenses}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Equipos Asignados</span>
              <span className="text-sm font-bold text-gray-800">
                {stats.totalAssets > 0
                  ? `${Math.round((stats.assignedAssets / stats.totalAssets) * 100)}%`
                  : "0%"}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/maintenance"
              className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors border border-purple-100"
            >
              <Wrench size={14} /> Registrar Mantenimiento
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}