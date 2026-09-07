import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Monitor, Smartphone, Ticket, Shield, Network, Wrench, FileText, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`${color} p-3 rounded-xl shrink-0`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({});
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: totalAssets },
        { count: assignedAssets },
        { count: totalPhones },
        { count: openTickets },
        { count: inProgress },
        { count: totalLicenses },
        { count: expiredLicenses },
        { data: recentTickets },
      ] = await Promise.all([
        supabase.from("assets").select("*",{count:"exact",head:true}),
        supabase.from("assets").select("*",{count:"exact",head:true}).eq("status","assigned"),
        supabase.from("phones").select("*",{count:"exact",head:true}),
        supabase.from("tickets").select("*",{count:"exact",head:true}).eq("status","open"),
        supabase.from("tickets").select("*",{count:"exact",head:true}).eq("status","in_progress"),
        supabase.from("software_licenses").select("*",{count:"exact",head:true}),
        supabase.from("software_licenses").select("*",{count:"exact",head:true}).eq("status","expired"),
        supabase.from("tickets")
          .select("id,ticket_number,title,status,priority,category,created_at,requester:profiles!tickets_requester_id_fkey(full_name)")
          .order("created_at",{ascending:false}).limit(5),
      ]);
      setStats({ totalAssets, assignedAssets, totalPhones, openTickets, inProgress, totalLicenses, expiredLicenses });
      setTickets(recentTickets || []);
      setLoading(false);
    }
    load();
  }, []);

  const stIcon = {
    open:<AlertCircle size={14} className="text-blue-500"/>,
    in_progress:<Clock size={14} className="text-yellow-500"/>,
    resolved:<CheckCircle size={14} className="text-green-500"/>,
    closed:<CheckCircle size={14} className="text-gray-400"/>,
    waiting:<Clock size={14} className="text-orange-400"/>,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {profile?.full_name?.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Panel de control — Departamento de TI</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_,i) => <div key={i} className="card h-24 animate-pulse bg-gray-100"/>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Equipos"    value={stats.totalAssets}    icon={Monitor}    color="bg-brand-500" sub={`${stats.assignedAssets} asignados`}/>
          <StatCard label="Telefonos"        value={stats.totalPhones}    icon={Smartphone}  color="bg-sky-500"/>
          <StatCard label="Licencias"        value={stats.totalLicenses}  icon={Shield}      color="bg-emerald-500" sub={stats.expiredLicenses > 0 ? `⚠️ ${stats.expiredLicenses} expiradas` : "Al dia"}/>
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Accesos rapidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { to:"/assets/new",      label:"Nuevo Equipo",   icon:Monitor,   color:"bg-brand-50 text-brand-600 hover:bg-brand-100" },
            { to:"/phones/new",      label:"Nuevo Telefono", icon:Smartphone, color:"bg-sky-50 text-sky-600 hover:bg-sky-100" },
            { to:"/licenses/new",    label:"Licencia",       icon:Shield,     color:"bg-emerald-50 text-emerald-600 hover:bg-emerald-100" },
            { to:"/network",         label:"Red / IPs",      icon:Network,    color:"bg-gray-50 text-gray-600 hover:bg-gray-100" },
          ].map(({ to, label, icon: Icon, color }) => (
            <Link key={to} to={to}
              className={`${color} flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 transition-colors text-sm font-medium`}>
              <Icon size={22}/><span className="text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">Tickets recientes</h2>
          <Link to="/tickets" className="text-sm text-brand-600 hover:underline">Ver todos</Link>
        </div>
        <div className="card p-0 overflow-hidden">
          {tickets.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Sin tickets recientes</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Ticket</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Titulo</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Solicitante</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/tickets/${t.id}`} className="font-mono text-brand-600 hover:underline text-xs">{t.ticket_number}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{t.title}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.requester?.full_name}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs">
                        {stIcon[t.status]}<span className="capitalize">{t.status?.replace("_"," ")}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        t.priority==="critical"?"text-red-600":t.priority==="high"?"text-orange-600":
                        t.priority==="medium"?"text-blue-600":"text-green-600"}`}>
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
    </div>
  );
}