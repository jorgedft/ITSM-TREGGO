import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar }  from './Navbar';

export function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            <Sidebar
                collapsed={collapsed}
                onToggle={() => setCollapsed(c => !c)}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <Navbar onMenuToggle={() => setMobileOpen(o => !o)} />
                <main className="flex-1 overflow-y-auto p-3 sm:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
