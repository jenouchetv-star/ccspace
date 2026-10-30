-- Balloon Pop Math: new cover picture (the rebuilt game, with Chike's chalkboard), so its description changes too.
-- Run once in the Supabase SQL Editor (safe to run again).
update games set data = jsonb_set(data, '{cover,alt}', to_jsonb($a$Striped hot-air balloons with numbers float across a blue sky in Balloon Pop Math, while Chike points to his chalkboard and works out 39 + 49 in columns$a$::text)), updated_at = now()
where id = 'game-balloon-math';
