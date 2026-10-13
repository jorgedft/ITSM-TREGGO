import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Monitor, Smartphone, FileText,
    Ticket, Shield, Network, Wrench, LogOut, ChevronLeft, Key,
    Users, CalendarCheck, Plane, Receipt, Briefcase, Settings, Lock,
    ChevronDown, X
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

// Sección simple, sin acordeón (Panel, Administración: pocos items, no necesitan plegarse).
function NavSection({ title, items, collapsed, onNavigate }) {
    return (
        <div className="space-y-0.5">
            {title && !collapsed && (
                <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {title}
                </p>
            )}
            {items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={onNavigate}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150
                        ${isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`
                    }
                    title={collapsed ? label : undefined}>
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{label}</span>}
                </NavLink>
            ))}
        </div>
    );
}

// Sección plegable tipo acordeón ("Gestión de TI" / "Gestión de RH").
// `blocked` = el usuario no tiene acceso a ninguno de estos módulos: se listan
// como referencia pero no son clicables (el candado es real, no solo visual).
function AccordionSection({ title, items, collapsed, blocked, defaultOpen = true, onNavigate }) {
    const [open, setOpen] = useState(defaultOpen);

    if (collapsed) {
        // Sidebar colapsado a iconos (solo en escritorio): sin encabezado plegable.
        return (
            <div className="space-y-0.5 pt-2">
                {items.map(({ to, label, icon: Icon }) =>
                    blocked ? (
                        <div key={to} title={`${label} (sin acceso)`}
                            className="flex items-center justify-center px-3 py-2.5 rounded-lg text-gray-600 cursor-not-allowed">
                            <Icon size={18} className="shrink-0" />
                        </div>
                    ) : (
                        <NavLink key={to} to={to} title={label} onClick={onNavigate}
                            className={({ isActive }) =>
                                `flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150
                                ${isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`
                            }>
                            <Icon size={18} className="shrink-0" />
                        </NavLink>
                    )
                )}
            </div>
        );
    }

    return (
        <div className="pt-2">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
            >
                <span className="flex items-center gap-1.5">
                    {title}
                    {blocked && <Lock size={10} />}
                </span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="space-y-0.5">
                    {items.map(({ to, label, icon: Icon }) =>
                        blocked ? (
                            <div key={to}
                                title="No tienes acceso a este módulo"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 cursor-not-allowed select-none">
                                <Icon size={18} className="shrink-0" />
                                <span className="flex-1 truncate">{label}</span>
                                <Lock size={12} className="shrink-0" />
                            </div>
                        ) : (
                            <NavLink key={to} to={to} onClick={onNavigate}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150
                                    ${isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`
                                }>
                                <Icon size={18} className="shrink-0" />
                                <span className="flex-1 truncate">{label}</span>
                            </NavLink>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

// Bloque de navegación completo. `collapsed` solo tiene sentido en escritorio
// (modo iconos); en el cajón móvil siempre se usa collapsed=false.
function NavContent({ collapsed, canManageTI, isAdmin, isTI, onNavigate }) {
    return (
        <nav className="flex-1 px-2 py-2 overflow-y-auto">
            <NavSection items={NAV_PANEL} collapsed={collapsed} onNavigate={onNavigate} />
            <AccordionSection title="Gestión de RH" items={NAV_RH} collapsed={collapsed} onNavigate={onNavigate} />
            <AccordionSection
                title="Gestión de TI"
                items={NAV_TI}
                collapsed={collapsed}
                blocked={!canManageTI}
                onNavigate={onNavigate}
            />
            {(isAdmin || isTI) && (
                <NavSection title="Administración" items={NAV_ADMIN} collapsed={collapsed} onNavigate={onNavigate} />
            )}
        </nav>
    );
}

export function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }) {
    const { profile, signOut } = useAuth();
    const { isAdmin, isTI, canManageTI } = useRole();

    return (
        <>
            {/* Fondo oscuro al abrir el cajón en móvil */}
            {mobileOpen && (
                <div onClick={onMobileClose} className="fixed inset-0 bg-black/50 z-40 lg:hidden" />
            )}

            <aside className={`
                flex flex-col bg-gray-900 text-white
                fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:static lg:translate-x-0 lg:transition-[width] lg:duration-300 lg:z-auto
                ${collapsed ? 'lg:w-16' : 'lg:w-64'}
                min-h-screen shrink-0
            `}>

                {/* Logo y Encabezado */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700 shrink-0">
                    <div className={collapsed ? 'lg:hidden' : ''}>
                        <span className="font-bold text-base">
                            <span className="text-brand-400">ITSM</span>
                            <span className="text-gray-400 font-light"> | TI</span>
                        </span>
                        <img src={logoEmpresa} alt="Logo Empresa" className="h-8 w-auto object-contain mt-1" />
                    </div>
                    {collapsed && (
                        <img src={logoEmpresa} alt="Logo" className="hidden lg:block mx-auto h-6 w-auto object-contain" />
                    )}

                    {/* Colapsar a iconos (solo escritorio) */}
                    <button onClick={onToggle}
                        className="hidden lg:block p-1.5 rounded-lg hover:bg-gray-700 transition-colors ml-auto">
                        <ChevronLeft size={16} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Cerrar cajón (solo móvil) */}
                    <button onClick={onMobileClose}
                        className="lg:hidden p-1.5 rounded-lg hover:bg-gray-700 transition-colors ml-auto">
                        <X size={18} />
                    </button>
                </div>

                {/* Nav móvil: siempre expandido dentro del cajón */}
                <div className="flex-1 overflow-y-auto lg:hidden">
                    <NavContent collapsed={false} canManageTI={canManageTI} isAdmin={isAdmin} isTI={isTI} onNavigate={onMobileClose} />
                </div>

                {/* Nav escritorio: respeta el modo colapsado a iconos */}
                <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:overflow-y-auto">
                    <NavContent collapsed={collapsed} canManageTI={canManageTI} isAdmin={isAdmin} isTI={isTI} />
                </div>

                {/* User */}
                <div className="border-t border-gray-700 px-3 py-4 space-y-2 shrink-0">
                    {profile && (
                        <div className={`px-1 pb-1 ${collapsed ? 'lg:hidden' : ''}`}>
                            <p className="text-sm font-semibold text-white truncate">{profile.full_name}</p>
                            <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                        </div>
                    )}
                    <button onClick={signOut}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors text-sm">
                        <LogOut size={18} className="shrink-0" />
                        <span className={collapsed ? 'lg:hidden' : ''}>Cerrar sesión</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
