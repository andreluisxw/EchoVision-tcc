import { resolve } from "node:path";

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} deve ser um inteiro positivo`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:8080"
)
  .split(",")
  .map((x) => x.trim());
const localOnly = allowedOrigins.every((value) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname),
);
if (process.env.ADMIN_COOKIE_SECURE === "false" && !localOnly)
  throw new Error(
    "Cookies sem Secure são permitidos somente com origens locais. Use HTTPS e ADMIN_COOKIE_SECURE=true.",
  );
function secret(name: string, devDefault: string): string {
  const value = process.env[name] || (isProduction ? "" : devDefault);
  if (value.length < 16)
    throw new Error(`Configure ${name} (mínimo 16 caracteres)`);
  return value;
}

export const config = {
  port: positiveInt("PORT", 3001),
  host: process.env.HOST || "0.0.0.0",
  allowedOrigins,
  trustedProxies: (process.env.TRUSTED_PROXIES || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
  ipHashSecret: secret(
    "IP_HASH_SECRET",
    "only-for-local-development-please-change",
  ),
  storageDir: resolve(process.env.STORAGE_DIR || "./uploads"),
  maxPostsHour: positiveInt("MAX_POSTS_HOUR", 5),
  maxPostsDay: positiveInt("MAX_POSTS_DAY", 20),
  maxConfirmsDay: positiveInt("MAX_CONFIRMS_DAY", 30),
  maxImageBytes: positiveInt("MAX_IMAGE_BYTES", 8 * 1024 * 1024),
};
