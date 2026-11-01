-- Chike's Creative Space - AI Lesson 04: Make a Picture Puzzle Game (Subscriber's Portal, saved as a draft).
-- Started with Copilot; the example (Pic Pop Puzzle, made with AI from this exact prompt) is portal_game_files row
-- pg-picture-puzzle, shown at the top of the lesson. The admin reviews and publishes it in the editor.
-- Safe to re-run: it replaces the entry with this text, so edits made in the editor belong here too.

insert into portal_entries (id, data) values ('port-mvxnxdib-9', jsonb_build_object(
  'id', 'port-mvxnxdib-9',
  'slug', 'how-to-build-your-own-puzzle-game',
  'layout', 'lesson',
  'category', 'AI lessons',
  'status', 'draft',
  'publishedAt', '2026-11-01',
  'title', 'AI Lesson 04: Make a Picture Puzzle Game',
  'description', 'Use AI to build a puzzle game that turns any picture into a puzzle, with a timer, a Peek button and confetti when you finish.',
  'cover', jsonb_build_object('src', '', 'alt', ''),
  'body', $b$<h3>Turn any picture into a puzzle</h3><p>This time, you are going to ask AI to build a puzzle game. You pick a picture, the game cuts it into square pieces and mixes them up, and you put it back together by swapping pieces. You choose how hard it is, from Easy (9 pieces) to Wizard (36), and a timer, a move counter and a progress bar show how you are doing.</p><h3>Your picture stays with you</h3><p>The prompt asks for a game where your picture stays on your computer and is never sent anywhere. That is a smart thing to ask for whenever you make something with your own photos. It also asks for 3 pictures drawn by the computer, so you can play right away.</p><h3>Be the puzzle tester</h3><p>When AI has built your game, try everything in the prompt: every size, the Peek button, Shuffle again, and finishing a puzzle. If something is missing or different, tell AI exactly what to fix, like "The pieces don't turn green. Make them turn green when they are in the right spot."</p>$b$,
  'steps', jsonb_build_array(
    'Can you pick a picture from your computer or phone, and does it turn into a puzzle?',
    'Is the picture cut into square pieces and mixed up?',
    'Can you swap pieces by dragging one onto another, or by tapping one and then another on a phone?',
    'Can you play with just the keyboard: arrow keys to move around, Enter to pick up a piece, and arrow keys to slide it into place?',
    'Does a piece turn green and stay put when it lands in the right spot?',
    'Can you pick Easy, Medium, Hard or Wizard?',
    'Is there a timer, a move counter and a bar that fills up as you place pieces?',
    'Does Peek show the whole picture for 2 seconds, and does Shuffle again mix the pieces up?',
    'Are there 3 pictures you can play with right away?',
    'When you finish, do you get confetti and a big "You did it!" with your time and moves?'
  ),
  'vocabWord', '2D spatial awareness',
  'vocabSay', 'too-DEE SPAY-shul uh-WAIR-ness · noun',
  'vocabMeaning', 'Knowing where things are on a flat surface, and seeing how the pieces fit together to make a whole picture.',
  'vocabExample', 'My 2D spatial awareness helped me finish the puzzle: the sky pieces go at the top and the grass pieces go at the bottom!',
  'aiPromptTitle', '', 'aiPromptTip', '',
  'aiPrompt', $p$🧩 Pic Pop Puzzle!
Make a fun picture puzzle game in one HTML file called puzzle.html, so I can open it in my browser by double-clicking it. Put all the HTML, CSS and JavaScript in that one file.

🌟 How to win:
• Put every piece back in its right spot to finish the picture.
• When I finish, confetti falls and a big "You did it!" message shows my time and how many moves I made.

🧩 How to play:
• I pick any picture from my computer or phone, and the game turns it into a puzzle.
• The picture gets cut into square pieces, and the pieces get mixed up.
• I drag one piece on top of another to swap them. On a phone, I tap one piece, then tap another.
• I can play with just the keyboard too: the arrow keys move around the board, Enter picks up a piece, the arrow keys slide it into place, and Enter puts it down.
• When a piece lands in the right spot, it turns green and stays there.
• I pick how many pieces I want: Easy (9), Medium (16), Hard (25) or Wizard (36).
• A "Peek" button shows the whole picture for 2 seconds.
• A "Shuffle again" button mixes the pieces up again.
• It comes with 3 pictures drawn by the computer, so I can play right away, even if I don’t have a photo handy.

🎨 How it looks:
• Bright, colorful and fun, with big round buttons.
• A timer, a move counter, and a bar that fills up as I place pieces.

🔒 My pictures stay private:
• My picture stays on my computer and is never sent anywhere.

📚 Help me learn:
• Explain each part in simple words, so I can learn how it works!$p$,
  'email', jsonb_build_object('on', true, 'subject', 'New AI Lesson: Make a Picture Puzzle Game',
    'preview', 'Turn any picture into a puzzle with AI.',
    'message', 'Our newest AI lesson is here! Kids write one clear prompt and AI builds a puzzle game that turns any picture into a puzzle, with a timer, a Peek button and confetti when they finish.' || chr(10) || chr(10) || 'It is a fun way to learn how detailed instructions help AI build exactly what you want, and why it is smart to ask that your photos stay on your own computer. Come and take a look!',
    'button', 'Take a look'),
  'howToPlay', '[]'::jsonb, 'gallery', '[]'::jsonb, 'coverStill', '',
  'gameId', '', 'gamePath', '', 'gameMode', 'launch', 'gameLabel', '', 'privateGameId', 'pg-picture-puzzle', 'privateGameKb', 543,
  'bookId', '', 'bookMode', 'launch', 'bookPath', '', 'videoUrl', '',
  'buttonLabel', '', 'buttonUrl', '', 'textFirst', 'after', 'adminNote', '',
  'createdAt', '2026-11-01T10:03:54.659Z', 'updatedAt', '2026-11-01T12:00:00.000Z'))
on conflict (id) do update set data = excluded.data, updated_at = now();
