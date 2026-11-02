-- Chike's Creative Space - AI Lesson 05: Control a Page with Hand Gestures (Subscriber's Portal, published 2026-11-01).
-- Built from the owner's webcam gesture concept, then turned (at the owner's request) from a ball game into a
-- Hands-Free Reader: a book about computer vision whose pages you turn, scroll, like, resize and switch to dark mode
-- with hand gestures. The example at the top of the lesson is portal_game_files row pg-gesture-lab (source
-- supabase/private-games/gesture-lab.html, uploaded from the admin session; re-upload it whenever the file changes
-- and update privateGameKb below). It never shows the camera picture, only the digital hand.
-- Safe to re-run: it replaces the entry with this text, so edits made in the editor belong here too.
-- Nothing here sends an email: the entry's email is switched off. The cover is our own drawing (assets/lessons/hands-free-reader-cover.svg), uploaded to the media library.

insert into portal_entries (id, data) values ('port-ai-lesson-gesture-lab', jsonb_build_object(
  'id', 'port-ai-lesson-gesture-lab',
  'slug', 'how-to-build-a-hands-free-reader',
  'layout', 'lesson',
  'category', 'AI lessons',
  'status', 'published',
  'publishedAt', '2026-11-01',
  'title', 'AI Lesson 05: Control a Page with Hand Gestures',
  'description', 'Use AI to build a page you control without touching anything: swipe to turn the pages of a book, point to scroll, pinch to change the text size, and more.',
  'cover', jsonb_build_object('src', 'https://wdctkfhwygwwulipwnys.supabase.co/storage/v1/object/public/uploads/media/1793593704712-hands-free-reader-cover.svg', 'alt', 'The teal book How Computers See, with a digital hand beside it swiping to turn the page'),
  'body', $b$<h3>Your hand is the remote control</h3><p>This time, you are going to ask AI to build a page you can use without touching your computer. The computer looks through the camera, finds 21 points on your hand (your wrist, every knuckle and every fingertip) and works out which gesture you are making. This is called <b>computer vision</b>. Then each gesture does a job: turn a page, scroll, change the text size, switch to dark mode and more.</p><h3>Four kinds of gestures</h3><p>Try the example above and you will notice that gestures work in different ways. A <b>pose</b>, like thumbs up, is a shape you hold still. A <b>motion</b>, like a swipe, is about how your hand moves. A <b>slider</b>, like pinching for text size, turns how far you move into a number. A <b>pointer</b> uses your fingertip like a mouse. Headsets and smart TVs that you control with your hands mix these same kinds of gestures.</p><h3>Good controls avoid mistakes</h3><p>A page that reacts to every wiggle would be hard to use. That's why you hold a pose until a ring fills up, why moving your hand restarts the ring, and why a fist is a resting hand that does nothing. Thinking about mistakes like these is a big part of designing anything people use.</p><h3>Only your digital hand</h3><p>The prompt asks for a page that never shows or saves your video. It only draws your digital hand: the 21 dots and the lines between them. Ask a grown-up before you turn on a camera, and it is always OK to say no and use the buttons and keys instead.</p><h3>Be the gesture tester</h3><p>When AI has built your page, try every gesture. If it mixes two of them up, tell AI exactly what happens, like "When I swipe with my open hand, it turns on focus mode. Only count the open hand when my hand is still."</p>$b$,
  'steps', jsonb_build_array(
    'Does the page ask before it turns on the camera, and can you use buttons and keys instead?',
    'Do you see your digital hand (dots and lines), and never your video?',
    'Does a swipe to the left turn to the next page, and a swipe to the right turn back?',
    'When you point high or low, does the page scroll up or down?',
    'When you pinch and slide up or down, do the words get bigger or smaller, with a dial on the screen?',
    'Does holding a thumbs-up like the chapter, with a heart?',
    'Does holding a peace sign switch between light and dark mode?',
    'Does holding an open hand still turn focus mode on and off, hiding the side panels?',
    'Does holding "rock on" turn on X-ray, so the whole page shows your digital hand?',
    'Does a ring fill up while you hold a pose, and does a fist do nothing?',
    'Is there a book, with a cover, that teaches what computer vision is and where it is used?'
  ),
  'vocabWord', 'computer vision',
  'vocabSay', 'kum-PYOO-ter VIZH-un · noun',
  'vocabMeaning', 'When a computer uses a camera and AI to understand what it sees, like finding a hand and working out what gesture it is making.',
  'vocabExample', 'Thanks to computer vision, I could turn the pages of my book just by swiping my hand in the air!',
  'aiPromptTitle', '', 'aiPromptTip', '',
  'aiPrompt', $p$🖐️ Hands-Free Reader!
Make a web page I control with hand gestures, in one HTML file called hands-free-reader.html, so I can open it in my browser by double-clicking it. Put all the HTML, CSS and JavaScript in that one file. Use MediaPipe Hands to find my hand in the camera.

📚 What the page is:
• A book called "How Computers See" with a cover and 6 chapters that teach about computer vision: what it is, how pictures are made of numbers, how the AI finds 21 points on a hand, how points turn into gestures, where computer vision is used, and how to keep it fair, safe and private.
• Each chapter is a two-page spread: a title and a drawing on the left, and words I can scroll on the right, with a like button and a heart.
• The pages turn like a real book, swinging around the spine. On a small screen, show one page at a time.

✋ Hand gestures:
• Swipe left or right: turn to the next or last page.
• Point: my fingertip shows a dot on the screen. Point high to scroll up and low to scroll down.
• Pinch and slide up or down: make the words bigger or smaller, with a big dial on the screen.
• Thumbs up (hold): like the chapter.
• Peace sign (hold): switch between light and dark mode.
• Open hand (hold still): focus mode, which hides the side panels so the book fills the screen.
• Rock on (hold): X-ray mode, where the whole page shows my digital hand with the points numbered.
• Fist: a resting hand that does nothing.

🎯 No mistakes:
• Show the name of the gesture the computer sees.
• For the hold gestures, fill up a ring while I hold, and start the ring over if my hand moves.
• Wait a moment after a swipe before another one can happen.

🎨 How it looks:
• Clean and modern, with simple line icons instead of emojis.
• Each gesture in the list is drawn as a little digital hand.
• A list of all the gestures on the side, and buttons and keyboard keys that do the same things.

🔒 My camera stays private:
• Ask before turning on the camera.
• Never show my video. Only draw my digital hand: 21 dots joined by lines.
• My video stays on my computer and is never recorded or sent anywhere.

📚 Help me learn:
• Explain each part in simple words, so I can learn how it works!$p$,
  'email', jsonb_build_object('on', false, 'subject', 'New AI Lesson: Control a Page with Hand Gestures',
    'preview', 'Build a page you control with your hand.',
    'message', 'Our newest AI lesson is here! Kids write one clear prompt and AI builds a page they control without touching anything: swipe to turn the pages of a book, point to scroll, pinch to change the text size, and more.' || chr(10) || chr(10) || 'It is a hands-on way to learn about computer vision and how to design controls that are easy to use, and why it is smart to ask that a camera''s video stays on your own computer. Come and take a look!',
    'button', 'Take a look'),
  'howToPlay', '[]'::jsonb, 'gallery', '[]'::jsonb, 'coverStill', '',
  'gameId', '', 'gamePath', '', 'gameMode', 'launch', 'gameLabel', '', 'privateGameId', 'pg-gesture-lab', 'privateGameKb', 75,
  'bookId', '', 'bookMode', 'launch', 'bookPath', '', 'videoUrl', '',
  'buttonLabel', '', 'buttonUrl', '', 'textFirst', 'after', 'adminNote', '',
  'createdAt', '2026-11-01T22:00:00.000Z', 'updatedAt', '2026-11-02T00:00:00.000Z'))
on conflict (id) do update set data = excluded.data, updated_at = now();
