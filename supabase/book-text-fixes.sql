-- Book text fixes, applied to the live database on 2026-11-02. Safe to re-run: each update only matches the old text.
--
-- 1. Mateo and the Floating Train: the closing page was left over from an older story about a city.
-- 2. Zech's Windmill Power: the closing page was left over from an older train story; it now has the same
--    "What ... learned" heading as the other books.
-- 3. Kiyah's Garden of Tiny Clues: her name was spelled "Kylah" throughout, and the cover's description read
--    "Gargen of Tine Clues". The web address (kylahs-garden-of-tiny-clues) and image file names are unchanged.

update stories set data = jsonb_set(jsonb_set(data,
    '{pages,8,layers,0,content}', '"What Mateo and Chike learned"'),
    '{pages,8,layers,1,content}', to_jsonb('“We didn’t need a bridge,” Mateo said. “We just needed to understand how magnets push.”'::text))
where id = 'story-city-that-sank' and data->'pages'->8->'layers'->1->>'content' like '%still my city%';

update stories set data = jsonb_set(data, '{pages,8,layers}', jsonb_build_array(
    '{"h": 10, "w": 80, "x": 10, "y": 20, "id": "ly-windmill-learned-tag", "type": "text", "align": "left", "color": "", "style": "tag", "locked": false, "content": "What Zech learned"}'::jsonb,
    (data->'pages'->8->'layers'->0) || jsonb_build_object('x', 10, 'y', 35, 'content', '“The wind was there all along,” Zech said. “I just had to build something that could catch it.”')))
where id = 'story-train-with-no-signals' and data->'pages'->8->'layers'->0->>'content' like 'Rules are easier%';

update stories set data = (replace(replace(data::text, 'Kylah', 'Kiyah'),
    '"alt": "Kiyah''s Gargen of Tine Clues', '"alt": "Kiyah''s Garden of Tiny Clues'))::jsonb
where id = 'story-drawing-nobody-understood' and (data::text like '%Kylah%' or data::text like '%Gargen of Tine Clues"%');
