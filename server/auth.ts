import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "crypto";

const TOKEN_SECRET = process.env.SESSION_SECRET || "seller-code-manager-secret-token-key-change-in-production";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, derivedKey);
}

export function generateAuthToken(userId: string, username: string): string {
  const payload = JSON.stringify({ userId, username, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const b64Payload = Buffer.from(payload).toString("base64url");
  const signature = createHmac("sha256", TOKEN_SECRET).update(b64Payload).digest("base64url");
  return `${b64Payload}.${signature}`;
}

export function verifyAuthToken(token: string): { userId: string; username: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [b64Payload, signature] = parts;
    if (!b64Payload || !signature) return null;
    const expectedSig = createHmac("sha256", TOKEN_SECRET).update(b64Payload).digest("base64url");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const data = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf-8"));
    if (data.exp && Date.now() > data.exp) return null;
    return { userId: data.userId, username: data.username };
  } catch {
    return null;
  }
}
