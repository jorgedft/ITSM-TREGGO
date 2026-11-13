import { Users, CalendarCheck, Plane, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function StatCard({ label, icon: Icon, color, sub }) {
    return (
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-4">
            <div className={`${color} p-3.5 rounded-xl text-white shrink-0 shadow-sm`}>
                <Icon size={24} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-2xl font-extrabold text-slate-100 tracking-tight">—</p>
                <p className="text-xs font-medium text-slate-400 truncate">{label}</p>
                {sub && <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">{sub}</p>}
            </div>
        </div>
    );
}

export default function DashboardRH() {
    const { profile } = useAuth();

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-2xl">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
                        Bienvenido, {profile?.full_name?.split(' ')[0] || 'Usuario'} 👋
                    </h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Panel de Control — Recursos Humanos
                    </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    En Linea
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Colaboradores" icon={Users} color="bg-blue-600" sub="Próximamente" />
                <StatCard label="Incidencias / Asistencia" icon={CalendarCheck} color="bg-amber-500" sub="Próximamente" />
                <StatCard label="Vacaciones Pendientes" icon={Plane} color="bg-emerald-500" sub="Próximamente" />
                <StatCard label="Pre-nómina" icon={Receipt} color="bg-purple-600" sub="Próximamente" />
            </div>

            <div className="glass-panel rounded-2xl p-6 text-center">
                <p className="text-sm text-slate-400">
                    Los módulos de Recursos Humanos están en construcción. Las métricas aparecerán aquí
                    conforme se vayan habilitando Colaboradores, Asistencia, Vacaciones, Nómina y Reclutamiento.
                </p>
            </div>
        </div>
    );
}
