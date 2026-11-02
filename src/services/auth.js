const encoder = new TextEncoder();

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function derivePasswordHash(password, saltHex) {
  if (!globalThis.crypto?.subtle) throw new Error('Güvenli parola doğrulaması için Android uygulamasında veya HTTPS üzerinde açın.');
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

export async function createLocalProfile({ name, email, password, avatar = '' }) {
  if (password.length < 8) throw new Error('Parola en az 8 karakter olmalıdır.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt);
  const passwordHash = await derivePasswordHash(password, saltHex);
  return { name: name.trim(), email: email.trim(), avatar, passwordHash, saltHex, createdAt: new Date().toISOString() };
}

export async function verifyLocalPassword(password, profile) {
  const candidate = await derivePasswordHash(password, profile.saltHex);
  if (candidate.length !== profile.passwordHash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ profile.passwordHash.charCodeAt(i);
  return diff === 0;
}
