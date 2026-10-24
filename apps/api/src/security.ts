import { createHmac } from "node:crypto";
import ipaddr from "ipaddr.js";
import { config } from "./config.js";

/** IPv6 /64 por padrão; endereços IPv4-mapped seguem regra IPv4. */
export function normalizeIp(raw: string): string {
  const addr = ipaddr.parse(raw);
  if (addr.kind() === "ipv4") return addr.toString();
  const v6 = addr as ipaddr.IPv6;
  if (v6.isIPv4MappedAddress()) return v6.toIPv4Address().toString();
  const bytes = v6.toByteArray();
  for (let i = 8; i < 16; i += 1) bytes[i] = 0;
  return `${ipaddr.fromByteArray(bytes).toString()}/64`;
}

export function hashIp(raw: string): string {
  return createHmac("sha256", config.ipHashSecret)
    .update(normalizeIp(raw))
    .digest("hex");
}
