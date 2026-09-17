import { renderWithOg } from "../_shared/og.js";

export const onRequest = (context) => renderWithOg(context, {
  table: "videos",
  titleKey: "title",
  descKey: "description",
  imageKey: "thumb.src",
  fallbackTitle: "Chike's Creative Space"
});
