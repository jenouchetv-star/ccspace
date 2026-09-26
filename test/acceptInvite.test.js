// The flow that gets somebody in, through to the point they have an
// account: see assets/lib/acceptInvite.js's own header comment for why
// this gate - not the network calls around it - is the right thing to
// test without a live backend.
import { describe, it, expect } from "vitest";
import { validateNewPassword } from "../assets/lib/acceptInvite.js";

describe("validateNewPassword", () => {
  it("rejects a password shorter than 8 characters", () => {
    expect(validateNewPassword("short1", "short1")).toBe("Password needs to be at least 8 characters.");
  });

  it("rejects a password that doesn't match its confirmation", () => {
    expect(validateNewPassword("longenough1", "longenough2")).toBe("Passwords don't match.");
  });

  it("accepts a password that's long enough and matches its confirmation", () => {
    expect(validateNewPassword("longenough1", "longenough1")).toBeNull();
  });
});
