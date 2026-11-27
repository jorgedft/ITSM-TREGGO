import { useState, useEffect } from 'react';
import { Lock, Unlock, ShieldCheck, KeyRound, Copy, Check, Download, X, AlertTriangle, History } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { checkPhrase } from './vaultCrypto';

function Shell({ title, icon: Icon = Lock, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className={`bg-slate-900 border border-white/10 shadow-2xl rounded-xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto`}>
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-bold text-slate-100 flex items-center gap-2"><Icon size={18} className="text-brand-500" /> {title}</h3>
          {onClose && <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-500 hover:text-slate-300"><X size={18} /></button>}
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

const Field = ({ label, hint, ...props }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 mb-1">{label}</label>
    <input className="input-field text-sm w-full" autoComplete="off" spellCheck={false} {...props} />
    {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
  </div>
);

const ErrorLine = ({ msg }) => msg ? (
  <p className="text-xs text-red-400 flex items-start gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {msg}</p>
) : null;

// ── Llave de recuperación: se muestra una sola vez ───────────────────
function RecoveryKeyBox({ recoveryKey, onDone, doneLabel = 'Ya la guardé, continuar' }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(recoveryKey); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sin permiso */ }
  };
  const download = () => {
    const text = `LLAVE DE RECUPERACIÓN — Bóveda ITSM Treggo\nGenerada: ${new Date().toLocaleString('es-MX')}\n\n${recoveryKey}\n\nGuárdala FUERA del sistema (gestor de contraseñas corporativo o impreso en un sobre en caja fuerte).\nSirve para restablecer la frase maestra si se olvida. Quien la tenga puede abrir la bóveda: no la compartas.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'llave-recuperacion-boveda.txt';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
        <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> Se muestra una sola vez</p>
        <p>Si olvidas la frase maestra y pierdes esta llave, <b>las contraseñas no se podrán recuperar</b> (ni siquiera nosotros podemos). Guárdala fuera del sistema.</p>
      </div>
      <div className="rounded-lg bg-black/40 border border-white/10 p-4 text-center font-mono text-sm tracking-wider text-emerald-300 break-all select-all">
        {recoveryKey}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="btn-secondary text-sm">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiada' : 'Copiar'}</button>
        <button type="button" onClick={download} className="btn-secondary text-sm"><Download size={14} /> Descargar .txt</button>
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5" />
        Ya guardé la llave de recuperación en un lugar seguro fuera de este sistema.
      </label>
      <div className="flex justify-end pt-2 border-t border-white/10">
        <button type="button" disabled={!saved} onClick={onDone} className="btn-primary text-sm disabled:opacity-40">{doneLabel}</button>
      </div>
    </>
  );
}

// ── Configuración inicial ────────────────────────────────────────────
export function SetupModal({ onSetup, onClose, onFinished }) {
  const [phrase, setPhrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [recoveryKey, setRecoveryKey] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const chk = checkPhrase(phrase);
    if (!chk.ok) return setErr(chk.message);
    if (phrase !== confirm) return setErr('Las frases no coinciden.');
    setBusy(true);
    try { setRecoveryKey(await onSetup(phrase)); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  if (recoveryKey) {
    return (
      <Shell title="Guarda tu llave de recuperación" icon={KeyRound}>
        <RecoveryKeyBox recoveryKey={recoveryKey} onDone={onFinished} />
      </Shell>
    );
  }

  return (
    <Shell title="Configurar bóveda cifrada" icon={ShieldCheck} onClose={onClose}>
      <p className="text-xs text-slate-400">
        Las contraseñas se cifrarán en tu navegador con una <b>frase maestra</b> que nunca se envía al servidor.
        Solo Administración y TI podrán verlas, y cada consulta queda registrada.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Frase maestra" type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)}
          hint="Mínimo 14 caracteres. Mejor 4 o más palabras al azar (ej. “tren-nube-limón-roca-24”)." autoFocus />
        <Field label="Repite la frase" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <ErrorLine msg={err} />
        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button type="submit" disabled={busy} className="btn-primary text-sm">{busy ? 'Cifrando…' : 'Crear bóveda'}</button>
        </div>
      </form>
    </Shell>
  );
}

// ── Desbloqueo ───────────────────────────────────────────────────────
export function UnlockModal({ onUnlock, onClose, onForgot }) {
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await onUnlock(phrase); setPhrase(''); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <Shell title="Desbloquear bóveda" icon={Unlock} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Frase maestra" type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoFocus />
        <ErrorLine msg={err} />
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button type="button" onClick={onForgot} className="text-xs text-sky-400 hover:underline">Olvidé mi frase</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
            <button type="submit" disabled={busy || !phrase} className="btn-primary text-sm">{busy ? 'Verificando…' : 'Desbloquear'}</button>
          </div>
        </div>
      </form>
      <p className="text-[11px] text-slate-500">La bóveda se bloquea sola tras 5 minutos sin actividad.</p>
    </Shell>
  );
}

// ── Recuperación con la llave guardada fuera ─────────────────────────
export function RecoverModal({ onRecover, onClose }) {
  const [rec, setRec] = useState('');
  const [phrase, setPhrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const chk = checkPhrase(phrase);
    if (!chk.ok) return setErr(chk.message);
    if (phrase !== confirm) return setErr('Las frases no coinciden.');
    setBusy(true);
    try { await onRecover(rec, phrase); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <Shell title="Recuperar acceso" icon={KeyRound} onClose={onClose}>
      <p className="text-xs text-slate-400">Pega la llave de recuperación que guardaste al crear la bóveda y define una frase maestra nueva. Tus contraseñas no se pierden.</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Llave de recuperación" value={rec} onChange={(e) => setRec(e.target.value)} placeholder="XXXXXX-XXXXXX-…" className="input-field text-sm w-full font-mono" autoFocus />
        <Field label="Nueva frase maestra" type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
        <Field label="Repite la nueva frase" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <ErrorLine msg={err} />
        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button type="submit" disabled={busy || !rec} className="btn-primary text-sm">{busy ? 'Verificando…' : 'Restablecer'}</button>
        </div>
      </form>
    </Shell>
  );
}

// ── Cambiar frase / regenerar llave de recuperación ──────────────────
export function SettingsModal({ onChangePhrase, onRegenerate, onClose }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [curRec, setCurRec] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [newKey, setNewKey] = useState(null);

  const change = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    const chk = checkPhrase(next);
    if (!chk.ok) return setErr(chk.message);
    if (next !== confirm) return setErr('Las frases nuevas no coinciden.');
    setBusy('phrase');
    try { await onChangePhrase(cur, next); setOk('Frase maestra actualizada.'); setCur(''); setNext(''); setConfirm(''); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(''); }
  };

  const regen = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    setBusy('rec');
    try { setNewKey(await onRegenerate(curRec)); setCurRec(''); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(''); }
  };

  if (newKey) {
    return (
      <Shell title="Nueva llave de recuperación" icon={KeyRound}>
        <p className="text-xs text-slate-400">La llave anterior ya no sirve.</p>
        <RecoveryKeyBox recoveryKey={newKey} onDone={() => { setNewKey(null); onClose(); }} doneLabel="Listo" />
      </Shell>
    );
  }

  return (
    <Shell title="Seguridad de la bóveda" icon={ShieldCheck} onClose={onClose}>
      <form onSubmit={change} className="space-y-3">
        <h4 className="text-sm font-bold text-slate-200">Cambiar frase maestra</h4>
        <Field label="Frase actual" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <Field label="Frase nueva" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Field label="Repite la frase nueva" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit" disabled={busy === 'phrase' || !cur || !next} className="btn-primary text-sm">{busy === 'phrase' ? 'Guardando…' : 'Cambiar frase'}</button>
      </form>
      <form onSubmit={regen} className="space-y-3 pt-4 border-t border-white/10">
        <h4 className="text-sm font-bold text-slate-200">Regenerar llave de recuperación</h4>
        <p className="text-xs text-slate-400">Úsalo si se perdió o expuso la llave. La anterior dejará de funcionar.</p>
        <Field label="Confirma con tu frase maestra" type="password" value={curRec} onChange={(e) => setCurRec(e.target.value)} />
        <button type="submit" disabled={busy === 'rec' || !curRec} className="btn-secondary text-sm">{busy === 'rec' ? 'Generando…' : 'Generar llave nueva'}</button>
      </form>
      <ErrorLine msg={err} />
      {ok && <p className="text-xs text-emerald-400">{ok}</p>}
    </Shell>
  );
}

// ── Registro de accesos ──────────────────────────────────────────────
const ACTION_LABEL = {
  setup: 'Bóveda creada', unlock: 'Desbloqueó', unlock_failed: 'Intento fallido', reveal: 'Vio contraseña',
  copy: 'Copió contraseña', change_phrase: 'Cambió la frase', recovery_reset: 'Llave de recuperación',
  backup: 'Descargó respaldo', restore: 'Restauró respaldo', migrate: 'Cifró contraseñas',
};

export function AccessLogModal({ onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.from('vault_access_log')
      .select('id, action, credential_title, created_at, actor:profiles(full_name)')
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => { if (error) setErr(error.message); else setRows(data || []); });
  }, []);

  return (
    <Shell title="Registro de accesos" icon={History} onClose={onClose} wide>
      <ErrorLine msg={err} />
      {!rows && !err && <p className="text-sm text-slate-500">Cargando…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-slate-500">Aún no hay accesos registrados.</p>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-400 border-b border-white/10">
              <th className="py-2 pr-3">Fecha</th><th className="py-2 pr-3">Usuario</th><th className="py-2 pr-3">Acción</th><th className="py-2">Credencial</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">{new Date(r.created_at).toLocaleString('es-MX')}</td>
                  <td className="py-1.5 pr-3 text-slate-200">{r.actor?.full_name || '—'}</td>
                  <td className={`py-1.5 pr-3 ${r.action === 'unlock_failed' ? 'text-red-400' : 'text-slate-300'}`}>{ACTION_LABEL[r.action] || r.action}</td>
                  <td className="py-1.5 text-slate-400">{r.credential_title || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
