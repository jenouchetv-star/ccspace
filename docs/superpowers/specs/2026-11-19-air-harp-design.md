# Air Harp: design

Owner request (2026-11-19): a digital harp built and played with both hands through the camera. Subscribers only.
Approved screen: `docs/mockups/air-harp-draft.html` (untracked draft). "Air Harp" is a working name.

## Why
Kids make their own digital instrument, and learn the real rule of strings on the way: the longer the string,
the lower the note.

## What it does (owner's calls)
- Pinch thumb and pointer finger together with BOTH hands to stretch a new string between the two pinches.
- Up to 8 strings.
- Each string has a round ball on each end; pinch a ball and pull to resize the string. The string can be played
  while it is being resized (one hand holds a ball, the other strums), so the note changes as you pull.
- Longer string = lower note, shorter = higher.
- Always in tune: whatever lengths you make, it sounds musical.
- Sound like an acoustic harp or guitar: real harp recordings plus a guitar made in code (option 2), with a
  Harp / Guitar switch.
- Strum speed sets loudness: slow is soft, fast is loud.
- A plucked string vibrates and sends soft, translucent, water-ripple rings in its own color spreading around it.

## My calls (played back to the owner, not objected to)
- Pitch follows real string physics, then snaps to a C major pentatonic scale (C D E G A) from C3 to C6, so any
  set of strings sounds good together. Raw pitch: midi = 84 - 12 * log2(length / shortest), shortest = 8% of the
  stage diagonal; lengths longer than that are clamped to the lowest note.
- Playing: an open hand's pointer fingertip sweeping across a string plucks it. Pinch is only for building.
- A fast strum is also a little brighter, not only louder.
- Remove a string: pinch a ball and fling it off the stage (or drag it off with the mouse). "Clear" empties it.
- Same look and camera setup as Hands-Free Builder: dark by default, light/dark switch, both digital hands
  visible, gestures always listed, video never shown, the page asks for the camera through the site.
- Chike in a small face circle with short reactions (start, first string, first pluck, full harp, removed string).
- No camera: mouse or touch. Press on empty stage and drag to make a string; drag a ball to resize or off the
  stage to remove; press on a string and drag across strings to strum (speed still sets loudness).
- Opens on the logo loading screen like every game.
- No saving in this version (a sealed portal game can't store reliably).

## Not in this version
Saving harps, recording songs, sharing, a backing track.

## How it ships
One self-contained file `supabase/private-games/air-harp.html` (code, harp recordings and Chike pictures inside),
stored in the Subscriber's Portal (`portal_game_files`), with a portal entry and a members-only Play page row.
Publishing waits for the owner's "publish"; never emailed.
