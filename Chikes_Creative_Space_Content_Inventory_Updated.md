# Chike's Creative Space — Content Inventory

A page-by-page content inventory for the Chike's Creative Space prototype. It documents current and recommended public-facing copy for headings, intros, key content blocks, calls to action, and navigation. Values such as `[N]` are dynamic and should be supplied by the content system at render time.

---

## Sitewide

### Header and navigation
*Appears on every page*

- **Desktop navigation:** Home · Create · Read · Watch · Play · Meet Chike · Grown-Ups · About · Shop
- **Desktop header actions:** “Join our mailing list” · “Donate”
- **Mobile global navigation:** A fixed, safe-area-aware bottom navigation with five primary destinations:
  - Home
  - Watch
  - Play
  - Create
  - More
- **Mobile header:** CCS logo only. Do not display a second hamburger menu that duplicates the bottom navigation.
- **Mobile More sheet:** Opens from the More item in the fixed bottom navigation. It should be titled **“More to Explore”** and group lower-frequency links clearly:
  - **Explore:** Read · Meet Chike
  - **For Grown-Ups:** Parent & Educator Resources · Workshops · Contact · Donate
  - **About CCS:** About · Our Mission · Our Vision · Team · Business Inquiries · Shop · Privacy · Terms
- **Mobile contextual subnavigation:** On sections with subpages, place a compact sticky switcher directly below the mobile header. It must remain visible during scrolling and show both the parent section and current subsection, for example: `ABOUT • What We Are` or `PLAY • Online Games`.
- **Subnavigation interaction:** Tapping the contextual switcher opens a bottom sheet listing every subsection. Selecting a page must immediately close the sheet, navigate to the selected page, update the sticky label, and reveal the destination content. No navigation overlay may remain open after route changes.

### Footer
*Appears on every page*

- **Strapline:** “Helping kids turn ideas into creations, creations into discoveries, and discoveries into confidence.”
- **Explore:** Create · Play · Watch · Stories · Meet Chike
- **For Grown-Ups:** About · Parent & Educator Guide · Articles · Contact Us
- **Shop and legal:** Shop · Donate · Help and Contact · Privacy Policy · Terms and Conditions
- **Newsletter:** “One email a month. New activities, no noise.”
- **Newsletter CTA:** “Join”
- **Social links:** YouTube · Instagram · Facebook · TikTok · Amazon
- **Bottom bar:** “Made for kids. Loved by grown-ups.”
- **Prototype-only note:** “Local prototype build. Content is stored in this browser only.” Remove this note before public launch.

### Recurring blocks

**Join our mailing list**

- **Heading:** “Join our mailing list”
- **Body:** “One email a month. New activities, no noise.”
- **Actions:** Cancel · Join

**Donate strip**

- **Heading:** “Help Us Create More Ways to Learn, Imagine, and Make!”
- **Body:** “Your donation helps Chike’s Creative Space create new animated adventures, hands-on activities, printable resources, and free community workshops that inspire kids to explore their biggest ideas.”
- **CTA:** “Donate”

**Announcement modal**

- Admin-editable announcement with heading, body, optional call to action, and a “Got it” dismiss button.

---

## Home
`/`

- **Eyebrow:** “Welcome to Chike’s Creative Space”
- **Heading:** “Let’s create something **[rotating word]**!”
- **Rotating words:** imaginative · brilliant · amazing · extraordinary · adventurous · remarkable · awesome · unforgettable · magical · incredible · bold · curious · fun · out of this world · one-of-a-kind
- **Intro:** “This is a place where kids build, draw, play, read, and explore. Start with a project, game, story, or printable, then use your imagination to make it your own.”
- **Primary CTA:** “Create something”
- **Path cards:** Create Something · Play Games · Watch Adventures · Read Together
- **Stats:**
  - `[N]` activities with full instructions
  - `[N]` games to play online or offline
  - `[N]` animated adventures with Chike and friends

### Newest episode

- **Eyebrow:** “Newest episode”
- **Heading:** Dynamic latest published episode title
- **CTA:** “Watch Episode [N]”
- **Secondary CTA:** “All Episodes”

### Popular projects

