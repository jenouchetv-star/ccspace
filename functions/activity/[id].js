import { renderWithOg } from "../_shared/og.js";

export const onRequest = (context) => renderWithOg(context, {
  table: "activities",
  titleKey: "title",
  descKey: "summary",
  imageKey: "image.src",
  fallbackTitle: "Chike's Creative Space"
});
