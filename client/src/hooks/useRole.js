import { useAuth } from '../context/AuthContext';

// admin y ti tienen acceso total a todos los módulos (TI y RH).
// rh tiene acceso total a RH y solo lectura en los módulos de TI.
export function useRole() {
    const { profile } = useAuth();
    const role = profile?.role ?? null;
    const isAdmin = role === 'admin';
    const isTI = role === 'ti';
    const isRH = role === 'rh';
    const canManageTI = isAdmin || isTI;
    const canManageRH = isAdmin || isTI || isRH;

    return { role, isAdmin, isTI, isRH, canManageTI, canManageRH };
}
