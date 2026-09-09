# media-upload Worker — setup

Replaces Supabase Storage for new media uploads (zero egress fees on R2 vs. the
Supabase Storage egress that hit its quota). Existing files stay on Supabase for
now — this only handles uploads going forward.

## One-time setup

1. **Install Wrangler** (if you don't have it): `npm install -g wrangler`, then `wrangler login`.

2. **Create the R2 bucket**:
   ```bash
   wrangler r2 bucket create chikes-creative-space-media
   ```

3. **Enable public access on the bucket** (Cloudflare dashboard → R2 → the bucket →
   Settings → Public Access → Enable). Copy the `pub-xxxxxxxx.r2.dev` URL it gives you.

4. **Paste that URL into `wrangler.toml`** in this folder, replacing
   `https://REPLACE-ME.r2.dev` under `[vars] PUBLIC_BASE_URL`.

5. **Set the two secrets** (from this folder):
   ```bash
   wrangler secret put SUPABASE_URL
   # paste: https://wdctkfhwygwwulipwnys.supabase.co
   wrangler secret put SUPABASE_ANON_KEY
   # paste the same anon key already used in index.html
   ```

6. **Deploy**:
   ```bash
   wrangler deploy
   ```
   This prints the Worker's live URL, something like
   `https://media-upload.<your-subdomain>.workers.dev`.

7. **Send me that URL** — I'll wire `uploadToStorage()` in `index.html` to use it,
   test an upload end to end, and only then it goes live for real uploads.

## Later (optional)

A custom domain (e.g. `media.chikescreativespace.com`) instead of the `.r2.dev`
URL is a nicer long-term look and gives you Cloudflare's CDN caching in front of
it - can be added anytime by pointing a route at this Worker in the dashboard,
no code change needed on this side.
