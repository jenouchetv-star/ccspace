# From visits to income: a long-term revenue strategy

Chike's Creative Space · working document, written 28 Oct 2026

This is a strategy to follow over two to three years, not a list of quick wins. It assumes the site stays what it is: a free, kid-safe place to make, play, read and watch, paid for by the grown-ups around the child.

**Not for the public site.** This file is listed in `.assetsignore`, so it stays in the repo and is not deployed.

---

## 1. Where we are today

What the site already has (counts are from the live database on 28 Oct 2026):

| Asset | Count | Notes |
|---|---|---|
| Games published | 17 | Includes 6 away-from-the-screen games |
| Activities | 22 | Hands-on, with discovery questions |
| Picture books (stories) | 8 | Read free in the site's own reader |
| Episodes (videos) | 10 | Live on YouTube and the site |
| Printable packs | 6 | Built, **switched off** (`SHOP_PRINTABLES_ENABLED = false`), no checkout |
| Our own books on Amazon | 16 | Linked from the Shop page, bought on Amazon |
| Newsletter subscribers | 22 | All confirmed |
| Donate / Support | built | **Hidden** (`DONATE_LINKS_ENABLED = false`) until Stripe is connected |
| Business inquiries page | live | Partnerships, licensing, press, wholesale |
| Workshops | mentioned | Listed under For Grown-Ups, no booking path yet |

Traffic, from the Analytics screen (30-day range): **1,520 page views**, about 93% from the US. Top pages are the home page (390), Play (210), Watch (160) and Doodle Dash (150). The biggest referrer is the site itself, with Google and Instagram around 20 each. These are page views, not people; one visitor can account for several. Page load at the 99th percentile is 19.8 seconds, which is worth fixing before sending more traffic.

Three facts decide the strategy:

1. **Today the site earns almost nothing directly.** The only live money path is a link to Amazon.
2. **The audience is small but the catalog is large.** 70-plus pieces of content for 1,520 monthly views means the catalog is under-used, not thin.
3. **The site is blocked from search on purpose** (`robots.txt` Disallow plus a `noindex` tag). That protects a prototype but also caps free growth. See decision D1.

---

## 2. Principles that every idea has to pass

- **The child is the audience; the grown-up is the customer.** Nothing is sold to a child, and nothing asks a child for money.
- **No ads, no tracking of children.** The site is cookieless today. Display ads would break the trust the brand is built on, and would pull in the US children's privacy law (COPPA). Keep it ad-free.
- **Free stays free.** Everything kids use now stays free. Paid things are extras for adults: more, deeper, printable, or for groups.
- **Every paid thing starts from something already loved.** We sell more of what people already finish and share, not new guesses.
- **Revenue should not depend on one source.** Aim for no single stream above 50% of income by year three.

---

## 3. The model: visits, then relationships, then revenue

```
visit  ->  subscriber  ->  buyer / booker  ->  repeat customer / advocate
 (free)    (email, free)    (money in)         (recurring)
```

Revenue per month is roughly:

> **visitors x email sign-up rate x purchase rate x average order**, plus everything that does not need an email at all (books on Amazon, workshop bookings, sponsors).

Why the email step matters: social platforms and search rank you today and forget you tomorrow. An email list is the one audience we own. Every stream below is easier to sell to a list.

### Funnel math (illustrative, to be replaced with our own numbers)

The rates below are **assumptions for planning**, typical of small content and education sites. They are not measured here. Replace them with real figures as soon as the tracking in section 7 is live.

| Stage | Assumption | Today (est.) | Goal for a $2,000/month mix |
|---|---|---|---|
| Monthly visitors (people, not views) | about 1.5-2 views per person | about 800-1,000 | 15,000-25,000 |
| Visitors who join the list | 2-4% | about 22 total so far | 400-800 new per month |
| List size | grows monthly | 22 | 3,000-5,000 |
| List members who buy something each year | 3-6% | - | 150-250 buyers |
| Average spend per buyer | $12-30 printables / books | - | about $20 |

Read this as: **a $2,000 per month mix is reachable with an audience in the low thousands of engaged grown-ups, if the ideas below are in place.** It is not reachable from 1,500 page views, however good the offers are. Growth and offers both have to move.

---

## 4. Revenue streams, ranked by fit

Ranked by how well each fits the brand, how soon it can start, and how much effort it needs. Section 6 turns them into a sequence.

### A. Printable packs (highest fit, closest to ready)

Six packs are built and a cart exists. What is missing is a real checkout, not content.

