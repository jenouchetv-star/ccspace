# Matching Suits: design (owner's PRD + drafts, 2026-11-17)

Source: owner's PRD (Downloads/matching_suits_product_requirements_document.md). Drafts the owner approved ("build it"):
docs/mockups/matching-suits-draft.html (screens) and docs/mockups/matching-suits-3d-draft.html (3D table, kids' casino style).

## What it is
A subscribers-only family card game for 2 to 4 players (people and robots). A shared screen (TV, laptop, tablet;
mirrored to a Roku if they like) shows the 3D card table; each player joins on their own phone, tablet or computer and
holds their cards there, privately. Chike sits in the corner and says what to do next.

## Rules (from the PRD)
- 52 cards, 13 slots A..K. Each player gets 5 cards; the rest is the face-down draw pile.
- Heart Race: everyone reveals their highest heart (A low, K high); highest goes first. No hearts anywhere: the
  highest card overall goes first (ties: spades, hearts, diamonds, clubs).
- Free choice: the player drops ALL cards of any rank they hold onto its slot, then draws 1 (while the pile lasts).
- Following: the next player clockwise must drop all their cards of the active rank (then draw 1), or pass (no draw).
- 4/4: the 4th card of a rank flips the stack face down and gives that player a bonus turn (free choice).
- Everyone passes back to the last player who dropped: the chain breaks and that player gets a free choice.
- Once the pile is empty there is no drawing. First player with no cards wins; the rest rank by cards left.

## Decisions (mine, the owner can change them)
- Room code: 4 letters without I or O. Phones open /games/matching-suits-player.html?room=CODE (QR), or
  chikescreativespace.com/join on another computer. Supabase Realtime broadcast, channel "matchingsuits-CODE", the same
  way the Lunar phone remote works. The table screen is the referee: it holds the deck and sends each phone its own hand.
- Names: typed on the phone, or "Player #N" (N = seat). Robots: Robo, Bolt, Sprocket.
- Heart Race: each phone taps "Show my highest heart" (the game picks it); robots show at once.
- A phone that drops off keeps its seat; reopening the link rejoins it.
- Look: Three.js table from the 3D draft; Chike's lines change with every moment of play.
