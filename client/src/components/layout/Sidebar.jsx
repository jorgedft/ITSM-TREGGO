import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Monitor, Smartphone, FileText,
    Ticket, Shield, Network, Wrench, LogOut, ChevronLeft, Key,
    Users, CalendarCheck, Plane, Receipt, Briefcase, Settings, Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../hooks/useRole';
import logoEmpresa from '../../assets/logo.png'; // 👈 Importación directa

const NAV_PANEL = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const NAV_RH = [
    { to: '/rh/colaboradores',   label: 'Colaboradores',             icon: Users },
    { to: '/rh/asistencia',      label: 'Incidencias y Asistencia',  icon: CalendarCheck },
    { to: '/rh/vacaciones',      label: 'Vacaciones y Permisos',     icon: Plane },
    { to: '/rh/nominas',         label: 'Nóminas y Recibos',         icon: Receipt },
    { to: '/rh/reclutamiento',   label: 'Reclutamiento / Vacantes',  icon: Briefcase },
];

const NAV_TI = [
    { to: '/assets',      label: 'Equipos',       icon: Monitor },
    { to: '/phones',      label: 'Telefonía',     icon: Smartphone },
    { to: '/licenses',    label: 'Licencias',     icon: Shield },
    { to: '/vault',       label: 'Bóveda',        icon: Key },
    { to: '/network',     label: 'Red / IPs',     icon: Network },
    { to: '/maintenance', label: 'Mantenimiento', icon: Wrench },
];

const NAV_ADMIN = [
    { to: '/admin', label: 'Administración', icon: Settings },
];

function NavSection({ title, items, readOnly, collapsed }) {
    return (
        <div className="space-y-0.5">
            {title && !collapsed && (
                <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {title}
                </p>
            )}
            {items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150
                        ${isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`
                    }
                    title={collapsed ? label : undefined}>
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{label}</span>}
                    {readOnly && !collapsed && <Lock size={12} className="shrink-0 text-gray-500" title="Solo lectura" />}
                </NavLink>
            ))}
        </div>
    );
}

export function Sidebar({ collapsed, onToggle }) {
    const { profile, signOut } = useAuth();
    const { isAdmin, isTI, canManageTI } = useRole();

    return (
        <aside className={`flex flex-col bg-gray-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} min-h-screen shrink-0`}>

            {/* Logo y Encabezado */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
                {!collapsed ? (
                    <div className="flex flex-col gap-2">
                        {/* Texto ITSM | TI */}
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-base">
                                <span className="text-brand-400">ITSM</span>
                                <span className="text-gray-400 font-light"> | TI</span>
                            </span>
                        </div>
                        {/* Logo Ubicado Debajo */}
                        <img 
                            src={logoEmpresa} 
                            alt="Logo Empresa" 
                            className="h-8 w-auto object-contain mt-1" 
                        />
                    </div>
                ) : (
                    /* Vista cuando el Sidebar está colapsado */
                    <div className="mx-auto">
                        <img 
                            src={logoEmpresa} 
                            alt="Logo" 
                            className="h-6 w-auto object-contain" 
                        />
                    </div>
                )}

                <button onClick={onToggle}
                    className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors ml-auto">
                    <ChevronLeft size={16}
                        className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-2 overflow-y-auto">
                <NavSection items={NAV_PANEL} collapsed={collapsed} />
                <NavSection title="Recursos Humanos" items={NAV_RH} collapsed={collapsed} />
                <NavSection
                    title="Infraestructura y TI"
                    items={NAV_TI}
                    collapsed={collapsed}
                    readOnly={!canManageTI}
                />
                {(isAdmin || isTI) && (
                    <NavSection title="Administración" items={NAV_ADMIN} collapsed={collapsed} />
                )}
            </nav>

            {/* User */}
            <div className="border-t border-gray-700 px-3 py-4 space-y-2">
                {!collapsed && profile && (
                    <div className="px-1 pb-1">
                        <p className="text-sm font-semibold text-white truncate">{profile.full_name}</p>
                        <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                    </div>
                )}
                <button onClick={signOut}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors text-sm"
                    title={collapsed ? 'Cerrar sesión' : undefined}>
                    <LogOut size={18} className="shrink-0" />
                    {!collapsed && <span>Cerrar sesión</span>}
                </button>
            </div>
        </aside>
    );
}