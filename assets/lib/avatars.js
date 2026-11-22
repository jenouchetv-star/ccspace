// Chike's Creative Space - the 20 avatars a grown-up can pick for a child (owner, 2026-11-22). A new child gets one at
// random (the kid-progress function picks it); the grown-up changes it with the pencil in Your children. The avatar
// shows at the top of the child's report, next to the name in Your children, and in "Who's creating today?".
//
// Each is drawn on a 64 by 64 grid on its own colored ground, in the site's ink and colors, so they read as one set.
// The look is docs/mockups/child-avatars-draft.html. The ids must match AVATARS in supabase/functions/kid-progress.

const K = "#1E2226";
const S = 'stroke="#1E2226" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
const GEAR_TEETH = [0, 45, 90, 135, 180, 225, 270, 315]
  .map((a) => `<rect x="27.5" y="8" width="9" height="11" rx="2" fill="#1273B0" ${S} transform="rotate(${a} 32 32)"/>`).join("");

/** id -> [name, ground color, drawing]. The order is the order of the picker. */
const ART = {
  robot: ["Robot", "#C6E1F2", `
    <line x1="32" y1="19" x2="32" y2="12" ${S}/><circle cx="32" cy="10" r="3.4" fill="#BC3229" ${S}/>
    <rect x="11" y="28" width="6" height="11" rx="2" fill="#9AA5AB" ${S}/><rect x="47" y="28" width="6" height="11" rx="2" fill="#9AA5AB" ${S}/>
    <rect x="16" y="19" width="32" height="28" rx="7" fill="#E4E8EA" ${S}/>
    <circle cx="25" cy="30" r="4.6" fill="#7FD1C1" ${S}/><circle cx="39" cy="30" r="4.6" fill="#7FD1C1" ${S}/>
    <rect x="24" y="38" width="16" height="4" rx="2" fill="${K}"/>
    <path d="M22 47 v5 h20 v-5" fill="#9AA5AB" ${S}/>`],
  racecar: ["Race car", "#F2C230", `
    <path d="M7 41 L11 33 L25 30 L33 23 L45 23 L50 30 L57 32 L57 42 Z" fill="#BC3229" ${S}/>
    <path d="M32 29 L36 25.5 L44 25.5 L47 29 Z" fill="#C6E1F2" ${S}/>
    <circle cx="23" cy="36" r="4.4" fill="#FFFBF3" ${S}/><path d="M22 34 L24 33.4 V39" fill="none" stroke="${K}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="17.5" cy="43" r="6" fill="${K}"/><circle cx="17.5" cy="43" r="2.4" fill="#C9CFD2"/>
    <circle cx="47" cy="43" r="6" fill="${K}"/><circle cx="47" cy="43" r="2.4" fill="#C9CFD2"/>
    <path d="M4 50 h56" ${S} stroke-dasharray="4 5"/>`],
  pencil: ["Pencil", "#D7EDE8", `<g transform="rotate(-40 32 32)">
    <rect x="9" y="26" width="8" height="12" rx="2.5" fill="#EC9BB4" ${S}/>
    <rect x="16" y="26" width="5" height="12" fill="#C9CFD2" ${S}/>
    <rect x="21" y="26" width="22" height="12" fill="#F2C230" ${S}/>
    <line x1="21" y1="32" x2="43" y2="32" stroke="#DD7A22" stroke-width="2"/>
    <path d="M43 26 L55 32 L43 38 Z" fill="#F3D9A4" ${S}/><path d="M51 30 L55 32 L51 34 Z" fill="${K}"/></g>`],
  rocket: ["Rocket", "#1B2A32", `
    <circle cx="12" cy="14" r="1.4" fill="#FFFBF3"/><circle cx="52" cy="20" r="1.2" fill="#FFFBF3"/><circle cx="48" cy="50" r="1.4" fill="#FFFBF3"/><circle cx="14" cy="46" r="1" fill="#FFFBF3"/>
    <path d="M27 44 L37 44 L32 57 Z" fill="#F2C230" ${S}/>
    <path d="M24 36 L16 47 L25 44 Z" fill="#BC3229" ${S}/><path d="M40 36 L48 47 L39 44 Z" fill="#BC3229" ${S}/>
    <path d="M32 7 C42 15 44 30 40 44 L24 44 C20 30 22 15 32 7 Z" fill="#FFFBF3" ${S}/>
    <circle cx="32" cy="26" r="5" fill="#C6E1F2" ${S}/>`],
  paintbrush: ["Paintbrush", "#BFA5E0", `<g transform="rotate(40 32 32)">
    <rect x="28" y="4" width="8" height="28" rx="3" fill="#1273B0" ${S}/>
    <rect x="27" y="31" width="10" height="7" fill="#C9CFD2" ${S}/>
    <path d="M27 38 C27 46 29 52 32 57 C35 52 37 46 37 38 Z" fill="#9C2287" ${S}/></g>
    <circle cx="14" cy="50" r="3.4" fill="#9C2287" ${S}/>`],
  guitar: ["Guitar", "#F5E7CC", `<g transform="rotate(35 32 32)">
    <rect x="29.5" y="5" width="5" height="26" fill="#6B4423" ${S}/>
    <rect x="27.5" y="2" width="9" height="7" rx="2" fill="#33200F" ${S}/>
    <circle cx="32" cy="34" r="8.5" fill="#DD7A22" ${S}/><circle cx="32" cy="46" r="11" fill="#DD7A22" ${S}/>
    <circle cx="32" cy="34" r="7.3" fill="#DD7A22"/><circle cx="32" cy="46" r="9.8" fill="#DD7A22"/><rect x="25" y="34" width="14" height="10" fill="#DD7A22"/>
    <rect x="30.8" y="12" width="2.4" height="22" fill="#6B4423"/>
    <circle cx="32" cy="40" r="3.6" fill="${K}"/><rect x="27" y="49" width="10" height="3" rx="1" fill="${K}"/></g>`],
  dinosaur: ["Dinosaur", "#E6F0F2", `
    <path d="M24 40 L27 33 L31 39 L34 31 L37 38" fill="#F2C230" ${S}/>
    <path d="M6 46 C14 44 18 38 26 38 L34 37 C35 30 38 20 45 20 C51 20 55 23 55 27 C55 31 51 32 47 32 L43 32 L43 44 C43 49 39 51 34 51 L22 51 C15 51 10 49 6 46 Z" fill="#3A7A37" ${S}/>
    <path d="M24 51 v6 h5 v-6 M35 51 v6 h5 v-6" fill="#3A7A37" ${S}/>
    <circle cx="47" cy="25" r="2" fill="${K}"/><path d="M49 30 h4" ${S}/>`],
  planet: ["Planet", "#1B2A32", `<g transform="rotate(-18 32 32)">
    <ellipse cx="32" cy="32" rx="26" ry="7.5" fill="none" stroke="${K}" stroke-width="7"/>
    <ellipse cx="32" cy="32" rx="26" ry="7.5" fill="none" stroke="#F2C230" stroke-width="2.6"/>
    <circle cx="32" cy="32" r="14" fill="#BFA5E0" ${S}/>
    <path d="M22 27 C27 25 34 26 42 29" fill="none" stroke="#6C3E8C" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M6 32 A26 7.5 0 0 0 58 32" fill="none" stroke="${K}" stroke-width="7"/>
    <path d="M6 32 A26 7.5 0 0 0 58 32" fill="none" stroke="#F2C230" stroke-width="2.6"/></g>`],
  lightbulb: ["Light bulb", "#FFFBF3", `
    <path d="M14 14 l3 3 M50 14 l-3 3 M8 30 h4 M52 30 h4" ${S}/>
    <path d="M23 40 C17 36 15 30 15 26 C15 16 23 10 32 10 C41 10 49 16 49 26 C49 30 47 36 41 40 L41 44 L23 44 Z" fill="#F2C230" ${S}/>
    <path d="M28 44 V33 L32 29 L36 33 V44" fill="none" stroke="#DD7A22" stroke-width="2.2" stroke-linejoin="round"/>
    <rect x="23" y="44" width="18" height="10" rx="2" fill="#C9CFD2" ${S}/><path d="M23 49 h18" ${S}/>
    <path d="M28 54 h8 v2 a4 4 0 0 1 -8 0 Z" fill="${K}"/>`],
  gear: ["Gear", "#F5E7CC", `${GEAR_TEETH}
    <circle cx="32" cy="32" r="16" fill="#1273B0" ${S}/>
    <circle cx="32" cy="32" r="14.8" fill="#1273B0"/>
    <circle cx="32" cy="32" r="6" fill="#F5E7CC" ${S}/>`],
  music: ["Music notes", "#F2C230", `
    <path d="M24 46 V18 L48 12 V40" fill="none" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 18 L48 12 V19 L24 25 Z" fill="${K}"/>
    <ellipse cx="18.5" cy="46.5" rx="7" ry="5.2" transform="rotate(-18 18.5 46.5)" fill="#1273B0" ${S}/>
    <ellipse cx="42.5" cy="40.5" rx="7" ry="5.2" transform="rotate(-18 42.5 40.5)" fill="#1273B0" ${S}/>`],
  microscope: ["Microscope", "#D7EDE8", `
    <rect x="12" y="50" width="38" height="6" rx="2" fill="#1273B0" ${S}/>
    <path d="M40 50 C48 44 48 30 40 24" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
    <path d="M40 50 C48 44 48 30 40 24" fill="none" stroke="#C9CFD2" stroke-width="2" stroke-linecap="round"/>
    <rect x="18" y="38" width="22" height="4" rx="1.5" fill="#9AA5AB" ${S}/>
    <g transform="rotate(-30 32 22)"><rect x="27" y="8" width="10" height="24" rx="2" fill="#FFFBF3" ${S}/><rect x="28.5" y="32" width="7" height="5" fill="#9AA5AB" ${S}/><rect x="26" y="5" width="12" height="5" rx="1.5" fill="${K}"/></g>
    <circle cx="44" cy="30" r="3" fill="#BC3229" ${S}/>`],
  book: ["Book", "#C6E1F2", `
    <path d="M6 18 C14 15 24 15 32 20 C40 15 50 15 58 18 V50 C50 47 40 47 32 52 C24 47 14 47 6 50 Z" fill="#BC3229" ${S}/>
    <path d="M9 17 C16 14 25 15 32 19 V48 C25 44 16 44 9 46 Z" fill="#FFFBF3" ${S}/>
    <path d="M55 17 C48 14 39 15 32 19 V48 C39 44 48 44 55 46 Z" fill="#FFFBF3" ${S}/>
    <path d="M14 24 c5-1.5 9-1 13 1 M14 30 c5-1.5 9-1 13 1 M14 36 c5-1.5 9-1 13 1 M37 25 c4-2 8-2.5 13-1 M37 31 c4-2 8-2.5 13-1" fill="none" stroke="#9AA5AB" stroke-width="2" stroke-linecap="round"/>`],
  telescope: ["Telescope", "#1B2A32", `
    <path d="M49 10 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5-3.5 -3.5-1.5 3.5-1.5 Z" fill="#F2C230"/>
    <path d="M30 36 L20 56 M32 36 L32 56 M34 36 L44 56" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
    <path d="M30 36 L20 56 M32 36 L32 56 M34 36 L44 56" fill="none" stroke="#C9CFD2" stroke-width="2.2" stroke-linecap="round"/>
    <g transform="rotate(-28 32 30)"><rect x="12" y="26" width="10" height="8" rx="1.5" fill="#FFFBF3" ${S}/><rect x="21" y="23" width="30" height="14" rx="2" fill="#1273B0" ${S}/><rect x="50" y="21" width="5" height="18" rx="1.5" fill="#FFFBF3" ${S}/><path d="M30 23 v14" ${S}/></g>
    <circle cx="32" cy="35" r="3" fill="#C9CFD2" ${S}/>`],
  drum: ["Drum", "#BFA5E0", `
    <path d="M10 12 L30 28 M54 12 L34 28" fill="none" stroke="${K}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M10 12 L30 28 M54 12 L34 28" fill="none" stroke="#F5E7CC" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="9" cy="11" r="3" fill="#F5E7CC" ${S}/><circle cx="55" cy="11" r="3" fill="#F5E7CC" ${S}/>
    <path d="M12 30 V48 C12 53 21 56 32 56 C43 56 52 53 52 48 V30" fill="#BC3229" ${S}/>
    <path d="M12 34 L20 50 L28 36 L36 52 L44 36 L52 48" fill="none" stroke="#F2C230" stroke-width="2.4" stroke-linejoin="round"/>
    <ellipse cx="32" cy="30" rx="20" ry="7" fill="#FFFBF3" ${S}/>`],
  crayon: ["Crayon", "#F2C230", `<g transform="rotate(40 32 32)">
    <rect x="8" y="26" width="34" height="12" rx="2" fill="#0C6B64" ${S}/>
    <rect x="16" y="26" width="18" height="12" fill="#7FD1C1" ${S}/>
    <path d="M42 26 L50 29 L54 32 L50 35 L42 38 Z" fill="#0C6B64" ${S}/></g>
    <path d="M12 52 c6-4 10 2 16-2" fill="none" stroke="#0C6B64" stroke-width="3" stroke-linecap="round"/>`],
  magnet: ["Magnet", "#E6F0F2", `
    <path d="M14 12 H26 V34 C26 38 28 41 32 41 C36 41 38 38 38 34 V12 H50 V34 C50 45 42 53 32 53 C22 53 14 45 14 34 Z" fill="#BC3229" ${S}/>
    <rect x="14" y="12" width="12" height="9" fill="#C9CFD2" ${S}/><rect x="38" y="12" width="12" height="9" fill="#C9CFD2" ${S}/>
    <path d="M8 6 l3 3 M20 4 v3 M44 4 v3 M56 6 l-3 3" ${S}/>`],
  headphones: ["Headphones", "#7FD1C1", `
    <path d="M12 38 V32 C12 20 21 12 32 12 C43 12 52 20 52 32 V38" fill="none" stroke="${K}" stroke-width="7" stroke-linecap="round"/>
    <path d="M12 38 V32 C12 20 21 12 32 12 C43 12 52 20 52 32 V38" fill="none" stroke="#9C2287" stroke-width="2.6" stroke-linecap="round"/>
    <rect x="8" y="34" width="12" height="18" rx="5" fill="#9C2287" ${S}/><rect x="44" y="34" width="12" height="18" rx="5" fill="#9C2287" ${S}/>
    <rect x="17" y="37" width="5" height="12" rx="2" fill="${K}"/><rect x="42" y="37" width="5" height="12" rx="2" fill="${K}"/>`],
  airplane: ["Paper airplane", "#C6E1F2", `
    <path d="M6 56 C14 52 14 46 22 44" fill="none" ${S} stroke-dasharray="3 4"/>
    <path d="M8 30 L56 10 L36 52 L28 38 Z" fill="#FFFBF3" ${S}/>
    <path d="M28 38 L56 10 L24 32" fill="#E6F0F2" ${S}/>
    <path d="M28 38 L30 46 L36 52" fill="#C9CFD2" ${S}/>`],
  star: ["Star", "#1273B0", `
    <path d="M32 7 L39.3 22 L55.8 24.3 L43.8 35.8 L46.7 52.2 L32 44.4 L17.3 52.2 L20.2 35.8 L8.2 24.3 L24.7 22 Z" fill="#F2C230" ${S}/>
    <circle cx="27" cy="31" r="2.2" fill="${K}"/><circle cx="37" cy="31" r="2.2" fill="${K}"/>
    <path d="M27.5 37 C30 40 34 40 36.5 37" fill="none" ${S}/>`],
};

