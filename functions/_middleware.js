/* Section pages for search engines (owner, 2026-11-24: "so that people can find us when searching for kids
   learning, kids learning games, children's books, kid activities, STEM for kids ..."). The app draws every page with
   JavaScript, so a crawler that does not run it got the home page's title and description, and an empty body, on
   every section page. For crawlers only, this writes the section's own title, description and address into the
   head, and a short readable page into the app's container (see functions/_shared/seo.js). A person's request is
   passed through untouched; single items (a game, a book) are handled by their own functions. */
import { isCrawler, applyMeta } from "./_shared/og.js";
import { seoFor, crawlerBody } from "./_shared/seo.js";

export async function onRequest(context){
  const response = await context.next();
  const request = context.request;
  if (request.method !== "GET" || !isCrawler(request)) return response;
  const url = new URL(request.url);
  const page = seoFor(url.pathname);
  if (!page || !(response.headers.get("content-type") || "").includes("text/html")) return response;
  const path = "/" + url.pathname.replace(/^\/+|\/+$/g, "");
  return applyMeta(response, { title: page.title, desc: page.desc, image: "", pageUrl: url.origin + path,
    body: crawlerBody({ h1: page.h1, desc: page.desc }) });
}
