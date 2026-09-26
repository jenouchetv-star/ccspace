// Chike's Creative Space - Activity Finder matching engine
//
// Rule-based and deterministic. No profiling, no learning, no hidden
// weighting: the score and the reasons come from the same table, and the
// table is printed on the page (see finderStepMarkup() in index.html).
//
// This is the one piece of "the product working end to end" that's worth
// covering with a test: pick some materials/theme/time, and the same
// three activities come back every time, in the same order, for the same
// reasons. It has no dependency on Supabase, localStorage, or the DOM, so
// it's imported both by index.html (for the real, live catalog) and by
// test/activityFinder.test.js (against small fixture activities) - the
// exact same code runs in both places, nothing duplicated.
//
// charName/topicMeta are passed in as options rather than imported,
// because the real versions (index.html) look a character/topic id up in
// the live database - something this module has no business knowing
// about, and something a test has no business needing a database for.
// Left unset, they fall back to using the id itself, which is enough to
// exercise scoreFind()'s own logic without a catalog of real names.

export const FIND_MATERIALS = [
  { id:"paper",    label:"Paper & drawing",      eg:"printer paper, construction paper, index cards, newspaper, crayons, markers, pencils, colored pencils" },
  { id:"boxes",    label:"Boxes & recyclables",  eg:"cardboard boxes, cereal boxes, paper tubes, egg cartons, plastic bottles, bottle caps, clean containers" },
  { id:"connect",  label:"Connect & build",      eg:"tape, glue, rubber bands, string, yarn, pipe cleaners, craft sticks, toothpicks, clothespins, paper clips" },
  { id:"cut",      label:"Cut, shape & measure", eg:"safety scissors, ruler, measuring tape, hole punch, clay, dough, aluminum foil" },
  { id:"kitchen",  label:"Kitchen science",      eg:"cups, bowls, spoons, straws, baking soda, vinegar, salt, sugar, food coloring, cooking oil, dish soap, coffee filters" },
  { id:"launch",   label:"Move & launch",        eg:"balloons, toy cars, marbles, ping-pong balls, small balls, cups, cardboard tubes" },
  { id:"lightsnd", label:"Light & sound",        eg:"flashlight, mirror, clear cup, plastic wrap, rubber bands, rice, beans, empty containers" },
  { id:"outside",  label:"Outside discoveries",  eg:"leaves, sticks, rocks, pinecones, soil, flowers, seed pods, water, ice, sand" },
  { id:"toys",     label:"Toys",                 eg:"toy cars, figures, blocks, and the toys already on the floor" },
  { id:"basics",   label:"Basics only",          eg:"paper, pencil, tape, and common household objects" },
  { id:"surprise", label:"Surprise me",          eg:"any activity with easy-to-find materials" }
];
export const findMaterial = id => FIND_MATERIALS.find(m => m.id === id) || { id:id, label:id, eg:"" };

export const FIND_THEMES = [
  { id:"fly",      label:"Fly & Move",       icon:"rocket",        bg:"#CFE7F7" },
  { id:"build",    label:"Build & Test",     icon:"hammer",        bg:"#FFE6A6" },
  { id:"mix",      label:"Mix & Observe",    icon:"flask-conical", bg:"#BFEDE3" },
  { id:"nature",   label:"Nature Detective", icon:"leaf",          bg:"#CDE9C2" },
  { id:"light",    label:"Light & Sound",    icon:"lightbulb",     bg:"#FBE3A8" },
  { id:"space",    label:"Space Explorer",   icon:"telescope",     bg:"#E7DAF6" },
  { id:"code",     label:"Code & Think",     icon:"binary",        bg:"#C6E1F2" },
  { id:"surprise", label:"Surprise Me",      icon:"dices",         bg:"#F8C0B9" }
];
export const findTheme = id => FIND_THEMES.find(t => t.id === id) || { id:id, label:id, icon:"dices" };

export const FIND_TIMES = [
  { id:"quick",  label:"Quick Make",    note:"5 to 10 minutes" },
  { id:"create", label:"Create & Test", note:"15 to 30 minutes" },
  { id:"big",    label:"Big Build",     note:"30 minutes or more" }
];
export const findTime = id => FIND_TIMES.find(t => t.id === id) || { id:id, label:id, note:"" };

export const FIND_AGES      = [{id:"3-5",label:"3 to 5",min:3,max:5},{id:"6-8",label:"6 to 8",min:6,max:8},{id:"9-12",label:"9 to 12",min:9,max:12}];
export const FIND_SUPPORT   = [{id:"kid",label:"Kid can lead"},{id:"nearby",label:"Grown-up nearby"},{id:"hands-on",label:"Grown-up hands-on"}];
export const FIND_CHALLENGE = [{id:"easy",label:"Easy start"},{id:"stretch",label:"Stretch challenge"},{id:"big",label:"Big challenge"}];
export const findLabel = (list, id) => (list.find(x => x.id === id) || { label:id }).label;

