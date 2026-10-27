import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The Edge Functions import Supabase's client with a Deno-only specifier
// (jsr:@supabase/supabase-js@2). For test/portalFunction.test.js that one
// import is pointed at a small in-memory stand-in, so the real function code
// can be exercised with no network, database or email. Nothing else changes.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: "jsr:@supabase/supabase-js@2",
        replacement: fileURLToPath(new URL("./test/helpers/fakeSupabase.js", import.meta.url)),
      },
    ],
  },
});
