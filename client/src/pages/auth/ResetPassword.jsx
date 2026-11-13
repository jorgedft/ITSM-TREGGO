import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Cpu } from 'lucide-react';
import { supabase } from '../../services/supabase';

export default function ResetPassword() {
    const [email,   setEmail]   = useState('');
    const [sent,    setSent]    = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/update-password`,
        });
        setSent(true);
        setLoading(false);
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-slate-900 px-4 overflow-hidden">
            {/* Fondo decorativo ambiental (igual que Login y el Dashboard) */}
            <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-sky-600/20 rounded-full blur-3xl" />
                <div className="absolute top-1/3 -right-24 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-sky-600 rounded-2xl mb-4">
                        <Cpu size={28} className="text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-100">Recuperar contraseña</h1>
                </div>
                {sent ? (
                    <div className="text-center text-sm text-slate-300">
                        <p>✅ Revisa tu correo <strong className="text-slate-100">{email}</strong> para restablecer tu contraseña.</p>
                        <Link to="/login" className="mt-4 inline-block text-sky-400 hover:text-sky-300 hover:underline">Volver al login</Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="label">Correo electrónico</label>
                            <div className="relative">
                                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="email" required className="input-field pl-9"
                                    placeholder="usuario@empresa.com"
                                    value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary w-full">
                            {loading ? 'Enviando...' : 'Enviar enlace'}
                        </button>
                        <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-slate-200 mt-2">
                            <ArrowLeft size={14} /> Volver al login
                        </Link>
                    </form>
                )}
            </div>
        </div>
    );
}