- **Why it fits:** parents already look for printables; it costs nothing to deliver; it matches the free activities.
- **Model:** single packs ($4-8), then bundles by theme or age ($15-25), then a yearly "all packs" pass.
- **What to build:** Stripe checkout (Payment Links first, because the site has no server of its own), instant download after payment, a receipt email, a refund policy, and the "prototype" warnings removed.
- **Free-to-paid ladder:** keep one or two free packs as the reward for joining the list, then offer the paid packs in the welcome series.

### B. Our own books (already earning, under-promoted)

Sixteen titles sit on Amazon.

- **Why it fits:** royalties with no inventory; the books are the brand's most durable product.
- **Model:** every episode, game and activity points to the matching book, in the same place and the same words. A "from the screen to the page" link on each character page.
- **Next:** a short new title each year that grows out of the best-performing activity. Direct-sale bundles (book plus printable pack) later, once checkout exists.

### C. Schools, libraries and community groups (the biggest long-term stream)

Grown-ups who buy for many children at once spend far more than parents do.

- **Workshops:** paid sessions at schools, libraries and community centers (in person or on video). The site already invites "workshop requests"; there is no booking path yet.
- **Classroom licence:** a yearly fee for teachers, with no ads, printable sets, a games guide, and a "run it in class" plan for each activity. Pathbuilder and the away-from-the-screen games are well suited.
- **District and library packages:** later, once two or three schools have used it and can be named as references.
- **Assumed pricing to test:** workshops $150-500 per session; classroom licence $30-100 per teacher per year. These are starting guesses to check against local rates, not facts.

### D. Membership for families (recurring, build after the list is large enough)

A monthly or yearly "Creators' Club" for grown-ups:

- a new activity pack each month,
- early access to episodes and new games,
- the members-only Newsletter Archive,
- seasonal projects (holidays, summer, back-to-school).

Recurring revenue is what makes the business plannable. Do not launch until there are at least 1,500 to 2,000 list members and six months of steady monthly content, or it will under-deliver and churn.

### E. Brand partnerships and sponsorship (selective)

The Business page already offers partnerships, licensing, press and wholesale.

- **Fit test:** a sponsor must be something we would recommend to a parent anyway (art supplies, books, educational toys, libraries). Nothing in front of children that sells to them.
- **Format:** a sponsored activity or sponsored "materials list", clearly labelled, never an ad.
- **Timing:** only worth pursuing once monthly reach is in the tens of thousands. Before that, keep it as inbound only.
- **Affiliate links:** the Shop page currently says the supply links are "not affiliate links." That is a trust choice. If it is ever changed, the disclosure must change with it and be visible on the page.

### F. Donations and grants (supplementary, not a plan)

- **Donate** is built. Turning it on is cheap once Stripe is connected.
- **Grants:** arts-education, literacy and early-STEM funders are a real source for a free, kid-safe resource. Most give only to tax-exempt organizations. The business is an LLC, which is not tax-exempt, so this needs a fiscal sponsor or a separate nonprofit. Treat it as a year two exploration.
- **Donations to an LLC are not tax-deductible for the giver.** The Donate page should say "support" rather than imply a charitable gift, unless a fiscal sponsor is in place.
- **Never the main income.** Donations are lumpy and depend on goodwill.

### G. Licensing the characters and stories (year three and beyond)

Books, puzzles, classroom materials and toys. This only works with an audience large enough for a partner to bet on, and the name-clearance work in `docs/name-clearance.md` has to be finished first. Keep it in view; do not chase it yet.

---

## 5. Growing the audience, so there is someone to sell to

Offers do nothing without reach. The reliable long-term sources, in order of payoff:

1. **Search.** Parents search for activities, printables and reading ideas. Every activity, story and game can be a page that answers a real search ("rainy day art for 6-year-olds"). This is the cheapest traffic over time and the one the site is currently turned off for. See D1.
2. **YouTube.** The episodes already live there. Each description should link to the matching activity page and the sign-up. Treat YouTube as the front door and the site as the home.
3. **Email itself.** Every subscriber is a referral source. Add a clear "forward this to a friend" line to each email, and a share button on each free printable.
4. **Educator and parent communities.** Teacher and homeschool groups share good free resources. A small set of excellent, well-credited free classroom resources travels further than posting.
5. **Instagram and short video.** Useful for reach, weak for conversion. Use it to send people to a free printable, not to sell.

Fix site speed first (the slowest 1% of page loads take almost 20 seconds), so new traffic does not bounce.

---

## 6. Sequence: stages with gates

Move to the next stage when the gate is met, not on a date.

### Stage 0: Foundations (now)
Make it possible to earn and to measure.
- Deploy the double opt-in email functions and run `supabase/double-opt-in.sql`, so the list is clean and legal.
- Open a business checking account in the LLC's exact legal name (needs the EIN and the articles of organization), then register Stripe as the LLC with that account. Stripe is the reason this comes first: it will not pay out to anything else.
- Connect Stripe; turn on Donate; turn on printable checkout (start with 2 packs).
- Add the tracking in section 7.
- Decide D1 (search).
- Fix slow page loads.