export function findBands(a){
  const bands = [];
  if (a.mins <= 10) bands.push("quick");
  if (a.mins >= 15 && a.mins <= 30 && !a.plus) bands.push("create");
  if (a.mins >= 30 || a.plus) bands.push("big");
  return bands;
}

/**
 * Weighted matching. An activity does not need to match every input, and no
 * single answer can rule one out - a low score simply loses to a higher one.
 */
export function scoreFind(a, f, opts){
  opts = opts || {};
  const charName = opts.charName || (id => id);
  const topicMeta = opts.topicMeta || (id => ({ id:id, label:id }));
  let score = 0;
  const why = [];
  const gaps = [];

  /* Step 1: something you have. Four points each, twelve at most. */
  const picked = (f.materials || []).filter(m => m !== "surprise");
  if (picked.length){
    const shared = picked.filter(m => a.materials.indexOf(m) >= 0);
    score += Math.min(shared.length * 4, 12);
    if (shared.length) why.push("Uses " + shared.map(m => findMaterial(m).label.toLowerCase()).join(" and "));
    const missing = picked.filter(m => a.materials.indexOf(m) < 0);
    if (shared.length && missing.length) gaps.push("Does not use " + missing.map(m => findMaterial(m).label.toLowerCase()).join(" or "));
    /* rule 4: nothing matched every category, so say what else is needed */
    if (!shared.length) gaps.push("Ask a grown-up for help finding this");
  }

  /* Step 2: what you want to explore. */
  if (f.theme && f.theme !== "surprise" && a.themes.indexOf(f.theme) >= 0){
    score += 5; why.push(findTheme(f.theme).label);
  }

  /* Step 3: how much time. */
  if (f.time && findBands(a).indexOf(f.time) >= 0){
    score += 4; why.push(findTime(f.time).label + ", " + findTime(f.time).note);
  }

  /* Rule 3: Surprise Me leans on the gentlest activities. */
  if (f.theme === "surprise" || (f.materials || []).indexOf("surprise") >= 0){
    if (a.challenge === "easy") score += 3;
    if (a.support === "kid") score += 3;
    if (a.mins >= 5 && a.mins <= 20 && !a.plus) score += 3;
  }

  /* The filters underneath the results. */
  if (f.age){
    const band = FIND_AGES.find(x => x.id === f.age);
    if (band && a.ageMin <= band.max && a.ageMax >= band.min){
      score += 4; why.push("Written for ages " + a.ageMin + " to " + a.ageMax);
    }
    /* rule 5: under-fives are not sent to hands-on-only activities */
    if (f.age === "3-5" && a.support === "hands-on"){
      score -= 12; gaps.push("A grown-up needs to be hands-on for this one");
    }
  }
  if (f.place && (a.place === f.place || a.place === "either" || f.place === "either")){ score += 2; }
  if (f.support && a.support === f.support){ score += 2; why.push(findLabel(FIND_SUPPORT, f.support)); }
  if (f.challenge && a.challenge === f.challenge){ score += 2; why.push(findLabel(FIND_CHALLENGE, f.challenge)); }
  if (f.character && a.character === f.character){ score += 3; why.push("One of " + charName(a.character) + "’s"); }
  if (f.topic && a.topic === f.topic){ score += 3; why.push(topicMeta(a.topic).label); }
  if (f.access && a.access === f.access){ score += 2; }

  return { activity:a, score:score, why:why.slice(0,4), gaps:gaps.slice(0,2) };
}

/**
 * The three to show. Rule 2 caps any one character at two of the three, so a
 * run of one character's activities cannot fill the whole answer.
 */
export function findTopMatches(activities, filters, opts){
  const scored = activities.map(a => scoreFind(a, filters, opts));
  scored.sort((x, y) => (y.score - x.score) || x.activity.id.localeCompare(y.activity.id));

  const chosen = [];
  const seen = {};
  scored.forEach(r => {
    if (chosen.length >= 3) return;
    const c = r.activity.character;
    if ((seen[c] || 0) >= 2) return;
    seen[c] = (seen[c] || 0) + 1;
    chosen.push(r);
  });
  /* if the cap left us short, top up in score order */
  scored.forEach(r => { if (chosen.length < 3 && chosen.indexOf(r) < 0) chosen.push(r); });
  return chosen.slice(0, 3);
}
