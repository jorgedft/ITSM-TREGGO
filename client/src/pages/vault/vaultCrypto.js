// =====================================================================
// Criptografía de la Bóveda (WebCrypto, se ejecuta solo en el navegador)
// =====================================================================
// Esquema "envelope":
//   - DEK: llave AES-GCM de 256 bits aleatoria. Cifra cada contraseña.
//   - La DEK se guarda ENVUELTA dos veces en vault_config:
//       * con una llave derivada de la FRASE MAESTRA (PBKDF2-SHA256, 600k)
//       * con una llave derivada de la LLAVE DE RECUPERACIÓN (256 bits,
//         HKDF-SHA256), que se muestra una sola vez y se guarda fuera.
//   - Cada contraseña se guarda como  v1.<iv>.<ciphertext>  (base64url),
//     con AAD = "<id del registro>:<campo>" para que un texto cifrado no
//     pueda copiarse a otro registro.
//   - La frase y la llave de recuperación NUNCA salen del navegador.
// =====================================================================

export const VAULT_VERSION = 1;
export const KDF_ITERATIONS = 600_000;
const PREFIX = 'v1';
const CIPHER_RE = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;
const enc = new TextEncoder();
const dec = new TextDecoder();

export class VaultError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ── base64url ────────────────────────────────────────────────────────
export function b64uEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64uDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

export const isCiphertext = (v) => typeof v === 'string' && CIPHER_RE.test(v);

// ── Frase maestra ────────────────────────────────────────────────────
const normPhrase = (p) => p.normalize('NFKC');

export function checkPhrase(phrase) {
  const p = normPhrase(phrase || '');
  if (p.length < 14) return { ok: false, message: 'Usa al menos 14 caracteres (mejor una frase de 4 o más palabras).' };
  if (new Set(p).size < 8) return { ok: false, message: 'La frase es demasiado repetitiva.' };
  return { ok: true, message: '' };
}

