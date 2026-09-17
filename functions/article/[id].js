import { renderWithOg } from "../_shared/og.js";

export const onRequest = (context) => renderWithOg(context, {
  table: "articles",
  titleKey: "title",
  descKey: "blurb",
  imageKey: "image.src",
  fallbackTitle: "Chike's Creative Space"
});