**Gate:** a stranger can pay for a printable and receive it with no help from us.

### Stage 1: First revenue and a real list (about months 1-6)
- Welcome series: free pack, then the story of the site, then the first paid pack.
- One email a month with a useful activity and one clear offer.
- Add a "book it" path for workshops (a form that creates a lead, with a price range stated).
- Link every episode and game to its matching book or pack.

**Gate:** list above 500; at least 20 paid orders; one paid workshop.

### Stage 2: Repeatable products (months 6-18)
- Bundles and the yearly "all packs" pass.
- A classroom page: what a teacher gets, a sample plan, a price.
- Publish a free resource a month for educators; ask satisfied schools for a quote.
- Evaluate the Creators' Club using list and open-rate data.

**Gate:** list above 2,000; monthly revenue covers hosting and tools with room to spare; two repeat institutional customers.

### Stage 3: Recurring revenue (months 18-30)
- Launch the Creators' Club if the data supports it.
- Classroom licence, then library and district packages.
- First sponsor conversations, using real reach and engagement numbers.
- Grant applications, if a suitable structure is in place.

**Gate:** recurring revenue above one-off revenue.

### Stage 4: Scale and licensing (month 30 onward)
- New titles and a seasonal release calendar.
- Character and story licensing conversations.
- A part-time hire (a customer-support or educator-outreach role) if workload demands it.

---

## 7. What to measure

Right now Analytics shows traffic but not money. Add these so each decision has evidence. Use Cloudflare Web Analytics for traffic (it stays cookieless), Stripe's own reports for payments, and campaign tags on every email and YouTube link.

| Question | Measure |
|---|---|
| Is the audience growing? | Monthly visitors; returning visitors; traffic by source |
| Are visitors becoming a list? | Sign-up rate by page and by source; confirmation rate (double opt-in) |
| Is the list healthy? | Open and click rates; unsubscribes; list size |
| Is content turning into money? | Orders and revenue per source page; paid orders per 1,000 visitors |
| Which offers work? | Conversion by product; refund rate; repeat purchase rate |
| Is the institutional route real? | Workshop and licence leads; quote-to-booking rate; repeat bookings |
| Are we on goal? | Monthly revenue by stream; share of the largest stream |

Review monthly. Change at most one thing at a time, so results can be traced.

---

## 8. Risks and constraints

- **Children's privacy.** The site is for children but sells to adults. Keep sign-up, payment and contact forms clearly adult-facing, keep the site cookieless, and have the Privacy page reviewed before taking payments. The double opt-in work already helps.
- **Payments and tax.** Digital goods, sales tax and refunds have rules that depend on where buyers live. Use Stripe's tax tools or a merchant of record, and get advice before volume grows.
- **Name conflicts.** Several game and brand names still need clearance; a product built on a name we cannot keep is a loss. See `docs/name-clearance.md`.
- **A real unrelated site shares the domain name.** The `robots.txt` note records that another site already lives at chikescreativespace.com. Settle exactly which site customers will find before opening search.
- **Dependence on one platform.** Amazon, YouTube and Stripe each hold part of the business. The email list and the site are the assets we control.
- **Owner time.** One person making episodes, games, activities and a business. Every stage above should reduce work per dollar, never increase it. Say no to ideas that need weekly manual effort.

---

## 9. Decisions needed from you

| # | Decision | Why it matters |
|---|---|---|
| D1 | When do we open the site to search engines? | Free traffic is capped until we do. Opening it means removing the `Disallow` and `noindex` together and settling the domain question first. |
| D2 | What is the income goal and by when? | The mix in section 3 is sized for about $2,000 a month; a higher or lower target changes which stages matter. |
| D3 | Payments: Stripe Payment Links, or a full checkout? | Payment Links are fastest for the first products; a full checkout is needed for a cart and bundles. |
| D4 | Stay "not affiliate" on supply links? | It is a trust positive today. Changing it adds some income and needs a visible disclosure. |
| D5 | Do you want to teach workshops yourself, or license the material for others to run? | Decides whether income scales with your hours or not. |
| D6 | The business is an LLC. Do we also want a fiscal sponsor or a separate nonprofit? | An LLC alone cannot take most grants, and donations to it are not tax-deductible for the giver. |

---

## 10. The first three steps

1. **Connect Stripe and sell two printable packs.** The packs, the cart and the pages exist; this is the shortest path from zero to the first dollar, and it tests real demand.
2. **Deploy the double opt-in functions** and add a welcome series that ends in the first paid pack.
3. **Decide D1**, then add the tracking in section 7, so every later decision is based on numbers instead of guesses.
