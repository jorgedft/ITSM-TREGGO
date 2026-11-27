import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import * as V from './vaultCrypto';

export const IDLE_LOCK_MS = 5 * 60 * 1000;   // se bloquea tras 5 min sin actividad
const HIDDEN_LOCK_MS = 60 * 1000;            // o tras 1 min con la pestaña oculta
const COLS = 'id, version, kdf_iterations, pass_salt, wrapped_dek_pass, recovery_salt, wrapped_dek_recovery';

/**
 * Estado de la bóveda cifrada.
 * status: loading | error | none (sin configurar) | locked | unlocked
 * La llave de trabajo vive solo en una ref (memoria), nunca en el estado ni en storage.
 */
export function useVault() {
  const { user } = useAuth();
  const [status, setStatus] = useState('loading');
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const keyRef = useRef(null);
  const fails = useRef({ count: 0, until: 0 });

  const load = useCallback(async () => {
    setStatus('loading');
    const { data, error: err } = await supabase.from('vault_config').select(COLS).maybeSingle();
    if (err) { setError(err.message); setStatus('error'); return; }
    setConfig(data || null);
    keyRef.current = null;
    setStatus(data ? 'locked' : 'none');
  }, []);

  useEffect(() => { load(); }, [load]);

  const lock = useCallback(() => {
    keyRef.current = null;
    setStatus((s) => (s === 'unlocked' ? 'locked' : s));
  }, []);

  // Bloqueo automático por inactividad / pestaña oculta
  useEffect(() => {
    if (status !== 'unlocked') return undefined;
    let timer;
    let hiddenAt = 0;
    const arm = () => { clearTimeout(timer); timer = setTimeout(lock, IDLE_LOCK_MS); };
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > HIDDEN_LOCK_MS) lock(); else arm();
      hiddenAt = 0;
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    document.addEventListener('visibilitychange', onVis);
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [status, lock]);

  // Registro de accesos. Con failClosed=true, si no se pudo registrar se lanza error
  // (no se revela ni copia ninguna contraseña sin dejar rastro).
  const log = useCallback(async (action, cred, failClosed = false) => {
    const { error: err } = await supabase.from('vault_access_log').insert({
      action, credential_id: cred?.id ?? null, credential_title: cred?.title ?? null,
    });
    if (err && failClosed) throw new V.VaultError('log_failed', 'No se pudo registrar el acceso en la bitácora; operación cancelada.');
  }, []);

  const guardRate = () => {
    const wait = fails.current.until - Date.now();
    if (wait > 0) throw new V.VaultError('rate_limited', `Demasiados intentos. Espera ${Math.ceil(wait / 1000)} s.`);
  };
  const registerFail = () => {
    const n = ++fails.current.count;
    if (n >= 3) fails.current.until = Date.now() + Math.min(5 * 2 ** (n - 3), 300) * 1000;
  };

  const unlock = useCallback(async (phrase) => {
    guardRate();
    try {
      keyRef.current = await V.unlockWithPhrase(config, phrase);
    } catch (e) {
      registerFail();
      log('unlock_failed');
      throw e;
    }
    fails.current = { count: 0, until: 0 };
    setStatus('unlocked');
    log('unlock');
  }, [config, log]);

  const saveConfig = async (fields) => {
    const { data, error: err } = await supabase.from('vault_config')
      .update({ ...fields, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq('id', 1).select(COLS).single();
    if (err) throw new Error(err.message);
    setConfig(data);
    return data;
  };

  /** Configura la bóveda por primera vez. Devuelve la llave de recuperación (mostrar UNA vez). */
  const setup = useCallback(async (phrase) => {
    const { config: cfg, recoveryKey, key } = await V.createVault(phrase);
    const { data, error: err } = await supabase.from('vault_config')
      .insert({ id: 1, ...cfg, updated_by: user?.id ?? null }).select(COLS).single();
    if (err) throw new Error(err.message);
    setConfig(data);
    keyRef.current = key;
    setStatus('unlocked');
    log('setup');
    return recoveryKey;
  }, [user, log]);

  const changePhrase = useCallback(async (current, next) => {
    guardRate();
    let fields;
    try { fields = await V.changePhrase(config, current, next); }
    catch (e) { if (e.code === 'bad_phrase') registerFail(); throw e; }
    await saveConfig(fields);
    log('change_phrase');
  }, [config, log]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Olvidó la frase: usa la llave de recuperación para fijar una nueva. */
  const recover = useCallback(async (recoveryText, newPhrase) => {
    guardRate();
    let fields;
    try { fields = await V.resetPhraseWithRecovery(config, recoveryText, newPhrase); }
    catch (e) { if (e.code === 'bad_recovery') registerFail(); throw e; }
    const next = await saveConfig(fields);
    keyRef.current = await V.unlockWithPhrase(next, newPhrase);
    setStatus('unlocked');
    log('recovery_reset');
  }, [config, log]); // eslint-disable-line react-hooks/exhaustive-deps

  const regenerateRecovery = useCallback(async (phrase) => {
    guardRate();
    let out;
    try { out = await V.regenerateRecovery(config, phrase); }
    catch (e) { if (e.code === 'bad_phrase') registerFail(); throw e; }
    await saveConfig(out.config);
    log('recovery_reset');
    return out.recoveryKey;
  }, [config, log]); // eslint-disable-line react-hooks/exhaustive-deps

  const encrypt = useCallback((text, recordId) => {
    if (!keyRef.current) throw new V.VaultError('locked', 'La bóveda está bloqueada.');
    return V.encryptField(keyRef.current, text, recordId);
  }, []);

  const decrypt = useCallback((token, recordId) => {
    if (!keyRef.current) throw new V.VaultError('locked', 'La bóveda está bloqueada.');
    return V.decryptField(keyRef.current, token, recordId);
  }, []);

  return {
    status, config, error, reload: load,
    unlock, lock, setup, changePhrase, recover, regenerateRecovery,
    encrypt, decrypt, log,
  };
}
