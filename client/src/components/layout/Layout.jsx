import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar }  from './Navbar';

export function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { pathname } = useLocation();

    return (
        <div className="relative isolate flex h-screen overflow-hidden bg-transparent">
            {/* Fondo ambiental compartido por todos los módulos (da profundidad al vidrio) */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="dash-float absolute -top-24 -left-24 w-96 h-96 bg-sky-600/20 rounded-full blur-3xl" />
                <div className="dash-float absolute top-1/3 -right-24 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" style={{ animationDelay: '-6s' }} />
                <div className="dash-float absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl" style={{ animationDelay: '-11s' }} />
            </div>
            <Sidebar
                collapsed={collapsed}
                onToggle={() => setCollapsed(c => !c)}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <Navbar onMenuToggle={() => setMobileOpen(o => !o)} />
                <main className="flex-1 overflow-y-auto p-3 sm:p-6">
                    <div key={pathname} className="page-fade">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
