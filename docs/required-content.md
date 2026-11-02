# Required content for a production-ready site

What still needs to be made and uploaded to Chike's Creative Space, in priority order.
Checked against the live database and the files in this project on November 2, 2026.

Already complete: articles, characters, the AI lessons and the Subscriber's Portal.

---

## 1. Shop downloads (most urgent)

All 6 published products point to PDF files that don't exist. On the live site, the download opens the homepage instead of a file, so the two free downloads are broken today.

| Product | Price | Pages promised | File it expects |
| --- | --- | --- | --- |
| The Make It Real Starter Pack | Free | 24 | `assets/printables/starter-pack.pdf` |
| The Grown-Up Guide | Free | 18 | `assets/printables/grown-up-guide.pdf` |
| Treehouse Build Cards | $9 | 32 | `assets/printables/treehouse-build-cards.pdf` |
| The Story Starter Deck | $8 | 20 | `assets/printables/story-starter-deck.pdf` |
| Creative Strength Poster Set | $7 | 8 | `assets/printables/strength-posters.pdf` |
| The Create-a-Day Calendar | $6 | 14 | `assets/printables/create-a-day.pdf` |
| Pop-Up STEM Workshop Kit (draft) | $24 | 40 | none yet |

- [ ] Write and design each PDF above
- [ ] A product image or cover for all 7 products (none has one)
- [ ] Connect checkout (Stripe) so paid items can be bought. This is the only open item in the launch readiness tracker.

## 2. Book pictures

The published books are now storyboarded: every story page has its own picture of its own moment, wide pictures
under the text and a tall full-page picture for each payoff, made in Higgsfield from the character sheets
(`assets/books/<book>/`, applied by `supabase/book-storyboards.sql`). Page colors are light tints of each picture.

- [x] A picture for every story page in the seven published books (the character portraits on some pages were replaced with real scenes)
- [x] Chike and Zech's Space Adventure: its pictures now live on this site instead of the old GoDaddy site
- [ ] Card image for the 6 books without one (their Read cards could use each book's payoff picture)
- [ ] The Missing Golden Leaf (draft): write and illustrate the whole book. It has no pages yet.

## 3. Activity videos

Every activity's video link only opens the YouTube channel's home page.

- [ ] A how-to video for each of the 22 published activities, or hide the link until one exists

Published activities: The Story Stage, The Library Book Portal Submarine, The Cardboard City Rescue, Make a Clay Volcano, Coral Reef Drawing, The Family Flag, How to Draw a Bee, The Country Line-Dance, The Bottle-Cap Marble Run, The Nature Color Wheel, Draw a Map of Your Neighborhood, The Desk-Top Solar System, How to Make a Paper Glider, The Pop-Up Jungle Book, The Rainy-Day Drumbeat, The Recycled Robot Friend, The Rubber-Band Guitar, The Wind-Powered Sail Car, The Shadow Puppet Theater, The Story Cube Storm, The Mystery in the Storybook, Draw the Treehouse You Would Build.

## 4. Printables

Activities with no printable (made November 2, with the character who leads each one; linked by
`supabase/offline-games-pictures.sql`):

- [x] Make a Clay Volcano: a volcano eruption log
- [x] The Country Line-Dance: a line-dance step chart
- [x] Draw a Map of Your Neighborhood: a map-maker sheet

Offline games with no printable (each game page now has a printable button):

- [x] The Bridge Challenge: a load log
- [x] Draw What I Say: picture cards
- [x] Freeze and Swap: call cards
- [x] Materials Mashup: challenge cards
- [x] Sound Scavenger Hunt: a checklist
- [x] Story Relay: story-starter cards

Upgrade (lower priority):

- [ ] Add character art to the 21 existing activity printables. Today each is a plain one-page sheet with a header, a heading and a grid.

## 5. Offline games section

The six offline games: The Bridge Challenge, Draw What I Say, Freeze and Swap, Materials Mashup, Sound Scavenger Hunt and Story Relay.

- [x] Branded cover art with Chike and friends for all 6 (`assets/games/offline/<game>.jpg`)
- [x] "How to play" pictures for each game: a small picture beside every rule that opens large on a click
  (`assets/games/offline/<game>/rule-N.jpg`)

## 6. Episodes not yet made

- [ ] The Pop-Up Jungle Book (approved)
- [ ] The Ballet Story Stage (draft)
- [ ] The Library Book Portal (draft)
- [ ] The Coral Reef Drawing (draft)
- [ ] The Rainy-Day Drumbeat (draft)
- [ ] The Country Line-Dance Barn (draft)
- [ ] The Backyard Sound Song (draft)
- [ ] The Mystery in the Storybook (draft)
- [ ] The Dinosaur Toy Trail (in review)
- [ ] The Toy Train Mystery (in review)

## 7. Activity step pictures (nice to have)

- [x] The site change: a step can have its own small picture (left of the words) that opens large, with arrows
  to move through the steps. An activity record takes them as `stepPictures` (`[{ src, full, alt }]`, one per step).
- [x] Stacey's Water-Glass Xylophone (finder activity, rewritten from the Rubber Band Sound Lab so it no longer
  repeats The Rubber-Band Guitar) has a main picture and a picture for every step
- [ ] Pictures for the steps of the 22 published activities (130 steps). The Rubber-Band Guitar is first.

## 8. Draft activities to finish

- [ ] Make an Origami T-Rex: a picture and a folding diagram printable
- [ ] The Weather-Watcher Kite: more steps (it has 2), a printable, and its own picture instead of a placeholder stock image
- [ ] Freeze-Frame Feelings: its own picture instead of a placeholder stock image
- [ ] The Backyard Sound Song: a picture
- [ ] The Toy Train Signal Station: a picture