/** The 20 avatar ids, in picker order. */
export const AVATAR_IDS = Object.freeze(Object.keys(ART));

/** An avatar's name for people ("Race car"), or "" for an id that isn't one. */
export function avatarName(id) { return Object.hasOwn(ART, id) ? ART[id][0] : ""; }

/** The avatar a child shows: theirs when it is one of the 20, else one picked from the child's id (the same one every
 *  time), for a child saved before avatars or a server that doesn't send one yet. */
export function avatarFor(child) {
  const own = child && child.avatar;
  if (typeof own === "string" && Object.hasOwn(ART, own)) return own;
  const s = String((child && child.id) || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_IDS[h % AVATAR_IDS.length];
}

/** The avatar as an inline SVG on its round ground. With a label it is an image with that name; without one it is
 *  decoration (next to the child's name) and hidden from screen readers. An unknown id draws the first avatar. */
export function avatarSVG(id, label) {
  const a = ART[Object.hasOwn(ART, id) ? id : AVATAR_IDS[0]];
  const say = typeof label === "string" && label
    ? ' role="img" aria-label="' + label.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") + '"'
    : ' aria-hidden="true" focusable="false"';
  return '<svg class="av-svg" viewBox="0 0 64 64"' + say + '><rect width="64" height="64" fill="' + a[1] + '"/>' + a[2] + "</svg>";
}
