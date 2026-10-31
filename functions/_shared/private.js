// Cloudflare Pages serves every file in this repository unless something says otherwise (.assetsignore is
// only read by Workers, not by Pages), so the project's own working files were reachable on the live site:
// supabase/ (with the members-only Gravity 4 code in its SQL), the tests, internal notes, CI settings.
// A Function takes priority over a static file at the same address, so each private folder gets a
// catch-all that uses this: a plain "Not found", never cached, never indexed. (test/privatePaths.test.js)
export function onRequest() {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