async function kekFromPhrase(phrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(normPhrase(phrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── Llave de recuperación (Crockford base32, 256 bits) ───────────────
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function b32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function b32Decode(str) {
  let bits = 0, value = 0; const out = [];
  for (const ch of str) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new VaultError('bad_recovery', 'La llave de recuperación tiene caracteres no válidos.');
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Uint8Array.from(out);
}

export function formatRecoveryKey(bytes) {
  return b32Encode(bytes).match(/.{1,6}/g).join('-'); // 52 caracteres en grupos de 6
}

export function parseRecoveryKey(text) {
  const clean = (text || '').toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  const bytes = b32Decode(clean);
  if (bytes.length !== 32) throw new VaultError('bad_recovery', 'La llave de recuperación está incompleta o es incorrecta.');
  return bytes;
}

async function kekFromRecovery(recoveryBytes, salt) {
  const base = await crypto.subtle.importKey('raw', recoveryBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('treggo-vault-recovery-v1') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── Envolver / desenvolver la DEK ────────────────────────────────────
async function wrapRaw(kek, rawDek, aad) {
  const iv = rand(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, kek, rawDek));
  return `${PREFIX}.${b64uEncode(iv)}.${b64uEncode(ct)}`;
}

async function unwrapRaw(kek, token, aad) {
  const [, iv, ct] = token.split('.');
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64uDecode(iv), additionalData: enc.encode(aad) }, kek, b64uDecode(ct));
  return new Uint8Array(raw);
}

// La llave de trabajo NO es extraíble: vive solo en memoria y JS no puede leerla.
const workingKey = (raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

const AAD_PASS = 'vault:dek:pass';
const AAD_REC = 'vault:dek:recovery';

// ── API pública ──────────────────────────────────────────────────────

/** Crea una bóveda nueva. Devuelve la config a guardar, la llave de recuperación (mostrar UNA vez) y la llave de trabajo. */
export async function createVault(phrase) {
  const chk = checkPhrase(phrase);
  if (!chk.ok) throw new VaultError('weak_phrase', chk.message);

  const rawDek = rand(32);
  const recoveryBytes = rand(32);
  const passSalt = rand(16);
  const recSalt = rand(16);

  const [kekP, kekR] = await Promise.all([
    kekFromPhrase(phrase, passSalt, KDF_ITERATIONS),
    kekFromRecovery(recoveryBytes, recSalt),
  ]);
  const config = {
    version: VAULT_VERSION,
    kdf_iterations: KDF_ITERATIONS,
    pass_salt: b64uEncode(passSalt),
    wrapped_dek_pass: await wrapRaw(kekP, rawDek, AAD_PASS),
    recovery_salt: b64uEncode(recSalt),
    wrapped_dek_recovery: await wrapRaw(kekR, rawDek, AAD_REC),
  };
  const key = await workingKey(rawDek);
  rawDek.fill(0);
  return { config, recoveryKey: formatRecoveryKey(recoveryBytes), key };
}

async function rawFromPhrase(config, phrase) {
  try {
    const kek = await kekFromPhrase(phrase, b64uDecode(config.pass_salt), config.kdf_iterations);
    return await unwrapRaw(kek, config.wrapped_dek_pass, AAD_PASS);
  } catch {
    throw new VaultError('bad_phrase', 'La frase maestra es incorrecta.');
  }
}

async function rawFromRecovery(config, recoveryText) {
  const bytes = parseRecoveryKey(recoveryText);
  try {
    const kek = await kekFromRecovery(bytes, b64uDecode(config.recovery_salt));
    return await unwrapRaw(kek, config.wrapped_dek_recovery, AAD_REC);
  } catch {
    throw new VaultError('bad_recovery', 'La llave de recuperación es incorrecta.');
  }
}

export async function unlockWithPhrase(config, phrase) {
  const raw = await rawFromPhrase(config, phrase);
  const key = await workingKey(raw);
  raw.fill(0);
  return key;
}

export async function unlockWithRecovery(config, recoveryText) {
  const raw = await rawFromRecovery(config, recoveryText);
  const key = await workingKey(raw);
  raw.fill(0);
  return key;
}

/** Cambia la frase (exige la actual). Devuelve solo los campos de config que cambian. */
export async function changePhrase(config, currentPhrase, newPhrase) {
  const chk = checkPhrase(newPhrase);
  if (!chk.ok) throw new VaultError('weak_phrase', chk.message);
  const raw = await rawFromPhrase(config, currentPhrase);
  return rewrapPhrase(raw, newPhrase);
}

/** Olvidó la frase: la restablece con la llave de recuperación. */
export async function resetPhraseWithRecovery(config, recoveryText, newPhrase) {
  const chk = checkPhrase(newPhrase);
  if (!chk.ok) throw new VaultError('weak_phrase', chk.message);
  const raw = await rawFromRecovery(config, recoveryText);
  return rewrapPhrase(raw, newPhrase);
}

async function rewrapPhrase(raw, newPhrase) {
  const salt = rand(16);
  const kek = await kekFromPhrase(newPhrase, salt, KDF_ITERATIONS);
  const out = {
    kdf_iterations: KDF_ITERATIONS,
    pass_salt: b64uEncode(salt),
    wrapped_dek_pass: await wrapRaw(kek, raw, AAD_PASS),
  };
  raw.fill(0);
  return out;
}

/** Genera una llave de recuperación nueva (exige la frase). La anterior deja de servir. */
export async function regenerateRecovery(config, phrase) {
  const raw = await rawFromPhrase(config, phrase);
  const recoveryBytes = rand(32);
  const salt = rand(16);
  const kek = await kekFromRecovery(recoveryBytes, salt);
  const out = {
    config: { recovery_salt: b64uEncode(salt), wrapped_dek_recovery: await wrapRaw(kek, raw, AAD_REC) },
    recoveryKey: formatRecoveryKey(recoveryBytes),
  };
  raw.fill(0);
  return out;
}

// ── Cifrado de campos ────────────────────────────────────────────────
export async function encryptField(key, plaintext, recordId, field = 'password') {
  const iv = rand(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(`${recordId}:${field}`) }, key, enc.encode(plaintext)));
  return `${PREFIX}.${b64uEncode(iv)}.${b64uEncode(ct)}`;
}

export async function decryptField(key, token, recordId, field = 'password') {
  if (!isCiphertext(token)) throw new VaultError('not_encrypted', 'El valor no está cifrado.');
  const [, iv, ct] = token.split('.');
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64uDecode(iv), additionalData: enc.encode(`${recordId}:${field}`) }, key, b64uDecode(ct));
    return dec.decode(pt);
  } catch {
    throw new VaultError('decrypt_failed', 'No se pudo descifrar (llave incorrecta o dato alterado).');
  }
}
