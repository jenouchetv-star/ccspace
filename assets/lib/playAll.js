// Chike's Creative Space - "Play all" episode playlist
//
// The Watch page's Play all button plays every published episode, in order,
// from Episode 1 through the newest, then loops back to Episode 1. This file is
// only the part that decides WHICH episode plays and WHAT comes next. It has
// no dependency on YouTube, the DOM or the database, so index.html imports it
// for the live site and test/playAll.test.js imports the very same code.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** The episodes Play all can actually play: published, with a real YouTube
    id, ordered by episode number (1 first, newest last). Draft, archived and
    still-in-production episodes are left out. The input is not changed. */
export function playAllOrder(videos) {
  return (videos || [])
    .filter((v) => v && v.status === "published" && VIDEO_ID.test(String(v.youtubeId || "")))
    .slice()
    .sort((a, b) => (a.episode || 0) - (b.episode || 0));
}

/** The position after `index` (dir = 1) or before it (dir = -1) in a list of
    `length` episodes, wrapping at both ends: the end goes back to the start,
    and Previous on the first episode goes to the last. */
export function playAllStep(index, length, dir) {
  if (!length || length < 1) return 0;
  const step = dir < 0 ? -1 : 1;
  return (((index + step) % length) + length) % length;
}
