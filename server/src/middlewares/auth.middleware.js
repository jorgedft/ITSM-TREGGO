import { supabase, supabaseAdmin } from '../config/supabaseClient.js';

export async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autorización requerido' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, department, full_name, is_active')
        .eq('id', user.id)
        .single();

    if (profile && profile.is_active === false) {
        return res.status(403).json({ error: 'Cuenta desactivada' });
    }

    req.user = { ...user, role: profile?.role ?? null, department: profile?.department ?? null };
    next();
}

// Restringe la ruta a los roles indicados. 'admin' y 'ti' siempre tienen acceso total.
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (role === 'admin' || role === 'ti' || allowedRoles.includes(role)) {
            return next();
        }
        return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    };
}