- **Eyebrow:** “Activities”
- **Heading:** “Popular projects to start with.”
- **Intro:** “Every activity includes what you need, simple steps, safety notes, and one new thing to discover.”
- **CTA:** “See All [N] Activities”

### Collections

- **Eyebrow:** “Collections”
- **Heading:** “Browse by time, place, or materials.”
- **Intro:** “Explore ready-made activity lists for the moments when you know what you have or how much time you have, but not quite what to make.”

### The Friends

- **Eyebrow:** “The Friends”
- **Heading:** “Eight friends. Endless ways to create.”
- **Intro:** “Chike, Zech, and their friends each create in their own way. From drawing and building to music, reading, coding, dancing, and imaginative play, every creative outlet belongs here.”
- **CTA:** “Meet the Friends”

### For Grown-Ups

- **Eyebrow:** “For Grown-Ups”
- **Heading:** “Resources for the people creating alongside kids.”
- **Intro:** “Find materials lists, safety notes, easy steps, and conversation starters to help children keep exploring, even when a project does not go exactly as planned.”
- **CTAs:** “Explore the Guide” · “Free Printables”

---

## Create
`/create`

- **Eyebrow:** “Create”
- **Heading:** “Hmmm, what should we create today?”
- **Intro:** “Tell us what you have, what you want to explore, and how much time you have. We’ll help you find an activity to build, test, and make your own.”
- **Activity finder steps:**
  1. “What materials do you have?”
  2. “What would you like to explore?”
  3. “How much time do you have?”
- **Actions:** Back · Next · “Show Me Three Activities”
- **Results heading:** “The Three That Fit Best”
- **No-exact-match heading:** “Nothing Matched Perfectly. Try These.”
- **CTA:** “Start Over”

### Browse all activities

- **Heading:** “Or explore all [N] activities.”
- **Intro:** “Every activity includes what you need, easy-to-follow steps, safety notes, and one thing to learn along the way.”
- **Filters:** Type · Access · Collection · Search · Pagination

---

## Watch
`/watch`

- **Eyebrow:** “Watch”
- **Heading:** “Big creative adventures in just a few minutes.”
- **Intro:** “Each animated episode starts with a creative idea and turns it into an adventure, a discovery, and something children can try for themselves.”
- **CTA:** “Visit Our YouTube Channel”
- **Content:** Latest episode feature followed by the full episode library.
- **Unreleased label:** “Coming Soon” rather than “Not filmed yet.”

---

## Read
`/stories`

- **Eyebrow:** “Read”
- **Heading:** “Stories to read together.”
- **Intro:** “Explore our growing collection of picture books for curious readers and creative families. Each story invites children to imagine, wonder, and see the world in a new way. Some books may include a creative activity, project, or space to write and draw their own ending.”
- **Coming-soon message:** “More Chike’s Creative Space books are coming soon!”
- **Card CTA:** “Read”
- **Filters:** By character · Search

---

## Play
`/play`

### Online Games
`/play/online`

- **Eyebrow:** “Play”
- **Heading:** “Online Games”
- **Intro:** “Play, solve, and create your next big idea. Explore quick challenges, puzzles, matching games, and practice games, then discover a hands-on project to make next.”
- **Mobile contextual label:** `PLAY • Online Games`
- **Subsections:** Online Games · Offline Games

### Offline Games
`/play/offline`

- **Eyebrow:** “Play”
- **Heading:** “Offline Games”
- **Intro:** “Big fun beyond the screen. Download a game sheet if you need one, then put the device away and start playing. Most games use paper, a few everyday items, and often a friend or family member.”
- **Mobile contextual label:** `PLAY • Offline Games`

---

## Meet Chike
`/characters`

- **Eyebrow:** “The Friends”
- **Heading:** “Eight friends. Endless ways to create.”
- **Intro:** “Chike, Zech, and their friends are a creative neighborhood. Each friend has a different outlet, showing children that there is no single right way to make, imagine, or learn.”
- **Supporting copy:** “Tap a friend to see what they love to create.”
- **Content:** Eight-character grid.

---

## Grown-Ups

### Parent and Educator Guide
`/grown-ups`

