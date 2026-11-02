-- Zech's Windmill Power: a picture for page 3, so the spread of pages 2 and 3 is no longer two pages of text.
-- Run AFTER assets/books/windmill-power-wind-hill.jpg is live (it ships with the site), or readers see a broken image.
-- Safe to re-run: it only adds the picture if page 3 has none yet.
--
-- The picture is Higgsfield generation 5aeeeed4 (Zech holding the pinwheel, Chike with the LED bulb, Stacey blowing
-- the bamboo tube, wind turbines on the hill), cropped wide. It sits in the bottom half, the same layout as other
-- picture-and-text pages in these books, and the text moves to the top half.

update stories set data = jsonb_set(data, '{pages,2}',
  jsonb_set(data->'pages'->2, '{layers}',
    jsonb_build_array(
      (data->'pages'->2->'layers'->0) || '{"x": 9.788359788359788, "y": 8, "w": 80, "h": 34}'::jsonb,
      '{"h": 50, "w": 100, "x": 0, "y": 50, "id": "ly-windmill-hill", "alt": "Zech holds up his green pinwheel while Stacey blows through a bamboo tube and Chike holds a tiny glowing light bulb, on a green hill with giant wind turbines", "fit": "cover", "src": "/assets/books/windmill-power-wind-hill.jpg", "type": "image", "locked": false, "placement": "bottom-half"}'::jsonb
    )))
where id = 'story-train-with-no-signals'
  and not exists (select 1 from jsonb_array_elements(data->'pages'->2->'layers') l where l->>'type' = 'image');
