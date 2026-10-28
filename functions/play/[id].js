import { renderWithOg } from "../_shared/og.js";

/* /play/<game id>: a shared link or a crawler gets that game's own title, description and cover,
   instead of the home page's. /play/online and /play/offline are not games, so nothing is found for
   them and they are served unchanged. */
export const onRequest = (context) => renderWithOg(context, {
  table: "games",
  titleKey: "title",
  descKey: "summary",
  imageKey: "cover.src",
  fallbackTitle: "Chike's Creative Space"
});