- **Eyebrow:** “Grown-Ups”
- **Heading:** “A guide for parents, caregivers, and teachers.”
- **Intro:** “Find simple ways to set up an activity, encourage a child when a project changes direction, and help them stay curious through the making process.”
- **CTAs:** “Find an Activity” · “Free Printables”
- **Supporting content:** Why hands-on making matters and a practical “What to Do While They Make” tip list.
- **Subsections:** Help and Support · Articles · Contact Us

### Help and Support
`/grown-ups/help`

- **Eyebrow:** “Grown-Ups”
- **Heading:** “Help and Support”
- **Intro:** “Find answers about ages, materials, printables, safety, accessibility, and using Chike’s Creative Space at home or in the classroom.”
- **Content:** Grouped FAQ accordion.

### Articles
`/grown-ups/articles`

- **Eyebrow:** “Grown-Ups”
- **Heading:** “Articles for parents and teachers.”
- **Intro:** “Short, practical reads about making, learning through play, creativity, and using screen time with intention.”

### Contact Us
`/grown-ups/contact`

- **Eyebrow:** “Contact Us”
- **Heading:** “Let’s create something extraordinary together.”
- **Intro:** “We’d love to hear from curious creators, families, educators, libraries, community organizations, and potential partners. Share a question, creative idea, classroom inquiry, workshop request, or partnership opportunity.”
- **Family and child message:** “Young creators, please ask a parent, caregiver, or trusted adult to help you send a message.”
- **CTA:** “Send Message”
- **Supporting panel heading:** “Other Ways to Reach Us”

---

## About

### What We Are
`/about`

- **Eyebrow:** “About”
- **Heading:** “Where ideas turn into real things.”
- **Intro/body:** “Most of what a child sees today is made to be watched, not made. Chike’s Creative Space exists to bring making back within reach. Every story, activity, game, and printable begins with the same question: what happens when a child decides to build something instead of only watch it?”
- **CTA:** “Download Our Brand Purpose PDF”
- **Mobile flow:** “Next Up” card followed by “Explore More About CCS.”

### Our Mission
`/about/mission`

- **Eyebrow:** “About”
- **Heading:** “Our Mission”
- **Intro:** “To help children see themselves as curious creators who can imagine possibilities, make something real, learn from the process, and share their ideas with confidence.”
- **Closing statement:** “Every creation leads to a discovery, and every discovery helps a child grow in confidence.”
- **Supporting blocks:** “What We Promise” checklist and “The Five Steps Behind Every Activity”: Create · Discover · Learn · Grow · Share.

### Our Vision
`/about/vision`

- **Eyebrow:** “About”
- **Heading:** “Our Vision”
- **Intro:** “We envision a world where every child sees themselves as a creator: someone who can imagine possibilities, build, fix, explore, invent, and share ideas with confidence.”
- **Body heading:** “Imagine. Make. Learn. Grow.”
- **Body:** “A child begins with an idea and brings it to life through drawing, building, coding, reading, music, movement, or play. Along the way, they discover something new. That discovery builds confidence, and confidence gives them the courage to dream even bigger next time.”
- **Supporting content:** Community Workshops · Every Way of Creating Counts.

### The Team
`/about/team`

- **Eyebrow:** “About”
- **Heading:** “The Team”
- **Intro:** “Meet the people creating Chike’s Creative Space.”
- **Working-with-us CTA:** “Contact Us”

### Business Inquiries
`/about/business`

- **Eyebrow:** “About”
- **Heading:** “Business Inquiries”
- **Intro:** “For partnerships, licensing, press, retail, and collaboration opportunities, our team is here to help.”
- **Inquiry categories:** Brand Partnerships and Sponsorships · Character or Story Licensing · Press and Media · Wholesale and Retail
- **CTA:** “Send Inquiry”

---

## Shop

### Books on Amazon
`/shop/amazon`

- **Eyebrow:** “Our Books”
- **Heading:** “[N] Titles on Amazon”
- **Intro:** “Explore workbooks, drawing books, and notebooks by LeeAndria Anusiem. Each title opens on its own Amazon page.”
- **CTA:** “Visit the Store”
- **Supporting heading:** “Recommended Supplies”
- **Supporting intro:** “Materials that pair well with Chike’s Creative Space activities.”
- **Note:** Clearly state whether links are affiliate links. If they are not affiliate links, use: “These are simple recommendations, not affiliate links.”

