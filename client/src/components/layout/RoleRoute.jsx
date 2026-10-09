import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useRole } from '../../hooks/useRole';

// Bloquea el acceso a una ruta a menos que el rol del usuario esté en `roles`.
// admin y ti siempre pasan. Es una capa de UX/defensa en profundidad:
// la restricción real vive en las políticas RLS de Supabase.
export function RoleRoute({ roles = [], children }) {
    const { role, isAdmin, isTI } = useRole();
    const allowed = isAdmin || isTI || roles.includes(role);

    useEffect(() => {
        if (!allowed) toast.error('No tienes permisos para acceder a esta sección');
    }, [allowed]);

    return allowed ? children : <Navigate to="/dashboard" replace />;
}
