/* Search titles and descriptions for the site's section pages (owner, 2026-11-24: "so that people can find us when
   searching for kids learning, kids learning games, children's books, kid activities, STEM for kids, fun education
   for kids"). The words people search for go first in each title; each description says plainly what is on the page.
   STEAMM is the site's word (STEM plus art and music), so STEM only appears inside that explanation.

   The same table sits in index.html (SEO_PAGES, set as the page opens in a browser); a test keeps the two identical.
   functions/_middleware.js hands it to crawlers, which do not run the app's JavaScript, together with a short
   readable page body (crawlerBody) in place of the empty app container. */

export const SEO_PAGES = {
  "/": { h1: "Fun learning for kids", title: "Chike's Creative Space | Fun Learning Games, Books and Activities for Kids", desc: "Fun education for kids ages 5 to 11: free learning games, children's picture books, hands-on activities, videos and STEAMM lessons (STEM plus art and music)." },
  "/create": { h1: "Kids activities", title: "Kids Activities: Art, Crafts and STEAMM Projects | Chike's Creative Space", desc: "Hands-on activities for kids ages 5 to 11: art and craft projects, science and building ideas, and computer lessons, sorted by age, time and materials." },
  "/create/browse": { h1: "Art and craft activities for kids", title: "Art and Craft Activities for Kids | Chike's Creative Space", desc: "Step-by-step art and craft activities for kids, with the materials, ages and times for each, so a grown-up and a child can make something real together." },
  "/create/tech": { h1: "Digital activities for kids", title: "Digital Activities and AI Lessons for Kids | Chike's Creative Space", desc: "Computer and tablet lessons for kids: writing, AI and hands-free activities that turn screen time into making time." },
  "/create/studio": { h1: "Chike's Creative Studio", title: "Drawing and Music Apps for Kids | Chike's Creative Space", desc: "Chike's Creative Studio: kid-friendly apps for drawing and making music, right in the browser." },
  "/play": { h1: "Learning games for kids", title: "Free Online Learning Games for Kids | Chike's Creative Space", desc: "Educational games for kids: math, spelling, word search, memory, music and logic games to play in the browser on a computer, tablet or phone." },
  "/play/online": { h1: "Learning games for kids", title: "Free Online Learning Games for Kids | Chike's Creative Space", desc: "Educational games for kids: math, spelling, word search, memory, music and logic games to play in the browser on a computer, tablet or phone." },
  "/play/offline": { h1: "Offline games for kids", title: "Offline Games for Kids: Screen-Free Learning Fun | Chike's Creative Space", desc: "Unplugged games for kids to play at home or in class, with simple supplies and easy rules that build thinking skills." },
  "/watch": { h1: "Videos for kids", title: "Educational Videos and Cartoons for Kids | Chike's Creative Space", desc: "Short animated episodes with Chike and friends, each one linked to a hands-on activity kids can try after watching." },
  "/stories": { h1: "Children's books", title: "Children's Books and Ebooks to Read Online | Chike's Creative Space", desc: "Read children's picture books online with Chike and friends: illustrated stories about making, discovering and trying again, for kids ages 5 to 11." },
  "/characters": { h1: "Meet Chike and friends", title: "Meet Chike and Friends | Chike's Creative Space", desc: "Meet the characters of Chike's Creative Space, young makers who each love a different part of STEAMM: science, technology, engineering, art, math and music." },
  "/grown-ups": { h1: "Parent and teacher guide", title: "Parent and Teacher Guide to Kids Learning | Chike's Creative Space", desc: "Answers for parents and teachers: ages, materials, safety, and how to use Chike's Creative Space games and activities at home or in the classroom." },
  "/grown-ups/articles": { h1: "Articles for parents and teachers", title: "Articles on Creative Learning for Kids | Chike's Creative Space", desc: "Ideas and news for parents and teachers on creative learning, STEAMM education and making the most of screen time for kids." },
  "/grown-ups/help": { h1: "Help and support", title: "Help and Support | Chike's Creative Space", desc: "Help with Chike's Creative Space: the games, the books, the Subscriber's Portal and your account." },
  "/grown-ups/contact": { h1: "Contact us", title: "Contact Us | Chike's Creative Space", desc: "Get in touch with the team behind Chike's Creative Space." },
  "/about": { h1: "About Chike's Creative Space", title: "About Us | Chike's Creative Space", desc: "Chike's Creative Space makes fun learning for kids: games, children's books, videos and hands-on STEAMM activities." },
  "/about/team": { h1: "About Chike's Creative Space", title: "About Us | Chike's Creative Space", desc: "Chike's Creative Space makes fun learning for kids: games, children's books, videos and hands-on STEAMM activities." },
  "/about/mission": { h1: "Our mission", title: "Our Mission | Chike's Creative Space", desc: "Why Chike's Creative Space exists: to turn kids from watchers into makers through play, stories and hands-on learning." },
  "/about/vision": { h1: "Our vision", title: "Our Vision | Chike's Creative Space", desc: "Our vision for Chike's Creative Space: creative, hands-on STEAMM learning for kids, at home and in the classroom." },
  "/about/steamm": { h1: "STEAMM education for kids", title: "STEAMM Education for Kids: STEM Plus Art and Music | Chike's Creative Space", desc: "Why we teach STEAMM, not just STEM: science, technology, engineering, art, math and music, learned through making, play and creative habits." },
  "/about/business": { h1: "Business inquiries", title: "Business Inquiries | Chike's Creative Space", desc: "Partnerships and business inquiries for Chike's Creative Space." },
  "/shop": { h1: "Shop", title: "Children's Books and Learning Supplies | Chike's Creative Space", desc: "Books by Chike's Creative Space, and the supplies our kids activities use." },
  "/donate": { h1: "Support Chike's Creative Space", title: "Support Fun Learning for Kids | Chike's Creative Space", desc: "Help keep Chike's Creative Space growing, with new games, books and activities for kids." }
};

/* the words that follow an item's own title, by the kind of page it is */
export const ITEM_LABELS = { games: "Learning Game for Kids", activities: "Kids Activity", stories: "Children's Book", videos: "Kids Video", articles: "" };

/* the sections a crawler can follow from any page */
export const SECTION_LINKS = [
  ["/play/online", "Learning games for kids"], ["/stories", "Children's books"], ["/create", "Kids activities"],
  ["/watch", "Videos for kids"], ["/characters", "Meet Chike and friends"], ["/about/steamm", "STEAMM education"],
  ["/grown-ups", "For parents and teachers"]
];

/** The section page for an address, or null: "/play/online/" and "/play/online" are the same page. */
export function seoFor(pathname){
  const key = "/" + String(pathname || "").replace(/^\/+|\/+$/g, "");
  return Object.prototype.hasOwnProperty.call(SEO_PAGES, key) ? SEO_PAGES[key] : null;
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** A short page a crawler can read: the heading, the description, an optional picture, and links to the sections.
    It says the same things the app shows a person on that page; the app replaces it as soon as it runs. */
export function crawlerBody({ h1, desc, image, imageAlt }){
  return '<main><h1>' + esc(h1) + '</h1>'
    + (desc ? '<p>' + esc(desc) + '</p>' : '')
    + (image ? '<img src="' + esc(image) + '" alt="' + esc(imageAlt || h1) + '">' : '')
    + '<nav><ul>' + SECTION_LINKS.map(([href, label]) => '<li><a href="' + href + '">' + esc(label) + '</a></li>').join("") + '</ul></nav></main>';
}
