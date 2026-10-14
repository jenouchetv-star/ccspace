// A small RFC 6238 (TOTP, SHA-1) generator for the integration tests, so they
// can produce the same 6-digit codes an authenticator app would from the
// secret Supabase returns at enrollment. Test-only: nothing in the app uses it.
import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input) {
  const clean = String(input).replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  const out = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("not valid base32: " + ch);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(out);
}

/** The code an authenticator app shows for `secretBase32` at `nowMs`. */
export function totp(secretBase32, nowMs = Date.now(), { digits = 6, step = 30 } = {}) {
  const counter = Math.floor(nowMs / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secretBase32)).update(buf).digest();
  const off = h[h.length - 1] & 15;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}
