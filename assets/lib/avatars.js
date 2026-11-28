// Chike's Creative Space - the 20 avatars a grown-up can pick for a child (owner, 2026-11-22). A new child gets one at
// random (the kid-progress function picks it); the grown-up changes it with the pencil in Your children. The avatar
// shows at the top of the child's report, next to the name in Your children, in "Who's creating today?" and in the
// corner in place of Chike.
//
// Each is a cartoon picture in the characters' style, on its own colored ground (owner, 2026-11-28: livelier cartoon
// drawings, made in Higgsfield as one sheet and cut into assets/avatars/<id>.webp, 256 by 256). The ids must match
// AVATARS in supabase/functions/kid-progress.

/** id -> [name, ground color]. The order is the order of the picker. */
const ART = {
  robot: ["Robot", "#C6E1F2"],
  racecar: ["Race car", "#F2C230"],
  pencil: ["Pencil", "#D7EDE8"],
  rocket: ["Rocket", "#1B2A32"],
  paintbrush: ["Paintbrush", "#BFA5E0"],
  guitar: ["Guitar", "#F5E7CC"],
  dinosaur: ["Dinosaur", "#E6F0F2"],
  planet: ["Planet", "#1B2A32"],
  lightbulb: ["Light bulb", "#FFFBF3"],
  gear: ["Gear", "#F5E7CC"],
  music: ["Music notes", "#F2C230"],
  microscope: ["Microscope", "#D7EDE8"],
  book: ["Book", "#C6E1F2"],
  telescope: ["Telescope", "#1B2A32"],
  drum: ["Drum", "#BFA5E0"],
  crayon: ["Crayon", "#F2C230"],
  magnet: ["Magnet", "#E6F0F2"],
  headphones: ["Headphones", "#7FD1C1"],
  airplane: ["Paper airplane", "#C6E1F2"],
  star: ["Star", "#1273B0"],
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

/** The avatar picture on its round ground (the box around it makes it round). With a label it is an image with that
 *  name; without one it is decoration (next to the child's name) and hidden from screen readers. An unknown id shows
 *  the first avatar. The name stays avatarSVG so every place that shows one keeps working. */
export function avatarSVG(id, label) {
  const key = Object.hasOwn(ART, id) ? id : AVATAR_IDS[0];
  const say = typeof label === "string" && label
    ? ' alt="' + label.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") + '"'
    : ' alt="" aria-hidden="true"';
  return '<img class="av-svg" src="/assets/avatars/' + key + '.webp" width="256" height="256" decoding="async"' + say
    + ' style="background:' + ART[key][1] + '">';
}