### Printables
`/shop/printables`

- **Eyebrow:** “Print at Home”
- **Heading:** “[N] Activity Packs”
- **Intro:** “Each printable pack includes activity cards, a materials list, simple instructions, and questions to keep the discovery going.”
- **Prototype notice:** “This is a prototype. Checkout is not available yet, and no payments can be accepted on this page.” Remove this notice when checkout is live.

---

## Donate
`/donate`

- **Heading:** “Help Us Create More Ways to Learn, Imagine, and Make!”
- **Intro:** “Your donation helps Chike’s Creative Space create new animated adventures, hands-on activities, printable resources, and free community workshops that inspire kids to explore their biggest ideas.”
- **Where your gift helps:**
  - New animated adventures
  - Hands-on activities and real-world activity videos
  - Free printable resources for families and educators
  - Captions, accessibility, and website resources
  - Community creative workshops
- **Heading 2:** “Give Once, or Give Monthly”
- **Intro 2:** “Every contribution helps us create more opportunities for children to imagine, make, learn, and grow.”
- **Donation controls:** One-Time · Monthly · “Give $5” · “Give $20” · “Give a Custom Amount”
- **Other ways to help:** Share an activity · Invite CCS to your school or library · Tell us what your child created · Explore a printable pack
- **CTA:** “Get in Touch”

---

## Legal

### Privacy Policy
`/privacy`

- **Eyebrow:** “Privacy”
- **Heading:** “Privacy Policy”
- **Intro:** “Learn what this site stores, where it stores it, and what information we do not collect.”

### Terms and Conditions
`/terms`

- **Eyebrow:** “Terms”
- **Heading:** “Terms and Conditions”
- **Intro:** “Learn how you may use the materials on this site and what Chike’s Creative Space does and does not promise.”

---

## Dynamic detail templates

These routes render individual records. Copy should follow these patterns.

- **Activity** — `/activity/[id]` — materials list, numbered steps, safety notes, a learning fact, and any age guidance. The steps are the primary experience.
- **Video** — `/watch/[id]` — video facade copy: “Nothing loads from YouTube until you press play.” CTA: “Play.”
- **Game** — `/play/[id]` — CTA: “Play [Game Title].” Supporting copy: “Opens in the full window. Press Escape to come back.”
- **Story** — `/stories/[id]` — opening-line pull quote, then “Read the Book” or “Write Your Own Ending.”
- **Character** — `/characters/[slug]` — tagline, creative outlet, “Never Far From” list, related activities, episodes, and stories.
- **Collection** — `/collection/[id]` — title, short description, and a matching activity grid.

---

## Not Found and Offline

### Not Found
*Any invalid route*

- **Heading:** “That [page/activity/story/etc.] is not here.”
- **Body:** “It may have moved, been archived, or not be ready yet.”
- **CTA:** “Back to the Treehouse”

### Offline Fallback
`offline.html`

- **Heading:** “You’re offline, but your next creative adventure is still waiting.”
- **Body:** “Check your connection and try again!”
- **CTA:** “Try Again”

---

## Content and UX guardrails

- Use title case for navigation labels, buttons, and headings consistently.
- Use “Chike’s Creative Space” with a curly apostrophe in visible copy.
- Do not use em dashes in public-facing copy.
- Keep language welcoming, simple, encouraging, and suitable for children, families, educators, and community partners.
- Avoid framing creativity as competition, perfection, or a single correct outcome.
- Use “Coming Soon” for unreleased content rather than negative labels such as “Not filmed yet.”
- Do not expose prototype-only, local-storage, admin, checkout-disabled, or development language on the public production site.
- On mobile, never display cut-off desktop tabs or duplicate primary navigation controls.
- All route changes from menus, sheets, and section switchers must close the navigation surface automatically before revealing the new page.

---

*Updated content inventory for Chike’s Creative Space. This document is intended to guide site copy, content-system entries, and mobile navigation behavior.*
