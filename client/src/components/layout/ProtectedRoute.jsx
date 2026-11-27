import { Navigate, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute() {
    const { user, profile, loading, signOut } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                    <p className="text-sm text-gray-500">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;

    // Cuenta sin rol asignado (o desactivada): no entra a ningún módulo hasta que un admin la apruebe.
    if (!profile?.role || profile.is_active === false) {
        const disabled = profile?.is_active === false;
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
                <div className="bg-slate-900 border border-white/10 shadow-2xl rounded-xl max-w-md w-full p-8 text-center space-y-4">
                    <ShieldAlert size={40} className="mx-auto text-amber-400" />
                    <h1 className="text-xl font-bold text-slate-100">
                        {disabled ? 'Cuenta desactivada' : 'Cuenta pendiente de aprobación'}
                    </h1>
                    <p className="text-sm text-slate-400">
                        {disabled
                            ? 'Tu cuenta fue desactivada. Contacta al administrador de TI.'
                            : 'Tu cuenta ya existe, pero aún no tiene permisos asignados. Pide al administrador de TI que la apruebe y vuelve a iniciar sesión.'}
                    </p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    <button onClick={signOut} className="btn-secondary text-sm">Cerrar sesión</button>
                </div>
            </div>
        );
    }

    return <Outlet />;
}
