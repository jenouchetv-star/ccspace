// The upload Worker's admin gate. It must ask Supabase's is_active_admin()
// (which, once enforcement is on, also requires a verified second factor)
// and must answer 403 on anything other than a literal `true` - including a
// failed or malformed answer.
import { describe, it, expect, afterEach } from "vitest";
import worker from "../workers/media-upload/index.js";

const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function mockSupabase(rpcResponse) {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push(String(url));
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
    }
    if (String(url).endsWith("/rest/v1/rpc/is_active_admin")) return rpcResponse();
    throw new Error("unexpected fetch: " + url);
  };
  return seen;
}

function upload() {
  return new Request("https://w.example/", {
    method: "POST",
    headers: { Authorization: "Bearer tok", "content-type": "image/png" },
    body: new Uint8Array(0),
  });
}

describe("media-upload admin gate", () => {
  it("rejects when is_active_admin returns false", async () => {
    mockSupabase(() => new Response("false", { status: 200 }));
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("rejects when the rpc call itself fails", async () => {
    mockSupabase(() => new Response("{}", { status: 500 }));
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("rejects a non-boolean answer such as the string 'true'", async () => {
    mockSupabase(() => new Response('"true"', { status: 200 }));
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("rejects a non-JSON answer", async () => {
    mockSupabase(() => new Response("<html>oops</html>", { status: 200 }));
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("rejects when the rpc request throws", async () => {
    mockSupabase(() => { throw new Error("network"); });
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("lets a true answer through to the next step (an empty body is then a 400)", async () => {
    const seen = mockSupabase(() => new Response("true", { status: 200 }));
    const res = await worker.fetch(upload(), env);
    expect(res.status).toBe(400);
    expect(seen.some(u => u.includes("/rest/v1/profiles"))).toBe(false);
  });
});
