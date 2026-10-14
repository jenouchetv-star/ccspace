// The integration tests generate authenticator codes themselves, so the
// generator has to be right. These are the published RFC 6238 (SHA-1) test
// vectors, shortened to the 6 digits Supabase uses, plus base32 decoding.
import { describe, it, expect } from "vitest";
import { base32Decode, totp } from "./helpers/totp.js";

const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // ASCII "12345678901234567890"

describe("base32Decode", () => {
  it("decodes the RFC secret", () => {
    expect(base32Decode(SECRET).toString("ascii")).toBe("12345678901234567890");
  });
  it("ignores case, spaces and padding", () => {
    expect(base32Decode("gezd gnbv=").toString("ascii")).toBe("12345");
  });
  it("rejects characters outside the alphabet", () => {
    expect(() => base32Decode("GEZ1")).toThrow(/base32/);
  });
});

describe("totp (RFC 6238, SHA-1, 6 digits)", () => {
  const vectors = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];
  for (const [seconds, code] of vectors) {
    it("T=" + seconds + "s gives " + code, () => {
      expect(totp(SECRET, seconds * 1000)).toBe(code);
    });
  }
  it("keeps leading zeros", () => {
    expect(totp(SECRET, 1111111109 * 1000)).toHaveLength(6);
  });
  it("changes at the 30-second boundary", () => {
    expect(totp(SECRET, 29_999)).toBe(totp(SECRET, 0));
    expect(totp(SECRET, 30_000)).not.toBe(totp(SECRET, 0));
  });
});
