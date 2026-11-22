// Builds assets/vendor/world-map.svg as a Robinson projection from Natural Earth 1:110m countries (public domain,
// via world-atlas). Each country is one <path id="xx" data-name="Name"> keyed by lowercase ISO 3166-1 alpha-2, so the
// admin map colouring keeps working. Run from a folder with d3-geo, d3-geo-projection, topojson-client, world-atlas and
// i18n-iso-countries installed: node make-world-map.mjs out.svg
import { readFileSync, writeFileSync } from "node:fs";
import { geoPath, geoGraticule10 } from "d3-geo";
import { geoRobinson } from "d3-geo-projection";
import { feature } from "topojson-client";
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };
countries.registerLocale(en);
const SHORT = { us: "United States", ru: "Russia", tz: "Tanzania", ir: "Iran", sy: "Syria", la: "Laos", cd: "DR Congo", cz: "Czechia", mk: "North Macedonia", kr: "South Korea", kp: "North Korea", md: "Moldova", ve: "Venezuela", bo: "Bolivia", vn: "Vietnam", ci: "Côte d’Ivoire", fm: "Micronesia" };
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const topo = JSON.parse(readFileSync(new URL("./node_modules/world-atlas/countries-110m.json", import.meta.url), "utf8"));
const land = feature(topo, topo.objects.countries);
const W = 800, H = 406;
const proj = geoRobinson().fitExtent([[2, 2], [W - 2, H - 2]], { type: "Sphere" });
const round = (s) => s.replace(/(\d+\.\d)\d+/g, "$1");
const path = (g) => round(geoPath(proj)(g) || "");
const byName = { "Kosovo": "xk", "Somaliland": "_somaliland", "N. Cyprus": "_northern_cyprus" };

const seen = new Set(), out = [], missing = [];
for (const f of land.features) {
  const num = f.id;
  let code = num && num !== "-99" ? countries.numericToAlpha2(String(num).padStart(3, "0")) : null;
  code = code ? code.toLowerCase() : (byName[f.properties.name] || null);
  if (!code) { missing.push(f.properties.name); code = "_" + f.properties.name.toLowerCase().replace(/[^a-z]+/g, "_"); }
  if (seen.has(code)) { missing.push("dup " + code + " " + f.properties.name); continue; }
  seen.add(code);
  const d = path(f);
  const name = SHORT[code] || (code.length === 2 && countries.getName(code.toUpperCase(), "en")) || f.properties.name;
  if (d) out.push('  <path id="' + code + '" data-name="' + esc(name) + '" d="' + d + '"/>');
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" id="world-map" role="img" aria-label="World map">\n'
  + '<title>World map (Robinson projection)</title>\n'
  + '<desc>Robinson projection. Country shapes: Natural Earth 1:110m (public domain), via world-atlas. Paths keyed by lowercase ISO 3166-1 alpha-2.</desc>\n'
  + '<path class="wm-sphere" d="' + path({ type: "Sphere" }) + '"/>\n'
  + '<path class="wm-grat" d="' + path(geoGraticule10()) + '"/>\n'
  + '<g class="wm-land">\n' + out.join("\n") + '\n</g>\n</svg>\n';

writeFileSync(process.argv[2], svg);
console.log(JSON.stringify({ countries: out.length, bytes: svg.length, missing }));
