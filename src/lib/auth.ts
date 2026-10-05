/**
 * Shared-password protection (APP_PASSWORD). The session cookie holds an
 * HMAC derived from the password, so changing the password signs everyone
 * out. Web Crypto only, so this also runs in the request proxy.
 */
export const SESSION_COOKIE = "jarvis_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

async function hmac(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function sessionToken(password: string): Promise<string> {
  return hmac(password, "jarvis-session-v1");
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySession(cookie: string | undefined, password: string): Promise<boolean> {
  if (!cookie) return false;
  return equal(cookie, await sessionToken(password));
}

/** Compare a submitted password without leaking timing (both sides are hashed first). */
export async function checkPassword(submitted: string, password: string): Promise<boolean> {
  return equal(await hmac("jarvis-login", submitted), await hmac("jarvis-login", password));
}
